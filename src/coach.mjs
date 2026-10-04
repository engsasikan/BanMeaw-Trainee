import {validateRecords,localDay} from '../dist/store.mjs';
import {validateBody} from '../dist/body-data.mjs';
import {planExercises} from './plans.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const validDate=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&localDay(new Date(day+'T12:00:00'))===day;
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function coachTarget(sql,team,mine,me,target){
 const coach=team.owner_id===me||(mine?.status==='active'&&mine.team_role==='trainer');
 const [member]=target===team.owner_id?[{team_role:team.owner_role}]:await sql`SELECT team_role FROM team_members WHERE team_id=${team.id} AND user_id=${target} AND status='active'`;
 return Boolean(member?.team_role==='trainee'&&(coach||(target===me&&mine?.status==='active')));
}
export async function handleFeedback(request,sql,user,team,mine,target){
 const coach=team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer');
 if(!await coachTarget(sql,team,mine,user.sub,target))return json({error:'ไม่มีสิทธิ์เข้าถึงคำแนะนำ'},403);
 const day=new URL(request.url).searchParams.get('day');
 if(!validDate(day))return json({error:'วันที่ไม่ถูกต้อง'},400);
 if(request.method==='GET')return json({feedback:await sql`SELECT f.id,f.day,f.text,f.reviewed,f.created_at,(NOT EXISTS (SELECT 1 FROM daily_logs l WHERE l.user_id=f.user_id AND l.day=f.day AND l.updated_at>f.created_at) AND NOT EXISTS (SELECT 1 FROM body_measurements b WHERE b.user_id=f.user_id AND b.day=f.day AND b.updated_at>f.created_at)) AS review_current,m.display_name AS author_name FROM trainer_feedback f JOIN members m ON m.id=f.author_id WHERE f.team_id=${team.id} AND f.user_id=${target} AND f.day=${day}::date ORDER BY f.created_at`});
 if(request.method!=='POST')return json({error:'ไม่รองรับคำสั่ง'},405);
 if(!coach)return json({error:'เฉพาะเทรนเนอร์ของทีมเท่านั้น'},403);
 let value;try{const text=await request.text();if(text.length>8000)throw Error();value=JSON.parse(text);}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(typeof value.text!=='string'||value.text.trim().length>2000||typeof value.reviewed!=='boolean'||(!value.text.trim()&&!value.reviewed))return json({error:'ใส่คำแนะนำหรือเลือกตรวจแล้ว'},400);
 await sql`INSERT INTO trainer_feedback (team_id,user_id,day,author_id,text,reviewed) VALUES (${team.id},${target},${day},${user.sub},${value.text.trim()},${value.reviewed})`;
 return json({ok:true});
}
export async function handleMemberProgress(request,sql,user,team,mine,target){
 const coach=team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer');
 if(!coach||!await coachTarget(sql,team,mine,user.sub,target))return json({error:'เฉพาะเทรนเนอร์ของลูกเทรนเท่านั้น'},403);
 const day=new URL(request.url).searchParams.get('day');if(!validDate(day))return json({error:'วันที่ไม่ถูกต้อง'},400);
 const start=new Date(day+'T12:00:00');start.setDate(start.getDate()-13);
 const records=await sql`SELECT payload FROM daily_logs WHERE user_id=${target} AND day BETWEEN ${localDay(start)}::date AND ${day}::date ORDER BY day DESC,created_at DESC`;
 const body=await sql`SELECT payload FROM body_measurements WHERE user_id=${target} AND day<=${day}::date ORDER BY day DESC,updated_at DESC`;
 const plans=await sql`SELECT id,day,exercises FROM training_plans WHERE team_id=${team.id} AND user_id=${target} AND day=${day}::date ORDER BY created_at`;
 return json({records:records.map(r=>r.payload),body:body.map(r=>r.payload),plans});
}
export async function handleOwnFeedback(request,sql,user){
 const day=new URL(request.url).searchParams.get('day');if(!validDate(day))return json({error:'วันที่ไม่ถูกต้อง'},400);
 if(request.method!=='GET')return json({error:'ไม่รองรับคำสั่ง'},405);
 return json({feedback:await sql`SELECT f.id,f.day,f.text,f.reviewed,f.created_at,m.display_name AS author_name,t.name AS team_name FROM trainer_feedback f JOIN members m ON m.id=f.author_id JOIN trainer_teams t ON t.id=f.team_id WHERE f.user_id=${user.sub} AND f.day=${day}::date AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')) ORDER BY f.created_at`});
}
export async function handleBackup(request,sql,user){
 if(request.method==='GET'){
  const [profile]=await sql`SELECT id,member_code,display_name,sex,avatar FROM members WHERE id=${user.sub}`;
  const entries=await sql`SELECT payload FROM daily_logs WHERE user_id=${user.sub} ORDER BY day,id`;
  const body=await sql`SELECT payload FROM body_measurements WHERE user_id=${user.sub} ORDER BY day DESC,updated_at DESC`;
  const reports=await sql`SELECT day::text,sent_at FROM daily_reports WHERE user_id=${user.sub} ORDER BY day`;
  const plans=await sql`SELECT p.* FROM training_plans p JOIN trainer_teams t ON t.id=p.team_id WHERE (p.user_id=${user.sub} OR p.created_by=${user.sub} OR t.owner_id=${user.sub}) AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')) ORDER BY p.day,p.id`;
  const feedback=await sql`SELECT f.* FROM trainer_feedback f JOIN trainer_teams t ON t.id=f.team_id WHERE (f.user_id=${user.sub} OR f.author_id=${user.sub} OR t.owner_id=${user.sub}) AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')) ORDER BY f.created_at`;
  const teams=await sql`SELECT t.id,t.name,t.owner_id FROM trainer_teams t WHERE t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')`;
  const nutritionTargets=await sql`SELECT * FROM nutrition_targets WHERE user_id=${user.sub} ORDER BY updated_at`;
  const wallets=await sql`SELECT * FROM team_point_wallets WHERE user_id=${user.sub}`;
  const awards=await sql`SELECT * FROM team_point_awards WHERE user_id=${user.sub} ORDER BY day`;
  const redemptions=await sql`SELECT * FROM team_redemptions WHERE user_id=${user.sub} ORDER BY created_at`;
  const rewards=await sql`SELECT r.* FROM team_rewards r JOIN trainer_teams t ON t.id=r.team_id WHERE t.owner_id=${user.sub}`;
  return json({version:3,exportedAt:new Date().toISOString(),profile,records:entries.map(r=>r.payload),body:body.map(r=>r.payload),reports,plans,feedback,teams,nutritionTargets,game:{wallets,awards,redemptions,rewards}});
 }
 if(request.method!=='POST')return json({error:'ไม่รองรับคำสั่ง'},405);
 let value;try{const text=await request.text();if(text.length>262144)return json({error:'ข้อมูลชุดนี้ใหญ่เกินไป'},413);value=JSON.parse(text);}catch{return json({error:'ไฟล์ไม่ถูกต้อง'},400);}
 if(value.ownerId!==user.sub)return json({error:'ไฟล์สำรองเป็นของบัญชีอื่น'},403);
 const {type,rows}=value;
 if(!['records','body','reports','plans','profile'].includes(type)||!Array.isArray(rows)||rows.length>25)return json({error:'รูปแบบข้อมูลสำรองไม่ถูกต้อง'},400);
 let validated;try{
  if(type==='records')validated=validateRecords(rows);
  if(type==='body')validated=rows.map(validateBody);
  if(type==='reports'){validated=rows;if(rows.some(r=>!validDate(r.day)||!r.sent_at||!Number.isFinite(Date.parse(r.sent_at))))throw Error();}
  if(type==='plans'){validated=rows.map(p=>{if(!uuid(p.id)||!uuid(p.team_id)||!uuid(p.batch_id)||!validDate(p.day)||typeof p.user_id!=='string'||!p.user_id||p.user_id.length>200)throw Error();return {...p,exercises:planExercises({exercises:p.exercises})};});}
  if(type==='profile'){if(rows.length!==1||![null,'male','female'].includes(rows[0].sex))throw Error();validated=rows;
   const avatar=rows[0].avatar;if(avatar!=null){if(typeof avatar!=='string'||avatar.length>90000||! /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatar))throw Error();const bytes=atob(avatar.split(',')[1]);if(bytes.length>65536||bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216||bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)throw Error();}
  }
 }catch{return json({error:'ข้อมูลสำรองไม่ถูกต้อง ไม่มีการนำเข้าชุดนี้'},400);}
 let added=0,skipped=0;
 // Add missing records only; backups never overwrite newer edits or recreate team permissions.
 for(const row of validated){
  let result=[];
  if(type==='records'){const {planId,planExerciseIndex,...record}=row;
   if(planId){const [plan]=await sql`SELECT p.day::text,p.exercises FROM training_plans p JOIN trainer_teams t ON t.id=p.team_id WHERE p.id=${planId} AND p.user_id=${user.sub} AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active'))`;
    if(plan?.day===row.day&&row.trainingType==='strength'&&plan.exercises[planExerciseIndex]?.exercise===row.exercise){record.planId=planId;record.planExerciseIndex=planExerciseIndex;}
   }
   result=await sql`INSERT INTO daily_logs (user_id,id,day,kind,payload) VALUES (${user.sub},${record.id},${record.day},${record.kind==='workout'?'workout':'meal'},${JSON.stringify(record)}::jsonb) ON CONFLICT DO NOTHING RETURNING id`;}
  if(type==='body')result=await sql`INSERT INTO body_measurements (user_id,id,day,payload) VALUES (${user.sub},${row.id},${row.day},${JSON.stringify(row)}::jsonb) ON CONFLICT DO NOTHING RETURNING id`;
  if(type==='reports')result=await sql`INSERT INTO daily_reports (user_id,day,sent_at) VALUES (${user.sub},${row.day},${row.sent_at}::timestamptz) ON CONFLICT DO NOTHING RETURNING day`;
  if(type==='profile')result=await sql`UPDATE members SET sex=COALESCE(sex,${row.sex}),avatar=COALESCE(avatar,${row.avatar??null}) WHERE id=${user.sub} RETURNING id`;
  if(type==='plans'){
   const [team]=await sql`SELECT id,owner_id,owner_role FROM trainer_teams WHERE id=${row.team_id}`;
   const [mine]=team&&team.owner_id!==user.sub?await sql`SELECT status,team_role FROM team_members WHERE team_id=${team.id} AND user_id=${user.sub}`:[];
   if(!team||!(team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer'))||!(row.user_id===user.sub||await coachTarget(sql,team,mine,user.sub,row.user_id))){skipped++;continue;}
   result=await sql`INSERT INTO training_plans (id,team_id,user_id,day,exercises,created_by,batch_id) VALUES (${row.id},${row.team_id},${row.user_id},${row.day},${JSON.stringify(row.exercises)}::jsonb,${user.sub},${row.batch_id}) ON CONFLICT DO NOTHING RETURNING id`;
  }
  if(result.length)added++;else skipped++;
 }
 return json({ok:true,added,skipped});
}
