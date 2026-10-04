import {handleGoogleLogin,googleLoginReady,verifyGoogleSession,resolveGoogleMember,checkGoogleMember,storeGoogleSession,revokeGoogleSession} from './google-login.mjs';
import {handleTeamGame} from './team-game.mjs';
import {handleNutrition,handleOwnNutrition} from './nutrition.mjs';
import {handleFeedback,handleMemberProgress,handleOwnFeedback,handleBackup} from './coach.mjs';
import {handlePlans} from './plans.mjs';
import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { validateRecords } from '../dist/store.mjs';
import { validateBody } from '../dist/body-data.mjs';
import schema from '../db/001_initial.sql';

const keys = new Map();
let schemaReady;
const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store'}});
const authPaths = new Set(['sign-up/email','sign-in/email','sign-in/social','sign-out','get-session','token','request-password-reset','reset-password','send-verification-email','verify-email','email-otp/send-verification-otp','email-otp/verify-email']);
export async function identity(request, env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), {status:401});
  const origin=new URL(request.url).origin;
  try{const user=await verifyGoogleSession(token,env,origin);await checkGoogleMember(neon(env.DATABASE_URL),user);return user;}catch{}
  const base = env.NEON_AUTH_BASE_URL.replace(/\/$/, '');
  if (!keys.has(base)) keys.set(base, createRemoteJWKSet(new URL(base + '/.well-known/jwks.json')));
  let payload;
  try { ({payload} = await jwtVerify(token, keys.get(base), {algorithms:['EdDSA'], issuer:new URL(base).origin, audience:new URL(base).origin, requiredClaims:['sub','exp','iat']})); }
  catch { throw Object.assign(new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'), {status:401}); }
  if (!payload.sub || payload.banned) throw Object.assign(new Error('บัญชีนี้ไม่สามารถใช้งานได้'), {status:403});
  return payload;
}
async function initialize(sql) {
  if (!schemaReady) schemaReady = sql.transaction(schema.replace(/--[^\n]*/g,'').split(';').map(x=>x.trim()).filter(x=>x && x !== 'BEGIN' && x !== 'COMMIT').map(statement=>sql.query(statement))).catch(error=>{schemaReady=undefined;throw error;});
  return schemaReady;
}
async function authProxy(request, env, url) {
  const path = url.pathname.slice('/api/auth/'.length);
  if (!authPaths.has(path) || !['GET','POST'].includes(request.method)) return json({error:'ไม่พบ API'},404);
  const target = new URL(env.NEON_AUTH_BASE_URL.replace(/\/$/,'') + '/' + path);
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.delete('host'); headers.delete('authorization');
  const body=request.method==='GET'?undefined:await request.arrayBuffer();
  if(body && body.byteLength>16000) return json({error:'ข้อมูลใหญ่เกินไป'},413);
  const upstream = await fetch(target, {method:request.method, headers, body, redirect:'manual'});
  const resultHeaders = new Headers(upstream.headers);
  resultHeaders.delete('set-cookie'); resultHeaders.set('Cache-Control','no-store');
  for (const cookie of upstream.headers.getSetCookie()) resultHeaders.append('Set-Cookie',cookie.replace(/;\s*Domain=[^;]+/ig,'').replace(/;\s*Path=[^;]+/ig,'; Path=/'));
  return new Response(upstream.body,{status:upstream.status,headers:resultHeaders});
}
export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({error:'คำขอจากเว็บไซต์อื่นไม่ได้รับอนุญาต'},403);
  if (Number(request.headers.get('Content-Length') || 0) > (url.pathname==='/api/me/avatar'?65536:url.pathname==='/api/backup'?262144:16000)) return json({error:'ข้อมูลใหญ่เกินไป'},413);
  if (url.pathname === '/api/config') return json({ready:Boolean(env.DATABASE_URL && env.NEON_AUTH_BASE_URL),googleLoginReady:googleLoginReady(env)});
  if(url.pathname.startsWith('/api/google/')){const response=await handleGoogleLogin(request,env,{resolveMember:profile=>resolveGoogleMember(neon(env.DATABASE_URL),profile),checkMember:user=>checkGoogleMember(neon(env.DATABASE_URL),user),storeSession:user=>storeGoogleSession(neon(env.DATABASE_URL),user),revokeSession:user=>revokeGoogleSession(neon(env.DATABASE_URL),user)});if(response)return response;}
  if (!env.DATABASE_URL || !env.NEON_AUTH_BASE_URL) return json({error:'ยังไม่ได้ตั้งค่า DATABASE_URL และ NEON_AUTH_BASE_URL ใน Worker'},503);
  if (url.pathname.startsWith('/api/auth/')) return authProxy(request,env,url);
  const user = await identity(request,env);
  const sql = neon(env.DATABASE_URL);
  await initialize(sql);
  const role = user.emailVerified === true && env.ADMIN_EMAIL?.toLowerCase() === user.email?.toLowerCase() ? 'admin' : 'trainee';
  await sql`INSERT INTO members (id, display_name, role) VALUES (${user.sub}, ${String(user.name || user.email || 'สมาชิก').slice(0,200)}, ${role}) ON CONFLICT (id) DO NOTHING`;
  if(url.pathname==='/api/backup')return handleBackup(request,sql,user);
  if(url.pathname==='/api/nutrition')return handleOwnNutrition(request,sql,user);
  if(url.pathname==='/api/feedback')return handleOwnFeedback(request,sql,user);
  if(url.pathname==='/api/me/avatar')return handleAvatar(request,sql,user);
  if (url.pathname === '/api/me' && request.method === 'PATCH') {
    const {sex}=await readJson(request);
    if(sex!==null && sex!=='male' && sex!=='female') return json({error:'ข้อมูลเพศไม่ถูกต้อง'},400);
    await sql`UPDATE members SET sex=${sex} WHERE id=${user.sub}`;
    // The member's sex applies to every saved measurement's 3D figure.
    if(sex) await sql`UPDATE body_measurements SET payload=jsonb_set(payload,'{sex}',to_jsonb(${sex}::text)),updated_at=now() WHERE user_id=${user.sub} AND payload->>'sex' IS DISTINCT FROM ${sex}`;
    return json({ok:true});
  }
  if (url.pathname === '/api/me') {const [me]=await sql`SELECT id,member_code,display_name,role,sex,avatar FROM members WHERE id=${user.sub}`;return json(me);}
  if(url.pathname==='/api/plans'&&request.method==='GET'){const day=url.searchParams.get('day');if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return json({error:'วันที่ไม่ถูกต้อง'},400);return json({plans:await sql`SELECT p.id,p.day,p.exercises,t.name AS team_name FROM training_plans p JOIN trainer_teams t ON t.id=p.team_id WHERE p.user_id=${user.sub} AND p.day=${day}::date AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.user_id=${user.sub} AND m.status='active')) ORDER BY p.created_at`});}
  if (url.pathname === '/api/teams' || url.pathname.startsWith('/api/teams/')) return handleTeams(request,sql,user);
  if (url.pathname === '/api/body' || url.pathname.startsWith('/api/body/')) return handleBody(request,sql,user);
  if (url.pathname === '/api/reports') return handleReports(request,sql,user);
  return handleEntries(request,sql,user);
}
export async function handleAvatar(request,sql,user){
 if(request.method==='DELETE'){await sql`UPDATE members SET avatar=NULL WHERE id=${user.sub}`;return json({ok:true,avatar:null});}
 if(request.method!=='PUT')return json({error:'ไม่พบ API'},405);
 if(request.headers.get('Content-Type')?.split(';')[0]!=='image/jpeg')return json({error:'รูปต้องเป็น JPEG'},400);
 const bytes=new Uint8Array(await request.arrayBuffer());
 if(bytes.length>65536)return json({error:'รูปใหญ่เกินไป'},413);
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)return json({error:'รูปไม่ถูกต้อง'},400);
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const avatar='data:image/jpeg;base64,'+btoa(binary);
 await sql`UPDATE members SET avatar=${avatar} WHERE id=${user.sub}`;
 return json({ok:true,avatar});
}
const teamId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function readJson(request) {
  const text=await request.text();
  if(text.length>16000) throw Object.assign(new Error('ข้อมูลใหญ่เกินไป'),{status:413});
  try {const value=JSON.parse(text);if(value&&typeof value==='object') return value;} catch {}
  throw Object.assign(new Error('ข้อมูลไม่ถูกต้อง'),{status:400});
}
// Teams: the owner manages the team and sets each member's team role (trainer/trainee).
// Members join by invitation (member_code) and must accept. The owner and active trainers
// can read active trainees' logs (read-only); the owner can read any active member.
const teamRoles=new Set(['trainer','trainee']);
export async function handleTeams(request,sql,user) {
  const [id,action,memberId,extra]=new URL(request.url).pathname.split('/').slice(3).map(decodeURIComponent);
  const method=request.method, me=user.sub;
  if (!id && method==='GET') {
    const teams=await sql`SELECT t.id,t.name,(t.owner_id=${me}) AS is_owner,o.display_name AS owner_name,m.status,m.team_role,
      (SELECT count(*)::int FROM team_members c WHERE c.team_id=t.id AND c.status='active') AS member_count
      FROM trainer_teams t JOIN members o ON o.id=t.owner_id LEFT JOIN team_members m ON m.team_id=t.id AND m.user_id=${me}
      WHERE t.owner_id=${me} OR m.user_id=${me} ORDER BY (m.status='invited') DESC NULLS LAST,t.created_at`;
    return json({teams:teams.map(t=>({id:t.id,name:t.name,owner_name:t.owner_name,member_count:t.member_count,my_role:t.is_owner?'owner':t.team_role,status:t.is_owner?'active':t.status}))});
  }
  if (!id && method==='POST') {
    const name=String((await readJson(request)).name??'').trim();
    if(!name||name.length>80) return json({error:'กรุณาตั้งชื่อทีม (ไม่เกิน 80 ตัวอักษร)'},400);
    const [{count}]=await sql`SELECT count(*)::int AS count FROM trainer_teams WHERE owner_id=${me}`;
    if(count>=10) return json({error:'สร้างทีมได้สูงสุด 10 ทีม'},409);
    const [team]=await sql`INSERT INTO trainer_teams (owner_id,name) VALUES (${me},${name}) RETURNING id,name`;
    await sql`UPDATE members SET role='trainer' WHERE id=${me} AND role='trainee'`;
    return json({team});
  }
  if (!id || !teamId.test(id) || (extra!==undefined && !(['body','progress'].includes(extra) && action==='members' && method==='GET'))) return json({error:'ไม่พบ API'},404);
  const [team]=await sql`SELECT t.id,t.name,t.owner_id,t.owner_role,o.display_name AS owner_name,o.member_code AS owner_code FROM trainer_teams t JOIN members o ON o.id=t.owner_id WHERE t.id=${id}`;
  if (!team) return json({error:'ไม่พบทีมนี้'},404);
  const owner=team.owner_id===me;
  const [mine]=owner?[]:await sql`SELECT status,team_role FROM team_members WHERE team_id=${id} AND user_id=${me}`;
  const active=owner||mine?.status==='active';
  if(action==='game')return handleTeamGame(request,sql,user,team,mine,memberId);
  if(action==='nutrition'&&memberId)return handleNutrition(request,sql,user,team,mine,memberId);
  if(action==='plans'&&memberId)return handlePlans(request,sql,user,team,mine,memberId);
  if(action==='feedback'&&memberId)return handleFeedback(request,sql,user,team,mine,memberId);
  if(action==='members'&&memberId&&extra==='progress')return handleMemberProgress(request,sql,user,team,mine,memberId);
  const ownerOnly=()=>json({error:'เฉพาะผู้สร้างทีมเท่านั้น'},403);
  if (!action && method==='GET') {
    if(!active) return json({error:'คุณยังไม่ได้อยู่ในทีมนี้'},403);
    // ?day=YYYY-MM-DD adds each person's daily report time for that day (null = not sent).
    const day=validDay(new URL(request.url).searchParams.get('day'));
    const rows=await sql`SELECT u.id,u.member_code,u.display_name,m.status,m.team_role,dr.sent_at AS report_sent_at FROM team_members m JOIN members u ON u.id=m.user_id LEFT JOIN daily_reports dr ON dr.user_id=u.id AND dr.day=${day}::date WHERE m.team_id=${id} ORDER BY m.status,m.team_role,u.display_name`;
    const [ownerReport]=day?await sql`SELECT sent_at FROM daily_reports WHERE user_id=${team.owner_id} AND day=${day}::date`:[];
    return json({team:{id:team.id,name:team.name,owner:{id:team.owner_id,display_name:team.owner_name,member_code:team.owner_code,team_role:team.owner_role,report_sent_at:ownerReport?.sent_at??null}},my_role:owner?'owner':mine.team_role,members:owner?rows:rows.filter(r=>r.status==='active')});
  }
  if (!action && method==='DELETE') {
    if(!owner) return ownerOnly();
    await sql`DELETE FROM trainer_teams WHERE id=${id}`;
    return json({ok:true});
  }
  if (action==='invites' && !memberId && method==='POST') {
    if(!owner) return ownerOnly();
    const body=await readJson(request), code=String(body.member_code??'').trim().toUpperCase(), role=teamRoles.has(body.team_role)?body.team_role:'trainee';
    const [invitee]=code.length<=20?await sql`SELECT id,member_code,display_name FROM members WHERE member_code=${code}`:[];
    if(!invitee) return json({error:'ไม่พบสมาชิก ID นี้ กรุณาตรวจอีกครั้ง'},404);
    if(invitee.id===me) return json({error:'คุณเป็นผู้สร้างทีมนี้อยู่แล้ว'},400);
    const [{count}]=await sql`SELECT count(*)::int AS count FROM team_members WHERE team_id=${id}`;
    if(count>=50) return json({error:'ทีมนี้มีสมาชิกครบ 50 คนแล้ว'},409);
    const rows=await sql`INSERT INTO team_members (team_id,user_id,status,team_role) VALUES (${id},${invitee.id},'invited',${role}) ON CONFLICT DO NOTHING RETURNING status`;
    if(!rows.length) return json({error:'สมาชิกคนนี้อยู่ในทีมหรือได้รับคำเชิญแล้ว'},409);
    return json({member:{...invitee,status:'invited',team_role:role}});
  }
  if (action==='accept' && !memberId && method==='POST') {
    const rows=await sql`UPDATE team_members SET status='active',joined_at=now() WHERE team_id=${id} AND user_id=${me} AND status='invited' RETURNING status`;
    return rows.length?json({ok:true}):json({error:'ไม่พบคำเชิญนี้'},404);
  }
  if (action==='members' && memberId && memberId.length<=200) {
    if (method==='PATCH') {
      if(!owner) return ownerOnly();
      const role=(await readJson(request)).team_role;
      if(!teamRoles.has(role)) return json({error:'บทบาทไม่ถูกต้อง'},400);
      if(memberId===me){await sql`UPDATE trainer_teams SET owner_role=${role} WHERE id=${id}`;return json({ok:true});}
      const rows=await sql`UPDATE team_members SET team_role=${role} WHERE team_id=${id} AND user_id=${memberId} RETURNING team_role`;
      return rows.length?json({ok:true}):json({error:'ไม่พบสมาชิกในทีมนี้'},404);
    }
    if (method==='DELETE') {
      if(!owner && memberId!==me) return json({error:'ไม่มีสิทธิ์นำสมาชิกคนนี้ออก'},403);
      const rows=await sql`DELETE FROM team_members WHERE team_id=${id} AND user_id=${memberId} RETURNING user_id`;
      return rows.length?json({ok:true}):json({error:'ไม่พบสมาชิกในทีมนี้'},404);
    }
    if (method==='GET') {
      if(!owner && !(mine?.status==='active' && mine.team_role==='trainer')) return json({error:'เฉพาะเทรนเนอร์ของทีมเท่านั้น'},403);
      const requestedDay=new URL(request.url).searchParams.get('day');
      const selectedDay=requestedDay===null?null:validDay(requestedDay);
      if(requestedDay!==null&&!selectedDay)return json({error:'วันที่ไม่ถูกต้อง'},400);
      const records=async()=>(extra==='body'
        ? await sql`SELECT payload FROM body_measurements WHERE user_id=${memberId} ORDER BY day DESC,updated_at DESC LIMIT 500`
        : selectedDay ? await sql`SELECT payload FROM daily_logs WHERE user_id=${memberId} AND day=${selectedDay}::date ORDER BY created_at DESC LIMIT 1000`
        : await sql`SELECT payload FROM daily_logs WHERE user_id=${memberId} ORDER BY day DESC,created_at DESC LIMIT 1000`).map(r=>r.payload);
      if(memberId===team.owner_id){
        if(owner || team.owner_role!=='trainee') return json({error:'ดูได้เฉพาะบันทึกของลูกเทรน'},403);
        return json({member:{id:team.owner_id,member_code:team.owner_code,display_name:team.owner_name,team_role:'trainee'},records:await records()});
      }
      const [member]=await sql`SELECT u.id,u.member_code,u.display_name,m.team_role FROM team_members m JOIN members u ON u.id=m.user_id WHERE m.team_id=${id} AND m.user_id=${memberId} AND m.status='active'`;
      if(!member) return json({error:'สมาชิกยังไม่ได้ตอบรับเข้าทีม'},403);
      if(!owner && member.team_role!=='trainee') return json({error:'ดูได้เฉพาะบันทึกของลูกเทรน'},403);
      return json({member,records:await records()});
    }
  }
  return json({error:'ไม่พบ API'},404);
}
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))?value:null;
// Daily reports: a trainee marks a day's food log as sent to their trainers.
export async function handleReports(request,sql,user) {
  if (request.method==='GET') {
    const day=validDay(new URL(request.url).searchParams.get('day'));
    if(!day) return json({error:'วันที่ไม่ถูกต้อง'},400);
    const [row]=await sql`SELECT sent_at,team_visible FROM daily_reports WHERE user_id=${user.sub} AND day=${day}::date`;
    return json({day,sent_at:row?.sent_at??null,team_visible:row?.team_visible??false});
  }
  if (request.method==='POST') {
    const day=validDay((await readJson(request)).day);
    if(!day) return json({error:'วันที่ไม่ถูกต้อง'},400);
    const [row]=await sql`INSERT INTO daily_reports (user_id,day,team_visible) VALUES (${user.sub},${day}::date,true) ON CONFLICT (user_id,day) DO UPDATE SET sent_at=now(),team_visible=true RETURNING sent_at`;
    return json({day,sent_at:row.sent_at,team_visible:true});
  }
  return json({error:'ไม่พบ API'},404);
}
// Body measurements: one record per measurement (history by day), owner-only writes.
export async function handleBody(request,sql,user) {
  const [id,extra]=new URL(request.url).pathname.split('/').slice(3).map(decodeURIComponent);
  if (!id && request.method==='GET') {
    const rows=await sql`SELECT payload FROM body_measurements WHERE user_id=${user.sub} ORDER BY day DESC,updated_at DESC LIMIT 500`;
    return json({records:rows.map(r=>r.payload)});
  }
  if (!id || id.length>100 || extra!==undefined) return json({error:'ไม่พบ API'},404);
  if (request.method==='DELETE') {
    const rows=await sql`DELETE FROM body_measurements WHERE user_id=${user.sub} AND id=${id} RETURNING id`;
    return rows.length?json({ok:true}):json({error:'ไม่พบรายการนี้'},404);
  }
  if (request.method==='PUT') {
    let row;
    try {row=validateBody(await readJson(request));if(row.id!==id) throw Error('ข้อมูลร่างกายไม่ถูกต้อง');}
    catch(error) {return json({error:error.status?error.message:error.message||'ข้อมูลร่างกายไม่ถูกต้อง'},error.status||400);}
    const [{count}]=await sql`SELECT count(*)::int AS count FROM body_measurements WHERE user_id=${user.sub}`;
    if(count>=500) return json({error:'บันทึกค่าร่างกายได้สูงสุด 500 รายการ'},409);
    await sql`INSERT INTO body_measurements (user_id,id,day,payload) VALUES (${user.sub},${id},${row.day},${JSON.stringify(row)}::jsonb)
      ON CONFLICT (user_id,id) DO UPDATE SET day=EXCLUDED.day,payload=EXCLUDED.payload,updated_at=now()`;
    return json({record:row});
  }
  return json({error:'ไม่พบ API'},404);
}
export async function handleEntries(request,sql,user) {
  const url=new URL(request.url);
  if (url.pathname === '/api/entries' && request.method === 'GET') {
    const rows = await sql`SELECT payload,revision FROM daily_logs WHERE user_id=${user.sub} ORDER BY day,id LIMIT 50001`;
    if(rows.length>50000) return json({error:'ข้อมูลเกินขอบเขต กรุณาติดต่อผู้ดูแล'},409);
    return json({records:rows.map(r=>({...r.payload,_revision:r.revision}))});
  }
  const match=url.pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (match && ['PUT','DELETE'].includes(request.method)) {
    const id=decodeURIComponent(match[1]);
    if (id.length>100) return json({error:'รหัสรายการไม่ถูกต้อง'},400);
    const revision=Number(request.headers.get('If-Match') || 0);
    if(!Number.isInteger(revision)||revision<0) return json({error:'รุ่นข้อมูลไม่ถูกต้อง'},400);
    if(request.method==='DELETE') {
      const rows=await sql`DELETE FROM daily_logs WHERE user_id=${user.sub} AND id=${id} AND revision=${revision} RETURNING id`;
      return rows.length?json({ok:true}):json({error:'รายการเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลใหม่'},409);
    }
    let row;
    try {const text=await request.text();if(text.length>16000) return json({error:'ข้อมูลใหญ่เกินไป'},413);[row]=validateRecords([JSON.parse(text)]);if(row.id!==id) throw Error();}
    catch {return json({error:'ข้อมูลบันทึกไม่ถูกต้อง'},400);}
    if(row.planId){
      const [plan]=await sql`SELECT p.day::text,p.exercises FROM training_plans p JOIN trainer_teams t ON t.id=p.team_id WHERE p.id=${row.planId} AND p.user_id=${user.sub} AND (t.owner_id=${user.sub} OR EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.user_id=${user.sub} AND m.status='active'))`;
      if(!plan||row.trainingType!=='strength'||plan.day!==row.day||plan.exercises[row.planExerciseIndex]?.exercise!==row.exercise)return json({error:'ท่าในแผนไม่ตรงกับบันทึกหรือคุณไม่มีสิทธิ์ใช้แผนนี้'},400);
    }
    const kind=row.kind==='workout'?'workout':'meal';
    const rows=revision===0
      ? await sql`INSERT INTO daily_logs (user_id,id,day,kind,payload) VALUES (${user.sub},${id},${row.day},${kind},${JSON.stringify(row)}::jsonb) ON CONFLICT DO NOTHING RETURNING revision`
      : await sql`UPDATE daily_logs SET day=${row.day},kind=${kind},payload=${JSON.stringify(row)}::jsonb,revision=revision+1,updated_at=now() WHERE user_id=${user.sub} AND id=${id} AND revision=${revision} RETURNING revision`;
    return rows.length?json({record:{...row,_revision:rows[0].revision}}):json({error:'รายการเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลใหม่'},409);
  }
  return json({error:'ไม่พบ API'},404);
}
export default {async fetch(request,env) {
  if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try {return await handleApi(request,env);} catch(error) {return json({error:error.status?error.message:'ติดต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่'},error.status||503);}
}};
