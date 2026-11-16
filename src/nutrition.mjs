import {coachTarget} from './coach.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
// A daily food goal: calories and protein are required, carbohydrate is optional. Null when the body is not valid.
export function goalValues(value){
 const ok=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(!value||!ok(value.calories,1,20000)||!ok(value.protein,0.1,1000))return null;
 if(value.carbs!=null&&!ok(value.carbs,0,3000))return null;
 return {calories:value.calories,protein:value.protein,carbs:value.carbs??null};
}
const GOAL_ERROR='กรอกแคลอรี 1–20,000 kcal, โปรตีน 0.1–1,000 กรัม และคาร์บ 0–3,000 กรัมต่อวัน (คาร์บไม่บังคับ)';
async function readBody(request){const text=await request.text();if(text.length>1000)throw Error();return JSON.parse(text);}
export async function handleNutrition(request,sql,user,team,mine,target){
 if(!(target===user.sub&&(team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer')))&&!await coachTarget(sql,team,mine,user.sub,target))return json({error:'ไม่มีสิทธิ์เข้าถึงเป้าหมายอาหาร'},403);
 if(request.method==='GET'){const [goal]=await sql`SELECT calories,protein,carbs,updated_at FROM nutrition_targets WHERE team_id=${team.id} AND user_id=${target}`;return json({goal:goal||null});}
 const coach=team.owner_id===user.sub||(mine?.status==='active'&&mine.team_role==='trainer');
 if(!coach)return json({error:'เฉพาะเทรนเนอร์ของทีมเท่านั้น'},403);
 if(request.method!=='PUT')return json({error:'ไม่รองรับคำขอนี้'},405);
 let value;try{value=goalValues(await readBody(request));}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(!value)return json({error:GOAL_ERROR},400);
 const [goal]=await sql`INSERT INTO nutrition_targets (team_id,user_id,calories,protein,carbs,updated_by) VALUES (${team.id},${target},${value.calories},${value.protein},${value.carbs},${user.sub}) ON CONFLICT (team_id,user_id) DO UPDATE SET calories=EXCLUDED.calories,protein=EXCLUDED.protein,carbs=EXCLUDED.carbs,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING calories,protein,carbs,updated_at`;
 return json({goal});
}
// The member's goals from their trainers, plus their own goal for when no trainer has set one.
// PUT sets the own goal; {"clear":true} removes it.
export async function handleOwnNutrition(request,sql,user){
 if(request.method==='PUT'){
  let body;try{body=await readBody(request);}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
  const own=body?.clear===true?null:goalValues(body);
  if(body?.clear!==true&&!own)return json({error:GOAL_ERROR},400);
  await sql`UPDATE members SET nutrition_goal=${own?JSON.stringify(own):null}::jsonb WHERE id=${user.sub}`;
  return json({own});
 }
 if(request.method!=='GET')return json({error:'ไม่รองรับคำขอนี้'},405);
 const goals=await sql`SELECT n.calories,n.protein,n.carbs,n.updated_at,t.name AS team_name,m.display_name AS trainer_name FROM nutrition_targets n JOIN trainer_teams t ON t.id=n.team_id JOIN members m ON m.id=n.updated_by WHERE n.user_id=${user.sub} AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${user.sub} AND tm.status='active')) ORDER BY n.updated_at DESC`;
 const [me]=await sql`SELECT nutrition_goal FROM members WHERE id=${user.sub}`;
 return json({goals,own:me?.nutrition_goal??null});
}
