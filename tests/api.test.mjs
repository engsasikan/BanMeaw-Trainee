import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('work',{recursive:true});
await build({entryPoints:['src/worker.mjs'],outfile:'work/test-worker.mjs',bundle:true,platform:'node',format:'esm',loader:{'.sql':'text'}});
const {handleEntries,handleTeams,handleAvatar,default:worker}=await import('../work/test-worker.mjs');
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
test('individual set progress can be reloaded, completed and remains private',async()=>{
 const db=database(),sql=async (strings,...values)=>strings.join('').includes('FROM training_plans p')?[{day:'2026-10-04',exercises:[{exercise:'Squat'}]}]:db(strings,...values),user={sub:'trainee'},row={id:'session',day:'2026-10-04',kind:'workout',exercise:'Squat',weight:20,sets:1,reps:12,notes:'',planId:'11111111-1111-4111-8111-111111111111',planExerciseIndex:0,setLogs:[{weight:20,reps:12}],sessionComplete:false};
 assert.equal((await handleEntries(req('PUT',row.id,row),sql,user)).status,200);
 const [saved]=(await (await handleEntries(req('GET'),sql,user)).json()).records;assert.deepEqual(saved.setLogs,row.setLogs);assert.equal(saved.sessionComplete,false);
 assert.deepEqual((await (await handleEntries(req('GET'),sql,{sub:'other'})).json()).records,[]);
 const finished={...row,sets:2,setLogs:[...row.setLogs,{weight:22,reps:10}],sessionComplete:true};assert.equal((await handleEntries(req('PUT',row.id,finished,1),sql,user)).status,200);
 const [loaded]=(await (await handleEntries(req('GET'),sql,user)).json()).records;assert.equal(loaded.sessionComplete,true);assert.equal(loaded.setLogs.length,2);
 assert.equal((await handleEntries(req('PUT',row.id,row,1),sql,user)).status,409);
});
test('unauthenticated requests, wrong origin and missing secrets fail closed',async()=>{
 const env={DATABASE_URL:'postgres://unused',NEON_AUTH_BASE_URL:'https://auth.test/auth'};
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries'),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries/x',{method:'DELETE',headers:{Origin:'https://evil.test'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://app.test/api/entries'),{})).status,503);
});

test('team member logs filter the requested day in SQL and preserve all-history requests',async()=>{
 const queries=[];
 const team={id:'11111111-1111-4111-8111-111111111111',owner_id:'owner',owner_role:'trainer'};
 const sql=async(strings,...values)=>{
  const q=strings.join('?');queries.push({q,values});
  if(q.includes('FROM trainer_teams'))return [team];
  if(q.includes('FROM team_members m'))return [{id:'student',team_role:'trainee'}];
  if(q.includes('FROM daily_logs'))return [{payload:{id:'entry',day:values[1]||'2026-10-03',kind:'workout'}}];
  throw Error('Unexpected query');
 };
 const path='https://example.com/api/teams/'+team.id+'/members/student';
 const response=await handleTeams(new Request(path+'?day=2026-10-04'),sql,{sub:'owner'});
 assert.equal(response.status,200);assert.equal((await response.json()).records[0].day,'2026-10-04');
 assert.deepEqual(queries.find(x=>x.q.includes('FROM daily_logs')).values,['student','2026-10-04']);
 assert.match(queries.find(x=>x.q.includes('FROM daily_logs')).q,/AND day=/);
 queries.length=0;assert.equal((await handleTeams(new Request(path),sql,{sub:'owner'})).status,200);
 assert.equal(queries.find(x=>x.q.includes('FROM daily_logs')).values.length,1);
 queries.length=0;assert.equal((await handleTeams(new Request(path+'?day=invalid'),sql,{sub:'owner'})).status,400);
 assert.equal(queries.some(x=>x.q.includes('FROM daily_logs')),false);
});
test('team daily records retain trainer-only access',async()=>{
 const sql=async(strings)=>strings.join('').includes('FROM trainer_teams')?[{id:'11111111-1111-4111-8111-111111111111',owner_id:'owner'}]:[{status:'active',team_role:'trainee'}];
 const response=await handleTeams(new Request('https://example.com/api/teams/11111111-1111-4111-8111-111111111111/members/student?day=2026-10-04'),sql,{sub:'another-student'});
 assert.equal(response.status,403);
});

test('profile avatar writes only the signed-in member and permits removal',async()=>{
 const writes=[],sql=async(strings,...values)=>{writes.push({q:strings.join('?'),values});return [];};
 const response=await handleAvatar(new Request('https://example.com/api/me/avatar',{method:'PUT',headers:{'Content-Type':'image/jpeg'},body:new Uint8Array([255,216,255,217])}),sql,{sub:'owner'});
 assert.equal(response.status,200);assert.equal((await response.json()).avatar,'data:image/jpeg;base64,/9j/2Q==');
 assert.deepEqual(writes[0].values,['data:image/jpeg;base64,/9j/2Q==','owner']);
 assert.equal((await handleAvatar(new Request('https://example.com/api/me/avatar',{method:'DELETE'}),sql,{sub:'owner'})).status,200);
 assert.deepEqual(writes[1].values,['owner']);
});
test('profile avatar rejects unsupported, invalid and oversized uploads without writing',async()=>{
 const sql=async()=>{throw Error('Unexpected write');};
 for(const [type,body,status] of [['image/svg+xml',new Uint8Array([1]),400],['image/jpeg',new Uint8Array([1,2,3,4]),400],['image/jpeg',new Uint8Array(65537),413]]){
  const response=await handleAvatar(new Request('https://example.com/api/me/avatar',{method:'PUT',headers:{'Content-Type':type},body}),sql,{sub:'owner'});
  assert.equal(response.status,status);
 }
});

test('actual workout plan references require an active assigned plan and matching day and exercise',async()=>{
 const planId='22222222-2222-4222-8222-222222222222';
 const workout={id:'linked',kind:'workout',day:'2026-10-04',exercise:'Squat',trainingType:'strength',weight:20,sets:3,reps:10,notes:'',planId,planExerciseIndex:0};
 const queries=[],sql=async(strings,...values)=>{const q=strings.join('?');queries.push({q,values});if(q.includes('FROM training_plans'))return [{day:'2026-10-04',exercises:[{exercise:'Squat'}]}];if(q.includes('INSERT INTO daily_logs'))return [{revision:1}];throw Error('Unexpected query');};
 const response=await handleEntries(req('PUT','linked',workout),sql,{sub:'student'});
 assert.equal(response.status,200);assert.equal((await response.json()).record.planId,planId);
 assert.deepEqual(queries.find(x=>x.q.includes('FROM training_plans')).values,[planId,'student','student','student']);
 queries.length=0;
 const denied=async(strings)=>{const q=strings.join('');if(q.includes('FROM training_plans'))return [];throw Error('Must not write unassigned plan');};
 assert.equal((await handleEntries(req('PUT','linked',workout),denied,{sub:'student'})).status,400);
 assert.equal((await handleEntries(req('PUT','linked',{...workout,exercise:'Row'}),sql,{sub:'student'})).status,400);
});
test('team progress route uses the same access checks and rejects future-invalid dates',async()=>{
 const team={id:'11111111-1111-4111-8111-111111111111',owner_id:'owner',owner_role:'trainer'};
 const sql=async(strings)=>{const q=strings.join('');if(q.includes('FROM trainer_teams'))return [team];if(q.includes('SELECT status,team_role'))return [{status:'active',team_role:'trainee'}];if(q.includes('SELECT team_role'))return [{team_role:'trainee'}];return [];};
 const base='https://app.test/api/teams/'+team.id+'/members/student/progress?day=';
 assert.equal((await handleTeams(new Request(base+'2026-10-04'),sql,{sub:'owner'})).status,200);
 assert.equal((await handleTeams(new Request(base+'2026-10-04'),sql,{sub:'student'})).status,403);
 assert.equal((await handleTeams(new Request(base+'2026-02-31'),sql,{sub:'owner'})).status,400);
});

test('team game route admits accepted players of either role and denies pending invitations',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const status of ['active','invited']){
  const sql=async strings=>{const q=strings.join('');if(q.includes('SELECT t.id,t.name,t.owner_id'))return [{id,owner_id:'owner',owner_role:'trainer'}];if(q.includes('SELECT status,team_role'))return [{status,team_role:'trainer'}];return [];};
  const response=await handleTeams(new Request('https://app.test/api/teams/'+id+'/game?day=2026-10-04'),sql,{sub:'coach'});assert.equal(response.status,status==='active'?200:403);
 }
});
