import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.argv[2] || 'http://127.0.0.1:8787').origin;
async function request(path, data, cookie, origin = base) {
  const response = await fetch(base + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? {cookie} : {}), ...(data !== undefined ? {'content-type':'application/json', origin} : {}) },
    ...(data !== undefined ? {body:JSON.stringify(data)} : {}),
  });
  return {status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const health = await request('/api/health');
assert.equal(health.status,200); assert.equal(health.body.database,'connected');
assert.equal((await request('/api/session',{},undefined,'https://example.invalid')).status,403);
assert.equal((await request('/api/transactions')).status,401);
const a = await request('/api/session',{}); const b = await request('/api/session',{});
assert.equal(a.status,201); assert.equal(b.status,201); assert.notEqual(a.cookie,b.cookie);
const entry = {type:'expense',amount:'30.00',date:'2026-11-14',category:'transport',description:'POC smoke: rickshaw'};
const save = {requestId:randomUUID(),draftId:null,entry};
const attempts = await Promise.all([request('/api/transactions',save,a.cookie),request('/api/transactions',save,a.cookie)]);
assert.ok(attempts.every(result=>[200,201].includes(result.status)),JSON.stringify(attempts.map(x=>x.body)));
assert.equal(attempts[0].body.transaction.id,attempts[1].body.transaction.id);
assert.equal((await request('/api/transactions',{...save,entry:{...entry,amount:'99'}},a.cookie)).status,409);
assert.equal((await request('/api/transactions',{requestId:randomUUID(),draftId:null,entry:{...entry,amount:'0'}},a.cookie)).status,400);
assert.equal((await request('/api/transactions',{requestId:randomUUID(),draftId:randomUUID(),entry},b.cookie)).status,400);
const one = await request('/api/transactions?month=2026-11',undefined,a.cookie);
const two = await request('/api/transactions?month=2026-11',undefined,b.cookie);
assert.equal(one.body.transactions.length,1); assert.equal(one.body.summary.expenses,3000);
assert.equal(two.body.transactions.length,0); assert.equal(two.body.summary.expenses,0);
const income = await request('/api/transactions',{requestId:randomUUID(),draftId:null,entry:{...entry,type:'income',amount:'15000',category:'salary',description:'POC smoke: salary'}},a.cookie);
assert.equal(income.status,201);
const totals = await request('/api/transactions?month=2026-11',undefined,a.cookie);
assert.equal(totals.body.summary.income,1500000); assert.equal(totals.body.summary.expenses,3000);
console.log('PASS: D1 health, origin protection, session isolation, validation, concurrent idempotency, and exact SQL totals');
if(process.argv.includes('--ai')) {
  const parseRequest = {requestId:randomUUID(),text:'Spent 30 Rs on Rickshaw to work today'};
  const parsed = await request('/api/parse',parseRequest,a.cookie);
  assert.equal(parsed.status,200,JSON.stringify(parsed.body));
  assert.equal(parsed.body.status,'candidate',JSON.stringify(parsed.body));
  assert.equal(parsed.body.entry.type,'expense'); assert.equal(parsed.body.entry.amount.replace(/\.0+$/,''),'30'); assert.equal(parsed.body.entry.category,'transport');
  const replay = await request('/api/parse',parseRequest,a.cookie);
  assert.equal(replay.body.draftId,parsed.body.draftId);
  const stolen = await request('/api/transactions',{requestId:randomUUID(),draftId:parsed.body.draftId,entry:parsed.body.entry},b.cookie);
  assert.equal(stolen.status,400);
  const confirm = {requestId:randomUUID(),draftId:parsed.body.draftId,entry:parsed.body.entry};
  const saved = await request('/api/transactions',confirm,a.cookie);
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal((await request('/api/transactions',confirm,a.cookie)).body.transaction.id,saved.body.transaction.id);
  const missing = await request('/api/parse',{requestId:randomUUID(),text:'Spent on lunch today'},a.cookie);
  assert.ok(['clarify','unsupported'].includes(missing.body.status),JSON.stringify(missing.body));
  console.log('PASS: live Workers AI extraction, replay without inference, confirmation, draft ownership, and missing-amount handling');
} else if(health.body.ai==='disabled') {
  const parsed = await request('/api/parse',{requestId:randomUUID(),text:'Spent 30 on lunch'},a.cookie);
  assert.equal(parsed.status,503);
  console.log('PASS: AI-disabled fallback leaves manual ledger functional');
}
const home = await fetch(base+'/'); assert.equal(home.status,200);
assert.ok((await home.text()).includes('Money Tracker'));
console.log(`PASS: static frontend served with same-origin API at ${base}`);
