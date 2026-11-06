import {mkdir,writeFile} from 'node:fs/promises';
import {searchExercises} from '../dist/exercise-picker.mjs';
import {demonstrationFor} from '../dist/exercise-demo.mjs';
import {MOTION_IDS,motionDefinition} from '../src/body3d.mjs';

const profiles=searchExercises('').map(({name})=>demonstrationFor(name));
if(profiles.some(x=>!x))throw Error('An exercise has no 3D profile');
for(const p of profiles)if(p.motion&&!motionDefinition(p.motion,p))throw Error('Unknown motion: '+p.name);
const animated=profiles.filter(p=>p.quality==='illustrative'),staticOnly=profiles.filter(p=>p.quality==='muscle-group'),protocols=profiles.filter(p=>p.quality==='protocol');
const summary={total:profiles.length,movementFamilies:MOTION_IDS.length,illustrativeAnimations:animated.length,staticMuscleViews:staticOnly.length,trainingProtocols:protocols.length};
await mkdir('outputs',{recursive:true});
await writeFile('outputs/exercise-3d-coverage.json',JSON.stringify({summary,profiles},null,2)+'\n');
await writeFile('outputs/exercise-3d-coverage.md',[
 '# ความครอบคลุมภาพ 3D ของบ้านแมว','',
 `รายการทั้งหมด ${summary.total} ชื่อ · กลุ่มการเคลื่อนไหว ${summary.movementFamilies} กลุ่ม`,
 `แอนิเมชันแบบจำลองโดยประมาณ ${animated.length} ชื่อ · ภาพกล้ามเนื้อ 3D อย่างเดียว ${staticOnly.length} ชื่อ · รูปแบบการฝึก ${protocols.length} ชื่อ`,'',
 'โปรไฟล์แยกอุปกรณ์ ท่านั่ง/นอนพื้น การจับ มุมม้านั่ง และการใช้แขนตามชื่อท่า มีการใช้โมเดลและกลุ่มการเคลื่อนไหวร่วมกัน ภาพเหล่านี้ไม่ใช่ motion capture และยังไม่ได้ตรวจความถูกต้องด้านเทคนิคการฝึกเป็นรายท่าครบทั้งหมด','',
 '## ชื่อที่ต้องระบุท่าให้ชัดก่อนสร้างแอนิเมชัน','',...staticOnly.map(p=>'- '+p.name),'',
 'รายการเหล่านี้แสดงภาพกล้ามเนื้อ 3D และปิดการเล่นแอนิเมชัน เพื่อไม่ใช้ท่าจากกลุ่มกล้ามเนื้อแทนโดยอัตโนมัติ','',
 '## รูปแบบการฝึกที่ไม่ใช่ท่าเดี่ยว','',...protocols.map(p=>'- '+p.name),'',
 'HIIT ต้องเลือกกิจกรรมย่อยก่อน เช่น วิ่งหรือปั่นจักรยาน','',
 'รัน npm test เพื่อตรวจ mapping, โครงร่างชาย/หญิง, ตำแหน่งข้อต่อ และการไม่ทะลุพื้น การทดสอบนี้ไม่ได้ยืนยันว่าทุกแอนิเมชันเป็นเทคนิคการฝึกที่ถูกต้องครบทุกจุด',''
].join('\n'));
console.log(summary);
