import {motionMatch} from './exercise-motion.mjs?v=7';

// Each name has an explicit presentation profile. Shared families remain illustrative;
// no keyword match is represented as a verified recording of that exact variation.
export function demonstrationFor(name){
 name=(name||'').trim();
 if(/^HIIT(?: น้ำหนักตัว)?$/i.test(name))return {name,motion:null,quality:'protocol',description:'HIIT เป็นรูปแบบการฝึกสลับหนัก–เบา กรุณาเลือกกิจกรรมหรือท่าที่จะทำ'};
 const match=motionMatch(name);if(!match.motion)return null;
 const n=name.toLowerCase();
 const equipment=/kettlebell/.test(n)?'kettlebell':/dumbbell|ดัมเบล|กอบเล็ต|goblet/.test(n)?'dumbbell':/barbell|ez.?bar|smith|บาร์เบล/.test(n)?'barbell':/cable|เคเบิล/.test(n)?'cable':/band|ยาง/.test(n)?'band':/lever|machine|sled|เครื่อง/.test(n)?'machine':/bodyweight|push.?up|plank|crunch|pull.?up|วิดพื้น|แพลงก์/.test(n)?'bodyweight':'unspecified';
 const posture=/floor|on ground/.test(n)?'floor':/seated|sitting|นั่ง/.test(n)?'seated':/kneeling|on knees/.test(n)?'kneeling':/lying|supine|prone|bench/.test(n)?'lying':'standing';
 const grip=/wide/.test(n)?'wide':/close.?grip|narrow/.test(n)?'narrow':/reverse.?grip|reverse curl|palms? out/.test(n)?'reverse':/hammer|neutral|parallel|palm.?in/.test(n)?'neutral':'standard';
 const side=/alternat|seesaw/.test(n)?'alternating':/one arm|single arm|single-arm|unilateral/.test(n)||/concentration/.test(n)&&equipment!=='barbell'?'single':'both';
 const angle=/incline/.test(n)?30:/decline/.test(n)?-15:0;
 const stance=/sumo|wide stance|wide squat/.test(n)?'wide':'standard';
 const legSide=/one leg|single leg|single-leg|pistol/.test(n)?'single':'both';
 return {name,motion:match.motion,equipment,posture,grip,side,angle,stance,legSide,quality:match.source==='movement'?'illustrative':'muscle-group',
  description:[{dumbbell:'ดัมเบล',barbell:'บาร์เบล',kettlebell:'เคตเทิลเบล',cable:'เคเบิล',band:'ยางยืด',machine:'เครื่องฝึก',bodyweight:'น้ำหนักตัว',unspecified:'อุปกรณ์ตามท่าพื้นฐาน'}[equipment],
   posture==='seated'?'ท่านั่ง':posture==='floor'?'บนพื้น':null,side==='single'?'ข้างเดียว':side==='alternating'?'สลับข้าง':null,
   grip==='wide'?'จับกว้าง':grip==='narrow'?'จับแคบ':grip==='neutral'?'จับขนาน':grip==='reverse'?'จับกลับด้าน':null,
   legSide==='single'?'ขาเดียว':null,angle===30?'แนวเอียงขึ้น':angle===-15?'แนวเอียงลง':null].filter(Boolean).join(' · ')};
}
