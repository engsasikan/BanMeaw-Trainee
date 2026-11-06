import {formatWeight} from './weight-units.mjs';
import {createExerciseHistory} from './exercise-history.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export function dailySummary(records,body,day){
 const rows=records.filter(r=>r.day===day),weights=body.filter(r=>r.day<=day&&typeof r.weight==='number').sort((a,b)=>b.day.localeCompare(a.day));
 return {workouts:rows.filter(r=>r.kind==='workout'),meals:rows.filter(r=>r.kind!=='workout').sort((a,b)=>(a.time||'99').localeCompare(b.time||'99')),weight:weights[0]||null};
}
export function initDailySummary({getRecords,onView}){
 const box=el('section',null,'diary daily-summary');box.id='daily-summary';document.getElementById('weekly-progress').before(box);let body=[],bodyState='loading';
 const button=(text,view)=>{const b=el('button',text,'quiet');b.type='button';b.onclick=()=>onView(view);return b;};
 function render(){
  const day=document.getElementById('day').value;if(!day)return;const records=getRecords(),s=dailySummary(records,body,day);box.replaceChildren(el('p','YOUR DAILY SUMMARY','eyebrow'),el('h2','สรุปการฝึก น้ำหนัก และอาหาร'),el('p',new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00')),'muted'));
  const grid=el('div',null,'daily-summary-grid'),weight=el('section'),training=el('section'),food=el('section');
  weight.append(el('h3','น้ำหนักร่างกาย'));if(bodyState!=='ready')weight.append(el('p',bodyState==='error'?'โหลดน้ำหนักไม่สำเร็จ':'กำลังโหลดน้ำหนัก…','muted'));else if(s.weight){weight.append(el('strong',s.weight.weight+' kg','daily-summary-value'),el('p',s.weight.day===day?'ชั่งในวันที่เลือก':'ค่าล่าสุดจาก '+s.weight.day,'muted'));}else weight.append(el('p','ยังไม่มีน้ำหนักถึงวันที่เลือก','muted'));weight.append(button('ดูน้ำหนักและสัดส่วน','settings'));
  training.append(el('h3','ท่าที่เล่น · '+s.workouts.length+' รายการ'));if(!s.workouts.length)training.append(el('p','ยังไม่ได้บันทึกการฝึกในวันนี้','muted'));
  for(const r of s.workouts){const item=el('div',null,'daily-summary-item');item.append(el('strong',r.exercise));if(r.trainingType==='cardio')item.append(el('p',r.duration+' นาที'+(r.distance==null?'':' · '+r.distance+' กม.')));else{if(r.setLogs?.length){r.setLogs.forEach((set,i)=>item.append(el('p','เซ็ต '+(i+1)+': '+formatWeight(set.weight)+' × '+set.reps+' ครั้ง')));}else item.append(el('p',formatWeight(r.weight)+' · '+(r.sets??'–')+' เซ็ต × '+(r.reps??'–')+' ครั้ง'));if(r.sessionComplete===false)item.append(el('p','ยังฝึกไม่ครบ','muted'));const fold=el('details');fold.append(el('summary','ดูกราฟประวัติท่านี้'));let chart;fold.ontoggle=()=>{if(!fold.open)return;if(!chart){chart=createExerciseHistory();fold.append(chart.element);}chart.update(getRecords(),r.exercise,'strength',day);};item.append(fold);}training.append(item);}training.append(button('ดู / บันทึกการฝึก','workout'));
  food.append(el('h3','อาหาร · '+s.meals.length+' รายการ'));if(!s.meals.length)food.append(el('p','ยังไม่ได้บันทึกอาหารในวันนี้','muted'));for(const r of s.meals){const item=el('div',null,'daily-summary-item');item.append(el('strong',r.meal+(r.time?' · '+r.time:'')),el('p',r.text));food.append(item);}food.append(button('ดู / บันทึกอาหาร','food'));grid.append(weight,training,food);box.append(grid);
 }
 window.addEventListener('diary-records',render);window.addEventListener('body-records',e=>{body=e.detail||[];bodyState='ready';render();});window.addEventListener('body-loading',()=>{bodyState='loading';render();});window.addEventListener('body-load-error',()=>{bodyState='error';render();});window.addEventListener('workout-weight-unit',render);render();
}
