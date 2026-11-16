import test from 'node:test';import assert from 'node:assert/strict';
import {cleanRoutine,handleRoutine} from '../src/routine.mjs';
test('a routine keeps 0–10 timed moves per part and clears to null when empty',()=>{
 assert.deepEqual(cleanRoutine({warmup:[{exercise:' Jack Jump ',seconds:45}],cooldown:[]}),{warmup:[{exercise:'Jack Jump',seconds:45}],cooldown:[]});
 assert.equal(cleanRoutine({warmup:[],cooldown:[]}),null);
 for(const bad of [{warmup:[{exercise:'',seconds:30}]},{warmup:[{exercise:'A',seconds:5}]},{cooldown:[{exercise:'A',seconds:30.5}]},{warmup:Array(11).fill({exercise:'A',seconds:30})}])assert.throws(()=>cleanRoutine(bad));
});
test('team trainers set the team routine, members read it, trainees cannot change it; members keep their own',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
  const teamId='33333333-3333-4333-8333-333333333333';
  await db.exec(`CREATE TABLE trainer_teams(id uuid,owner_id text,routine jsonb);CREATE TABLE members(id text,routine jsonb);
   INSERT INTO trainer_teams VALUES ('${teamId}','owner',null);INSERT INTO members VALUES ('owner',null),('kid',null);`);
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,part,i)=>q+(i?'$'+i:'')+part,''),values)).rows;
  const team={id:teamId,owner_id:'owner'},routine={warmup:[{exercise:'Jack Jump',seconds:45}],cooldown:[{exercise:'Hamstring Stretch',seconds:40}]};
  const call=(who,method,body,t=team,mine=null)=>handleRoutine(new Request('https://x/api',{method,...(body?{body:JSON.stringify(body)}:{})}),sql,{sub:who},t,mine);
  const trainee={status:'active',team_role:'trainee'};
  assert.equal((await call('kid','PUT',routine,team,trainee)).status,403);
  assert.equal((await call('owner','PUT',routine)).status,200);
  assert.deepEqual((await (await call('kid','GET',null,team,trainee)).json()).routine,routine);
  assert.equal((await call('stranger','GET',null,team,null)).status,403);
  assert.equal((await call('owner','PUT',{warmup:[{exercise:'A',seconds:1}]})).status,400);
  // Personal routine, separate from the team's.
  await call('kid','PUT',{warmup:[{exercise:'Inchworm',seconds:30}]},null,null);
  assert.deepEqual((await (await call('kid','GET',null,null,null)).json()).routine,{warmup:[{exercise:'Inchworm',seconds:30}],cooldown:[]});
  await call('owner','PUT',{warmup:[],cooldown:[]});
  assert.equal((await (await call('kid','GET',null,team,trainee)).json()).routine,null,'cleared back to the app standard');
 }finally{await db.close();}
});
