// Apple Health on the page: the connect card in Profile (Shortcut key + history import)
// and the activity card on the overview. Other modules hear about the data through 'health-records'.
import {api} from './account.js?v=4';
import {activityName} from './health-data.mjs?v=1';
import {readHealthExport} from './health-import.mjs?v=1';
import {celebrate} from './motion.mjs?v=2';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const fmt=(n,d=0)=>n==null?'–':Number(n).toLocaleString('th-TH',{maximumFractionDigits:d});
const when=iso=>iso?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)):'';
const GOALS={activeKcal:500,exerciseMin:30,steps:8000};
let state={days:[],workouts:[],key:null},loaded=false;

async function load(){
 try{state=await api('/api/health');loaded=true;}catch{loaded=false;}
 window.dispatchEvent(new CustomEvent('health-records',{detail:state}));
 renderConnect();renderActivity();
}

// ---------- Overview: rings, numbers and the day's Watch workouts ----------
function ring(value,goal,label,unit,cls){
 const pct=value==null?0:Math.min(1,value/goal),wrap=node('div',undefined,'ring '+cls),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 44 44');svg.setAttribute('aria-hidden','true');
 svg.innerHTML='<circle cx="22" cy="22" r="18" class="ring-track"/><circle cx="22" cy="22" r="18" class="ring-fill" pathLength="100" stroke-dasharray="'+(pct*100).toFixed(1)+' 100"/>';
 const text=node('div',undefined,'ring-text');text.append(node('strong',fmt(value),'digits'),node('small',unit));
 wrap.append(svg,text,node('span',label,'ring-label'));wrap.setAttribute('aria-label',label+' '+fmt(value)+' '+unit+' จากเป้า '+fmt(goal));
 return wrap;
}
function renderActivity(){
 const day=$('day')?.value,anchor=$('today-card');if(!day||!anchor)return;
 let box=$('health-activity');
 const hasAny=state.days.length||state.workouts.length||state.key;
 if(!box){box=node('section',undefined,'health-card');box.id='health-activity';box.setAttribute('aria-label','กิจกรรมจาก Apple Health');anchor.before(box);}
 box.hidden=!loaded||!hasAny;if(box.hidden)return;
 const d=state.days.find(r=>r.day===day),workouts=state.workouts.filter(w=>w.day===day);
 const head=node('div',undefined,'health-head');head.append(node('p','ACTIVITY · APPLE HEALTH','eyebrow'),node('small',state.key?.lastUsedAt?'ส่งล่าสุด '+when(state.key.lastUsedAt):'',''));
 const rings=node('div',undefined,'health-rings');
 rings.append(ring(d?.activeKcal,GOALS.activeKcal,'เผาผลาญ','kcal','move'),ring(d?.exerciseMin,GOALS.exerciseMin,'ออกกำลังกาย','นาที','exercise'),ring(d?.steps,GOALS.steps,'ก้าวเดิน','ก้าว','steps'));
 const extras=node('div',undefined,'health-extras');
 for(const [label,v] of [['ระยะทาง',d?.distanceKm!=null?fmt(d.distanceKm,2)+' กม.':null],['ชีพจรตอนพัก',d?.restingHr!=null?fmt(d.restingHr)+' bpm':null],['การนอน',d?.sleepMin!=null?Math.floor(d.sleepMin/60)+' ชม. '+Math.round(d.sleepMin%60)+' น.':null],['น้ำหนัก',d?.weight!=null?fmt(d.weight,1)+' กก.':null]])if(v){const c=node('div');c.append(node('span',label),node('strong',v));extras.append(c);}
 const list=node('ul',undefined,'health-workouts');
 for(const w of workouts){const li=node('li');li.append(node('strong',activityName(w.activity)),node('span',[w.durationMin!=null?fmt(w.durationMin)+' นาที':null,w.distanceKm!=null?fmt(w.distanceKm,2)+' กม.':null,w.kcal!=null?fmt(w.kcal)+' kcal':null].filter(Boolean).join(' · ')));list.append(li);}
 box.replaceChildren(head,rings);
 if(extras.children.length)box.append(extras);
 if(workouts.length){box.append(node('p','ออกกำลังกายจาก Apple Watch','health-sub'),list);}
 if(!d&&!workouts.length)box.append(node('p','ยังไม่มีข้อมูลจาก Health ของวันนี้','muted'));
}

// ---------- Profile: connect with a Shortcut, import history, disconnect ----------
let shownKey=null;
function renderConnect(){
 const host=$('settings-panel');if(!host)return;
 let box=$('health-connect');
 if(!box){box=node('section',undefined,'diary health-connect');box.id='health-connect';const tools=$('account-tools');tools?tools.before(box):host.append(box);}
 const k=state.key,url=location.origin+'/api/health/ingest';
 const title=node('div',undefined,'list-heading');title.append(node('h2','Apple Health / Apple Watch'),node('span',k?'เชื่อมแล้ว':'ยังไม่เชื่อม','tag'+(k?' tag-on':'')));
 const status=node('p',k?('สร้างรหัสเมื่อ '+when(k.createdAt)+(k.lastUsedAt?' · ส่งข้อมูลล่าสุด '+when(k.lastUsedAt):' · ยังไม่เคยส่งข้อมูล')):'ดึงก้าวเดิน แคลอรี นาทีออกกำลังกาย น้ำหนัก การนอน และการออกกำลังกายจาก Apple Watch เข้ามาใน BanMeaw','muted');
 const message=node('p',undefined,'health-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');

 // 1. Daily Shortcut
 const daily=node('div',undefined,'health-step');daily.append(node('h3','1 · ส่งข้อมูลทุกวันด้วยคำสั่งลัด'));
 const make=node('button',k?'สร้างรหัสใหม่':'สร้างรหัสเชื่อมต่อ',k?'quiet':'primary');make.type='button';
 make.onclick=async()=>{if(k&&!confirm('รหัสเดิมจะใช้ไม่ได้ทันที ต้องใส่รหัสใหม่ในคำสั่งลัดด้วย สร้างใหม่ไหม?'))return;make.disabled=true;try{({key:shownKey}=await api('/api/health/key',{method:'POST'}));await load();}catch(e){message.textContent=e.message;}finally{make.disabled=false;}};
 daily.append(make);
 if(shownKey){
  const secret=node('div',undefined,'health-secret');
  for(const [label,value] of [['URL',url],['Authorization',' Bearer '+shownKey]]){const row=node('div');const code=node('code',value.trim());const copy=node('button','คัดลอก','quiet');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(value.trim());copy.textContent='คัดลอกแล้ว ✓';}catch{copy.textContent='คัดลอกไม่ได้';}};row.append(node('span',label),code,copy);secret.append(row);}
  secret.append(node('p','รหัสนี้แสดงครั้งเดียว ใครมีรหัสนี้ส่งข้อมูลเข้าบัญชีคุณได้ อย่าส่งให้คนอื่น','health-warn'));
  daily.append(secret);
 }
 const guide=node('details',undefined,'health-guide');guide.append(node('summary','วิธีทำคำสั่งลัด (ทำครั้งเดียว)'));
 const steps=node('ol');
 for(const s of [
  'เปิดแอป "คำสั่งลัด" (Shortcuts) แตะ + แล้วตั้งชื่อว่า "ส่งให้ BanMeaw"',
  'เพิ่มการทำงาน "ค้นหาตัวอย่างสุขภาพ" (Find Health Samples) เลือกประเภท "จำนวนก้าว" (Steps) แล้วเพิ่มตัวกรอง "วันที่เริ่มต้น" "อยู่ในวันนี้" (Start Date is today)',
  'ต่อด้วย "คำนวณสถิติ" (Calculate Statistics) เลือก "ผลรวม" (Sum)',
  'ทำซ้ำข้อ 2–3 สำหรับ "พลังงานที่ใช้งาน" (Active Energy), "นาทีออกกำลังกาย" (Exercise Minutes) และ "ระยะทางเดิน + วิ่ง" (Walking + Running Distance)',
  'น้ำหนัก (ถ้ามีตาชั่งที่เชื่อม Health): "ค้นหาตัวอย่างสุขภาพ" ประเภท "น้ำหนัก" (Weight) อยู่ในวันนี้ เรียงจากล่าสุด จำกัด 1 รายการ',
  'เพิ่ม "รับเนื้อหาของ URL" (Get Contents of URL) ใส่ URL ด้านบน แตะ "แสดงเพิ่มเติม" เลือกวิธี POST',
  'ที่ "ส่วนหัว" (Headers) เพิ่ม Authorization และใส่ค่า Bearer ตามด้วยรหัส (คัดลอกจากด้านบน)',
  'ที่ "เนื้อหาคำขอ" เลือก JSON แล้วเพิ่มฟิลด์ steps, activeKcal, exerciseMin, distanceKm, weight โดยเลือกผลลัพธ์จากแต่ละขั้นตอน (ฟิลด์ไหนไม่มีข้ามได้)',
  'กด ▶ ทดลอง ถ้าสำเร็จจะเห็นข้อความ "BanMeaw ได้รับข้อมูลแล้ว"',
  'ให้ส่งเองทุกวัน: แท็บ "ระบบอัตโนมัติ" → + → "เวลาของวัน" เช่น 21:00 ทุกวัน → เลือก "เรียกใช้ทันที" → เลือกคำสั่งลัด "ส่งให้ BanMeaw"',
 ])steps.append(node('li',s));
 guide.append(steps,node('p','iPhone อ่านข้อมูล Health ได้ตอนปลดล็อกเครื่องเท่านั้น ถ้าเวลาที่ตั้งไว้เครื่องล็อกอยู่ คำสั่งลัดจะส่งตอนที่เปิดเครื่องครั้งถัดไป ส่งซ้ำได้ ไม่ทำให้ข้อมูลซ้ำ','muted'));
 daily.append(guide);

 // 2. History import
 const history=node('div',undefined,'health-step');history.append(node('h3','2 · นำเข้าประวัติเก่าทั้งหมด'));
 history.append(node('p','ในแอป "สุขภาพ" แตะรูปโปรไฟล์มุมขวาบน → "ส่งออกข้อมูลสุขภาพทั้งหมด" → บันทึกไปที่แอป "ไฟล์" แล้วเลือกไฟล์ export.zip ที่นี่ ไฟล์จะถูกอ่านบนเครื่องคุณ ส่งขึ้นเฉพาะยอดรวมรายวันกับการออกกำลังกาย','muted'));
 const pick=node('input');pick.type='file';pick.accept='.zip,.xml,application/zip,text/xml';pick.id='health-file';
 const pickLabel=node('label','เลือกไฟล์ export.zip หรือ export.xml','health-pick');pickLabel.htmlFor='health-file';
 const bar=node('progress');bar.max=1;bar.value=0;bar.hidden=true;
 pick.onchange=async()=>{
  const file=pick.files[0];if(!file)return;pick.disabled=true;bar.hidden=false;bar.value=0;
  try{
   message.textContent='กำลังอ่านไฟล์… (ไฟล์ใหญ่อาจใช้เวลาหลายนาที อย่าปิดหน้านี้)';
   const {days,workouts}=await readHealthExport(file,p=>{bar.value=p*.8;});
   message.textContent='พบข้อมูล '+days.length+' วัน และการออกกำลังกาย '+workouts.length+' ครั้ง กำลังอัปโหลด…';
   const batches=[];for(let i=0;i<days.length;i+=300)batches.push({days:days.slice(i,i+300),workouts:[]});for(let i=0;i<workouts.length;i+=300)batches.push({days:[],workouts:workouts.slice(i,i+300)});
   let done=0;for(const b of batches){await api('/api/health/import',{method:'POST',body:JSON.stringify(b)});done++;bar.value=.8+.2*done/batches.length;}
   await load();bar.value=1;
   message.textContent='นำเข้าเรียบร้อย '+days.length+' วัน · ออกกำลังกาย '+workouts.length+' ครั้ง';
   if(workouts.length)celebrate('นำเข้าประวัติออกกำลังกาย '+workouts.length.toLocaleString('th-TH')+' ครั้งแล้ว! 💪');
  }catch(e){message.textContent='นำเข้าไม่สำเร็จ: '+e.message;}
  finally{pick.disabled=false;pick.value='';}
 };
 history.append(pickLabel,pick,bar);

 // 3. Disconnect / delete
 const danger=node('div',undefined,'health-step health-danger');
 if(k){const off=node('button','ยกเลิกการเชื่อม (หยุดรับจากคำสั่งลัด)','quiet');off.type='button';off.onclick=async()=>{if(!confirm('หยุดรับข้อมูลจากคำสั่งลัด? ข้อมูลที่ส่งมาแล้วยังอยู่'))return;try{await api('/api/health/key',{method:'DELETE'});shownKey=null;await load();}catch(e){message.textContent=e.message;}};danger.append(off);}
 if(state.days.length||state.workouts.length){const wipe=node('button','ลบข้อมูล Health ทั้งหมด','quiet delete');wipe.type='button';wipe.onclick=async()=>{if(!confirm('ลบข้อมูลจาก Health ทั้งหมดใน BanMeaw และยกเลิกการเชื่อม? ข้อมูลในแอปสุขภาพของ iPhone ไม่ถูกลบ'))return;try{await api('/api/health',{method:'DELETE'});shownKey=null;await load();}catch(e){message.textContent=e.message;}};danger.append(wipe);}

 box.replaceChildren(title,status,daily,history);if(danger.children.length)box.append(danger);box.append(message);
}

export function initHealth(){
 window.addEventListener('diary-records',renderActivity);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 load();
}
// For the local preview and tests: draw with given data instead of the API.
export function showHealth(data){state={days:[],workouts:[],key:null,...data};loaded=true;window.dispatchEvent(new CustomEvent('health-records',{detail:state}));renderConnect();renderActivity();}
