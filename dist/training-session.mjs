import {comparePlan,workoutDescription} from './progress.mjs?v=2';
import {previousExercise,remainingSeconds} from './diary-tools.mjs?v=1';
import {switchView} from './dashboard.mjs?v=9';
import {api} from './account.js?v=4';
import {createMuscleFocus} from './exercise-preview.mjs?v=9';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function initTrainingSession({getRecords,saveRecords}){
 const card=el('section',undefined,'diary training-entry');document.getElementById('dashboard-panel').prepend(card);
 const session=el('section',undefined,'diary guided-training');session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');document.getElementById('workout-panel').prepend(session);
 const focus=createMuscleFocus();
 let plans=[],day='',items=[],current=0,active=false,busy=false,deadline=null,ticker=null,summary=false;
 const selected=()=>document.getElementById('day').value;
 const rows=()=>plans.flatMap(plan=>comparePlan(plan,getRecords()).map(r=>({...r,plan})));
 const draft=item=>getRecords().find(r=>r.day===day&&r.planId===item.plan.id&&r.planExerciseIndex===item.index);
 const done=item=>!!comparePlan(item.plan,getRecords())[item.index]?.actual;
 function button(text,fn,cls='quiet'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
 function stop(){clearInterval(ticker);ticker=null;deadline=null;}
 function overview(){
  card.replaceChildren(el('p','YOUR TRAINING','eyebrow'),el('h2',day===selected()?'แผนฝึกของวันที่เลือก':'แผนฝึก'));
  if(!day){card.append(el('p','กำลังโหลดแผน…','muted'));return;}
  const all=rows(),complete=all.filter(done).length;
  card.append(el('p',new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00')),'muted'),el('strong',all.length?'บันทึกแล้ว '+complete+' จาก '+all.length+' ท่า':'ยังไม่มีแผนจากเทรนเนอร์','training-progress'));
  card.append(button(all.length?(complete===all.length?'ดูสรุปการฝึก':'เริ่ม / ฝึกต่อจากแผน'):'ดูหน้าฝึก',()=>all.length?start():switchView('workout'),'primary'));
 }
 function start(){if(!plans.length)return;items=rows();current=Math.max(0,items.findIndex(x=>!done(x)));summary=items.every(done);active=true;session.hidden=false;document.getElementById('workout-panel').classList.add('training-mode');switchView('workout');render();session.scrollIntoView({behavior:'smooth',block:'start'});}
 function leave(){if(busy)return;stop();active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');}
 function navigation(finished,last){
  const next=()=>{if(busy)return;stop();if(last)summary=true;else current++;render();};
  const nav=el('div',undefined,'training-actions');
  nav.append(current>0?button('← ท่าก่อนหน้า',()=>{if(busy)return;stop();current--;render();}):el('span'));
  if(!last)nav.append(button(finished?'ท่าถัดไป →':'ข้ามท่านี้ →',next));
  session.append(nav,button('จบการฝึกวันนี้ · ดูสรุป',()=>{if(busy)return;stop();summary=true;render();},'ts-finish'));
  return next;
 }
 // Cardio: one result (time, incline, speed, distance), prefilled with the trainer's target.
 function cardioStep(item,saved,last){
  const target=item.target,finished=!!saved;
  const form=el('form',undefined,'ts-log'),fields={};
  const field=(key,label,min,max,step,required)=>{const box=el('label',label),i=el('input');i.type='number';i.min=min;i.max=max;i.step=step;i.inputMode='decimal';i.required=required;i.placeholder='ไม่ระบุ';i.value=saved?.[key]??target[key]??'';box.append(i);fields[key]=i;return box;};
  const metrics=el('div',undefined,'training-live-metrics');
  metrics.append(field('duration','เวลาที่ทำจริง (นาที)',1,1440,'any',true),field('incline','ความชัน (%)',0,100,'any',false),field('speed','ความเร็ว (กม./ชม.)',0,50,'any',false),field('distance','ระยะทาง (กม.)',0,1000,'any',false));
  const notice=el('p',undefined,'muted');notice.setAttribute('role','status');
  const save=el('button',finished?'บันทึกการแก้ไข':'✓ ทำเสร็จแล้ว · บันทึกผล',finished?'quiet':'primary');save.type='submit';save.disabled=busy;
  let next;
  if(finished){const doneBox=el('div',undefined,'ts-done');doneBox.append(el('strong','บันทึกแล้ว: '+workoutDescription(saved)),button(last?'ดูสรุปการฝึก →':'ไปท่าถัดไป →',()=>next(),'primary'));session.append(doneBox);}
  form.append(el('p',finished?'แก้ผลได้ถ้ากรอกผิด':'ทำตามเป้าแล้วกรอกค่าที่ทำได้จริง (ดูจากหน้าจอลู่วิ่ง/เครื่อง)','ts-label'),metrics,save);
  session.append(form,notice);
  const previous=previousExercise(getRecords(),target.exercise,'cardio',day);
  session.append(el('p',previous?'ครั้งก่อน ('+previous.day+'): '+workoutDescription(previous):'ยังไม่มีผลครั้งก่อนของท่านี้','ts-prev'));
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||selected()!==day)return;busy=true;save.disabled=true;notice.textContent='กำลังบันทึก…';
   const value=k=>fields[k].value===''?null:Number(fields[k].value),latest=draft(item);
   const row={id:latest?.id||crypto.randomUUID(),kind:'workout',day,trainingType:'cardio',exercise:target.exercise,planId:item.plan.id,planExerciseIndex:item.index,duration:value('duration'),incline:value('incline'),speed:value('speed'),distance:value('distance'),weight:null,sets:null,reps:null,notes:latest?.notes||''};
   try{const ok=await saveRecords([...getRecords().filter(r=>r.id!==row.id),row]);if(!ok){notice.textContent='บันทึกไม่สำเร็จ ลองกดอีกครั้ง';return;}render();overview();}
   catch(error){notice.textContent=error.message;}finally{busy=false;save.disabled=false;}
  };
  focus.show(target.exercise);session.append(focus.el);
  next=navigation(finished,last);
 }
 function render(){
  if(!active)return;
  session.replaceChildren();
  const top=el('div',undefined,'ts-top');top.append(el('p','ฝึกตามแผน · '+new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(day+'T12:00:00')),'eyebrow'),button('✕ ออกจากโหมดฝึก',leave,'ts-exit'));session.append(top);
  if(summary){renderSummary();return;}
  const item=items[current],saved=draft(item),logs=saved?.setLogs||[],target=item.target,sets=Math.max(1,target.sets||1),finished=logs.length>=sets,last=current===items.length-1;
  // 1. Where am I: one bar per exercise in today's plan.
  const steps=el('ol',undefined,'ts-steps');
  items.forEach((x,i)=>{const li=el('li',undefined,i===current?'now':done(x)?'done':'');li.title=x.target.exercise;steps.append(li);});
  session.append(steps,el('p','ท่าที่ '+(current+1)+' จาก '+items.length+' · '+(item.plan.team_name||'แผนจากเทรนเนอร์'),'ts-sub'),el('h2',target.exercise,'ts-name'));
  // 2. What the trainer asked for.
  const goal=el('div',undefined,'ts-goal'),chip=(label,value)=>{const c=el('span',undefined,'ts-chip');c.append(el('small',label),el('b',value));return c;};
  if(target.trainingType==='cardio'){
   goal.append(chip('เวลา',target.duration+' นาที'));
   if(target.incline!=null)goal.append(chip('ความชัน',target.incline+'%'));
   if(target.speed!=null)goal.append(chip('ความเร็ว',target.speed+' กม./ชม.'));
   if(target.distance!=null)goal.append(chip('ระยะทาง',target.distance+' กม.'));
   session.append(el('p','เทรนเนอร์ให้ทำ','ts-label'),goal);cardioStep(item,saved,last);return;
  }
  else goal.append(chip('จำนวน',sets+' เซ็ต'),chip('เซ็ตละ',(target.reps??'-')+' ครั้ง'),chip('น้ำหนัก',target.weight==null?'ตามไหว':target.weight===0?'น้ำหนักตัว':target.weight+' กก.'),chip('พักระหว่างเซ็ต',(target.rest_seconds??60)+' วิ'));
  session.append(el('p','เทรนเนอร์ให้ทำ','ts-label'),goal);
  if(target.superset)session.append(el('p','Super set '+target.superset+' · ทำสลับกับท่าในกลุ่มเดียวกันตามลำดับ','muted'));
  // 3. Sets: done / now / later.
  const track=el('ol',undefined,'ts-sets');
  for(let i=0;i<Math.max(sets,logs.length+(finished?0:1));i++){const r=logs[i],li=el('li',undefined,r?'done':i===logs.length?'now':'');li.append(el('small','เซ็ต '+(i+1)),el('b',r?'✓ '+r.reps+' ครั้ง':i===logs.length?'ตอนนี้':'รอ'));li.append(el('small',r?(r.weight==null?'':r.weight+' กก.'):''));track.append(li);}
  session.append(track);
  const rest=el('div',undefined,'ts-rest'),clock=el('p',undefined,'training-clock');clock.setAttribute('role','status');rest.hidden=!deadline;
  rest.append(el('small','พักก่อนเซ็ตถัดไป'),clock,button('ข้ามเวลาพัก',()=>{stop();rest.hidden=true;}));session.append(rest);
  // 4. Log the set just done.
  const form=el('form',undefined,'ts-log'),weight=el('input'),reps=el('input'),weightLabel=el('label','น้ำหนักที่ยก (กก.)'),repsLabel=el('label','ทำได้กี่ครั้ง');
  weight.type=reps.type='number';weight.min=0;weight.max=2000;weight.step='.01';weight.placeholder='ไม่ระบุ';weight.value=logs.at(-1)?.weight??target.weight??'';weight.inputMode='decimal';
  reps.min=1;reps.max=1000;reps.step=1;reps.required=true;reps.value=logs.at(-1)?.reps??target.reps??12;reps.inputMode='numeric';weightLabel.append(weight);repsLabel.append(reps);
  const metrics=el('div',undefined,'training-live-metrics');metrics.append(weightLabel,repsLabel);
  const notice=el('p',undefined,'muted');notice.setAttribute('role','status');
  const save=el('button',finished?'+ บันทึกเซ็ตเพิ่ม':'✓ ทำเซ็ต '+(logs.length+1)+' เสร็จแล้ว',finished?'quiet':'primary');save.type='submit';save.disabled=busy;
  const next=()=>{if(busy)return;stop();if(last)summary=true;else current++;render();};
  if(finished){const doneBox=el('div',undefined,'ts-done');doneBox.append(el('strong','ครบ '+sets+' เซ็ตแล้ว เก่งมาก!'),button(last?'ดูสรุปการฝึก →':'ไปท่าถัดไป →',next,'primary'));session.append(doneBox);}
  form.append(el('p',finished?'ทำเกินเป้าได้ บันทึกเพิ่มได้เลย':'ทำเซ็ต '+(logs.length+1)+' แล้วกรอกผลจริง','ts-label'),metrics,save);
  session.append(form,notice);
  const previous=previousExercise(getRecords(),target.exercise,'strength',day);
  session.append(el('p',previous?'ครั้งก่อน ('+previous.day+'): '+workoutDescription(previous):'ยังไม่มีผลครั้งก่อนของท่านี้','ts-prev'));
  function tick(){const left=deadline?remainingSeconds(deadline):0;clock.textContent=left?String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0'):(deadline?'ครบเวลาพัก พร้อมเซ็ตต่อไป':'');if(deadline&&!left){stop();navigator.vibrate?.([150,100,150]);}}
  if(deadline){tick();clearInterval(ticker);ticker=setInterval(tick,250);}
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||selected()!==day)return;busy=true;save.disabled=true;notice.textContent='กำลังบันทึกเซ็ต…';
   const latest=draft(item),nextLogs=[...(latest?.setLogs||[]),{weight:weight.value===''?null:Number(weight.value),reps:Number(reps.value)}];
   if(nextLogs.length>100){busy=false;save.disabled=false;notice.textContent='บันทึกได้สูงสุด 100 เซ็ตต่อท่า';return;}
   const row={id:latest?.id||crypto.randomUUID(),kind:'workout',day,trainingType:'strength',exercise:target.exercise,planId:item.plan.id,planExerciseIndex:item.index,weight:nextLogs.at(-1).weight,sets:nextLogs.length,reps:nextLogs.at(-1).reps,notes:latest?.notes||'',setLogs:nextLogs,sessionComplete:nextLogs.length>=target.sets};
   try{const ok=await saveRecords([...getRecords().filter(r=>r.id!==row.id),row]);if(!ok){notice.textContent='บันทึกไม่สำเร็จ กรอกไว้แล้ว กดจบเซ็ตเพื่อลองใหม่';return;}stop();if((target.rest_seconds??60)>0)deadline=Date.now()+(target.rest_seconds??60)*1000;if(target.superset){const group=items.map((x,i)=>({x,i})).filter(({x})=>x.plan.id===item.plan.id&&x.target.superset===target.superset);const candidates=[...group.filter(x=>x.i>current),...group.filter(x=>x.i<=current)];const next=candidates.find(({x})=>!done(x));if(next)current=next.i;}render();overview();}catch(error){notice.textContent=error.message;}finally{busy=false;save.disabled=false;session.querySelector('button[type="submit"]')?.removeAttribute('disabled');}
  };
  focus.show(target.exercise);session.append(focus.el);
  // 5. Move between exercises.
  const nav=el('div',undefined,'training-actions');
  nav.append(current>0?button('← ท่าก่อนหน้า',()=>{if(busy)return;stop();current--;render();}):el('span'));
  if(!last)nav.append(button(finished?'ท่าถัดไป →':'ข้ามท่านี้ →',next));
  session.append(nav,button('จบการฝึกวันนี้ · ดูสรุป',()=>{if(busy)return;stop();summary=true;render();},'ts-finish'));
 }
 function renderSummary(){
  const all=rows(),completed=all.filter(done),remaining=all.filter(x=>!done(x));
  session.append(el('h2','สรุปการฝึก'),el('strong','บันทึกครบ '+completed.length+' / '+all.length+' ท่า','training-progress'));
  const list=el('ul');for(const item of all){const r=draft(item);list.append(el('li',(done(item)?'✓ ':'○ ')+item.target.exercise+(r?.setLogs?' · '+r.setLogs.length+'/'+item.target.sets+' เซ็ต':done(item)?' · บันทึกแล้ว':' · ยังไม่บันทึกครบ')));}session.append(list);
  if(remaining.length)session.append(el('p','ยังเหลือ '+remaining.length+' ท่า กลับไปฝึกต่อได้ หรือส่งผลที่ทำแล้วให้เทรนเนอร์','muted'),button('กลับไปฝึกต่อ',()=>{summary=false;current=all.findIndex(x=>!done(x));render();},'primary'));
  const message=el('p');message.setAttribute('role','status');
  session.append(button('ส่งผลให้เทรนเนอร์',async e=>{const b=e.currentTarget;b.disabled=true;try{await api('/api/reports',{method:'POST',body:JSON.stringify({day})});message.textContent='ส่งอาหารและผลการฝึกของวันที่เลือกให้ทีมแล้ว';window.dispatchEvent(new CustomEvent('training-report-sent'));}catch(error){message.textContent=error.message;}finally{b.disabled=false;}},'primary'),message);
 }
 window.addEventListener('training-plans',e=>{if(e.detail.day!==selected())return;plans=e.detail.plans;day=e.detail.day;overview();});
 window.addEventListener('training-start',start);
 document.getElementById('day').addEventListener('change',()=>{stop();active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');plans=[];day='';overview();});
 window.addEventListener('diary-records',overview);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&!busy)render();});
 overview();
}
