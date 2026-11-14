import {planComparison} from './coach-ui.mjs?v=3';
import {searchExercises,bindExercisePicker} from './exercise-picker.mjs?v=12';
import {api} from './account.js?v=2';
import {localDay} from './store.mjs';
import {attachWeightUnit,formatLoggedWeight} from './weight-units.mjs';
import {createAnatomyPicker} from './anatomy-picker.mjs?v=3';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const input=(label,type,value)=>{const box=el('label',label),i=el('input');i.type=type;i.value=value??'';box.append(i);return {box,i};};
const cardioText=r=>[r.duration+' นาที',r.incline!=null?'ความชัน '+r.incline+'%':'',r.speed!=null?'ความเร็ว '+r.speed+' กม./ชม.':'',r.distance!=null?r.distance+' กม.':''].filter(Boolean).join(' · ');
const prescription=r=>r.trainingType==='cardio'?cardioText(r):r.sets+' เซ็ต · '+r.reps+' ครั้ง'+(r.weight==null?'':' · '+formatLoggedWeight(r))+(r.rest_seconds==null?'':' · พัก '+r.rest_seconds+' วินาที');
function appendPlanExercise(card,r){
 const item=el('div',undefined,'plan-saved-exercise');
 if(r.superset)item.append(el('span','Super set '+r.superset,'plan-superset-badge'));
 item.append(el('strong',r.exercise),el('span',prescription(r),'muted'));card.append(item);
}
let pickerNumber=0;
function planExercisePicker(onChoose,savedExercises){
 const box=el('div',undefined,'plan-name plan-inline-picker exercise-picker'),label=el('label','ชื่อท่า');
 const search=el('input');search.type='search';search.placeholder='ค้นหาท่า หรือพิมพ์ชื่อเอง';search.autocomplete='off';search.maxLength=150;
 const panel=el('div',undefined,'exercise-dropdown'),options=el('div',undefined,'exercise-options');
 options.id='plan-exercise-options-'+(++pickerNumber);options.setAttribute('role','listbox');
 search.setAttribute('role','combobox');search.setAttribute('aria-autocomplete','list');
 search.setAttribute('aria-controls',options.id);search.setAttribute('aria-expanded','false');
 const empty=el('p','ไม่พบท่า ใช้ชื่อที่พิมพ์ได้เลย','exercise-more');
 const custom=el('button',undefined,'quiet plan-custom-exercise');custom.type='button';custom.hidden=true;
 const toggle=el('button','⌄','quiet');toggle.type='button';
 toggle.setAttribute('aria-label','เปิดรายการท่าออกกำลังกาย');
 toggle.setAttribute('aria-controls',options.id);toggle.setAttribute('aria-expanded','false');
 label.append(search);panel.append(custom,options,empty);panel.hidden=true;box.append(label,toggle,panel);
 const normalize=name=>name.normalize('NFKC').trim().toLocaleLowerCase();
 function find(value){
  const query=normalize(value);
  const byName=new Map(searchExercises(value).map(exercise=>[normalize(exercise.name),exercise]));
  for(const exercise of savedExercises.values()){
   const key=normalize(exercise.name);
   if(key.includes(query)&&!byName.has(key))byName.set(key,exercise);
  }
  return [...byName.values()].sort((a,b)=>Number(normalize(b.name)===query)-Number(normalize(a.name)===query));
 }
 const {choose}=bindExercisePicker({input:search,toggle,wrapper:box,dropdown:panel,list:options,empty,find,onChoose,custom});
 search.addEventListener('change',()=>{
  const exact=find(search.value).find(exercise=>normalize(exercise.name)===normalize(search.value));
  if(exact)onChoose?.(exact);
 });
 return {box,i:search,choose,focus:()=>search.focus()};
}
function stylePlanDate(date){
 const frame=el('div',undefined,'plan-date-control'),display=el('span'),icon=el('span','▾');
 icon.setAttribute('aria-hidden','true');display.setAttribute('aria-hidden','true');
 const update=()=>{display.textContent=date.i.value?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(date.i.value+'T12:00:00')):'เลือกวันที่';};
 date.i.addEventListener('change',update);date.i.addEventListener('input',update);
 frame.append(display,icon,date.i);date.box.append(frame);update();
}
export async function trainerPlanner(root,team,member,{day=localDay(),onSaved,draftKey}={}){
 const section=el('section',undefined,'diary training-planner');
 const header=el('div',undefined,'plan-header');
 header.append(el('h2',!team?'โปรแกรมฝึกส่วนตัว':member?'จัดแผนฝึก · '+member.display_name:'จัดแผนฝึกทั้งทีม'));
 if(team)header.append(el('p',member?'เลือกท่าและกำหนดเป้าหมายให้สมาชิก':team.name+' · โปรแกรมจะส่งให้สมาชิกที่เข้าร่วมทีมแล้ว','muted'));
 const message=el('p',undefined,'plan-message');message.setAttribute('role','status');
 const savedExercises=new Map();
 section.append(header);root.append(section);
 const form=el('form'),date=input('วันเริ่มโปรแกรม','date',day),end=input('วันสิ้นสุด','date',day);
 for(const field of [date,end]){stylePlanDate(field);field.i.required=true;}
 end.i.min=day;
 date.i.addEventListener('change',()=>{
  end.i.min=date.i.value;
  if(end.i.value<date.i.value){end.i.value=date.i.value;end.i.dispatchEvent(new Event('input'));}
 });
 const dates=el('div',undefined,'plan-dates');dates.append(date.box,end.box);
 const calendar=el('section',undefined,'program-calendar');
 calendar.append(el('h3','ช่วงโปรแกรม'),dates,el('h3','ตารางฝึกรายสัปดาห์'));
 form.append(calendar);
 let persistDraft=()=>{};
 function exerciseEditor(host){
  const rows=el('div',undefined,'plan-exercises'),entries=[];
  const heading=el('div',undefined,'plan-list-heading'),count=el('span',undefined,'muted');heading.append(el('h3','ท่าฝึก'),count);host.append(heading);
  const membersOf=group=>entries.filter(entry=>entry.type.i.value!=='cardio'&&entry.superset.i.value===group);
  const groupOf=entry=>entry.type.i.value==='cardio'?'':entry.superset.i.value;
  function blocks(){
   const seen=new Set();
   return entries.flatMap(entry=>{
    const group=groupOf(entry);
    if(!group)return [[entry]];
    if(seen.has(group))return [];
    seen.add(group);return [membersOf(group)];
   });
  }
  function move(entry,direction,within,control){
   const order=blocks(),block=order.find(group=>group.includes(entry));
   const list=within?block:order,item=within?entry:block,index=list.indexOf(item),next=index+direction;
   if(next<0||next>=list.length)return;
   const rests=within?block.map(member=>member.rest.i.value):null;
   [list[index],list[next]]=[list[next],list[index]];
   if(rests)block.forEach((member,index)=>{member.rest.i.value=rests[index];});
   entries.splice(0,entries.length,...order.flat());
   rows.replaceChildren(...entries.map(member=>member.row));
   refresh();(control.disabled?entry.name.i:control).focus();
   message.textContent='ย้าย '+(entry.name.i.value||'ท่าฝึก')+(within?' ภายในชุด':'')+' แล้ว';
  }
  function refresh(){
   const order=blocks();
   count.textContent=entries.length+' / 30 ท่า';
   entries.forEach((entry,index)=>{
    const cardio=entry.type.i.value==='cardio',group=cardio?'':entry.superset.i.value;
    const members=group?membersOf(group):[];
    entry.options.hidden=!group;
    entry.number.textContent=group?'Super set '+group+' · ท่าที่ '+(members.indexOf(entry)+1):'ท่าที่ '+(index+1);
    entry.pair.hidden=cardio||Boolean(group&&members.at(-1)!==entry);
    entry.pair.disabled=entries.length>=30;
    const blockIndex=order.findIndex(block=>block.includes(entry)),memberIndex=members.indexOf(entry);
    entry.order.hidden=Boolean(group&&memberIndex!==0);
    entry.up.disabled=blockIndex===0;entry.down.disabled=blockIndex===order.length-1;
    entry.up.textContent=group?'↑ เลื่อนชุด':'↑ เลื่อนขึ้น';
    entry.down.textContent=group?'↓ เลื่อนชุด':'↓ เลื่อนลง';
    entry.inner.hidden=members.length<2;
    entry.innerUp.disabled=memberIndex<=0;entry.innerDown.disabled=memberIndex>=members.length-1;
   });
   more.disabled=entries.length>=30;
   persistDraft();
  }
  function add(after=null){
   const row=el('fieldset',undefined,'plan-exercise'),number=el('legend'),remove=el('button','นำท่านี้ออก','quiet plan-remove');
   remove.type='button';
   const type={box:el('label','ประเภท'),i:el('select')};type.box.append(type.i);
   for(const [v,t] of [['strength','เวทเทรนนิ่ง (เซ็ต/ครั้ง)'],['cardio','คาร์ดิโอ (เวลา/ความชัน)']]){const o=el('option',t);o.value=v;type.i.append(o);}
   const name=planExercisePicker(exercise=>{if(exercise.group!==undefined)type.i.value=exercise.group==='คาร์ดิโอ'?'cardio':'strength';applyType();refresh();},savedExercises);
   const weight=input('น้ำหนักที่ยก','number',''),sets=input('เซ็ต','number',3),reps=input('ครั้ง / เซ็ต','number',12);
   weight.i.min=0;weight.i.max=2000;weight.i.step='.01';weight.i.placeholder='ไม่ระบุ';
   for(const f of [sets,reps]){f.i.required=true;f.i.min=1;f.i.step=1;}sets.i.max=100;reps.i.max=1000;
   const metrics=el('div',undefined,'plan-metrics');metrics.append(weight.box,sets.box,reps.box);
   const weightUnit=attachWeightUnit(weight.i,metrics);
   const rest=input('พัก (วินาที)','number',60);rest.i.min=0;rest.i.max=3600;rest.i.step=1;rest.i.required=true;
   const superset={box:el('label','Super set'),i:el('select')};superset.box.append(superset.i);
   const solo=el('option','ท่าเดี่ยว');solo.value='';superset.i.append(solo);
   for(const group of 'ABCDEFGHIJKLMNO'){const option=el('option','กลุ่ม '+group);option.value=group;superset.i.append(option);}
   const advanced=el('div',undefined,'plan-advanced');advanced.append(rest.box);
   const duration=input('เวลา (นาที)','number',30),incline=input('ความชัน (%)','number',''),speed=input('ความเร็ว (กม./ชม.)','number',''),distance=input('ระยะทาง (กม.)','number','');
   duration.i.min=1;duration.i.max=600;duration.i.step=1;duration.i.required=true;incline.i.min=0;incline.i.max=100;incline.i.step='.5';incline.i.placeholder='เช่น 12';
   speed.i.min=0;speed.i.max=50;speed.i.step='.1';speed.i.placeholder='เช่น 5';distance.i.min=0;distance.i.max=1000;distance.i.step='.01';distance.i.placeholder='ไม่ระบุ';
   for(const f of [duration,incline,speed,distance])f.i.inputMode='decimal';
   const cardio=el('div',undefined,'plan-metrics plan-cardio');cardio.append(duration.box,incline.box,speed.box,distance.box);
   function applyType(){const c=type.i.value==='cardio';metrics.hidden=advanced.hidden=c;cardio.hidden=!c;for(const f of [weight,sets,reps,rest])f.i.disabled=c;superset.i.disabled=weightUnit.select.disabled=c;for(const f of [duration,incline,speed,distance])f.i.disabled=!c;}
   const pair=el('button','+ เพิ่มท่าใน Super set','quiet plan-pair');pair.type='button';
   const entry={row,name,weightUnit,sets,reps,number,rest,superset,type,duration,incline,speed,distance,pair};
   function orderControls(within){
    const bar=el('div',undefined,'plan-order');
    const controls=[-1,1].map(direction=>{
     const control=el('button',direction<0?'↑ ขึ้นในชุด':'↓ ลงในชุด','quiet');
     control.type='button';control.onclick=()=>move(entry,direction,within,control);
     bar.append(control);return control;
    });
    return [bar,...controls];
   }
   [entry.order,entry.up,entry.down]=orderControls(false);
   [entry.inner,entry.innerUp,entry.innerDown]=orderControls(true);
   if(after)entries.splice(entries.indexOf(after)+1,0,entry);else entries.push(entry);
   pair.onclick=()=>{
    if(pair.disabled||pair.hidden)return;
    const group=superset.i.value||[...'ABCDEFGHIJKLMNO'].find(key=>!membersOf(key).length);
    if(!group){message.textContent='ใช้กลุ่ม Super set ครบแล้ว';return;}
    const next=add(entry);
    superset.i.value=next.superset.i.value=group;
    next.sets.i.value=sets.i.value;
    next.rest.i.value=rest.i.value;
    rest.i.value=0;
    refresh();next.name.focus();
   };
   superset.i.addEventListener('change',refresh);type.i.addEventListener('change',()=>{applyType();refresh();});
   remove.onclick=()=>{
    const group=superset.i.value,members=group?membersOf(group):[];
    const wasLast=members.at(-1)===entry;
    entries.splice(entries.indexOf(entry),1);row.remove();
    const remaining=group?membersOf(group):[];
    if(wasLast&&remaining.length)remaining.at(-1).rest.i.value=rest.i.value;
    if(remaining.length===1)remaining[0].superset.i.value='';
    refresh();
   };
   const options=el('details',undefined,'plan-exercise-options');
   entry.options=options;
   options.append(el('summary','ย้ายกลุ่มหรือแยกท่า'),superset.box);
   row.append(number,name.box,entry.order,entry.inner,type.box,metrics,advanced,cardio,pair,options,remove);applyType();if(after)after.row.after(row);else rows.append(row);refresh();return entry;
  }
  const more=el('button','+ เพิ่มท่าฝึก','quiet plan-add');more.type='button';more.onclick=()=>{if(entries.length<30){add();entries.at(-1).name.focus();}};
  const actions=el('div',undefined,'plan-day-actions');actions.append(more);
  host.append(rows,actions);
  add();
  const anatomy=el('details',undefined,'plan-anatomy');anatomy.append(el('summary','เลือกท่าจากแผนผังกล้ามเนื้อ'));
  anatomy.append(createAnatomyPicker({onChoose:exercise=>{
   const empty=entries.find(x=>!x.name.i.value.trim());
   if(!empty&&entries.length>=30){message.textContent='เพิ่มได้สูงสุด 30 ท่าต่อวัน';return false;}
   const entry=empty||add();entry.name.choose(exercise);
  }}));actions.append(anatomy);
  function fill(exercises){
   entries.splice(0);rows.replaceChildren();
   for(const exercise of exercises){
    const entry=add();
    entry.name.choose({name:exercise.exercise,group:exercise.trainingType==='cardio'?'คาร์ดิโอ':''});
    entry.weightUnit.set(exercise.weight,exercise.weightUnit);
    for(const key of ['sets','reps','duration','incline','speed','distance','superset']){
     if(exercise[key]!=null)entry[key].i.value=exercise[key];
    }
    if(exercise.rest_seconds!=null)entry.rest.i.value=exercise.rest_seconds;
   }
   refresh();
  }
  return {entries,more,fill};
 }
 const schedule=[];
 const week=el('div',undefined,'program-week');week.setAttribute('aria-label','เลือกวันเพื่อแก้แผน');calendar.append(week);
 const panels=el('div',undefined,'program-panels');form.append(panels);
 function selectDay(item){
  for(const day of schedule){
   const selected=day===item;day.card.hidden=!selected;
   day.button.setAttribute('aria-pressed',String(selected));
  }
 }
 for(const [weekday,title,short] of [[1,'จันทร์','จ.'],[2,'อังคาร','อ.'],[3,'พุธ','พ.'],[4,'พฤหัสบดี','พฤ.'],[5,'ศุกร์','ศ.'],[6,'เสาร์','ส.'],[0,'อาทิตย์','อา.']]){
  const card=el('section',undefined,'program-day'),label=el('label','เปิดแผนฝึกวัน'+title),check=el('input');
  const button=el('button',short,'quiet');button.type='button';button.setAttribute('aria-label','วัน'+title);
  button.setAttribute('aria-controls','program-day-'+weekday);card.id='program-day-'+weekday;
  button.setAttribute('aria-pressed','false');card.hidden=true;
  check.type='checkbox';label.prepend(check);
  const fields=el('fieldset',undefined,'program-day-fields');fields.hidden=fields.disabled=true;
  const item={weekday,title,check,fields,card,button,editor:null};schedule.push(item);
  button.onclick=()=>selectDay(item);
  check.onchange=()=>{
   fields.hidden=fields.disabled=!check.checked;
   button.classList.toggle('has-plan',check.checked);
   button.setAttribute('aria-label','วัน'+title+(check.checked?' · วันฝึก':' · วันพัก'));
   if(check.checked&&!item.editor)item.editor=exerciseEditor(fields);
  };
  card.append(label,fields);week.append(button);panels.append(card);
 }
 const initial=schedule.find(item=>item.weekday===new Date(day+'T12:00:00').getDay());
 initial.check.checked=true;initial.check.onchange();selectDay(initial);
 form.addEventListener('invalid',event=>{
  const item=schedule.find(day=>day.fields.contains(event.target));
  if(item&&!editing)selectDay(item);
 },true);
 const save=el('button','บันทึกโปรแกรม','primary');save.type='submit';
 const footer=el('div',undefined,'program-footer');footer.append(message,save);form.append(footer);section.append(form);
 const list=el('div',undefined,'plan-saved');section.append(list);
 const cancel=el('button','ยกเลิกการแก้ไข','quiet');cancel.type='button';cancel.hidden=true;footer.append(cancel);
 let editing=null,editItem=null;
 function finishEdit(){
  editing=null;editItem=null;calendar.hidden=false;list.hidden=false;cancel.hidden=true;
  date.i.disabled=end.i.disabled=false;
  for(const item of schedule)item.fields.disabled=!item.check.checked;
  selectDay(initial);save.textContent='บันทึกโปรแกรม';
 }
 function editPlan(plan){
  editing=plan;
  const weekday=new Date(plan.day+'T12:00:00').getDay();
  const original=schedule.find(item=>item.weekday===weekday);
  const fields=el('fieldset',undefined,'program-day-fields');
  const card=el('section',undefined,'program-day');
  card.append(el('h3','แก้แผนวัน'+original.title+' · '+plan.day),fields);
  editItem={card,fields,title:original.title,editor:exerciseEditor(fields)};
  editItem.editor.fill(plan.exercises);
  panels.append(card);
  date.i.disabled=end.i.disabled=true;
  for(const item of schedule){item.card.hidden=true;item.fields.disabled=true;}
  calendar.hidden=true;list.hidden=true;cancel.hidden=false;
  message.textContent='';save.textContent='บันทึกการแก้ไข';
  card.scrollIntoView({block:'start'});
 }
 const closeEdit=()=>{editItem?.card.remove();finishEdit();};
 cancel.onclick=()=>{closeEdit();message.textContent='';};
 const path=team?'/api/teams/'+team.id+'/plans'+(member?'/'+encodeURIComponent(member.id):''):'/api/personal-plans';
 function exerciseValues(x){
  return x.type.i.value==='cardio'?
   {trainingType:'cardio',exercise:x.name.i.value.trim(),duration:Number(x.duration.i.value),...Object.fromEntries(['incline','speed','distance'].filter(k=>x[k].i.value!=='').map(k=>[k,Number(x[k].i.value)]))}:
   {exercise:x.name.i.value.trim(),...x.weightUnit.read(),sets:Number(x.sets.i.value),reps:Number(x.reps.i.value),rest_seconds:Number(x.rest.i.value),superset:x.superset.i.value||null};
 }
 if(draftKey){
  try{
   const draft=JSON.parse(localStorage.getItem(draftKey));
   if(draft){
    date.i.value=draft.start;end.i.value=draft.end;end.i.min=draft.start;
    for(const field of [date,end])field.i.dispatchEvent(new Event('input'));
    for(const item of schedule){
     const saved=draft.schedule.find(entry=>entry.weekday===item.weekday);
     item.check.checked=Boolean(saved?.enabled);item.check.onchange();
     if(saved){
      item.editor??=exerciseEditor(item.fields);
      item.editor.fill(saved.exercises);
     }
    }
    selectDay(schedule.find(item=>item.check.checked)??initial);
    message.textContent='เปิดแบบร่างที่เก็บไว้ในเครื่องแล้ว';
   }
  }catch{}
  persistDraft=()=>{
   if(editing)return;
   try{
    localStorage.setItem(draftKey,JSON.stringify({start:date.i.value,end:end.i.value,schedule:schedule
     .filter(item=>item.editor).map(item=>({weekday:item.weekday,enabled:item.check.checked,exercises:item.editor.entries.map(exerciseValues)}))}));
   }catch{}
  };
  form.addEventListener('input',persistDraft);
  form.addEventListener('change',persistDraft);
 }
 async function load(){
  const {plans}=await api(path);list.replaceChildren(el('h3','แผนที่บันทึกไว้'));
  savedExercises.clear();
  for(const {exercises} of plans){
   for(const exercise of exercises)savedExercises.set(exercise.exercise,{
    name:exercise.exercise,group:exercise.trainingType==='cardio'?'คาร์ดิโอ':'',
   });
  }
  if(!plans.length)list.append(el('p','ยังไม่มีแผน เริ่มจัดท่าฝึกด้านบนได้เลย','muted'));
  for(const p of plans){
   const card=el('div',undefined,'entry'),day=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(p.day+'T12:00:00'));card.append(el('h3',day));
   for(const r of p.exercises)appendPlanExercise(card,r);
   const edit=el('button','แก้ไขท่า','quiet');edit.type='button';edit.onclick=()=>editPlan(p);card.append(edit);
   if(team&&!member){list.append(card);continue;}
   const b=el('button','ลบแผนวันนี้','quiet');b.type='button';b.onclick=async()=>{if(!confirm('ลบแผนวันที่ '+day+'?'))return;try{await api(path+'?id='+p.id,{method:'DELETE'});onSaved?.();await load();}catch(e){message.textContent=e.message;}};card.append(b);list.append(card);
  }
 }
 form.onsubmit=async e=>{
  e.preventDefault();
  if(save.disabled)return;
  const active=editing?[editItem]:schedule.filter(item=>item.check.checked);
  if(!active.length){message.textContent='เลือกวันฝึกอย่างน้อย 1 วัน';return;}
  for(const item of active){
   const {title,editor:{entries,more}}=item;
   if(!entries.length){if(!editing)selectDay(item);message.textContent='เพิ่มท่าฝึกวัน'+title+' อย่างน้อย 1 ท่า';more.focus();return;}
   const missing=entries.find(x=>!x.name.i.value.trim());
   if(missing){if(!editing)selectDay(item);message.textContent='เลือกท่าฝึกวัน'+title;missing.name.focus();return;}
  }
  const payload={start:date.i.value,end:end.i.value,period:'program',schedule:active.map(({weekday,editor:{entries}})=>({weekday,
   exercises:entries.map(exerciseValues)}))};
  persistDraft();
  save.disabled=cancel.disabled=true;save.textContent='กำลังบันทึก…';
  try{
   const result=editing
    ?await api(path+'?id='+encodeURIComponent(editing.id),{method:'PATCH',body:JSON.stringify({day:editing.day,exercises:payload.schedule[0].exercises})})
    :await api(path,{method:'POST',body:JSON.stringify(payload)});
   if(draftKey&&!editing){try{localStorage.removeItem(draftKey);}catch{}}
   onSaved?.(editing?undefined:result.firstDay);
   if(editing){
    closeEdit();message.textContent='บันทึกการแก้ไขแล้ว';
    try{await load();}catch{message.textContent+=' · โหลดรายการล่าสุดไม่สำเร็จ';}
    return;
   }
   message.textContent='บันทึกโปรแกรมแล้ว '+result.count+' วัน'+(team&&!member?' · สมาชิก '+result.members+' คน':'');
   try{await load();}catch{message.textContent+=' · โหลดรายการแผนล่าสุดไม่สำเร็จ';}
  }catch(e){message.textContent=e.message;}
  finally{save.disabled=cancel.disabled=false;save.textContent=editing?'บันทึกการแก้ไข':'บันทึกโปรแกรม';}
 };
 await load();
 section.scrollIntoView({behavior:'smooth',block:'start'});
}
const weekLabels=['MON','TUE','WED','THU','FRI','SAT','SUN'];
const shortDate=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'});
const fullDate=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'});
function shiftDate(day,offset){
 const date=new Date(day+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+offset);
 return date.toISOString().slice(0,10);
}
function trainingWeek(root,days,day,plans,onSelectDay){
 const week=el('section',undefined,'training-week');
 const header=el('div',undefined,'training-week-header');
 const arrow=(label,offset)=>{
  const button=el('button',offset<0?'‹':'›','quiet');
  button.type='button';button.setAttribute('aria-label',label);
  button.onclick=()=>onSelectDay?.(shiftDate(day,offset));
  return button;
 };
 const range=shortDate.formatRange(new Date(days[0]+'T12:00:00'),new Date(days[6]+'T12:00:00'));
 header.append(arrow('สัปดาห์ก่อนหน้า',-7),el('h2',range),arrow('สัปดาห์ถัดไป',7));
 const strip=el('div',undefined,'training-week-strip');
 strip.setAttribute('role','group');strip.setAttribute('aria-label','เลือกวันฝึก');
 const agenda=el('div',undefined,'training-week-agenda');
 const today=localDay();
 days.forEach((date,index)=>{
  const entries=plans.filter(plan=>plan.day===date);
  const number=String(Number(date.slice(-2)));
  const button=el('button',undefined,'training-week-day');
  button.type='button';button.setAttribute('aria-pressed',String(date===day));
  if(date===today)button.setAttribute('aria-current','date');
  button.setAttribute('aria-label',fullDate.format(new Date(date+'T12:00:00'))+(entries.length?', '+entries.length+' แผน':''));
  button.append(el('span',weekLabels[index]),el('strong',number));
  button.classList.toggle('has-plan',entries.length>0);
  button.onclick=()=>onSelectDay?.(date);
  strip.append(button);
  if(!entries.length)return;
  const item=el('div',undefined,'training-week-row');
  const stamp=el('div',undefined,'training-week-stamp');
  stamp.append(el('span',weekLabels[index]),el('strong',number));
  const cards=el('div',undefined,'training-week-cards');
  for(const plan of entries){
   const card=el('button',undefined,'training-week-card');
   card.type='button';
   card.append(el('strong',plan.team_name),el('small',plan.exercises.length+' ท่า'),el('span','›','training-week-chevron'));
   card.onclick=()=>{
    if(date===day){
     const detail=root.querySelector('.training-week-detail');
     const select=detail?.querySelector('select');
     if(select)select.value=plan.id;
     detail?.scrollIntoView({block:'nearest'});
     return;
    }
    root.dataset.scrollToDay=date;
    root.dataset.openPlan=plan.id;
    onSelectDay?.(date);
   };
   cards.append(card);
  }
  item.append(stamp,cards);agenda.append(item);
 });
 week.append(header,strip,agenda);
 return week;
}
export async function showDailyPlans(root,day,{records=[],onStart,onSelectDay}={}){
 const request=String(Number(root.dataset.request||0)+1);root.dataset.request=request;
 if(root.dataset.scrollToDay&&root.dataset.scrollToDay!==day){
  delete root.dataset.scrollToDay;delete root.dataset.openPlan;
 }
 const monday=shiftDate(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
 const days=weekLabels.map((_,index)=>shiftDate(monday,index));
 const renderWeek=plans=>trainingWeek(root,days,day,plans,onSelectDay);
 if(root.dataset.day!==day||!root.firstChild){
  const loading=el('p','กำลังโหลดโปรแกรมฝึก…','muted');
  loading.setAttribute('role','status');
  root.replaceChildren(renderWeek([]),loading);
 }
 root.dataset.day=day;
 try{
  const {plans:weekPlans}=await api('/api/plans?range=week&day='+monday);if(root.dataset.day!==day||root.dataset.request!==request)return;
  const plans=weekPlans.filter(plan=>plan.day===day);
  const detail=el('section',undefined,'training-week-detail');
  const browse=el('details',undefined,'training-plan-details');
  const dates=el('div');browse.append(el('summary','ดูวันที่มีแผนฝึก'),dates);
  browse.ontoggle=async()=>{
   if(!browse.open||dates.dataset.loaded)return;
   dates.dataset.loaded='loading';dates.textContent='กำลังโหลดวันที่มีแผน…';
   try{
    const result=await api('/api/plans/dates?day='+day);
    dates.replaceChildren();
    if(!result.dates.length)dates.append(el('p','ยังไม่พบโปรแกรมที่บันทึกไว้','muted'));
    for(const item of result.dates){
     const label=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(new Date(item.day+'T12:00:00'));
     const jump=el('button',label+' · '+item.name,'quiet');jump.type='button';
     jump.disabled=item.day===day;jump.onclick=()=>onSelectDay?.(item.day);
     dates.append(jump);
    }
    dates.dataset.loaded='true';
   }catch{delete dates.dataset.loaded;dates.textContent='โหลดวันที่ไม่สำเร็จ ปิดแล้วเปิดใหม่เพื่อลองอีกครั้ง';}
  };
  window.dispatchEvent(new CustomEvent('training-plans',{detail:{plans,day}}));
  if(!plans.length){
   detail.append(el('p',weekPlans.length?'วันที่เลือกไม่มีแผนฝึก':'สัปดาห์นี้ยังไม่มีแผนฝึก','muted'),browse);
   root.replaceChildren(renderWeek(weekPlans),detail);
   return;
  }
  const start=el('button','เริ่มฝึก / ฝึกต่อ','primary');start.type='button';
  let picker;
  if(plans.length>1){
   picker=el('label','เลือกแผนที่จะฝึก');
   const select=el('select');picker.append(select);
   plans.forEach((plan,index)=>{
    const option=el('option',plan.team_name+' · '+plan.exercises.length+' ท่า');
    option.value=plan.id;option.textContent+=' ('+(index+1)+')';select.append(option);
   });
   if(root.dataset.scrollToDay===day&&plans.some(plan=>plan.id===root.dataset.openPlan))select.value=root.dataset.openPlan;
   start.onclick=()=>window.dispatchEvent(new CustomEvent('training-start',{detail:{planId:select.value}}));
  }else start.onclick=()=>window.dispatchEvent(new CustomEvent('training-start'));
  const details=el('details',undefined,'training-plan-details');details.open=root.querySelector('.training-plan-details')?.open??true;
  details.append(el('summary','ดูท่าในแผน'),planComparison(plans,records,{onStart}));
  detail.append(el('h2',fullDate.format(new Date(day+'T12:00:00'))),...(picker?[picker]:[]),start,details,browse);
  root.replaceChildren(renderWeek(weekPlans),detail);
  if(root.dataset.scrollToDay===day){
   delete root.dataset.scrollToDay;delete root.dataset.openPlan;
   detail.scrollIntoView({block:'nearest'});
  }
 }catch{if(root.dataset.day===day&&root.dataset.request===request){
  const retry=el('button','ลองโหลดอีกครั้ง','quiet');retry.type='button';retry.onclick=()=>showDailyPlans(root,day,{records,onStart,onSelectDay});
  root.replaceChildren(renderWeek([]),el('p','โหลดโปรแกรมฝึกไม่สำเร็จ','muted'),retry);
  window.dispatchEvent(new CustomEvent('training-plans',{detail:{plans:[],day}}));
 }}
}
