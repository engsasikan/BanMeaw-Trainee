import {planComparison} from './coach-ui.mjs?v=2';
import {searchExercises,SHOW_LIMIT} from './exercise-picker.mjs?v=9';
import {api} from './account.js?v=2';
import {localDay} from './store.mjs';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const input=(label,type,value)=>{const box=el('label',label),i=el('input');i.type=type;i.value=value??'';box.append(i);return {box,i};};
const cardioText=r=>[r.duration+' นาที',r.incline!=null?'ความชัน '+r.incline+'%':'',r.speed!=null?'ความเร็ว '+r.speed+' กม./ชม.':'',r.distance!=null?r.distance+' กม.':''].filter(Boolean).join(' · ');
const prescription=r=>r.trainingType==='cardio'?cardioText(r):r.sets+' เซ็ต · '+r.reps+' ครั้ง'+(r.weight==null?'':' · '+r.weight+' กก.')+(r.rest_seconds==null?'':' · พัก '+r.rest_seconds+' วินาที');
function appendPlanExercise(card,r){
 const item=el('div',undefined,'plan-saved-exercise');
 if(r.superset)item.append(el('span','Super set '+r.superset,'plan-superset-badge'));
 item.append(el('strong',r.exercise),el('span',prescription(r),'muted'));card.append(item);
}
function planExercisePicker(onChoose){
 const box=el('div',undefined,'plan-name'),details=el('details',undefined,'plan-picker'),summary=el('summary','เลือกหรือค้นหาท่าฝึก'),label=el('span','ท่าฝึก'),i=el('input');
 i.type='hidden';const search=el('input');search.type='search';search.placeholder='ค้นหาชื่อท่าหรือกล้ามเนื้อ';search.setAttribute('aria-label','ค้นหาท่าฝึก');search.autocomplete='off';
 const panel=el('div',undefined,'plan-picker-panel'),options=el('div',undefined,'plan-picker-options'),status=el('p',undefined,'muted');status.setAttribute('role','status');
 panel.append(search,options,status);details.append(summary,panel);box.append(label,details,i);
 function choose(exercise){i.value=exercise.name;summary.textContent=exercise.name;details.open=false;summary.focus();onChoose?.(exercise);}
 function render(){
  const matches=searchExercises(search.value);options.replaceChildren();
  for(const exercise of matches.slice(0,SHOW_LIMIT)){
   const b=el('button');b.type='button';b.append(el('span',exercise.name),el('small',exercise.group));b.setAttribute('aria-pressed',String(i.value===exercise.name));b.onclick=()=>choose(exercise);options.append(b);
  }
  status.textContent=matches.length>SHOW_LIMIT?'พบ '+matches.length+' ท่า แสดง '+SHOW_LIMIT+' ท่าแรก พิมพ์เพิ่มเพื่อค้นหา':matches.length?'พบ '+matches.length+' ท่า':'ไม่พบท่า ลองค้นหาคำอื่น';
 }
 details.addEventListener('toggle',()=>{if(details.open){search.value='';render();}});
 search.addEventListener('input',render);
 search.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();const match=searchExercises(search.value)[0];if(match)choose(match);}
  if(e.key==='ArrowDown'){e.preventDefault();options.querySelector('button')?.focus();}
  if(e.key==='Escape'){e.preventDefault();details.open=false;summary.focus();}
 });
 return {box,i,focus:()=>summary.focus()};
}
function stylePlanDate(date){
 const frame=el('div',undefined,'plan-date-control'),display=el('span'),icon=el('span','▾');
 icon.setAttribute('aria-hidden','true');display.setAttribute('aria-hidden','true');
 const update=()=>{display.textContent=date.i.value?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(date.i.value+'T12:00:00')):'เลือกวันที่';};
 date.i.setAttribute('aria-label','เริ่มวันที่');date.i.addEventListener('change',update);date.i.addEventListener('input',update);
 frame.append(display,icon,date.i);date.box.append(frame);update();
}
export async function trainerPlanner(root,team,member,{day=localDay()}={}){
 const section=el('section',undefined,'diary training-planner');
 const header=el('div',undefined,'plan-header');
 header.append(el('p','จัดแผนให้ทีม','eyebrow'),el('h2',member.display_name),el('p','เลือกท่าและกำหนดเป้าหมายให้ลูกเทรน','muted'));
 const message=el('p',undefined,'plan-message');message.setAttribute('role','status');
 section.append(header);root.append(section);
 const form=el('form'),date=input('เริ่มวันที่','date',day),period=el('select'),periodBox=el('label','ช่วงแผน');
 periodBox.append(period);for(const [v,t] of [['day','วันเดียว'],['week','7 วัน'],['month','ถึงสิ้นเดือน']]){const o=el('option',t);o.value=v;period.append(o);}
 stylePlanDate(date);
 const dates=el('div',undefined,'plan-dates');dates.append(date.box,periodBox);form.append(dates);date.i.required=true;
 const weekdays=el('fieldset',undefined,'plan-weekdays');weekdays.append(el('legend','เลือกวันฝึก'));
 const checks=[];for(const [v,t] of [[1,'จ.'],[2,'อ.'],[3,'พ.'],[4,'พฤ.'],[5,'ศ.'],[6,'ส.'],[0,'อา.']]){const l=el('label',t),c=el('input');c.type='checkbox';c.value=v;c.checked=[1,3,5].includes(v);l.prepend(c);weekdays.append(l);checks.push(c);}
 weekdays.hidden=true;period.onchange=()=>weekdays.hidden=period.value==='day';form.append(weekdays);
 const rows=el('div',undefined,'plan-exercises'),entries=[];
 const heading=el('div',undefined,'plan-list-heading'),count=el('span',undefined,'muted');heading.append(el('h3','ท่าในแผน'),count);form.append(heading,el('p','เลือกกลุ่มเดียวกันเพื่อทำ Super set ต่อเนื่อง ตั้งพัก 0 สำหรับท่าแรก และใส่เวลาพักหลังท่าสุดท้ายของกลุ่ม','muted plan-superset-hint'));
 const refresh=()=>{count.textContent=entries.length+' / 30 ท่า';entries.forEach((entry,index)=>entry.number.textContent='ท่าที่ '+(index+1));more.disabled=entries.length>=30;};
 function add(){
  const row=el('div',undefined,'plan-exercise'),top=el('div',undefined,'plan-exercise-top'),number=el('strong'),remove=el('button','นำออก','quiet plan-remove');
  remove.type='button';top.append(number,remove);
  const type={box:el('label','ประเภท'),i:el('select')};type.box.append(type.i);
  for(const [v,t] of [['strength','เวทเทรนนิ่ง (เซ็ต/ครั้ง)'],['cardio','คาร์ดิโอ (เวลา/ความชัน)']]){const o=el('option',t);o.value=v;type.i.append(o);}
  const name=planExercisePicker(exercise=>{type.i.value=exercise.group==='คาร์ดิโอ'?'cardio':'strength';applyType();});
  const weight=input('น้ำหนัก (กก.)','number',''),sets=input('เซ็ต','number',3),reps=input('ครั้ง / เซ็ต','number',12);
  weight.i.min=0;weight.i.max=2000;weight.i.step='.01';weight.i.placeholder='ไม่ระบุ';
  for(const f of [sets,reps]){f.i.required=true;f.i.min=1;f.i.step=1;}sets.i.max=100;reps.i.max=1000;
  const metrics=el('div',undefined,'plan-metrics');metrics.append(weight.box,sets.box,reps.box);
  const rest=input('พัก (วินาที)','number',60);rest.i.min=0;rest.i.max=3600;rest.i.step=1;rest.i.required=true;
  const superset={box:el('label','Super set'),i:el('select')};superset.box.append(superset.i);
  const solo=el('option','ท่าเดี่ยว');solo.value='';superset.i.append(solo);
  for(const group of 'ABCDEFGHIJKLMNO'){const option=el('option','กลุ่ม '+group);option.value=group;superset.i.append(option);}
  const advanced=el('div',undefined,'plan-advanced');advanced.append(superset.box,rest.box);
  const duration=input('เวลา (นาที)','number',30),incline=input('ความชัน (%)','number',''),speed=input('ความเร็ว (กม./ชม.)','number',''),distance=input('ระยะทาง (กม.)','number','');
  duration.i.min=1;duration.i.max=600;duration.i.step=1;duration.i.required=true;incline.i.min=0;incline.i.max=100;incline.i.step='.5';incline.i.placeholder='เช่น 12';
  speed.i.min=0;speed.i.max=50;speed.i.step='.1';speed.i.placeholder='เช่น 5';distance.i.min=0;distance.i.max=1000;distance.i.step='.01';distance.i.placeholder='ไม่ระบุ';
  for(const f of [duration,incline,speed,distance])f.i.inputMode='decimal';
  const cardio=el('div',undefined,'plan-metrics plan-cardio');cardio.append(duration.box,incline.box,speed.box,distance.box);
  function applyType(){const c=type.i.value==='cardio';metrics.hidden=advanced.hidden=c;cardio.hidden=!c;for(const f of [weight,sets,reps,rest])f.i.disabled=c;superset.i.disabled=c;for(const f of [duration,incline,speed,distance])f.i.disabled=!c;}
  const entry={row,name,weight,sets,reps,number,rest,superset,type,duration,incline,speed,distance};entries.push(entry);
  remove.onclick=()=>{entries.splice(entries.indexOf(entry),1);row.remove();refresh();};
  row.append(top,name.box,type.box,metrics,advanced,cardio);applyType();rows.append(row);refresh();
 }
 const more=el('button','+ เพิ่มท่าฝึก','quiet plan-add');more.type='button';more.onclick=()=>{if(entries.length<30){add();entries.at(-1).name.focus();}};
 const save=el('button','บันทึกแผน','primary');save.type='submit';form.append(rows,more,save,message);section.append(form);
 add();const list=el('div',undefined,'plan-saved');section.append(list);
 const path='/api/teams/'+team.id+'/plans/'+encodeURIComponent(member.id);
 async function load(){
  const {plans}=await api(path);list.replaceChildren(el('h3','แผนที่บันทึกไว้'));
  if(!plans.length)list.append(el('p','ยังไม่มีแผน เริ่มจัดท่าฝึกด้านบนได้เลย','muted'));
  for(const p of plans){
   const card=el('div',undefined,'entry'),day=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(p.day+'T12:00:00'));card.append(el('h3',day));
   for(const r of p.exercises)appendPlanExercise(card,r);
   const b=el('button','ลบแผนวันนี้','quiet');b.type='button';b.onclick=async()=>{if(!confirm('ลบแผนวันที่ '+day+'?'))return;try{await api(path+'?id='+p.id,{method:'DELETE'});await load();}catch(e){message.textContent=e.message;}};card.append(b);list.append(card);
  }
 }
 form.onsubmit=async e=>{
  e.preventDefault();if(!entries.length){message.textContent='เพิ่มท่าฝึกอย่างน้อย 1 ท่าก่อนบันทึก';more.focus();return;}
  const missing=entries.find(x=>!x.name.i.value);if(missing){message.textContent='เลือกท่าฝึกก่อนบันทึก';missing.name.focus();return;}
  if(period.value!=='day'&&!checks.some(c=>c.checked)){message.textContent='เลือกวันฝึกอย่างน้อย 1 วัน';checks[0].focus();return;}
  const groupOf=x=>x.type.i.value==='cardio'?'':x.superset.i.value;
  for(const group of new Set(entries.map(groupOf).filter(Boolean))){if(entries.filter(x=>groupOf(x)===group).length<2){message.textContent='Super set '+group+' ต้องมีอย่างน้อย 2 ท่า';return;}}
  save.disabled=true;save.textContent='กำลังบันทึก…';
  try{const result=await api(path,{method:'POST',body:JSON.stringify({start:date.i.value,period:period.value,weekdays:checks.filter(c=>c.checked).map(c=>Number(c.value)),exercises:entries.map(x=>x.type.i.value==='cardio'?{trainingType:'cardio',exercise:x.name.i.value,duration:Number(x.duration.i.value),...Object.fromEntries(['incline','speed','distance'].filter(k=>x[k].i.value!=='').map(k=>[k,Number(x[k].i.value)]))}:({exercise:x.name.i.value,weight:x.weight.i.value===''?null:Number(x.weight.i.value),sets:Number(x.sets.i.value),reps:Number(x.reps.i.value),rest_seconds:Number(x.rest.i.value),superset:x.superset.i.value||null}))})});message.textContent='บันทึกแผนแล้ว '+result.count+' วัน';await load();}
  catch(e){message.textContent=e.message;}finally{save.disabled=false;save.textContent='บันทึกแผน';}
 };
 await load();section.scrollIntoView({behavior:'smooth',block:'start'});
}
export async function showDailyPlans(root,day,{records=[],onStart}={}){
 const request=String(Number(root.dataset.request||0)+1);root.dataset.request=request;
 const heading=()=>[el('p','YOUR TRAINING','eyebrow'),el('h2',day===localDay()?'วันนี้ฝึกอะไร':'แผนฝึกของวันที่เลือก'),el('p',new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00')),'muted')];
 root.replaceChildren(...heading(),el('p','กำลังโหลดแผนจากเทรนเนอร์…','muted'));
 try{
  const {plans}=await api('/api/plans?day='+day);if(root.dataset.day!==day||root.dataset.request!==request)return;
  root.replaceChildren(...heading());
  window.dispatchEvent(new CustomEvent('training-plans',{detail:{plans,day}}));
  if(!plans.length){root.append(el('h3','ยังไม่มีแผนจากเทรนเนอร์สำหรับวันนี้'),el('p','สอบถามเทรนเนอร์ว่าเป็นวันพักหรือยังไม่ได้จัดแผน หากฝึกเอง ให้เปิดเพิ่มท่านอกแผนด้านล่าง','muted'));return;}
  const start=el('button','เริ่มฝึกตามแผน','primary');start.type='button';start.onclick=()=>window.dispatchEvent(new CustomEvent('training-start'));root.append(start);
  root.append(el('p','แผนจากเทรนเนอร์ · เลือกท่า → ฝึก → บันทึกผลที่ทำจริง','training-guide'),planComparison(plans,records,{onStart}));
  root.append(el('p','กดบันทึกผลท่านี้ ปรับน้ำหนัก เซ็ต และครั้งตามที่ทำจริง แล้วกดบันทึก','muted'));
 }catch(e){if(root.dataset.day===day&&root.dataset.request===request){root.replaceChildren(...heading(),el('p','โหลดแผนไม่สำเร็จ: '+e.message,'muted'));const retry=el('button','โหลดแผนอีกครั้ง','quiet');retry.type='button';retry.onclick=()=>showDailyPlans(root,day,{records,onStart});root.append(retry);}}
}
