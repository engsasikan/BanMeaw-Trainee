// Body measurement records, shared by the browser and the Worker.
// Every numeric field is optional (null). Segments follow InBody-style analysis:
// la/ra = left/right arm, trunk, ll/rl = left/right leg.
import {localDay} from './store.mjs';
export const SEGMENTS=[['la','แขนซ้าย'],['ra','แขนขวา'],['trunk','ลำตัว'],['ll','ขาซ้าย'],['rl','ขาขวา']];
export const FIELDS={
 height:{label:'ส่วนสูง',unit:'ซม.',min:50,max:250},
 weight:{label:'น้ำหนัก',unit:'กก.',min:10,max:400},
 body_fat:{label:'ไขมันในร่างกาย',unit:'%',min:1,max:75},
 muscle:{label:'มวลกล้ามเนื้อ',unit:'กก.',min:5,max:150},
 visceral:{label:'ไขมันในช่องท้อง',unit:'ระดับ',min:1,max:30},
 chest:{label:'รอบอก',unit:'ซม.',min:40,max:200},
 waist:{label:'รอบเอว',unit:'ซม.',min:30,max:250},
 hip:{label:'รอบสะโพก',unit:'ซม.',min:40,max:250},
 arm:{label:'รอบต้นแขน',unit:'ซม.',min:10,max:80},
 thigh:{label:'รอบต้นขา',unit:'ซม.',min:20,max:120},
 calf:{label:'รอบน่อง',unit:'ซม.',min:15,max:80},
};
for(const [key,label] of SEGMENTS){
 // InBody reports segmental fat as % of the standard value (100 = standard).
 FIELDS['fat_'+key]={label:'ไขมัน'+label,unit:'%',min:1,max:500};
 FIELDS['mus_'+key]={label:'กล้ามเนื้อ'+label,unit:'กก.',min:0.1,max:60};
}
export const BASIC=['height','weight','body_fat','muscle','visceral'];
export const GIRTHS=['chest','waist','hip','arm','thigh','calf'];

export function validateBody(r){
 const fail=()=>{throw new Error('ข้อมูลร่างกายไม่ถูกต้อง');};
 if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||r.id.length>100)fail();
 if(typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||localDay(new Date(r.day+'T12:00:00'))!==r.day)fail();
 if(!['male','female'].includes(r.sex))fail();
 const note=r.note??'';if(typeof note!=='string'||note.length>500)fail();
 const out={id:r.id,day:r.day,sex:r.sex,note:note.trim()};
 let any=false;
 for(const [key,{min,max}] of Object.entries(FIELDS)){
  const v=r[key]??null;
  if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max))fail();
  out[key]=v===null?null:Math.round(v*10)/10;if(v!==null)any=true;
 }
 if(!any)throw new Error('กรุณากรอกค่าร่างกายอย่างน้อย 1 ช่อง');
 return out;
}
