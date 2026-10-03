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
  await sql`INSERT INTO app_users (id, display_name, role) VALUES (${user.sub}, ${String(user.name || user.email || 'สมาชิก').slice(0,200)}, ${role}) ON CONFLICT (id) DO NOTHING`;
  if (url.pathname === '/api/me') {const [me]=await sql`SELECT id,member_code,display_name,role FROM app_users WHERE id=${user.sub}`;return json(me);}
  return handleEntries(request,sql,user);
}
export async function handleEntries(request,sql,user) {
  const url=new URL(request.url);
  if (url.pathname === '/api/entries' && request.method === 'GET') {
    const rows = await sql`SELECT payload,revision FROM diary_entries WHERE user_id=${user.sub} ORDER BY day,id LIMIT 50001`;
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
      const rows=await sql`DELETE FROM diary_entries WHERE user_id=${user.sub} AND id=${id} AND revision=${revision} RETURNING id`;
      return rows.length?json({ok:true}):json({error:'รายการเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลใหม่'},409);
    }
    let row;
    try {const text=await request.text();if(text.length>16000) return json({error:'ข้อมูลใหญ่เกินไป'},413);[row]=validateRecords([JSON.parse(text)]);if(row.id!==id) throw Error();}
    catch {return json({error:'ข้อมูลบันทึกไม่ถูกต้อง'},400);}
    const kind=row.kind==='workout'?'workout':'meal';
    const rows=revision===0
      ? await sql`INSERT INTO diary_entries (user_id,id,day,kind,payload) VALUES (${user.sub},${id},${row.day},${kind},${JSON.stringify(row)}::jsonb) ON CONFLICT DO NOTHING RETURNING revision`
      : await sql`UPDATE diary_entries SET day=${row.day},kind=${kind},payload=${JSON.stringify(row)}::jsonb,revision=revision+1,updated_at=now() WHERE user_id=${user.sub} AND id=${id} AND revision=${revision} RETURNING revision`;
    return rows.length?json({record:{...row,_revision:rows[0].revision}}):json({error:'รายการเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลใหม่'},409);
  }
  return json({error:'ไม่พบ API'},404);
}
export default {async fetch(request,env) {
  if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try {return await handleApi(request,env);} catch(error) {return json({error:error.status?error.message:'ติดต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่'},error.status||503);}
}};
