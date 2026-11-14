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
