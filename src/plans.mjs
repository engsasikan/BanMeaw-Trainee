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
  if(!r||typeof r.exercise!=='string'||!r.exercise.trim()||r.exercise.length>150||!Number.isInteger(r.sets)||r.sets<1||r.sets>100||!Number.isInteger(r.reps)||r.reps<1||r.reps>1000||!(r.weight===null||(typeof r.weight==='number'&&Number.isFinite(r.weight)&&r.weight>=0&&r.weight<=2000)))throw Error('ตรวจชื่อท่า น้ำหนัก จำนวนครั้ง และเซ็ต');
  const out={exercise:r.exercise.trim(),weight:r.weight,sets:r.sets,reps:r.reps};
  if(r.rest_seconds!=null){if(!Number.isInteger(r.rest_seconds)||r.rest_seconds<0||r.rest_seconds>3600)throw Error('เวลาพักต้องเป็น 0–3600 วินาที');out.rest_seconds=r.rest_seconds;}
  if(r.superset!=null&&r.superset!==''){if(typeof r.superset!=='string'||! /^[A-O]$/.test(r.superset))throw Error('กลุ่ม Super set ไม่ถูกต้อง');out.superset=r.superset;}
  return out;
 });
 for(const group of new Set(exercises.map(r=>r.superset).filter(Boolean))){
  if(exercises.filter(r=>r.superset===group).length<2)throw Error('Super set '+group+' ต้องมีอย่างน้อย 2 ท่า');
 }
 return exercises;
}
export async function handlePlans(request,sql,user,team,mine,memberId){
 const me=user.sub,owner=team.owner_id===me,trainer=owner||(mine?.status==='active'&&mine.team_role==='trainer');
 const [target]=memberId===team.owner_id?[{team_role:team.owner_role}]:await sql`SELECT team_role FROM team_members WHERE team_id=${team.id} AND user_id=${memberId} AND status='active'`;
 if(!target||(target.team_role!=='trainee'&&!(trainer&&memberId===me))||(!trainer&&memberId!==me))return Response.json({error:'ไม่มีสิทธิ์เข้าถึงแผนนี้'},{status:403});
 const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method==='GET')return json({plans:await sql`SELECT id,day::text AS day,exercises,created_by FROM training_plans WHERE team_id=${team.id} AND user_id=${memberId} ORDER BY day,id LIMIT 1000`});
 if(!trainer)return json({error:'เฉพาะเทรนเนอร์เท่านั้น' },403);
 if(request.method==='POST'){let body,days,exercises;try{const text=await request.text();if(text.length>16000)throw Error('ข้อมูลใหญ่เกินไป');body=JSON.parse(text);days=planDays(body);exercises=planExercises(body);}catch(e){return json({error:e.message},400);}const batch=crypto.randomUUID();await sql.transaction(days.map(day=>sql`INSERT INTO training_plans (team_id,user_id,day,exercises,created_by,batch_id) VALUES (${team.id},${memberId},${day},${JSON.stringify(exercises)}::jsonb,${me},${batch})`));return json({ok:true,count:days.length});}
 if(request.method==='DELETE'){const id=new URL(request.url).searchParams.get('id');if(!/^[0-9a-f-]{36}$/i.test(id||''))return json({error:'รหัสแผนไม่ถูกต้อง'},400);await sql`DELETE FROM training_plans WHERE id=${id} AND team_id=${team.id} AND user_id=${memberId}`;return json({ok:true});}return json({error:'ไม่พบ API'},404);
}
