// A team's (set by its trainers) or a member's own warm-up and cool-down, used by the workout screen when a
// day's plan has no warm-up or cool-down of its own. Without one the app's standard set is used.
const MAX_MOVES=10;
export function cleanRoutine(body){
 const list=(moves,label)=>{
  if(moves==null)return [];
  if(!Array.isArray(moves)||moves.length>MAX_MOVES)throw Error(label+'ใส่ได้ 0–'+MAX_MOVES+' ท่า');
  return moves.map(m=>{
   const exercise=typeof m?.exercise==='string'?m.exercise.trim():'';
   if(!exercise||exercise.length>150)throw Error('ตรวจชื่อท่าใน'+label);
   if(!Number.isInteger(m.seconds)||m.seconds<10||m.seconds>600)throw Error('เวลาท่าใน'+label+'ต้องเป็น 10–600 วินาที');
   return {exercise,seconds:m.seconds};
  });
 };
 const routine={warmup:list(body?.warmup,'วอร์มอัพ'),cooldown:list(body?.cooldown,'คูลดาวน์')};
 return routine.warmup.length||routine.cooldown.length?routine:null;
}
export async function handleRoutine(request,sql,user,team=null,mine=null){
 const me=user.sub,json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
 const owner=team?.owner_id===me,member=!team||owner||mine?.status==='active',trainer=!team||owner||(mine?.status==='active'&&mine.team_role==='trainer');
 if(!member)return json({error:'ไม่มีสิทธิ์เข้าถึงทีมนี้'},403);
 if(request.method==='GET'){
  const [row]=team?await sql`SELECT routine FROM trainer_teams WHERE id=${team.id}`:await sql`SELECT routine FROM members WHERE id=${me}`;
  return json({routine:row?.routine??null});
 }
 if(request.method!=='PUT')return json({error:'ไม่พบ API'},404);
 if(!trainer)return json({error:'เฉพาะผู้สร้างทีมหรือเทรนเนอร์เท่านั้น'},403);
 let routine;
 try{const text=await request.text();if(text.length>16000)throw Error('ข้อมูลใหญ่เกินไป');routine=cleanRoutine(JSON.parse(text));}
 catch(error){return json({error:error.message},400);}
 const value=routine?JSON.stringify(routine):null;
 if(team)await sql`UPDATE trainer_teams SET routine=${value}::jsonb WHERE id=${team.id}`;
 else await sql`UPDATE members SET routine=${value}::jsonb WHERE id=${me}`;
 return json({ok:true,routine});
}
