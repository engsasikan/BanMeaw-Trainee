import test from 'node:test';import assert from 'node:assert/strict';import {planDays,planExercises,handlePlans,syncTeamPlans} from '../src/plans.mjs';
const exercise={exercise:'Squat',sets:3,reps:12,weight:20};
test('plan prescriptions preserve pounds and validate the selected unit',()=>{
 const pounds={...exercise,weight:2200,weightUnit:'lb'};
 assert.deepEqual(planExercises({exercises:[pounds]}),[pounds]);
 assert.throws(()=>planExercises({exercises:[{...pounds,weightUnit:'kg'}]}));
 assert.throws(()=>planExercises({exercises:[{...exercise,weightUnit:'oz'}]}));
});
test('personal programs save without a team and scope reads and deletes to the signed-in member',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE training_plans (id uuid DEFAULT gen_random_uuid(),team_id uuid,user_id text,day date,exercises jsonb,created_by text,batch_id uuid)');
  const sql=(strings,...values)=>()=>db.query(strings.reduce((query,part,i)=>query+(i?'$'+i:'')+part,''),values).then(result=>result.rows);
  const query=Object.assign((strings,...values)=>{
   const run=sql(strings,...values);
   return {then:(resolve,reject)=>run().then(resolve,reject),run};
  },{transaction:async statements=>{for(const statement of statements)await statement.run();}});
  const call=(user,method,body,id)=>handlePlans(new Request('https://example.com/api/personal-plans'+(id?'?id='+id:''),{
   method,...(body?{body:JSON.stringify(body)}:{}),
  }),query,{sub:user},null);
  assert.equal((await call('alice','POST',{start:'2026-11-16',end:'2026-11-16',period:'program',schedule:[{weekday:1,exercises:[exercise]}]})).status,200);
  const {plans:[plan]}=await (await call('alice','GET')).json();
  assert.equal(plan.exercises[0].exercise,'Squat');
  assert.deepEqual(await (await call('bob','GET')).json(),{plans:[]});
  await call('bob','DELETE',null,plan.id);
  assert.equal((await (await call('alice','GET')).json()).plans.length,1);
 }finally{await db.close();}
});
test('team program assigns all active roles and the owner, excluding pending members',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try{
  const team='11111111-1111-4111-8111-111111111111';
  await db.exec(`
   CREATE TABLE members(id text,display_name text,member_code text);
   CREATE TABLE trainer_teams(id uuid,owner_id text,name text,owner_role text);
   CREATE TABLE team_members(team_id uuid,user_id text,status text,team_role text);
   CREATE TABLE training_plans(team_id uuid,user_id text,day date,exercises jsonb,created_by text,batch_id uuid,team_wide boolean);
   ALTER TABLE training_plans ADD COLUMN id uuid DEFAULT gen_random_uuid();
   CREATE TABLE daily_logs(user_id text,payload jsonb);
   INSERT INTO members VALUES ('owner','Owner','BM-OWNER');
   INSERT INTO trainer_teams VALUES ('${team}','owner','Team','trainer');
   INSERT INTO team_members VALUES ('${team}','coach','active','trainer'),
    ('${team}','student','active','trainee'),('${team}','pending','invited','trainee');
  `);
  const sql=async(strings,...values)=>{
   const query=strings.reduce((text,part,index)=>text+(index?'$'+index:'')+part,'');
   return (await db.query(query,values)).rows;
  };
  const post=(user,mine)=>handlePlans(new Request('https://example.com/api/teams/'+team+'/plans',{
   method:'POST',body:JSON.stringify({period:'program',start:'2026-11-16',end:'2026-11-23',schedule:[{weekday:1,exercises:[exercise]}]}),
  }),sql,{sub:user},{id:team,owner_id:'owner'},mine);
  assert.equal((await post('student',{status:'active',team_role:'trainee'})).status,403);
  assert.equal((await post('pending',{status:'invited',team_role:'trainer'})).status,403);
  assert.deepEqual(await (await post('coach',{status:'active',team_role:'trainer'})).json(),{ok:true,count:2,members:3,firstDay:'2026-11-16'});
  const {rows}=await db.query('SELECT user_id, count(*)::int AS days FROM training_plans GROUP BY user_id ORDER BY user_id');
  assert.deepEqual(rows,[{user_id:'coach',days:2},{user_id:'owner',days:2},{user_id:'student',days:2}]);
  const {rows:[plan]}=await db.query('SELECT batch_id FROM training_plans LIMIT 1');
  const patch=()=>handlePlans(new Request('https://example.com/api/teams/'+team+'/plans?id='+plan.batch_id,{
   method:'PATCH',body:JSON.stringify({day:'2026-11-16',exercises:[{...exercise,superset:'A'},{...exercise,exercise:'Row',superset:'A'}]}),
  }),sql,{sub:'owner'},{id:team,owner_id:'owner'},null);
  assert.deepEqual(await (await patch()).json(),{ok:true,count:3});
  const {rows:[first]}=await db.query("SELECT id,user_id FROM training_plans WHERE day='2026-11-16' LIMIT 1");
  await db.query('INSERT INTO daily_logs VALUES ($1,$2)',[first.user_id,JSON.stringify({planId:first.id})]);
  assert.equal((await patch()).status,409);
 }finally{await db.close();}
});
test('weekly program saves distinct prescriptions per weekday within the inclusive range',async()=>{
 const writes=[];
 const sql=(strings,...values)=>strings.join('').includes('SELECT')?Promise.resolve([{team_role:'trainee'}]):(writes.push(values),{});
 sql.transaction=async operations=>assert.equal(operations.length,4);
 const program={period:'program',start:'2026-11-16',end:'2026-11-25',schedule:[
  {weekday:1,exercises:[exercise]},
  {weekday:3,exercises:[{trainingType:'cardio',exercise:'Walk',duration:20}]},
 ]};
 const post=body=>handlePlans(new Request('https://example.com/api',{method:'POST',body:JSON.stringify(body)}),
  sql,{sub:'coach'},{id:'team',owner_id:'owner'},{status:'active',team_role:'trainer'},'student');
 assert.equal((await post(program)).status,200);
 assert.deepEqual(writes.map(row=>[row[2],JSON.parse(row[3])[0].exercise]),
  [['2026-11-16','Squat'],['2026-11-18','Walk'],['2026-11-23','Squat'],['2026-11-25','Walk']]);
 assert.equal(new Set(writes.map(row=>row[5])).size,1);
 assert.equal((await post({...program,end:program.start})).status,400);
 assert.equal(writes.length,4);
});
test('day, week and monthly schedules select requested weekdays',()=>{assert.deepEqual(planDays({start:'2026-10-04',period:'day'}),['2026-10-04']);assert.deepEqual(planDays({start:'2026-10-05',period:'week',weekdays:[1,3,5]}),['2026-10-05','2026-10-07','2026-10-09']);const days=planDays({start:'2026-02-01',period:'month',weekdays:[0,1,2,3,4,5,6]});assert.equal(days.length,28);assert.equal(days.at(-1),'2026-02-28');assert.throws(()=>planDays({start:'2026-02-30',period:'day'}));assert.throws(()=>planDays({start:'2026-10-04',period:'week',weekdays:[]}));});
test('exercise prescriptions validate numbers and required fields',()=>{assert.deepEqual(planExercises({exercises:[exercise]}),[exercise]);for(const r of [{...exercise,sets:0},{...exercise,reps:1.5},{...exercise,weight:-1},{...exercise,exercise:''}])assert.throws(()=>planExercises({exercises:[r]}));});
test('trainee cannot prescribe and trainer cannot target other trainers',async()=>{const team={id:'team',owner_id:'owner',owner_role:'trainer'};const sql=async()=>[{team_role:'trainee'}];const req=new Request('https://example.com/api',{method:'POST',body:'{}'});assert.equal((await handlePlans(req,sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,403);assert.equal((await handlePlans(req,async()=>[{team_role:'trainer'}],{sub:'coach'},team,{status:'active',team_role:'trainer'},'other')).status,403);});
test('trainer creates weekly plans in one transaction',async()=>{const writes=[];const sql=(strings,...values)=>strings.join('').includes('SELECT')?Promise.resolve([{team_role:'trainee'}]):(writes.push(values),{});sql.transaction=async q=>{assert.equal(q.length,3);};const res=await handlePlans(new Request('https://example.com/api',{method:'POST',body:JSON.stringify({start:'2026-10-05',period:'week',weekdays:[1,3,5],exercises:[exercise]})}),sql,{sub:'coach'},{id:'team',owner_id:'owner'},{status:'active',team_role:'trainer'},'student');assert.equal(res.status,200);assert.equal((await res.json()).count,3);assert.equal(writes[0][1],'student');assert.equal(writes[0][4],'coach');});

test('rest and superset survive validation; old prescriptions remain compatible',()=>{
 const a={...exercise,rest_seconds:0,superset:'A'},b={...exercise,exercise:'Row',rest_seconds:90,superset:'A'};
 assert.deepEqual(planExercises({exercises:[a,b]}),[a,b]);
 assert.deepEqual(planExercises({exercises:[exercise]}),[exercise]);
 for(const rest_seconds of [-1,1.5,3601,'60'])assert.throws(()=>planExercises({exercises:[{...exercise,rest_seconds}]}));
 for(const superset of ['Z',1])assert.throws(()=>planExercises({exercises:[{...exercise,superset}]}));
 assert.throws(()=>planExercises({exercises:[a]}));
});
test('saved training plans retain rest and superset in database payload',async()=>{
 const writes=[];
 const sql=(strings,...values)=>strings.join('').includes('SELECT')?Promise.resolve([{team_role:'trainee'}]):(writes.push(values),{});
 sql.transaction=async queries=>{assert.equal(queries.length,1);};
 const exercises=[{...exercise,rest_seconds:0,superset:'A'},{...exercise,exercise:'Row',rest_seconds:90,superset:'A'}];
 const response=await handlePlans(new Request('https://example.com/api',{method:'POST',body:JSON.stringify({start:'2026-10-05',period:'day',exercises})}),sql,{sub:'coach'},{id:'team',owner_id:'owner'},{status:'active',team_role:'trainer'},'student');
 assert.equal(response.status,200);assert.deepEqual(JSON.parse(writes[0][3]),exercises);
});

test('active trainers can view their own training plan while retaining coaching role',async()=>{
 const sql=async strings=>strings.join('').includes('SELECT team_role')?[{team_role:'trainer'}]:[];
 const response=await handlePlans(new Request('https://example.com/api'),sql,{sub:'coach'},{id:'team',owner_id:'owner'},{status:'active',team_role:'trainer'},'coach');assert.equal(response.status,200);
});

test('saved plan API returns a date-only string which can be rendered on the planner',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec(`CREATE TABLE training_plans (id text,team_id text,user_id text,day date,exercises jsonb,created_by text);INSERT INTO training_plans VALUES ('plan','team','owner','2026-10-04','[]','owner');`);
 const sql=async(strings,...values)=>{let query=strings[0];for(let i=0;i<values.length;i++)query+='$'+(i+1)+strings[i+1];return (await db.query(query,values)).rows;};
 try{const response=await handlePlans(new Request('https://example.com/api'),sql,{sub:'owner'},{id:'team',owner_id:'owner',owner_role:'trainee'},null,'owner');assert.equal(response.status,200);const {plans}=await response.json();assert.equal(plans[0].day,'2026-10-04');assert.doesNotThrow(()=>new Intl.DateTimeFormat('th-TH').format(new Date(plans[0].day+'T12:00:00')));}finally{await db.close();}
});
test('cardio plan items carry time, incline and speed instead of sets',()=>{
 assert.deepEqual(planExercises({exercises:[{trainingType:'cardio',exercise:'เดินชัน',duration:30,incline:12,speed:5,distance:null,sets:3}]}),[{trainingType:'cardio',exercise:'เดินชัน',duration:30,incline:12,speed:5}]);
 for(const r of [{duration:0},{duration:30,incline:101},{duration:30,speed:-1},{duration:'30'}])assert.throws(()=>planExercises({exercises:[{trainingType:'cardio',exercise:'เดินชัน',...r}]}));
});
test('members who join after a team-wide plan was saved get their own copy, once',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try{
  const team='22222222-2222-4222-8222-222222222222',batch='33333333-3333-4333-8333-333333333333';
  await db.exec(`
   CREATE TABLE team_members(team_id uuid,user_id text,status text,team_role text,joined_at timestamptz);
   CREATE TABLE training_plans(id uuid DEFAULT gen_random_uuid(),team_id uuid,user_id text,day date,exercises jsonb,created_by text,batch_id uuid,team_wide boolean DEFAULT false,created_at timestamptz DEFAULT now());
   INSERT INTO team_members VALUES ('${team}','early','active','trainee','2026-11-01T03:00:00Z'),
    ('${team}','late','active','trainee','2026-11-10T03:00:00Z'),('${team}','pending','invited','trainee',NULL);
   INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id,team_wide,created_at) VALUES
    ('${team}','owner','2026-11-07','[{"exercise":"Squat"}]','owner','${batch}',true,'2026-11-05T03:00:00Z'),
    ('${team}','owner','2026-11-14','[{"exercise":"Squat"}]','owner','${batch}',true,'2026-11-05T03:00:00Z'),
    ('${team}','owner','2026-11-14','[{"exercise":"Solo"}]','owner',gen_random_uuid(),false,'2026-11-05T03:00:00Z');
  `);
  const sql=async(strings,...values)=>(await db.query(strings.reduce((text,part,index)=>text+(index?'$'+index:'')+part,''),values)).rows;
  const days=async user=>(await db.query('SELECT day::text AS day FROM training_plans WHERE user_id=$1 ORDER BY day',[user])).rows.map(r=>r.day);
  await syncTeamPlans(sql,'late');await syncTeamPlans(sql,'late');
  assert.deepEqual(await days('late'),['2026-11-14'],'only days from joining on, copied once');
  await syncTeamPlans(sql,'pending');assert.deepEqual(await days('pending'),[]);
  await syncTeamPlans(sql,'early');assert.deepEqual(await days('early'),[],'members present at save time already had copies; a removed copy stays removed');
  await db.query("DELETE FROM training_plans WHERE user_id='late'");
  await syncTeamPlans(sql,'late','2026-11-15','2026-11-21');assert.deepEqual(await days('late'),[],'outside the requested range');
  await syncTeamPlans(sql,'late','2026-11-09','2026-11-15');assert.deepEqual(await days('late'),['2026-11-14']);
 }finally{await db.close();}
});
