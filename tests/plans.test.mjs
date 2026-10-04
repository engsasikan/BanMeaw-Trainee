import test from 'node:test';import assert from 'node:assert/strict';import {planDays,planExercises,handlePlans} from '../src/plans.mjs';
const exercise={exercise:'Squat',sets:3,reps:12,weight:20};
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
