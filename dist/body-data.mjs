// Body measurement records, shared by the browser and the Worker.
// Fields follow the InBody result sheet (e.g. InBody 380); every numeric field is optional.
// Segments: ra/la = right/left arm, trunk, rl/ll = right/left leg (InBody sheet order).
import {localDay} from './store.mjs';
export const SEGMENTS=[['ra','แขนขวา'],['la','แขนซ้าย'],['trunk','ลำตัว'],['rl','ขาขวา'],['ll','ขาซ้าย']];
const f=(label,unit,min,max,dp=1)=>({label,unit,min,max,dp});
export const FIELDS={
 // Main values
 height:f('ส่วนสูง','ซม.',50,250),
 weight:f('น้ำหนัก','กก.',10,400),
 muscle:f('มวลกล้ามเนื้อโครงร่าง (SMM)','กก.',5,150),
 body_fat_mass:f('มวลไขมันในร่างกาย','กก.',0.5,300),
 body_fat:f('เปอร์เซ็นต์ไขมัน (PBF)','%',1,75),
 visceral:f('ระดับไขมันในช่องท้อง','ระดับ',1,30,0),
 score:f('คะแนน InBody','คะแนน',0,150,0),
 // Body composition analysis
 tbw:f('ปริมาณน้ำในร่างกาย','ลิตร',5,150),
 protein:f('โปรตีน','กก.',1,50),
 minerals:f('แร่ธาตุ','กก.',0.3,15,2),
 soft_lean:f('มวลกล้ามเนื้อ (Soft Lean)','กก.',5,200),
 ffm:f('มวลกายไม่รวมไขมัน','กก.',5,250),
 // Additional data
 icw:f('น้ำภายในเซลล์','ลิตร',2,100),
 ecw:f('น้ำภายนอกเซลล์','ลิตร',1,60),
 ecw_ratio:f('อัตราส่วน ECW','',0.2,0.6,3),
 phase_angle:f('มุมเฟส (50 kHz)','°',1,20),
 smi:f('ดัชนีกล้ามเนื้อโครงร่าง (SMI)','กก./ม²',2,20),
 bmr:f('อัตราการเผาผลาญพื้นฐาน','kcal',500,5000,0),
 whr:f('อัตราส่วนเอวต่อสะโพก','',0.4,2,2),
 obesity_degree:f('ภาวะอ้วน','%',30,300,0),
 bmc:f('แร่ธาตุในกระดูก','กก.',0.3,10,2),
 bcm:f('มวลเซลล์ร่างกาย','กก.',5,150),
 // Weight control
 target_weight:f('น้ำหนักเป้าหมาย','กก.',10,400),
 weight_control:f('การควบคุมน้ำหนัก','กก.',-200,200),
 fat_control:f('การควบคุมไขมัน','กก.',-200,200),
 muscle_control:f('การควบคุมกล้ามเนื้อ','กก.',-100,100),
 // Tape measurements
 chest:f('รอบอก','ซม.',40,200),
 waist:f('รอบเอว','ซม.',30,250),
 hip:f('รอบสะโพก','ซม.',40,250),
 arm:f('รอบต้นแขน','ซม.',10,80),
 thigh:f('รอบต้นขา','ซม.',20,120),
 calf:f('รอบน่อง','ซม.',15,80),
};
for(const [key,label] of SEGMENTS){
 // Segmental lean analysis: kg and % of standard (100 = standard).
 FIELDS['mus_'+key]=f('กล้ามเนื้อ'+label,'กก.',0.1,60,2);
 FIELDS['musp_'+key]=f('กล้ามเนื้อ'+label,'%',10,300);
 // Segmental fat (only some InBody models): % of standard.
 FIELDS['fat_'+key]=f('ไขมัน'+label,'%',1,500);
}
// Form sections in the order of the InBody sheet.
export const GROUPS=[
 {title:'ค่าหลัก',open:true,keys:['height','weight','muscle','body_fat_mass','body_fat','visceral','score']},
 {title:'การวิเคราะห์องค์ประกอบร่างกาย',keys:['tbw','protein','minerals','soft_lean','ffm']},
 {title:'ความสมดุลกล้ามเนื้อแต่ละส่วน (กก. และ %)',segments:'mus',keys:SEGMENTS.flatMap(([s])=>['mus_'+s,'musp_'+s])},
 {title:'ข้อมูลเพิ่มเติม',keys:['icw','ecw','ecw_ratio','phase_angle','smi','bmr','whr','obesity_degree','bmc','bcm']},
 {title:'สัดส่วนจากสายวัด (ซม.)',keys:['chest','waist','hip','arm','thigh','calf']}
];
export const GIRTHS=['chest','waist','hip','arm','thigh','calf'];

export function validateBody(r){
 const fail=()=>{throw new Error('ข้อมูลร่างกายไม่ถูกต้อง');};
 if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||r.id.length>100)fail();
 if(typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||localDay(new Date(r.day+'T12:00:00'))!==r.day)fail();
 if(!['male','female'].includes(r.sex))fail();
 const note=r.note??'';if(typeof note!=='string'||note.length>500)fail();
 const out={id:r.id,day:r.day,sex:r.sex,note:note.trim()};
 let any=false;
 for(const [key,{min,max,dp}] of Object.entries(FIELDS)){
  const v=r[key]??null;
  if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max))fail();
  out[key]=v===null?null:Math.round(v*10**dp)/10**dp;if(v!==null)any=true;
 }
 if(!any)throw new Error('กรุณากรอกค่าร่างกายอย่างน้อย 1 ช่อง');
 return out;
}
