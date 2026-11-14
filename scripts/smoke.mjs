import assert from 'node:assert/strict';
const base=new URL(process.argv[2]||'http://127.0.0.1:8787').origin;
async function request(path,data,origin=base){
 return fetch(base+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'content-type':'application/json',origin},...(data===undefined?{}:{body:JSON.stringify(data)})});
}
const health=await request('/api/health');assert.equal(health.status,200);
assert.equal((await health.json()).mode,'google-account');
const session=await request('/api/session');assert.equal(session.status,200);assert.equal((await session.json()).user,null);
assert.equal((await request('/api/transactions')).status,401);
assert.equal((await request('/api/transactions',{})).status,401);
assert.equal((await request('/api/parse',{})).status,401);
assert.equal((await request('/api/session',{})).status,410);
assert.equal((await request('/api/transactions',{},'https://example.invalid')).status,403);
for(const path of ['/','/chat/','/overview/','/transactions/','/settings/','/login/','/setup/'])assert.equal((await fetch(base+path)).status,200,path);
console.log(`PASS: auth-required API, no anonymous bypass, origin protection, and static routes at ${base}`);
console.log('Authenticated session/isolation checks run in npm test. A real Google sign-in still requires configured OAuth credentials and consent.');
