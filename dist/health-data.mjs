// Apple Health data: daily totals and workouts, shared by the Worker (validation) and the page.
// Shortcuts send numbers in many shapes: 1234, "1,234", "65.2 kg", a list, or text with one value per line.
export const DAY_FIELDS=['steps','activeKcal','exerciseMin','distanceKm','restingHr','sleepMin','weight'];
const LIMITS={steps:[0,200000],activeKcal:[0,20000],exerciseMin:[0,1440],distanceKm:[0,500],restingHr:[20,250],sleepMin:[0,1440],weight:[10,400]};
const isDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export const bangkokDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(date);

// Every number found in a value, with the unit written right after it (if any).
export function readings(value){
 if(value==null)return [];
 if(typeof value==='number')return Number.isFinite(value)?[{n:value,unit:''}]:[];
 if(Array.isArray(value))return value.flatMap(readings);
 if(typeof value==='object')return readings(value.value??value.quantity??null).map(r=>({...r,unit:r.unit||String(value.unit||'').toLowerCase()}));
 const text=String(value).replace(/(\d),(?=\d{3}\b)/g,'$1');
 return [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*([a-zA-Zก-๙.]*)/g)].map(m=>({n:Number(m[1]),unit:m[2].toLowerCase().replace(/\.$/,'')}));
}
const sum=list=>list.length?list.reduce((a,b)=>a+b,0):null;
const toKm=({n,unit})=>/^(mi|mile|miles|ไมล์)$/.test(unit)?n*1.609344:/^(m|meter|meters|metre|metres|เมตร)$/.test(unit)?n/1000:n;
const toKg=({n,unit})=>/^(lb|lbs|pound|pounds|ปอนด์)$/.test(unit)?n*0.45359237:n;
const toMin=({n,unit})=>/^(h|hr|hrs|hour|hours|ชม|ชั่วโมง)$/.test(unit)?n*60:/^(s|sec|secs|second|seconds|วินาที)$/.test(unit)?n/60:n;
const toKcal=({n,unit})=>/^(kj|kilojoule|kilojoules)$/.test(unit)?n/4.184:n;
const round=(n,d=1)=>Math.round(n*10**d)/10**d;

// One day of totals from loose input. Unknown or out-of-range fields become null; a day with nothing usable is rejected.
export function healthDay(input,today=bangkokDay()){
 if(!input||typeof input!=='object')throw Error('ข้อมูลสุขภาพไม่ถูกต้อง');
 const day=input.day==null||input.day===''?today:String(input.day).trim().slice(0,10);
 if(!isDay(day))throw Error('วันที่ต้องเป็นรูปแบบ ปปปป-ดด-วว');
 const r=k=>readings(input[k]);
 const values={
  steps:sum(r('steps').map(x=>x.n)),
  activeKcal:sum(r('activeKcal').map(toKcal)),
  exerciseMin:sum(r('exerciseMin').map(toMin)),
  distanceKm:sum(r('distanceKm').map(toKm)),
  restingHr:(l=>l.length?sum(l)/l.length:null)(r('restingHr').map(x=>x.n)),
  sleepMin:sum(r('sleepMin').map(toMin)),
  weight:(l=>l.length?toKg(l[l.length-1]):null)(r('weight')),
 };
 const out={day};
 for(const k of DAY_FIELDS){const v=values[k],[lo,hi]=LIMITS[k];out[k]=v!=null&&Number.isFinite(v)&&v>=lo&&v<=hi?(k==='steps'?Math.round(v):round(v,k==='weight'||k==='distanceKm'?2:1)):null;}
 if(DAY_FIELDS.every(k=>out[k]==null))throw Error('ไม่พบตัวเลขสุขภาพที่ใช้ได้ในวันที่ '+day);
 return out;
}

// A workout from the Health export or a Shortcut. Its id comes from when it started and what it was, so re-imports overwrite.
export function healthWorkout(input){
 if(!input||typeof input!=='object')throw Error('ข้อมูลการออกกำลังกายไม่ถูกต้อง');
 const start=new Date(input.start);if(Number.isNaN(start.getTime())||start.getFullYear()<2000||start.getTime()>Date.now()+86400000)throw Error('เวลาเริ่มออกกำลังกายไม่ถูกต้อง');
 const activity=String(input.activity||'').replace(/^HKWorkoutActivityType/,'').trim().slice(0,60)||'Other';
 const num=(v,max,conv=x=>x.n)=>{const l=readings(v);if(!l.length)return null;const n=conv(l[0]);return Number.isFinite(n)&&n>=0&&n<=max?round(n,2):null;};
 const day=isDay(input.day)?input.day:bangkokDay(start);
 return {id:start.toISOString()+'|'+activity,day,activity,start:start.toISOString(),durationMin:num(input.durationMin,1440,toMin),distanceKm:num(input.distanceKm,500,toKm),kcal:num(input.kcal,20000,toKcal),source:input.source?String(input.source).slice(0,80):null};
}

const NAMES={Running:'วิ่ง',Walking:'เดิน',Cycling:'ปั่นจักรยาน',TraditionalStrengthTraining:'เวทเทรนนิ่ง',FunctionalStrengthTraining:'ฟังก์ชันนอลเทรนนิ่ง',HighIntensityIntervalTraining:'HIIT',Yoga:'โยคะ',Pilates:'พิลาทิส',Swimming:'ว่ายน้ำ',Elliptical:'อีลิปติคอล',Rowing:'กรรเชียงบก',StairClimbing:'ขึ้นบันได',Stairs:'ขึ้นบันได',CoreTraining:'แกนกลางลำตัว',Cooldown:'คูลดาวน์',Hiking:'เดินป่า',Dance:'เต้น',CardioDance:'เต้นคาร์ดิโอ',MixedCardio:'คาร์ดิโอผสม',Boxing:'มวย',Kickboxing:'คิกบ็อกซิ่ง',MartialArts:'ศิลปะการต่อสู้',Badminton:'แบดมินตัน',Tennis:'เทนนิส',Soccer:'ฟุตบอล',Basketball:'บาสเกตบอล',JumpRope:'กระโดดเชือก',Flexibility:'ยืดเหยียด',Other:'อื่น ๆ'};
export const activityName=a=>NAMES[a]||String(a).replace(/([a-z])([A-Z])/g,'$1 $2');
