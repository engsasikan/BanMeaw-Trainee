import {validDate} from './coach.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const REWARDS=[{code:'drink',name:'น้ำหวาน',cost:40},{code:'shabu',name:'ชาบู',cost:120},{code:'bbq',name:'ปิ้งย่าง',cost:150}];
export const bangkokDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function claimWindow(day,now=new Date()){
 if(!validDate(day))return false;const end=bangkokDay(now),start=new Date(end+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-6);return day>=start.toISOString().slice(0,10)&&day<=end;
}
export function dailyScore(records,{sent=false,rest=false}={}){
 const meals=records.filter(r=>r.kind!=='workout'&&typeof r.text==='string'&&r.text.trim());
 if(!sent||!meals.length)return 0;
 const complete=['มื้อเช้า','มื้อกลางวัน','มื้อเย็น'].every(m=>meals.some(r=>r.meal===m));
 return 10+(complete?5:0)+(records.some(r=>r.kind==='workout')||rest?5:0);
}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function handleTeamGame(request,sql,user,team,mine,action){
 const me=user.sub,owner=team.owner_id===me,active=owner||mine?.status==='active',coach=owner||(active&&mine.team_role==='trainer');
 if(!active)return json({error:'เฉพาะสมาชิกที่เข้าร่วมทีมแล้ว'},403);
 if(request.method==='GET'&&!action){
  const day=new URL(request.url).searchParams.get('day')||bangkokDay();if(!validDate(day))return json({error:'วันที่ไม่ถูกต้อง'},400);
  const players=await sql`WITH players AS (SELECT t.owner_id AS id,t.owner_role AS team_role FROM trainer_teams t WHERE t.id=${team.id} UNION ALL SELECT user_id,team_role FROM team_members WHERE team_id=${team.id} AND status='active') SELECT m.id,m.display_name,m.member_code,p.team_role,COALESCE(w.balance,0) AS balance,COALESCE(w.earned,0) AS earned,CASE WHEN r.team_visible THEN r.sent_at END AS sent_at,a.points AS day_points,a.rest_day FROM players p JOIN members m ON m.id=p.id LEFT JOIN team_point_wallets w ON w.team_id=${team.id} AND w.user_id=p.id LEFT JOIN daily_reports r ON r.user_id=p.id AND r.day=${day}::date LEFT JOIN team_point_awards a ON a.team_id=${team.id} AND a.user_id=p.id AND a.day=${day}::date ORDER BY COALESCE(w.earned,0) DESC,m.display_name`;
  const rewards=await sql`SELECT code,cost,enabled FROM team_rewards WHERE team_id=${team.id}`;
  const redemptions=await sql`SELECT r.id,r.user_id,m.display_name,r.reward,r.cost,r.status,r.created_at,r.resolved_at FROM team_redemptions r JOIN members m ON m.id=r.user_id WHERE r.team_id=${team.id} AND (r.user_id=${me} OR ${coach}) ORDER BY r.created_at DESC LIMIT 50`;
  const awards=await sql`SELECT day,points,rest_day FROM team_point_awards WHERE team_id=${team.id} AND user_id=${me} ORDER BY day DESC LIMIT 30`;
  const reports=await sql`SELECT l.user_id,l.payload,(l.updated_at>r.sent_at) AS changed_after_send FROM daily_logs l JOIN daily_reports r ON r.user_id=l.user_id AND r.day=l.day WHERE l.day=${day}::date AND r.team_visible AND EXISTS (SELECT 1 FROM trainer_teams t WHERE t.id=${team.id} AND (t.owner_id=l.user_id OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=l.user_id AND tm.status='active'))) ORDER BY l.user_id,l.created_at`;
  return json({day,me,coach,owner,players,rewards:REWARDS.map(r=>({...r,enabled:true,...rewards.find(x=>x.code===r.code)})),redemptions,awards,reports,claimable:claimWindow(day)});
 }
 if(request.method!=='POST'||!['claim','redeem','resolve','rewards'].includes(action))return json({error:'ไม่พบคำขอนี้'},404);
 let body;try{const text=await request.text();if(text.length>3000)throw Error();body=JSON.parse(text);if(!body||typeof body!=='object')throw Error();}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400);}
 if(action==='rewards'){
  if(!owner)return json({error:'เฉพาะผู้สร้างทีมตั้งค่ารางวัลได้'},403);
  if(!REWARDS.some(r=>r.code===body.code)||!Number.isInteger(body.cost)||body.cost<1||body.cost>100000||typeof body.enabled!=='boolean')return json({error:'คะแนนรางวัลต้องเป็นจำนวนเต็ม 1–100,000'},400);
  await sql`INSERT INTO team_rewards (team_id,code,cost,enabled) VALUES (${team.id},${body.code},${body.cost},${body.enabled}) ON CONFLICT (team_id,code) DO UPDATE SET cost=EXCLUDED.cost,enabled=EXCLUDED.enabled`;
  return json({ok:true});
 }
 if(action==='claim'){
  if(!claimWindow(body.day)||typeof body.rest!=='boolean')return json({error:'รับคะแนนได้เฉพาะวันนี้และย้อนหลังไม่เกิน 6 วัน'},400);
  await sql`INSERT INTO team_point_wallets (team_id,user_id) VALUES (${team.id},${me}) ON CONFLICT DO NOTHING`;
  // One statement evaluates stored records, verifies a current submitted report, inserts once, and credits the wallet.
  const result=await sql`WITH eligible AS (
   SELECT r.user_id,r.day,10+CASE WHEN count(DISTINCT l.payload->>'meal') FILTER (WHERE l.kind='meal' AND l.payload->>'meal' IN ('มื้อเช้า','มื้อกลางวัน','มื้อเย็น'))=3 THEN 5 ELSE 0 END+CASE WHEN bool_or(l.kind='workout') OR ${body.rest} THEN 5 ELSE 0 END AS points
   FROM daily_reports r JOIN daily_logs l ON l.user_id=r.user_id AND l.day=r.day JOIN trainer_teams t ON t.id=${team.id}
   WHERE r.user_id=${me} AND r.team_visible AND r.day=${body.day}::date AND r.day>=(t.created_at AT TIME ZONE 'Asia/Bangkok')::date
   AND (t.owner_id=${me} OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=${me} AND tm.status='active' AND r.day>=(tm.joined_at AT TIME ZONE 'Asia/Bangkok')::date))
   AND NOT EXISTS (SELECT 1 FROM daily_logs changed WHERE changed.user_id=r.user_id AND changed.day=r.day AND changed.updated_at>r.sent_at)
   GROUP BY r.user_id,r.day HAVING count(*) FILTER (WHERE l.kind='meal' AND length(trim(l.payload->>'text'))>0)>0
  ), awarded AS (INSERT INTO team_point_awards (team_id,user_id,day,points,rest_day) SELECT ${team.id},user_id,day,points,${body.rest} FROM eligible ON CONFLICT DO NOTHING RETURNING points)
  UPDATE team_point_wallets SET balance=balance+(SELECT points FROM awarded),earned=earned+(SELECT points FROM awarded) WHERE team_id=${team.id} AND user_id=${me} AND EXISTS (SELECT 1 FROM awarded) RETURNING balance,earned`;
  return result.length?json({ok:true,wallet:result[0]}):json({error:'รับคะแนนวันนี้แล้ว หรือยังไม่มีอาหารและสรุปที่ส่งล่าสุด กรุณาส่งสรุปหลังบันทึกครบก่อนรับคะแนน'},409);
 }
 if(action==='redeem'){
  const reward=REWARDS.find(r=>r.code===body.reward);if(!reward||!uuid(body.requestId))return json({error:'รางวัลหรือรหัสคำขอไม่ถูกต้อง'},400);
  const [existing]=await sql`SELECT id,status FROM team_redemptions WHERE team_id=${team.id} AND user_id=${me} AND request_id=${body.requestId}`;
  if(existing)return json({ok:true,redemption:existing});
  // The wallet update locks the row; both concurrent spending and duplicate request IDs are guarded atomically.
  try{
   const rows=await sql`WITH reward AS (SELECT COALESCE(r.cost,${reward.cost}) AS cost,COALESCE(r.enabled,true) AS enabled FROM (SELECT 1) seed LEFT JOIN team_rewards r ON r.team_id=${team.id} AND r.code=${reward.code}), debit AS (UPDATE team_point_wallets w SET balance=w.balance-r.cost FROM reward r WHERE w.team_id=${team.id} AND w.user_id=${me} AND r.enabled AND w.balance>=r.cost RETURNING r.cost)
   INSERT INTO team_redemptions (team_id,user_id,reward,cost,request_id) SELECT ${team.id},${me},${reward.code},cost,${body.requestId} FROM debit RETURNING id,status,cost`;
   if(rows.length)return json({ok:true,redemption:rows[0]});
   const [retry]=await sql`SELECT id,status FROM team_redemptions WHERE team_id=${team.id} AND user_id=${me} AND request_id=${body.requestId}`;
   return retry?json({ok:true,redemption:retry}):json({error:'คะแนนไม่พอ หรือรางวัลนี้ปิดการแลกแล้ว'},409);
  }catch(error){if(error.code==='23505'){const [row]=await sql`SELECT id,status FROM team_redemptions WHERE team_id=${team.id} AND user_id=${me} AND request_id=${body.requestId}`;if(row)return json({ok:true,redemption:row});}throw error;}
 }
 if(!uuid(body.id)||!['fulfilled','rejected','cancelled'].includes(body.status))return json({error:'สถานะรางวัลไม่ถูกต้อง'},400);
 const [redemption]=await sql`SELECT user_id,status FROM team_redemptions WHERE id=${body.id} AND team_id=${team.id}`;
 if(!redemption)return json({error:'ไม่พบรายการแลก'},404);
 if(body.status==='cancelled'?redemption.user_id!==me:!coach||(body.status==='rejected'&&redemption.user_id===me))return json({error:'ยกเลิกได้เฉพาะรายการตัวเอง และเฉพาะเทรนเนอร์ยืนยันรับรางวัลได้'},403);
 if(body.status==='fulfilled'){
  const rows=await sql`UPDATE team_redemptions SET status='fulfilled',resolved_by=${me},resolved_at=now() WHERE id=${body.id} AND team_id=${team.id} AND status='pending' RETURNING id`;
  return rows.length?json({ok:true}):json({error:'รายการนี้ดำเนินการแล้ว'},409);
 }
 const rows=await sql`WITH refunded AS (UPDATE team_redemptions SET status=${body.status},resolved_by=${me},resolved_at=now() WHERE id=${body.id} AND team_id=${team.id} AND status='pending' RETURNING user_id,cost)
 UPDATE team_point_wallets w SET balance=w.balance+r.cost FROM refunded r WHERE w.team_id=${team.id} AND w.user_id=r.user_id RETURNING w.balance`;
 return rows.length?json({ok:true}):json({error:'รายการนี้ดำเนินการแล้ว'},409);
}
