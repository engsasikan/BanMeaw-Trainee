import {coachTarget} from './coach.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function handleNutrition(request,sql,user,team,mine,target){
 if(!(target===user.sub&&(team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer')))&&!await coachTarget(sql,team,mine,user.sub,target))return json({error:'ไม่มีสิทธิ์เข้าถึงเป้าหมายอาหาร'},403);
 if(request.method==='GET'){const [goal]=await sql`SELECT calories,protein,updated_at FROM nutrition_targets WHERE team_id=${team.id} AND user_id=${target}`;return json({goal:goal||null});}
 const coach=team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer');
 if(!coach)return json({error:'เฉพาะเทรนเนอร์ของทีมเท่านั้น'},403);
 if(request.method!=='PUT')return json({error:'ไม่รองรับคำขอนี้'},405);
 let value;try{const text=await request.text();if(text.length>1000)throw Error();value=JSON.parse(text);}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(!value||typeof value.calories!=='number'||!Number.isFinite(value.calories)||value.calories<=0||value.calories>20000||typeof value.protein!=='number'||!Number.isFinite(value.protein)||value.protein<=0||value.protein>1000)return json({error:'กรอกแคลอรี 1–20,000 kcal และโปรตีน 0.1–1,000 กรัมต่อวัน'},400);
 const [goal]=await sql`INSERT INTO nutrition_targets (team_id,user_id,calories,protein,updated_by) VALUES (${team.id},${target},${value.calories},${value.protein},${user.sub}) ON CONFLICT (team_id,user_id) DO UPDATE SET calories=EXCLUDED.calories,protein=EXCLUDED.protein,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING calories,protein,updated_at`;
 return json({goal});
}
export async function handleOwnNutrition(request,sql,user){
 if(request.method!=='GET')return json({error:'ไม่รองรับคำขอนี้'},405);
 return json({goals:await sql`SELECT n.calories,n.protein,n.updated_at,t.name AS team_name,m.display_name AS trainer_name FROM nutrition_targets n JOIN trainer_teams t ON t.id=n.team_id JOIN members m ON m.id=n.updated_by WHERE n.user_id=${user.sub} AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')) ORDER BY n.updated_at DESC`});
}
