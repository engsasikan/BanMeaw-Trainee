import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { validateRecords } from '../dist/store.mjs';
import schema from '../db/001_initial.sql';

const keys = new Map();
let schemaReady;
const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store'}});
const authPaths = new Set(['sign-up/email','sign-in/email','sign-in/social','sign-out','get-session','token','request-password-reset','reset-password','send-verification-email','verify-email','email-otp/send-verification-otp','email-otp/verify-email']);
export async function identity(request, env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), {status:401});
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
  if (Number(request.headers.get('Content-Length') || 0) > 16000) return json({error:'ข้อมูลใหญ่เกินไป'},413);
  if (url.pathname === '/api/config') return json({ready:Boolean(env.DATABASE_URL && env.NEON_AUTH_BASE_URL)});
  if (!env.DATABASE_URL || !env.NEON_AUTH_BASE_URL) return json({error:'ยังไม่ได้ตั้งค่า DATABASE_URL และ NEON_AUTH_BASE_URL ใน Worker'},503);
  if (url.pathname.startsWith('/api/auth/')) return authProxy(request,env,url);
  const user = await identity(request,env);
  const sql = neon(env.DATABASE_URL);
  await initialize(sql);
  const role = user.emailVerified === true && env.ADMIN_EMAIL?.toLowerCase() === user.email?.toLowerCase() ? 'admin' : 'trainee';
  await sql`INSERT INTO members (id, display_name, role) VALUES (${user.sub}, ${String(user.name || user.email || 'สมาชิก').slice(0,200)}, ${role}) ON CONFLICT (id) DO NOTHING`;
  if (url.pathname === '/api/me') {const [me]=await sql`SELECT id,member_code,display_name,role FROM members WHERE id=${user.sub}`;return json(me);}
  if (url.pathname === '/api/teams' || url.pathname.startsWith('/api/teams/')) return handleTeams(request,sql,user);
  return handleEntries(request,sql,user);
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
  if (!id || !teamId.test(id) || extra!==undefined) return json({error:'ไม่พบ API'},404);
  const [team]=await sql`SELECT t.id,t.name,t.owner_id,o.display_name AS owner_name,o.member_code AS owner_code FROM trainer_teams t JOIN members o ON o.id=t.owner_id WHERE t.id=${id}`;
  if (!team) return json({error:'ไม่พบทีมนี้'},404);
  const owner=team.owner_id===me;
  const [mine]=owner?[]:await sql`SELECT status,team_role FROM team_members WHERE team_id=${id} AND user_id=${me}`;
  const active=owner||mine?.status==='active';
  const ownerOnly=()=>json({error:'เฉพาะผู้สร้างทีมเท่านั้น'},403);
  if (!action && method==='GET') {
    if(!active) return json({error:'คุณยังไม่ได้อยู่ในทีมนี้'},403);
    const rows=await sql`SELECT u.id,u.member_code,u.display_name,m.status,m.team_role FROM team_members m JOIN members u ON u.id=m.user_id WHERE m.team_id=${id} ORDER BY m.status,m.team_role,u.display_name`;
    return json({team:{id:team.id,name:team.name,owner:{id:team.owner_id,display_name:team.owner_name,member_code:team.owner_code}},my_role:owner?'owner':mine.team_role,members:owner?rows:rows.filter(r=>r.status==='active')});
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
      const [member]=await sql`SELECT u.id,u.member_code,u.display_name,m.team_role FROM team_members m JOIN members u ON u.id=m.user_id WHERE m.team_id=${id} AND m.user_id=${memberId} AND m.status='active'`;
      if(!member) return json({error:'สมาชิกยังไม่ได้ตอบรับเข้าทีม'},403);
      if(!owner && member.team_role!=='trainee') return json({error:'ดูได้เฉพาะบันทึกของลูกเทรน'},403);
      const rows=await sql`SELECT payload FROM daily_logs WHERE user_id=${memberId} ORDER BY day DESC,created_at DESC LIMIT 1000`;
      return json({member,records:rows.map(r=>r.payload)});
    }
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
