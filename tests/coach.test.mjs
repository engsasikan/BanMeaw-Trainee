import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleFeedback,handleMemberProgress,handleBackup,validDate} from '../src/coach.mjs';
import {validateBackup} from '../dist/backup-data.mjs';
const team={id:'11111111-1111-4111-8111-111111111111',owner_id:'owner',owner_role:'trainer'};
const req=(path,method='GET',body)=>new Request('https://app.test'+path,{method,body:body&&JSON.stringify(body)});
test('feedback reads are private to the trainee and active coaches; trainees cannot mark reviewed',async()=>{
 const sql=async(strings)=>strings.join('').includes('SELECT team_role')?[{team_role:'trainee'}]:[];
 assert.equal((await handleFeedback(req('/?day=2026-10-04'),sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,200);
 assert.equal((await handleFeedback(req('/?day=2026-10-04'),sql,{sub:'other'},team,{status:'active',team_role:'trainee'},'student')).status,403);
 assert.equal((await handleFeedback(req('/?day=2026-10-04','POST',{text:'',reviewed:true}),sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,403);
 assert.equal((await handleFeedback(req('/?day=2026-10-04'),sql,{sub:'coach'},team,{status:'invited',team_role:'trainer'},'student')).status,403);
});
test('coach feedback validates date and body before writes and uses bound values',async()=>{
 const writes=[],sql=async(strings,...values)=>{const q=strings.join('?');if(q.includes('SELECT team_role'))return [{team_role:'trainee'}];writes.push({q,values});return [];};
 for(const body of [{text:'',reviewed:false},{text:'a'.repeat(2001),reviewed:true},{text:'Hello',reviewed:'yes'}])assert.equal((await handleFeedback(req('/?day=2026-10-04','POST',body),sql,{sub:'owner'},team,null,'student')).status,400);
 assert.equal(writes.length,0);
 assert.equal((await handleFeedback(req('/?day=2026-10-04','POST',{text:'Keep it up',reviewed:true}),sql,{sub:'owner'},team,null,'student')).status,200);
 assert.deepEqual(writes[0].values,[team.id,'student','2026-10-04','owner','Keep it up',true]);assert.equal(validDate('2026-02-31'),false);
});
test('progress denies trainee and filters history to selected date and 14-day window',async()=>{
 const queries=[],sql=async(strings,...values)=>{const q=strings.join('?');queries.push({q,values});return q.includes('SELECT team_role')?[{team_role:'trainee'}]:[];};
 assert.equal((await handleMemberProgress(req('/?day=2026-10-04'),sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,403);
 assert.equal((await handleMemberProgress(req('/?day=2026-10-04'),sql,{sub:'owner'},team,null,'student')).status,200);
 assert.deepEqual(queries.find(q=>q.q.includes('FROM daily_logs')).values,['student','2026-09-21','2026-10-04']);
 assert.match(queries.find(q=>q.q.includes('FROM body_measurements')).q,/day<=/);
});
test('backup restore rejects other accounts and validates an entire chunk before inserting',async()=>{
 const writes=[],sql=async(strings,...values)=>{writes.push({q:strings.join('?'),values});return [{id:'x'}];};
 assert.equal((await handleBackup(req('/api/backup','POST',{ownerId:'other',type:'body',rows:[]}),sql,{sub:'owner'})).status,403);
 assert.equal((await handleBackup(req('/api/backup','POST',{ownerId:'owner',type:'body',rows:[{id:'b',day:'2026-10-04',sex:'male',weight:80},{id:'bad',day:'2026-02-31',sex:'male',weight:80}]}),sql,{sub:'owner'})).status,400);assert.equal(writes.length,0);
 const response=await handleBackup(req('/api/backup','POST',{ownerId:'owner',type:'body',rows:[{id:'b',day:'2026-10-04',sex:'male',height:170,weight:80}]}),sql,{sub:'owner'});
 assert.equal(response.status,200);assert.match(writes[0].q,/ON CONFLICT DO NOTHING/);assert.equal(writes[0].values[0],'owner');
});
test('backup includes body history, plans and reviews without truncation',async()=>{
 const queries=[],sql=async(strings)=>{const q=strings.join('?');queries.push(q);if(q.includes('SELECT id,member_code'))return [{id:'owner'}];if(q.includes('FROM body_measurements'))return [{payload:{weight:80}}];if(q.includes('FROM training_plans'))return [{id:'plan'}];if(q.includes('FROM trainer_feedback'))return [{id:'review'}];return [];};
 const result=await (await handleBackup(req('/api/backup'),sql,{sub:'owner'})).json();
 assert.equal(result.version,3);assert.equal(result.body[0].weight,80);assert.equal(result.plans[0].id,'plan');assert.equal(result.feedback[0].id,'review');assert.ok(queries.every(q=>!q.includes('LIMIT')));
});
test('backup cannot restore plans into teams the account no longer coaches',async()=>{
 const writes=[],plan={id:'22222222-2222-4222-8222-222222222222',team_id:team.id,batch_id:'33333333-3333-4333-8333-333333333333',day:'2026-10-04',user_id:'student',exercises:[{exercise:'Squat',weight:20,sets:3,reps:12}]};
 const sql=async(strings)=>{const q=strings.join('');if(q.includes('FROM trainer_teams'))return [team];if(q.includes('SELECT status'))return [{status:'active',team_role:'trainee'}];writes.push(q);return [];};
 const response=await handleBackup(req('/api/backup','POST',{ownerId:'student',type:'plans',rows:[plan]}),sql,{sub:'student'});
 assert.equal((await response.json()).skipped,1);assert.equal(writes.length,0);
});
test('client validates all backup sections before import begins',()=>{
 const backup={version:3,profile:{id:'owner',sex:null},records:[],body:[{id:'b',day:'2026-10-04',sex:'male',weight:80}],plans:[],reports:[]};
 assert.equal(validateBackup(backup,'owner'),backup);assert.throws(()=>validateBackup(backup,'other'));assert.throws(()=>validateBackup({...backup,reports:[{day:'2026-02-31',sent_at:'2026-10-04T12:00:00Z'}]},'owner'));assert.throws(()=>validateBackup({...backup,profile:{id:'owner',sex:null,avatar:'data:image/jpeg;base64,eA=='}},'owner'));
});

test('backup exports own points and reward history as reference, and never imports a forged balance',async()=>{
 const queries=[],sql=async(strings,...values)=>{const q=strings.join('?');queries.push({q,values});if(q.includes('SELECT id,member_code'))return [{id:'owner'}];if(q.includes('FROM team_point_wallets'))return [{balance:40,earned:80}];if(q.includes('FROM team_redemptions'))return [{reward:'drink',cost:40}];return [];};
 const result=await (await handleBackup(req('/api/backup'),sql,{sub:'owner'})).json();assert.equal(result.game.wallets[0].balance,40);assert.equal(result.game.redemptions[0].reward,'drink');assert.ok(queries.filter(q=>q.q.includes('team_point_')||q.q.includes('team_redemptions')).every(q=>q.values[0]==='owner'));
 assert.equal((await handleBackup(req('/api/backup','POST',{ownerId:'owner',type:'wallets',rows:[{balance:100000}]}),sql,{sub:'owner'})).status,400);
});
