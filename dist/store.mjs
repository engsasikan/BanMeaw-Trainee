export const KEY='meal-diary-v1';
export const MEALS=['มื้อเช้า','มื้อกลางวัน','มื้อเย็น','ของว่าง','เครื่องดื่ม'];
export const WORKOUT_TIMINGS=['','pre-workout','post-workout'];
export function mealForTime(time){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;const hour=Number(time.slice(0,2));return hour>=16?'มื้อเย็น':hour>=12?'มื้อกลางวัน':'มื้อเช้า';}
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validateRecords(records){
 if(!Array.isArray(records)||records.length>50000)throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
 const ids=new Set();
 return records.map(r=>{
  if(r?.kind==='workout'){
   if(typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id)||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||localDay(new Date(r.day+'T12:00:00'))!==r.day||typeof r.exercise!=='string'||!r.exercise.trim()||r.exercise.length>150||!(r.weight===null||(typeof r.weight==='number'&&Number.isFinite(r.weight)&&r.weight>=0&&r.weight<=2000))||![r.sets,r.reps].every(n=>n===null||(Number.isInteger(n)&&n>=1&&n<=1000))||typeof r.notes!=='string'||r.notes.length>1000)throw new Error('ข้อมูลออกกำลังกายไม่ถูกต้อง');
   const trainingType=r.trainingType??'strength';if(!['strength','cardio'].includes(trainingType))throw Error('ประเภทการฝึกไม่ถูกต้อง');
   const valid=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;if(trainingType==='cardio'&&(!valid(r.duration,1440)||r.duration<=0||(r.distance!=null&&!valid(r.distance,1000))))throw Error('กรุณาใส่เวลาคาร์ดิโอให้ถูกต้อง');
   if(trainingType==='cardio'&&r.incline!=null&&!valid(r.incline,100))throw Error('ความชันต้องอยู่ระหว่าง 0–100%');
   ids.add(r.id);return {trainingType,...(trainingType==='cardio'?{duration:r.duration,distance:r.distance??null,incline:r.incline??null}:{}),id:r.id,kind:'workout',day:r.day,exercise:r.exercise.trim(),weight:r.weight,sets:r.sets,reps:r.reps,notes:r.notes.trim()};
  }
  if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id)||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||localDay(new Date(r.day+'T12:00:00'))!==r.day||!MEALS.includes(r.meal)||typeof r.text!=='string'||!r.text.trim()||r.text.length>3000||typeof r.time!=='string'||!/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw new Error('ข้อมูลในไฟล์ไม่ถูกต้อง');
  if(r.workoutTiming!==undefined&&!WORKOUT_TIMINGS.includes(r.workoutTiming))throw new Error('ช่วงการฝึกไม่ถูกต้อง');
  ids.add(r.id);return {id:r.id,day:r.day,meal:r.meal,time:r.time,text:r.text.trim(),...(r.workoutTiming?{workoutTiming:r.workoutTiming}:{})};
 });
}
export function read(storage){return validateRecords(JSON.parse(storage.getItem(KEY)||'[]'));}
export function write(storage,records){const valid=validateRecords(records);storage.setItem(KEY,JSON.stringify(valid));return valid;}
export function mergeRecords(existing,incoming){const map=new Map(existing.map(r=>[r.id,r]));for(const r of incoming)if(!map.has(r.id))map.set(r.id,r);return validateRecords([...map.values()]);}
