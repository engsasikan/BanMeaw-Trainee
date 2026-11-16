import {localDay} from '../dist/store.mjs';
export function planDays(body){
 const {start,period,weekdays}=body;if(!['day','week','month'].includes(period)||typeof start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(start)||localDay(new Date(start+'T12:00:00'))!==start)throw Error('วันที่หรือช่วงแผนไม่ถูกต้อง');
 if(period!=='day'&&(!Array.isArray(weekdays)||!weekdays.length||weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)))throw Error('เลือกวันฝึกอย่างน้อยหนึ่งวัน');
 const d=new Date(start+'T12:00:00'),end=new Date(d);if(period==='week')end.setDate(end.getDate()+6);if(period==='month'){end.setMonth(end.getMonth()+1,1);end.setDate(0);if(end<d)throw Error('วันที่ไม่ถูกต้อง');}
 const days=[];for(;d<=end;d.setDate(d.getDate()+1))if(period==='day'||weekdays.includes(d.getDay()))days.push(localDay(d));if(!days.length)throw Error('ไม่มีวันฝึกในช่วงที่เลือก');return days;
}
export function planExercises(body){
 if(!Array.isArray(body.exercises)||!body.exercises.length||body.exercises.length>30)throw Error('เพิ่มท่า 1–30 ท่า');
 const exercises=body.exercises.map(r=>{
  if(r?.trainingType==='cardio'){
   const ok=(v,max)=>v==null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max);
   if(typeof r.exercise!=='string'||!r.exercise.trim()||r.exercise.length>150||typeof r.duration!=='number'||!ok(r.duration,600)||r.duration<=0||!ok(r.incline,100)||!ok(r.speed,50)||!ok(r.distance,1000))throw Error('ตรวจชื่อท่า เวลา ความชัน และความเร็วของคาร์ดิโอ');
   const out={trainingType:'cardio',exercise:r.exercise.trim(),duration:r.duration};for(const k of ['incline','speed','distance'])if(r[k]!=null)out[k]=r[k];return out;
  }
  const unit=r?.weightUnit??'kg';
  if(!r||!['kg','lb'].includes(unit)||typeof r.exercise!=='string'||!r.exercise.trim()||r.exercise.length>150||!Number.isInteger(r.sets)||r.sets<1||r.sets>100||(r.seconds!=null?!Number.isInteger(r.seconds)||r.seconds<1||r.seconds>3600:!Number.isInteger(r.reps)||r.reps<1||r.reps>1000)||!(r.weight===null||(typeof r.weight==='number'&&Number.isFinite(r.weight)&&r.weight>=0&&r.weight<=(unit==='lb'?4409.25:2000))))throw Error('ตรวจชื่อท่า น้ำหนัก หน่วย จำนวนครั้ง และเซ็ต');
  // Timed holds (plank) carry seconds per set instead of reps.
  const out={exercise:r.exercise.trim(),weight:r.weight,sets:r.sets,...(r.seconds!=null?{seconds:r.seconds}:{reps:r.reps})};
  if(r.weightUnit!=null)out.weightUnit=unit;
  if(r.rest_seconds!=null){if(!Number.isInteger(r.rest_seconds)||r.rest_seconds<0||r.rest_seconds>3600)throw Error('เวลาพักต้องเป็น 0–3600 วินาที');out.rest_seconds=r.rest_seconds;}
  if(r.superset!=null&&r.superset!==''){if(typeof r.superset!=='string'||! /^[A-O]$/.test(r.superset))throw Error('กลุ่ม Super set ไม่ถูกต้อง');out.superset=r.superset;}
  return out;
 });
 for(const group of new Set(exercises.map(r=>r.superset).filter(Boolean))){
  if(exercises.filter(r=>r.superset===group).length<2)throw Error('Super set '+group+' ต้องมีอย่างน้อย 2 ท่า');
 }
 return exercises;
}
export function weeklyProgram({start,end,schedule}){
 const valid=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&localDay(new Date(day+'T12:00:00'))===day;
 if(!valid(start)||!valid(end)||end<start)throw Error('ตรวจวันเริ่มและวันสิ้นสุด');
 const first=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
 const limit=new Date(first);limit.setDate(limit.getDate()+365);
 if(last>limit)throw Error('กำหนดช่วงได้สูงสุด 366 วัน');
 if(!Array.isArray(schedule)||!schedule.length||schedule.length>7)throw Error('เลือกวันฝึกอย่างน้อยหนึ่งวัน');
 const byWeekday=new Map();
 for(const day of schedule){
  const weekday=day?.weekday;
  if(!Number.isInteger(weekday)||weekday<0||weekday>6||byWeekday.has(weekday))throw Error('วันฝึกไม่ถูกต้อง');
  byWeekday.set(weekday,planExercises(day));
 }
 const plans=[],used=new Set();
 for(const day=new Date(first);day<=last;day.setDate(day.getDate()+1)){
  const weekday=day.getDay(),exercises=byWeekday.get(weekday);
  if(exercises){plans.push({day:localDay(day),exercises});used.add(weekday);}
 }
 if(used.size!==byWeekday.size)throw Error('บางวันฝึกไม่อยู่ในช่วงวันที่เลือก');
 return plans;
}
// The program day in Thailand, where the gym is: a program edit only rewrites days from here on.
export const bangkokDay=(now=Date.now())=>new Date(now+7*36e5).toISOString().slice(0,10);
const uuidPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function handlePlans(request,sql,user,team,mine,memberId,today=bangkokDay()){
 const me=user.sub,personal=!team,teamId=team?.id??null;
 const owner=team?.owner_id===me,trainer=personal||owner||(mine?.status==='active'&&mine.team_role==='trainer');
 const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
 if(personal)memberId=me;
 else if(memberId){
  const [target]=memberId===team.owner_id?[{team_role:team.owner_role}]:await sql`SELECT team_role FROM team_members WHERE team_id=${team.id} AND user_id=${memberId} AND status='active'`;
  if(!target||(target.team_role!=='trainee'&&!(trainer&&memberId===me))||(!trainer&&memberId!==me))return json({error:'ไม่มีสิทธิ์เข้าถึงแผนนี้'},403);
 }else if(!trainer)return json({error:'เฉพาะผู้สร้างทีมหรือเทรนเนอร์เท่านั้น'},403);
 if(request.method==='GET'){
  // A member looking at their own team program first gets any team-wide plans they joined too late to receive.
  if(team&&memberId===me&&me!==team.owner_id)await syncTeamPlans(sql,me);
  if(memberId)return json({plans:await sql`SELECT id,day::text AS day,exercises,created_by,batch_id FROM training_plans WHERE team_id IS NOT DISTINCT FROM ${teamId} AND user_id=${memberId} ORDER BY day,id LIMIT 1000`});
  return json({plans:await sql`
   SELECT DISTINCT ON (batch_id,day) batch_id AS id,day::text AS day,exercises,batch_id
   FROM training_plans WHERE team_id=${team.id} AND (team_wide OR batch_id IN (
    SELECT batch_id FROM training_plans WHERE team_id=${team.id} GROUP BY batch_id HAVING count(DISTINCT user_id)>1
   ))
   ORDER BY batch_id,day,user_id LIMIT 1000`});
 }
 if(!trainer)return json({error:'เฉพาะเทรนเนอร์เท่านั้น' },403);
 const params=new URL(request.url).searchParams,batch=params.get('batch');
 if(batch!==null){
  if(!uuidPattern.test(batch))return json({error:'รหัสโปรแกรมไม่ถูกต้อง'},400);
  if(request.method==='PUT')return replaceProgram(request,sql,{team,teamId,memberId,me,batch,today,json});
  if(request.method==='DELETE')return deleteProgram(sql,{teamId,memberId,batch,today,day:params.get('day'),json});
  return json({error:'ไม่พบ API'},404);
 }
 if(request.method==='PATCH'){
  const id=new URL(request.url).searchParams.get('id');
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||''))return json({error:'รหัสแผนไม่ถูกต้อง'},400);
  let day,exercises;
  try{
   const text=await request.text();if(text.length>16000)throw Error('ข้อมูลใหญ่เกินไป');
   const body=JSON.parse(text);
   [day]=planDays({start:body.day,period:'day'});exercises=planExercises(body);
  }catch(error){return json({error:error.message},400);}
  const payload=JSON.stringify(exercises);
  // Exercise indexes are referenced by saved results, so a day with results must keep its prescription.
  const [result]=await sql`
   WITH selected AS (
    SELECT id,user_id FROM training_plans
    WHERE team_id IS NOT DISTINCT FROM ${teamId} AND day=${day}::date
    AND ((${Boolean(memberId)} AND id=${id} AND user_id=${memberId??''})
      OR (NOT ${Boolean(memberId)} AND batch_id=${id} AND (team_wide OR batch_id IN (
       SELECT batch_id FROM training_plans WHERE team_id=${teamId}::uuid GROUP BY batch_id HAVING count(DISTINCT user_id)>1
      ))))
   ), changed AS (
    UPDATE training_plans p SET exercises=${payload}::jsonb FROM selected s
    WHERE p.id=s.id AND NOT EXISTS (
     SELECT 1 FROM daily_logs l JOIN selected x ON x.user_id=l.user_id
     WHERE l.payload->>'planId'=x.id::text
    ) RETURNING p.id
   )
   SELECT EXISTS(SELECT 1 FROM selected) AS found, count(*)::int AS changed FROM changed`;
  if(!result.found)return json({error:'ไม่พบแผนนี้'},404);
  if(!result.changed)return json({error:'วันนี้มีผลฝึกแล้ว จึงแก้รายการท่าไม่ได้'},409);
  return json({ok:true,count:result.changed});
 }
 if(request.method==='POST'){
  let plans;
  try{
   const text=await request.text();if(text.length>100000)throw Error('ข้อมูลใหญ่เกินไป');
   const body=JSON.parse(text);
   if(body.period==='program')plans=weeklyProgram(body);
   else{const days=planDays(body),exercises=planExercises(body);plans=days.map(day=>({day,exercises}));}
  }catch(e){return json({error:e.message},400);}
  const batch=crypto.randomUUID();
  if(!memberId){
   const [{members}]=await sql`
    WITH recipients AS (
     SELECT owner_id AS user_id FROM trainer_teams WHERE id=${team.id}
     UNION
     SELECT user_id FROM team_members WHERE team_id=${team.id} AND status='active'
    ), assigned AS (
     INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id,team_wide)
     SELECT ${team.id},r.user_id,p.day,p.exercises,${me},${batch},true
     FROM recipients r
     CROSS JOIN jsonb_to_recordset(${JSON.stringify(plans)}::jsonb) AS p(day date,exercises jsonb)
     RETURNING user_id
    )
    SELECT count(DISTINCT user_id)::int AS members FROM assigned`;
   return json({ok:true,count:plans.length,members,firstDay:plans[0].day});
  }
  await sql.transaction(plans.map(({day,exercises})=>sql`INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id) VALUES (${teamId},${memberId},${day},${JSON.stringify(exercises)}::jsonb,${me},${batch})`));
  return json({ok:true,count:plans.length,firstDay:plans[0].day});
 }
 if(request.method==='DELETE'){const id=new URL(request.url).searchParams.get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))return json({error:'รหัสแผนไม่ถูกต้อง'},400);await sql`DELETE FROM training_plans WHERE id=${id} AND team_id IS NOT DISTINCT FROM ${teamId} AND user_id=${memberId}`;return json({ok:true});}return json({error:'ไม่พบ API'},404);
}
// Rows that belong to one saved program: one member's copy, or every member's copy of a team-wide program.
function programRows(sql,{teamId,memberId,batch}){
 return memberId
  ?sql`SELECT id,user_id,day::text AS day FROM training_plans WHERE team_id IS NOT DISTINCT FROM ${teamId} AND batch_id=${batch} AND user_id=${memberId}`
  :sql`SELECT id,user_id,day::text AS day FROM training_plans WHERE team_id=${teamId} AND batch_id=${batch} AND (team_wide OR batch_id IN (
    SELECT batch_id FROM training_plans WHERE team_id=${teamId} GROUP BY batch_id HAVING count(DISTINCT user_id)>1))`;
}
// Saved results point at a plan id, so a day someone already trained keeps its prescription.
async function withoutResults(sql,rows){
 if(!rows.length)return [];
 const logged=new Set((await sql`SELECT payload->>'planId' AS id FROM daily_logs WHERE payload->>'planId'=ANY(${rows.map(row=>String(row.id))}::text[])`).map(row=>row.id));
 return rows.filter(row=>!logged.has(String(row.id)));
}
// Edit a whole program: days from today on that have no results are rewritten from the new weekly schedule.
// Past days stay as they were, so history and team points do not change.
async function replaceProgram(request,sql,{team,teamId,memberId,me,batch,today,json}){
 let plans;
 try{
  const text=await request.text();if(text.length>100000)throw Error('ข้อมูลใหญ่เกินไป');
  plans=weeklyProgram(JSON.parse(text));
 }catch(error){return json({error:error.message},400);}
 const rows=await programRows(sql,{teamId,memberId,batch});
 if(!rows.length)return json({error:'ไม่พบโปรแกรมนี้'},404);
 const removable=(await withoutResults(sql,rows.filter(row=>row.day>=today)));
 if(removable.length)await sql`DELETE FROM training_plans WHERE id=ANY(${removable.map(row=>String(row.id))}::uuid[])`;
 const gone=new Set(removable.map(row=>row.id));
 const kept=new Set(rows.filter(row=>!gone.has(row.id)).map(row=>row.user_id+' '+row.day));
 const future=plans.filter(plan=>plan.day>=today);
 const recipients=memberId?[memberId]:(await sql`
  SELECT owner_id AS user_id FROM trainer_teams WHERE id=${team.id}
  UNION SELECT user_id FROM team_members WHERE team_id=${team.id} AND status='active'`).map(row=>row.user_id);
 const inserts=recipients.flatMap(user=>future.filter(plan=>!kept.has(user+' '+plan.day)).map(plan=>({user,...plan})));
 if(inserts.length)await sql`
  INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id,team_wide)
  SELECT ${teamId}::uuid,p.user_id,p.day,p.exercises,${me},${batch}::uuid,${!memberId}
  FROM jsonb_to_recordset(${JSON.stringify(inserts.map(({user,day,exercises})=>({user_id:user,day,exercises})))}::jsonb) AS p(user_id text,day date,exercises jsonb)`;
 const locked=rows.filter(row=>row.day>=today&&!gone.has(row.id)).length;
 return json({ok:true,count:new Set(inserts.map(row=>row.day)).size,locked});
}
// Delete a program from today on (or one day of it). Days with results and past days are kept as history.
async function deleteProgram(sql,{teamId,memberId,batch,today,day,json}){
 if(day!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({error:'วันที่ไม่ถูกต้อง'},400);
 const rows=(await programRows(sql,{teamId,memberId,batch})).filter(row=>day===null?row.day>=today:row.day===day);
 const removable=await withoutResults(sql,rows);
 if(removable.length)await sql`DELETE FROM training_plans WHERE id=ANY(${removable.map(row=>String(row.id))}::uuid[])`;
 return json({ok:true,count:removable.length,locked:rows.length-removable.length});
}
// Team-wide plans are copied to each member when saved, so someone who joins later would never get them.
// Give an active member their own copy of team-wide plans that were saved before they joined, for days from
// their join date on. Plans saved after joining were already copied, so a copy a trainer removed stays removed.
export async function syncTeamPlans(sql,me,from=null,to=null){
 await sql`
  INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id,team_wide)
  SELECT DISTINCT ON (p.batch_id,p.day) p.team_id,${me},p.day,p.exercises,p.created_by,p.batch_id,true
  FROM training_plans p
  JOIN team_members m ON m.team_id=p.team_id AND m.user_id=${me} AND m.status='active'
  WHERE p.team_wide AND p.user_id<>${me}
   AND p.created_at<COALESCE(m.joined_at,'infinity'::timestamptz)
   AND p.day>=COALESCE((m.joined_at AT TIME ZONE 'Asia/Bangkok')::date,'-infinity'::date)
   AND (${from}::date IS NULL OR p.day>=${from}::date) AND (${to}::date IS NULL OR p.day<=${to}::date)
   AND NOT EXISTS (SELECT 1 FROM training_plans x WHERE x.batch_id=p.batch_id AND x.day=p.day AND x.user_id=${me})
  ORDER BY p.batch_id,p.day,p.created_at`;
}
// Plans the training page shows for `days`+1 days from `day`: personal plans, and team plans only while the
// person still owns the team or is an active member. Leaving a team hides its plans; rejoining shows them again.
export async function readPlans(sql,me,day,days=0){
 const to=new Date(Date.parse(day+'T12:00:00Z')+days*864e5).toISOString().slice(0,10);
 await syncTeamPlans(sql,me,day,to);
 return sql`
  SELECT p.id,p.day::text AS day,p.exercises,COALESCE(t.name,'โปรแกรมส่วนตัว') AS team_name
  FROM training_plans p LEFT JOIN trainer_teams t ON t.id=p.team_id
  WHERE p.user_id=${me} AND p.day BETWEEN ${day}::date AND ${to}::date
   AND (p.team_id IS NULL OR t.owner_id=${me}
    OR EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.user_id=${me} AND m.status='active'))
  ORDER BY p.day,p.created_at`;
}
