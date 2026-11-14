import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

// Compile the real Worker; this test adds no login bypass to production code.
await mkdir('.wrangler/auth-tests',{recursive:true});
const bundle=await build({entryPoints:['worker/index.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false});
await writeFile('.wrangler/auth-tests/worker.mjs',bundle.outputFiles[0].text);
const {default:worker}=await import('../.wrangler/auth-tests/worker.mjs');
class LocalD1 {
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec('PRAGMA foreign_keys=ON');}
  prepare(sql){
    const db=this.sqlite;let args=[];
    return {bind(...values){args=values;return this;},async all(){
      const results=db.prepare(sql).all(...args);
      return {results,success:true,meta:{changes:Number(db.prepare('SELECT changes() AS n').get().n),last_row_id:Number(db.prepare('SELECT last_insert_rowid() AS n').get().n)}};
    },async first(column){const row=(await this.all()).results[0]??null;return column&&row?row[column]:row;},async run(){return this.all();}};
  }
  async batch(statements){this.sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.all());this.sqlite.exec('COMMIT');return result;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
  async exec(sql){this.sqlite.exec(sql);return {count:1,duration:0};}
}
async function setup(){
 const db=new LocalD1();
 for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('migrations/'+file,'utf8'));
 const secret=randomBytes(32).toString('base64');
 const env={DB:db,BETTER_AUTH_URL:'http://localhost:8787',BETTER_AUTH_SECRET:secret,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only',AI_ENABLED:'false',ASSETS:{fetch:()=>new Response('assets')}};
 const now=new Date().toISOString();
 function createUser(id){db.sqlite.prepare('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(id,id,id+'@example.test',1,now,now);}
 function createSession(user,expired=false){
   const token=randomBytes(32).toString('hex');const sid=randomUUID();
   db.sqlite.prepare('INSERT INTO "session"(id,expiresAt,token,createdAt,updatedAt,userId) VALUES(?,?,?,?,?,?)').run(sid,new Date(Date.now()+(expired?-60000:86400000)).toISOString(),token,now,now,user);
   const signature=createHmac('sha256',secret).update(token).digest('base64');
   return {sid,cookie:'money-tracker.session_token='+encodeURIComponent(token+'.'+signature)};
 }
 async function call(path,{data,cookie,origin='http://localhost:8787'}={}){
   const req=new Request('http://localhost:8787'+path,{method:data===undefined?'GET':'POST',headers:{"cf-connecting-ip":"127.0.0.1",...(cookie?{cookie}:{}),...(data===undefined?{}:{origin,'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
   return worker.fetch(req,env,{});
 }
 return {db,env,createUser,createSession,call};
}
test('anonymous and old browser cookies cannot access ledgers or create a session',async()=>{
 const {call}=await setup();
 assert.equal((await call('/api/transactions')).status,401);
 assert.equal((await call('/api/parse',{data:{text:'Salary 100',requestId:randomUUID()}})).status,401);
 assert.equal((await call('/api/transactions',{cookie:'mt_poc='+'a'.repeat(64)})).status,401);
 assert.equal((await call('/api/session',{data:{}})).status,410);
});
test('same account across independent sessions shares records; different users remain isolated',async()=>{
 const {call,createUser,createSession,db}=await setup();createUser('alice');createUser('bob');
 const a=createSession('alice'),a2=createSession('alice'),b=createSession('bob');
 const session=await (await call('/api/session',{cookie:a.cookie})).json();
 assert.equal(session.user?.id,'alice',JSON.stringify(session));assert.equal(session.user.token,undefined);
 const entry={type:'income',amount:'15000',date:'2026-11-14',category:'salary',description:'Salary'};
 const payload={requestId:randomUUID(),draftId:null,entry};
 const saved=await call('/api/transactions',{data:payload,cookie:a.cookie});
 assert.equal(saved.status,201,await saved.clone().text());
 assert.equal((await call('/api/transactions',{data:payload,cookie:a2.cookie})).status,200);
 const same=await (await call('/api/transactions?month=2026-11',{cookie:a2.cookie})).json();
 const other=await (await call('/api/transactions?month=2026-11',{cookie:b.cookie})).json();
 assert.equal(same.transactions.length,1);assert.equal(same.summary.income,1500000);assert.equal(other.transactions.length,0);
 const draftId=randomUUID();
 db.sqlite.prepare('INSERT INTO ledger_parses(id,user_id,request_id,day,input,result,created_at) VALUES(?,?,?,?,?,?,?)').run(draftId,'alice',randomUUID(),'2026-11-14','test',JSON.stringify({status:'candidate',entry}),Date.now());
 assert.equal((await call('/api/transactions',{data:{...payload,requestId:randomUUID(),draftId},cookie:b.cookie})).status,400);
 const logout=await call('/api/auth/sign-out',{data:{},cookie:a.cookie});assert.equal(logout.status,200);
 assert.equal((await call('/api/transactions',{cookie:a.cookie})).status,401);
 assert.equal((await call('/api/transactions',{cookie:a2.cookie})).status,200);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ledger_transactions').get().n,1);
});
test('expired/tampered sessions and cross-origin changes are rejected; account records survive expiry',async()=>{
 const {call,createUser,createSession,db}=await setup();createUser('alice');
 const a=createSession('alice'),expired=createSession('alice',true);
 const saved=await call('/api/transactions',{cookie:a.cookie,data:{requestId:randomUUID(),draftId:null,entry:{type:'expense',amount:'30',date:'2026-11-14',category:'transport',description:'Retained after session expiry'}}});
 assert.equal(saved.status,201);
 assert.equal((await call('/api/transactions',{cookie:expired.cookie})).status,401);
 assert.equal((await call('/api/transactions',{cookie:a.cookie+'tamper'})).status,401);
 assert.equal((await call('/api/transactions',{cookie:a.cookie,origin:'https://evil.example',data:{}})).status,403);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM "user"').get().n,1);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ledger_transactions').get().n,1);
});
test('Google authorization starts with state and correct redirect; unsafe callback destinations and missing state are rejected',async()=>{
 const {call}=await setup();
 const response=await call('/api/auth/sign-in/social',{data:{provider:'google',callbackURL:'http://localhost:8787/chat/'}});
 assert.equal(response.status,200,await response.clone().text());
 const {url}=await response.json();const destination=new URL(url);
 assert.equal(destination.origin,'https://accounts.google.com');assert.equal(destination.searchParams.get('redirect_uri'),'http://localhost:8787/api/auth/callback/google');assert.ok(destination.searchParams.get('state'));
 assert.ok(response.headers.get('set-cookie'));
 assert.ok((await call('/api/auth/sign-in/social',{data:{provider:'google',callbackURL:'https://evil.example'}})).status>=400);
 const callback=await call('/api/auth/callback/google?code=untrusted&state=missing');
 assert.notEqual(callback.headers.get('set-cookie')?.includes('session_token='),true);
});
test('missing OAuth credentials fails closed with no anonymous fallback',async()=>{
 const {env,call}=await setup();delete env.GOOGLE_CLIENT_SECRET;
 const session=await (await call('/api/session')).json();assert.equal(session.configured,false);assert.equal(session.user,null);
 assert.equal((await call('/api/auth/sign-in/social',{data:{provider:'google'}})).status,503);
 assert.equal((await call('/api/transactions')).status,401);
});

test('password signup and signin are disabled: Google is the only identity provider',async()=>{
 const {call,db}=await setup();
 for(const path of ['/api/auth/sign-up/email','/api/auth/sign-in/email']) {
   const response=await call(path,{data:{name:'No password account',email:'password@example.test',password:'not-a-real-password-123'}});
   assert.ok(response.status>=400);
 }
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM "user"').get().n,0);
});

test('monthly reports and CSV reconcile beyond list limit and isolate users/months',async()=>{
 const {call,createUser,createSession,db}=await setup();createUser('alice');createUser('bob');
 const a=createSession('alice'),b=createSession('bob');
 function insert(user,entry){
  const id=randomUUID();
  const minor=Math.round(Number(entry.amount)*100);
  db.sqlite.prepare('INSERT INTO ledger_transactions(id,user_id,request_id,source_parse_id,type,amount_minor,date,category,description,payload,created_at) VALUES(?,?,?,NULL,?,?,?,?,?,?,?)')
   .run(id,user,randomUUID(),entry.type,minor,entry.date,entry.category,entry.description,JSON.stringify(entry),Date.now());
 }
 const expense={type:'expense',amount:'1.00',date:'2026-11-15',category:'dining',description:'Lunch'};
 for(let i=0;i<101;i++)insert('alice',expense);
 insert('alice',{...expense,amount:'2.50',date:'2026-11-01',category:'transport',description:'=1+1'});
 insert('alice',{type:'income',amount:'1000',date:'2026-11-01',category:'salary',description:'Salary'});
 insert('alice',{...expense,date:'2026-10-31',amount:'55'});
 insert('bob',{...expense,amount:'999'});
 db.sqlite.prepare('INSERT INTO ledger_parses(id,user_id,request_id,day,input,result,created_at) VALUES(?,?,?,?,?,?,?)')
  .run(randomUUID(),'alice',randomUUID(),'2026-11-15','Unconfirmed',JSON.stringify({status:'candidate',entry:expense}),Date.now());
 const report=await(await call('/api/reports?month=2026-11',{cookie:a.cookie})).json();
 assert.equal(report.transactions.length,100);
 assert.deepEqual(report.summary,{income:100000,expenses:10350});
 assert.equal(report.report.categories.reduce((n,r)=>n+r.amount_minor,0),10350);
 assert.equal(report.report.days.reduce((n,r)=>n+r.income,0),100000);
 assert.equal(report.report.days.reduce((n,r)=>n+r.expenses,0),10350);
 const exported=await call('/api/export?month=2026-11',{cookie:a.cookie});
 assert.equal(exported.headers.get('content-type'),'text/csv; charset=utf-8');
 const csv=await exported.text();
 assert.equal(csv.trim().split('\r\n').length,104); // header + 103 confirmed entries
 assert.ok(csv.includes('"\'=1+1"'));
 assert.equal(csv.includes('"999.00"'),false);
 assert.equal(csv.includes('2026-10-31'),false);
 const other=await(await call('/api/reports?month=2026-11',{cookie:b.cookie})).json();
 assert.equal(other.summary.expenses,99900);
 const empty=await(await call('/api/reports?month=2026-12',{cookie:a.cookie})).json();
 assert.deepEqual(empty.summary,{income:0,expenses:0});assert.deepEqual(empty.report,{categories:[],days:[]});
 assert.equal((await call('/api/reports?month=2026-13',{cookie:a.cookie})).status,400);
 assert.equal((await call('/api/export?month=bad',{cookie:a.cookie})).status,400);
 assert.equal((await call('/api/reports')).status,401);
 assert.equal((await call('/api/export')).status,401);
});
