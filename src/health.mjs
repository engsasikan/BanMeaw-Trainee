// Apple Health / Apple Watch data, sent by an iPhone Shortcut (with a personal key) or imported from the Health export.
// Only daily totals and workouts are kept; the raw export never leaves the member's phone.
import {healthDay,healthWorkout,DAY_FIELDS} from '../dist/health-data.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const COLUMNS={steps:'steps',activeKcal:'active_kcal',exerciseMin:'exercise_min',distanceKm:'distance_km',restingHr:'resting_hr',sleepMin:'sleep_min',weight:'weight'};

export async function hashKey(key){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function newKey(){
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return 'bmh_'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function body(request,limit){
 const text=await request.text();
 if(text.length>limit)throw Object.assign(Error('ข้อมูลใหญ่เกินไป'),{status:413});
 try{return JSON.parse(text||'{}');}catch{throw Object.assign(Error('รูปแบบ JSON ไม่ถูกต้อง'),{status:400});}
}

// Merge days and workouts for one member. A field sent as null keeps what was there.
export async function storeHealth(sql,userId,{days=[],workouts=[]}){
 if(!Array.isArray(days)||!Array.isArray(workouts)||days.length>400||workouts.length>400)throw Object.assign(Error('ส่งได้ครั้งละไม่เกิน 400 วันและ 400 รายการออกกำลังกาย'),{status:400});
 const cleanDays=days.map(d=>healthDay(d)),cleanWorkouts=workouts.map(healthWorkout);
 for(const d of cleanDays){
  await sql`INSERT INTO health_days (user_id,day,steps,active_kcal,exercise_min,distance_km,resting_hr,sleep_min,weight) VALUES (${userId},${d.day}::date,${d.steps},${d.activeKcal},${d.exerciseMin},${d.distanceKm},${d.restingHr},${d.sleepMin},${d.weight})
   ON CONFLICT (user_id,day) DO UPDATE SET steps=COALESCE(EXCLUDED.steps,health_days.steps),active_kcal=COALESCE(EXCLUDED.active_kcal,health_days.active_kcal),exercise_min=COALESCE(EXCLUDED.exercise_min,health_days.exercise_min),distance_km=COALESCE(EXCLUDED.distance_km,health_days.distance_km),resting_hr=COALESCE(EXCLUDED.resting_hr,health_days.resting_hr),sleep_min=COALESCE(EXCLUDED.sleep_min,health_days.sleep_min),weight=COALESCE(EXCLUDED.weight,health_days.weight),updated_at=now()`;
 }
 for(const w of cleanWorkouts){
  await sql`INSERT INTO health_workouts (user_id,id,day,activity,started_at,duration_min,distance_km,kcal,source) VALUES (${userId},${w.id},${w.day}::date,${w.activity},${w.start}::timestamptz,${w.durationMin},${w.distanceKm},${w.kcal},${w.source})
   ON CONFLICT (user_id,id) DO UPDATE SET day=EXCLUDED.day,duration_min=EXCLUDED.duration_min,distance_km=EXCLUDED.distance_km,kcal=EXCLUDED.kcal,source=EXCLUDED.source`;
 }
 return {days:cleanDays.length,workouts:cleanWorkouts.length};
}

const dayRow=r=>{const out={day:typeof r.day==='string'?r.day.slice(0,10):new Date(r.day).toISOString().slice(0,10)};for(const k of DAY_FIELDS){const v=r[COLUMNS[k]];out[k]=v==null?null:Number(v);}return out;};
const workoutRow=r=>({id:r.id,day:typeof r.day==='string'?r.day.slice(0,10):new Date(r.day).toISOString().slice(0,10),activity:r.activity,start:new Date(r.started_at).toISOString(),durationMin:r.duration_min==null?null:Number(r.duration_min),distanceKm:r.distance_km==null?null:Number(r.distance_km),kcal:r.kcal==null?null:Number(r.kcal),source:r.source});

// Signed-in member: read data, create or revoke the Shortcut key, import the export, delete everything.
export async function handleHealth(request,sql,user){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==='/api/health'&&request.method==='GET'){
   const from=url.searchParams.get('from')||'2000-01-01',to=url.searchParams.get('to')||'2999-12-31';
   if(![from,to].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))return json({error:'วันที่ไม่ถูกต้อง'},400);
   const [days,workouts,[key]]=[await sql`SELECT * FROM health_days WHERE user_id=${user.sub} AND day BETWEEN ${from}::date AND ${to}::date ORDER BY day`,await sql`SELECT * FROM health_workouts WHERE user_id=${user.sub} AND day BETWEEN ${from}::date AND ${to}::date ORDER BY started_at`,await sql`SELECT created_at,last_used_at FROM health_keys WHERE user_id=${user.sub}`];
   return json({days:days.map(dayRow),workouts:workouts.map(workoutRow),key:key?{createdAt:key.created_at,lastUsedAt:key.last_used_at}:null});
  }
  if(path==='/api/health'&&request.method==='DELETE'){
   await sql`DELETE FROM health_days WHERE user_id=${user.sub}`;await sql`DELETE FROM health_workouts WHERE user_id=${user.sub}`;await sql`DELETE FROM health_keys WHERE user_id=${user.sub}`;
   return json({ok:true});
  }
  if(path==='/api/health/key'&&request.method==='POST'){
   const key=newKey(),hash=await hashKey(key);
   await sql`INSERT INTO health_keys (user_id,key_hash) VALUES (${user.sub},${hash}) ON CONFLICT (user_id) DO UPDATE SET key_hash=EXCLUDED.key_hash,created_at=now(),last_used_at=NULL`;
   return json({key});
  }
  if(path==='/api/health/key'&&request.method==='DELETE'){await sql`DELETE FROM health_keys WHERE user_id=${user.sub}`;return json({ok:true});}
  if(path==='/api/health/import'&&request.method==='POST')return json(await storeHealth(sql,user.sub,await body(request,262144)));
  return json({error:'ไม่พบ API'},404);
 }catch(error){return json({error:error.message},error.status||400);}
}

// iPhone Shortcut: no sign-in, only the personal key. Accepts one day's totals (and optional workouts) or {days,workouts}.
export async function handleHealthIngest(request,sql){
 if(request.method!=='POST')return json({error:'ใช้ POST'},405);
 const key=request.headers.get('Authorization')?.match(/^Bearer\s+(bmh_[\w-]{20,})$/)?.[1]||request.headers.get('X-BanMeaw-Key')?.trim();
 if(!key||!/^bmh_[\w-]{20,}$/.test(key))return json({error:'ไม่พบรหัสเชื่อมต่อ'},401);
 try{
  const data=await body(request,32768);
  const [owner]=await sql`UPDATE health_keys SET last_used_at=now() WHERE key_hash=${await hashKey(key)} RETURNING user_id`;
  if(!owner)return json({error:'รหัสเชื่อมต่อไม่ถูกต้องหรือถูกยกเลิกแล้ว'},401);
  const payload=Array.isArray(data.days)||Array.isArray(data.workouts)?{days:data.days||[],workouts:data.workouts||[]}:{days:DAY_FIELDS.some(k=>data[k]!=null&&data[k]!=='')?[data]:[],workouts:Array.isArray(data.workout)?data.workout:data.workout?[data.workout]:[]};
  const saved=await storeHealth(sql,owner.user_id,payload);
  return json({ok:true,...saved,message:'BanMeaw ได้รับข้อมูลแล้ว · '+saved.days+' วัน · '+saved.workouts+' การออกกำลังกาย'});
 }catch(error){return json({error:error.message},error.status||400);}
}
