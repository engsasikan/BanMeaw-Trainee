import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('work',{recursive:true});
await build({entryPoints:['src/worker.mjs'],outfile:'work/test-worker.mjs',bundle:true,platform:'node',format:'esm',loader:{'.sql':'text'}});
const {handleEntries,default:worker}=await import('../work/test-worker.mjs');
function database(){
 const rows=new Map();
 return async function sql(strings,...v){
  const q=strings.join('?');
  if(q.includes('SELECT payload'))return [...rows.values()].filter(r=>r.user===v[0]).map(r=>({payload:r.payload,revision:r.revision}));
  if(q.includes('INSERT INTO daily_logs')){const [user,id,day,kind,payload]=v,key=user+':'+id;if(rows.has(key))return [];rows.set(key,{user,payload:JSON.parse(payload),revision:1});return [{revision:1}];}
  if(q.includes('UPDATE daily_logs')){const [day,kind,payload,user,id,revision]=v,key=user+':'+id,r=rows.get(key);if(!r||r.revision!==revision)return [];r.payload=JSON.parse(payload);r.revision++;return [{revision:r.revision}];}
  if(q.includes('DELETE FROM daily_logs')){const [user,id,revision]=v,key=user+':'+id,r=rows.get(key);if(!r||r.revision!==revision)return [];rows.delete(key);return [{id}];}
  throw Error('Unexpected query');
 };
}
const meal={id:'meal-1',day:'2026-10-03',meal:'มื้อเช้า',time:'08:00',text:'ข้าว 1 จาน'};
const req=(method,id='',row=undefined,revision=0)=>new Request('https://app.test/api/entries'+(id?'/'+id:''),{method,headers:{'If-Match':String(revision),'Content-Type':'application/json'},body:row?JSON.stringify(row):undefined});
test('create, read, edit, stale revision and delete protect user ownership',async()=>{
 const sql=database(),a={sub:'a'},b={sub:'b'};
 assert.equal((await handleEntries(req('PUT',meal.id,meal),sql,a)).status,200);
 assert.deepEqual((await (await handleEntries(req('GET'),sql,b)).json()).records,[]);
 assert.equal((await handleEntries(req('PUT',meal.id,{...meal,text:'เปลี่ยนแล้ว'},1),sql,a)).status,200);
 assert.equal((await handleEntries(req('PUT',meal.id,meal,1),sql,a)).status,409);
 assert.equal((await handleEntries(req('DELETE',meal.id,undefined,2),sql,b)).status,409);
 assert.equal((await (await handleEntries(req('GET'),sql,a)).json()).records[0].text,'เปลี่ยนแล้ว');
 assert.equal((await handleEntries(req('DELETE',meal.id,undefined,2),sql,a)).status,200);
 assert.deepEqual((await (await handleEntries(req('GET'),sql,a)).json()).records,[]);
});
test('workout validation, ID mismatch and invalid dates reject without writes',async()=>{
 const sql=database(),user={sub:'a'},workout={id:'w1',day:'2026-10-03',kind:'workout',exercise:'Squat',weight:20.5,sets:3,reps:12,notes:''};
 assert.equal((await handleEntries(req('PUT','w1',workout),sql,user)).status,200);
 for(const bad of [{...workout,weight:-1},{...meal,day:'2026-02-31'},{...meal,id:'other'}])assert.equal((await handleEntries(req('PUT',meal.id,bad),sql,user)).status,400);
});
test('unauthenticated requests, wrong origin and missing secrets fail closed',async()=>{
 const env={DATABASE_URL:'postgres://unused',NEON_AUTH_BASE_URL:'https://auth.test/auth'};
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries'),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries/x',{method:'DELETE',headers:{Origin:'https://evil.test'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries'),{})).status,503);
});
