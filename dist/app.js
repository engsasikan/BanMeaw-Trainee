import {localDay,read,write,validateRecords,mergeRecords} from './store.mjs';
import {attachExercisePicker} from './exercise-picker.mjs';
import {attachNavigation,renderDashboard,switchView} from './dashboard.mjs';
const $=id=>document.getElementById(id);let records=[],editing=null,workoutEditing=null,storageOK=true;
attachExercisePicker();
attachNavigation();
function tell(message){$('status').textContent=message;}
try{records=read(localStorage);}catch{storageOK=false;tell('อ่านข้อมูลไม่ได้ กรุณาอย่าล้างข้อมูลเว็บไซต์ ลองเปิดใหม่หรือสำรองข้อมูลเดิมก่อน');}
$('day').value=localDay();$('time').value=new Date().toTimeString().slice(0,5);
function saveRecords(next){if(!storageOK){tell('ยังบันทึกไม่ได้ เพราะอ่านข้อมูลเดิมไม่สำเร็จ กรุณาลองเปิดใหม่');return false;}try{records=write(localStorage,next);return true;}catch{tell('บันทึกไม่สำเร็จ พื้นที่อาจเต็มหรือเบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล กรุณาสำรองข้อมูล');return false;}}
function reset(){editing=null;$('meal-form').reset();$('time').value=new Date().toTimeString().slice(0,5);$('form-title').textContent='เพิ่มมื้ออาหาร';$('save').textContent='บันทึกมื้ออาหาร';$('cancel').hidden=true;$('count').textContent='0 / 3,000';resetWorkout();}
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function renderMeals(){
 const day=$('day').value;if(!day)return;
 $('date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 const meals=records.filter(r=>r.day===day&&r.kind!=='workout').sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 $('total').textContent=meals.length+' รายการ';$('entries').replaceChildren();
 if(!meals.length){const box=node('div',undefined,'empty');box.append(node('span','+','empty-symbol'),node('h3','ยังไม่มีมื้อที่บันทึก'),node('p','เริ่มจดมื้อแรกของวันนี้ได้เลย'));$('entries').append(box);return;}
 for(const r of meals){const card=node('article',undefined,'entry'),top=node('div',undefined,'entry-top');top.append(node('h3',r.meal));if(r.time)top.append(node('time',r.time));card.append(top,node('p',r.text,'entry-text'));const actions=node('div',undefined,'entry-actions');const edit=node('button','แก้ไข');edit.type='button';edit.setAttribute('aria-label','แก้ไข '+r.meal+' '+r.time);edit.onclick=()=>{editing=r.id;$('meal').value=r.meal;$('time').value=r.time;$('details').value=r.text;$('form-title').textContent='แก้ไขมื้ออาหาร';$('save').textContent='บันทึกการแก้ไข';$('cancel').hidden=false;count();$('details').focus();$('meal-form').scrollIntoView({behavior:'smooth',block:'center'});};const del=node('button','ลบ','delete');del.type='button';del.setAttribute('aria-label','ลบ '+r.meal+' '+r.time);del.onclick=()=>{if(confirm('ลบรายการ '+r.meal+' นี้ไหม?')){if(saveRecords(records.filter(x=>x.id!==r.id))){if(editing===r.id)reset();render();tell('ลบรายการแล้ว');}}};actions.append(edit,del);card.append(actions);$('entries').append(card);}
}
function count(){$('count').textContent=$('details').value.length.toLocaleString('en-US')+' / 3,000';}
function resetWorkout(){workoutEditing=null;$('workout-form').reset();$('workout-form-title').textContent='เพิ่มท่าออกกำลังกาย';$('workout-save').textContent='บันทึกท่าออกกำลังกาย';$('workout-cancel').hidden=true;}
function render(){renderMeals();renderWorkouts();renderDashboard(records,$('day').value);}
function renderWorkouts(){
 const day=$('day').value;if(!day)return;
 $('workout-date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 const rows=records.filter(r=>r.kind==='workout'&&r.day===day);$('workout-total').textContent=rows.length+' รายการ';$('workout-entries').replaceChildren();
 if(!rows.length){const box=node('div',undefined,'empty');box.append(node('span','+','empty-symbol'),node('h3','ยังไม่มีท่าที่บันทึก'),node('p','จดชื่อท่าและน้ำหนักที่ใช้วันนี้ได้เลย'));$('workout-entries').append(box);return;}
 for(const r of rows){
  const card=node('article',undefined,'entry');card.append(node('h3',r.exercise));
  const metrics=node('div',undefined,'workout-metrics');for(const [label,value] of [['น้ำหนัก',r.weight===null?'ไม่ระบุ':r.weight===0?'น้ำหนักตัว':r.weight+' กก.'],['เซ็ต',r.sets===null?'ไม่ระบุ':String(r.sets)],['ครั้ง / เซ็ต',r.reps===null?'ไม่ระบุ':String(r.reps)]]){const metric=node('div');metric.append(node('span',label),node('strong',value));metrics.append(metric);}card.append(metrics);if(r.notes)card.append(node('p',r.notes,'entry-text'));
  const actions=node('div',undefined,'entry-actions'),edit=node('button','แก้ไข'),del=node('button','ลบ','delete');edit.type=del.type='button';edit.setAttribute('aria-label','แก้ไขท่า '+r.exercise);del.setAttribute('aria-label','ลบท่า '+r.exercise);
  edit.onclick=()=>{workoutEditing=r.id;$('exercise').value=r.exercise;$('weight').value=r.weight??'';$('sets').value=r.sets??'';$('reps').value=r.reps??'';$('workout-notes').value=r.notes;$('workout-form-title').textContent='แก้ไขท่าออกกำลังกาย';$('workout-save').textContent='บันทึกการแก้ไข';$('workout-cancel').hidden=false;$('exercise').focus();$('workout-form').scrollIntoView({behavior:'smooth',block:'center'});};
  del.onclick=()=>{if(confirm('ลบท่า '+r.exercise+' นี้ไหม?')&&saveRecords(records.filter(x=>x.id!==r.id))){if(workoutEditing===r.id)resetWorkout();render();tell('ลบรายการออกกำลังกายแล้ว');}};actions.append(edit,del);card.append(actions);$('workout-entries').append(card);
 }
}
function switchPanel(workout){switchView(workout?'workout':'food');}
$('food-tab').onclick=()=>switchPanel(false);$('workout-tab').onclick=()=>switchPanel(true);$('workout-cancel').onclick=resetWorkout;
$('exercise').addEventListener('input',()=>$('exercise').setCustomValidity(''));
$('workout-form').addEventListener('submit',e=>{
 e.preventDefault();const exercise=$('exercise').value.trim(),day=$('day').value;if(!exercise){$('exercise').setCustomValidity('กรุณาใส่ชื่อท่า');$('exercise').reportValidity();return;}if(!day){$('day').reportValidity();return;}
 const number=id=>$(id).value===''?null:Number($(id).value);
 const row={id:workoutEditing||crypto.randomUUID(),kind:'workout',day,exercise,weight:number('weight'),sets:number('sets'),reps:number('reps'),notes:$('workout-notes').value.trim()};
 const next=workoutEditing?records.map(r=>r.id===workoutEditing?row:r):[...records,row];if(saveRecords(next)){resetWorkout();render();tell('บันทึกท่าออกกำลังกายแล้ว');}
});
$('details').addEventListener('input',count);
$('meal-form').addEventListener('submit',e=>{e.preventDefault();const text=$('details').value.trim(),day=$('day').value;if(!text){$('details').setCustomValidity('กรุณาใส่รายละเอียดอาหาร');$('details').reportValidity();return;}if(!day){$('day').reportValidity();return;}const row={id:editing||crypto.randomUUID(),day,meal:$('meal').value,time:$('time').value,text};const next=editing?records.map(r=>r.id===editing?row:r):[...records,row];if(saveRecords(next)){reset();render();tell('บันทึกเรียบร้อยแล้ว');}});
$('details').addEventListener('input',()=>$('details').setCustomValidity(''));
$('cancel').onclick=reset;$('day').onchange=()=>{reset();render();};
function moveDay(offset){const d=new Date(($('day').value||localDay())+'T12:00:00');d.setDate(d.getDate()+offset);$('day').value=localDay(d);reset();render();}
$('prev').onclick=()=>moveDay(-1);$('next').onclick=()=>moveDay(1);$('today').onclick=()=>{$('day').value=localDay();reset();render();};
$('export').onclick=()=>{if(!storageOK){tell('อ่านข้อมูลเดิมไม่ได้ จึงยังสำรองไม่ได้ กรุณาลองเปิดใหม่');return;}const blob=new Blob([JSON.stringify({version:2,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meal-diary-'+localDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);tell('ส่งออกข้อมูลแล้ว เก็บไฟล์นี้ไว้สำหรับนำเข้าภายหลัง');};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>15000000)throw new Error('ไฟล์ใหญ่เกินไป');const payload=JSON.parse(await file.text());if(![1,2].includes(payload.version))throw new Error('ไม่รองรับไฟล์นี้');const incoming=validateRecords(payload.records);if(!confirm('นำเข้า '+incoming.length+' รายการ? ข้อมูลเดิมจะยังอยู่ และรายการที่ซ้ำจะไม่ถูกเพิ่ม'))return;if(saveRecords(mergeRecords(records,incoming))){render();tell('นำเข้าข้อมูลเรียบร้อยแล้ว');}}catch{tell('นำเข้าไม่สำเร็จ กรุณาเลือกไฟล์สำรองจากเว็บนี้ ข้อมูลเดิมยังอยู่');}finally{e.target.value='';}};
$('install').onclick=()=>$('install-dialog').showModal();$('close-dialog').onclick=()=>$('install-dialog').close();window.addEventListener('storage',()=>{try{records=read(localStorage);storageOK=true;reset();render();}catch{storageOK=false;tell('อ่านข้อมูลที่เปลี่ยนแปลงไม่ได้ กรุณาเปิดใหม่');}});render();

