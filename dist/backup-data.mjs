import {validateRecords,localDay} from './store.mjs?v=14';
import {validateBody} from './body-data.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&localDay(new Date(value+'T12:00:00'))===value;
export function validateBackup(value,ownerId){
 if(value?.version!==3||value.profile?.id!==ownerId||!Array.isArray(value.body)||!Array.isArray(value.plans)||!Array.isArray(value.reports))throw Error('ไฟล์สำรองไม่ถูกต้องหรือเป็นของบัญชีอื่น');
 validateRecords(value.records);value.body.forEach(validateBody);
 if(value.reports.some(r=>!day(r.day)||!r.sent_at||!Number.isFinite(Date.parse(r.sent_at))))throw Error('ข้อมูลรายงานไม่ถูกต้อง');
 if(![null,'male','female'].includes(value.profile.sex??null))throw Error('ข้อมูลโปรไฟล์ไม่ถูกต้อง');
 const avatar=value.profile.avatar;
 if(avatar!=null){
  if(typeof avatar!=='string'||avatar.length>90000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatar))throw Error('รูปโปรไฟล์ในไฟล์ไม่ถูกต้อง');
  const bytes=atob(avatar.split(',')[1]);if(bytes.length>65536||bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216||bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)throw Error('รูปโปรไฟล์ในไฟล์ไม่ถูกต้อง');
 }
 for(const p of value.plans){
  if(!uuid(p.id)||!uuid(p.team_id)||!uuid(p.batch_id)||!day(p.day)||typeof p.user_id!=='string'||!p.user_id||p.user_id.length>200||!Array.isArray(p.exercises)||!p.exercises.length||p.exercises.length>30)throw Error('ข้อมูลแผนฝึกไม่ถูกต้อง');
  for(const r of p.exercises){
   if(typeof r.exercise!=='string'||!r.exercise.trim()||r.exercise.length>150||!Number.isInteger(r.sets)||r.sets<1||r.sets>100||!Number.isInteger(r.reps)||r.reps<1||r.reps>1000||!(r.weight===null||typeof r.weight==='number'&&Number.isFinite(r.weight)&&r.weight>=0&&r.weight<=2000)||r.rest_seconds!=null&&(!Number.isInteger(r.rest_seconds)||r.rest_seconds<0||r.rest_seconds>3600)||r.superset!=null&&r.superset!==''&&!/^[A-O]$/.test(r.superset))throw Error('รายละเอียดท่าในแผนไม่ถูกต้อง');
  }
  for(const group of new Set(p.exercises.map(r=>r.superset).filter(Boolean)))if(p.exercises.filter(r=>r.superset===group).length<2)throw Error('Super set ในไฟล์ต้องมีอย่างน้อย 2 ท่า');
 }
 return value;
}
