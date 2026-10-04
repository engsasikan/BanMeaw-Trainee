import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleTeamGame,dailyScore,claimWindow,bangkokDay} from '../src/team-game.mjs';
const team={id:'11111111-1111-4111-8111-111111111111',owner_id:'owner',owner_role:'trainer'};
const member={status:'active',team_role:'trainee'},trainer={status:'active',team_role:'trainer'};
const req=(action='',body,day=bangkokDay())=>new Request('https://app.test/api/teams/'+team.id+'/game'+(action?'/'+action:'?day='+day),{method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body)});
const meals=['มื้อเช้า','มื้อกลางวัน','มื้อเย็น'].map((meal,i)=>({id:'meal-'+i,meal,text:'อาหาร 1 จาน',kind:'meal'}));
test('daily scoring requires submitted meals, never weight loss, and gives equal rest-day points',()=>{
 assert.equal(dailyScore(meals,{sent:false}),0);assert.equal(dailyScore([{kind:'workout'}],{sent:true}),0);assert.equal(dailyScore([meals[0]],{sent:true}),10);assert.equal(dailyScore(meals,{sent:true}),15);assert.equal(dailyScore(meals,{sent:true,rest:true}),20);assert.equal(dailyScore([...meals,{kind:'workout'}],{sent:true}),20);
 assert.equal(claimWindow('2026-02-31',new Date('2026-10-04T12:00:00Z')),false);assert.equal(claimWindow('2026-10-05',new Date('2026-10-04T12:00:00Z')),false);assert.equal(claimWindow('2026-09-27',new Date('2026-10-04T12:00:00Z')),false);assert.equal(claimWindow('2026-09-28',new Date('2026-10-04T12:00:00Z')),true);assert.equal(bangkokDay(new Date('2026-10-03T18:00:00Z')),'2026-10-04');
});
test('game denies invited and unrelated members before touching data',async()=>{
 const sql=()=>{throw Error('must not query');};for(const mine of [undefined,{status:'invited',team_role:'trainer'}])assert.equal((await handleTeamGame(req(),sql,{sub:'outsider'},team,mine)).status,403);
});
test('PostgreSQL game accounting, privacy, concurrency and trainer participation',async t=>{
 const db=new PGlite();await db.exec(await readFile(new URL('../db/001_initial.sql',import.meta.url),'utf8'));
 const sql=async(strings,...values)=>(await db.query(strings.reduce((q,s,i)=>q+(i?'$'+i:'')+s,''),values)).rows;
 const day=bangkokDay(),call=(id,action,body,mine=member)=>handleTeamGame(req(action,body),sql,{sub:id},team,mine,action||undefined);
 await db.query("INSERT INTO members (id,display_name,role) VALUES ('owner','Coach','trainer'),('student','Student','trainee'),('trainer','Second Coach','trainer'),('late','Late Joiner','trainee')");
 await db.query("INSERT INTO trainer_teams (id,name,owner_id,created_at) VALUES ($1,'Together','owner','2020-01-01')",[team.id]);
 await db.query("INSERT INTO team_members (team_id,user_id,status,team_role,joined_at) VALUES ($1,'student','active','trainee','2020-01-01'),($1,'trainer','active','trainer','2020-01-01'),($1,'late','active','trainee',now())",[team.id]);
 for(const id of ['owner','student','trainer']){for(const row of [...meals,{id:'workout',kind:'workout',exercise:'Squat',sets:3,reps:12,weight:20}])await db.query('INSERT INTO daily_logs (user_id,id,day,kind,payload) VALUES ($1,$2,$3,$4,$5)',[id,row.id,day,row.kind,JSON.stringify({...row,day})]);await db.query('INSERT INTO daily_reports (user_id,day,team_visible) VALUES ($1,$2,true)',[id,day]);}
 await t.test('server reads current submitted records and credits a day only once',async()=>{
  const results=await Promise.all([call('student','claim',{day,rest:false}),call('student','claim',{day,rest:false})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.deepEqual((await sql`SELECT balance,earned FROM team_point_wallets WHERE user_id='student'`)[0],{balance:20,earned:20});
  assert.equal((await call('student','claim',{day:'2099-01-01',rest:false})).status,400);assert.equal((await call('student','rewards',{code:'drink',cost:1,enabled:true})).status,403);
 });
 await t.test('coaches earn exactly the same daily score; edited logs require resending',async()=>{
  assert.equal((await call('owner','claim',{day,rest:false},undefined)).status,200);
  await db.query("UPDATE daily_logs SET updated_at=now()+interval '1 second' WHERE user_id='trainer'");assert.equal((await call('trainer','claim',{day,rest:false},trainer)).status,409);
  await db.query("UPDATE daily_reports SET sent_at=now()+interval '2 seconds' WHERE user_id='trainer'");assert.equal((await call('trainer','claim',{day,rest:false},trainer)).status,200);
  assert.equal((await sql`SELECT earned FROM team_point_wallets WHERE user_id='owner'`)[0].earned,20);
 });
 await t.test('retries debit only once and use the configured price from the server',async()=>{
  assert.equal((await call('owner','rewards',{code:'drink',cost:20,enabled:true})).status,200);
  const requestId='22222222-2222-4222-8222-222222222222',body={reward:'drink',requestId,cost:0};const results=await Promise.all([call('student','redeem',body),call('student','redeem',body)]);assert.ok(results.every(r=>r.status===200));
  assert.equal((await sql`SELECT balance FROM team_point_wallets WHERE user_id='student'`)[0].balance,0);assert.equal((await sql`SELECT count(*)::int AS count FROM team_redemptions WHERE user_id='student'`)[0].count,1);
  const [r]=await sql`SELECT id,cost FROM team_redemptions WHERE user_id='student'`;assert.equal(r.cost,20);
  assert.equal((await call('student','resolve',{id:r.id,status:'fulfilled'})).status,403);
  const refunds=await Promise.all([call('owner','resolve',{id:r.id,status:'rejected'}),call('owner','resolve',{id:r.id,status:'rejected'})]);assert.deepEqual(refunds.map(r=>r.status).sort(),[200,409]);assert.equal((await sql`SELECT balance FROM team_point_wallets WHERE user_id='student'`)[0].balance,20);
 });
 await t.test('parallel redemptions never overdraw and cancelling refunds once',async()=>{
  await call('owner','rewards',{code:'drink',cost:15,enabled:true});
  const results=await Promise.all(['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'].map(requestId=>call('student','redeem',{reward:'drink',requestId})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const [r]=await sql`SELECT id FROM team_redemptions WHERE user_id='student' AND status='pending'`;assert.equal((await call('trainer','resolve',{id:r.id,status:'cancelled'},trainer)).status,403);
  assert.equal((await call('student','resolve',{id:r.id,status:'cancelled'})).status,200);assert.equal((await call('student','resolve',{id:r.id,status:'cancelled'})).status,409);assert.equal((await sql`SELECT balance FROM team_point_wallets WHERE user_id='student'`)[0].balance,20);
 });
 await t.test('trainer can redeem and record receipt; closed rewards cannot be bought',async()=>{
  const response=await call('owner','redeem',{reward:'drink',requestId:'55555555-5555-4555-8555-555555555555'});assert.equal(response.status,200);const {redemption}=await response.json();assert.equal((await call('owner','resolve',{id:redemption.id,status:'fulfilled'})).status,200);assert.equal((await call('owner','resolve',{id:redemption.id,status:'cancelled'})).status,409);
  await call('owner','rewards',{code:'drink',cost:1,enabled:false});assert.equal((await call('student','redeem',{reward:'drink',requestId:'66666666-6666-4666-8666-666666666666'})).status,409);
 });
 await t.test('active participants see submitted team results and only their own redemption history',async()=>{
  const state=await (await call('student','',undefined)).json();assert.equal(state.players.length,4);assert.ok(state.players.some(p=>p.id==='owner'&&p.team_role==='trainer'&&p.day_points===20));assert.ok(state.redemptions.every(r=>r.user_id==='student'));assert.ok(state.reports.some(r=>r.user_id==='owner'));assert.ok(state.reports.every(r=>r.user_id!=='late'));
 });
 await t.test('old reports are not shared or awarded until a member sends explicitly to the team',async()=>{
  await db.query("UPDATE daily_reports SET team_visible=false WHERE user_id='owner'");const state=await (await call('student','',undefined)).json();assert.ok(state.reports.every(r=>r.user_id!=='owner'));assert.equal(state.players.find(p=>p.id==='owner').sent_at,null);
  await db.query("UPDATE daily_reports SET team_visible=true WHERE user_id='owner'");
 });
 await t.test('no claim before membership date; stale report and zero-food days cannot earn',async()=>{
  assert.equal((await call('late','claim',{day,rest:false})).status,409);
  const previous=new Date(day+'T00:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);const oldDay=previous.toISOString().slice(0,10);
  await db.query("INSERT INTO daily_logs (user_id,id,day,kind,payload) VALUES ('late','old-meal',$1,'meal',$2)",[oldDay,JSON.stringify({...meals[0],day:oldDay})]);await db.query("INSERT INTO daily_reports (user_id,day,team_visible) VALUES ('late',$1,true)",[oldDay]);assert.equal((await call('late','claim',{day:oldDay,rest:true})).status,409);
 });
 await db.close();
});
