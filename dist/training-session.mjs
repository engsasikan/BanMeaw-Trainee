import {comparePlan,workoutDescription} from './progress.mjs?v=2';
import {previousExercise,remainingSeconds} from './diary-tools.mjs?v=1';
import {switchView} from './dashboard.mjs?v=9';
import {api} from './account.js?v=4';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function initTrainingSession({getRecords,saveRecords}){
 const card=el('section',undefined,'diary training-entry');document.getElementById('dashboard-panel').prepend(card);
 const session=el('section',undefined,'diary guided-training');session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');document.getElementById('workout-panel').prepend(session);
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
 function render(){
  if(!active)return;
  session.replaceChildren();session.append(el('p','ฝึกตามแผน · '+day,'eyebrow'));
  if(summary){renderSummary();return;}
  const item=items[current],saved=draft(item),logs=saved?.setLogs||[],target=item.target;
  session.append(el('h2',item.target.exercise),el('p','ท่า '+(current+1)+' / '+items.length+' · '+(item.plan.team_name||'แผนจากเทรนเนอร์'),'muted'),el('p','เป้าหมาย: '+workoutDescription(target),'training-target'));
  if(target.superset)session.append(el('p','Super set '+target.superset+' · ทำตามลำดับท่าในแผน','muted'));
  const previous=previousExercise(getRecords(),target.exercise,'strength',day);
  session.append(el('p',previous?'ครั้งก่อน ('+previous.day+'): '+workoutDescription(previous):'ยังไม่มีผลครั้งก่อนของท่านี้','muted'));
  const form=el('form'),weight=el('input'),reps=el('input'),weightLabel=el('label','น้ำหนักที่ทำจริง (กก.)'),repsLabel=el('label','จำนวนครั้งที่ทำจริง');
  weight.type=reps.type='number';weight.min=0;weight.max=2000;weight.step='.01';weight.placeholder='ไม่ระบุ';weight.value=logs.at(-1)?.weight??target.weight??'';weight.inputMode='decimal';
  reps.min=1;reps.max=1000;reps.step=1;reps.required=true;reps.value=logs.at(-1)?.reps??target.reps??12;reps.inputMode='numeric';weightLabel.append(weight);repsLabel.append(reps);
  const metrics=el('div',undefined,'training-live-metrics');metrics.append(weightLabel,repsLabel);form.append(metrics);
  const count=el('p','บันทึกแล้ว '+logs.length+' / '+target.sets+' เซ็ต','training-progress'),clock=el('p',undefined,'training-clock');clock.setAttribute('role','status');
  session.append(count,clock);
  const notice=el('p',undefined,'muted');notice.setAttribute('role','status');
  const save=el('button',logs.length>=target.sets?'บันทึกเซ็ตเพิ่มเติม':'จบเซ็ต '+(logs.length+1)+' · บันทึกและพัก','primary');save.type='submit';save.disabled=busy;form.append(save);session.append(form,notice);
  function tick(){const left=deadline?remainingSeconds(deadline):0;clock.textContent=left?'พัก '+String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0'):(deadline?'ครบเวลาพักแล้ว พร้อมฝึกต่อ':'');if(deadline&&!left){stop();navigator.vibrate?.([150,100,150]);}}
  if(deadline){tick();clearInterval(ticker);ticker=setInterval(tick,250);}
  session.append(button('ข้ามเวลาพัก',()=>{stop();clock.textContent='พร้อมฝึกต่อ';}));
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||selected()!==day)return;busy=true;save.disabled=true;notice.textContent='กำลังบันทึกเซ็ต…';
   const latest=draft(item),nextLogs=[...(latest?.setLogs||[]),{weight:weight.value===''?null:Number(weight.value),reps:Number(reps.value)}];
   if(nextLogs.length>100){busy=false;save.disabled=false;notice.textContent='บันทึกได้สูงสุด 100 เซ็ตต่อท่า';return;}
   const row={id:latest?.id||crypto.randomUUID(),kind:'workout',day,trainingType:'strength',exercise:target.exercise,planId:item.plan.id,planExerciseIndex:item.index,weight:nextLogs.at(-1).weight,sets:nextLogs.length,reps:nextLogs.at(-1).reps,notes:latest?.notes||'',setLogs:nextLogs,sessionComplete:nextLogs.length>=target.sets};
   try{const ok=await saveRecords([...getRecords().filter(r=>r.id!==row.id),row]);if(!ok){notice.textContent='บันทึกไม่สำเร็จ กรอกไว้แล้ว กดจบเซ็ตเพื่อลองใหม่';return;}stop();if((target.rest_seconds??60)>0)deadline=Date.now()+(target.rest_seconds??60)*1000;if(target.superset){const group=items.map((x,i)=>({x,i})).filter(({x})=>x.plan.id===item.plan.id&&x.target.superset===target.superset);const candidates=[...group.filter(x=>x.i>current),...group.filter(x=>x.i<=current)];const next=candidates.find(({x})=>!done(x));if(next)current=next.i;}render();overview();}catch(error){notice.textContent=error.message;}finally{busy=false;save.disabled=false;session.querySelector('button[type="submit"]')?.removeAttribute('disabled');}
  };
  if(logs.length){const fold=el('details'),list=el('ol');fold.append(el('summary','เซ็ตที่บันทึกไว้'));for(const r of logs)list.append(el('li',(r.weight==null?'ไม่ระบุน้ำหนัก':r.weight+' กก.')+' · '+r.reps+' ครั้ง'));fold.append(list);session.append(fold);}
  const nav=el('div',undefined,'training-actions');
  if(current>0)nav.append(button('ท่าก่อนหน้า',()=>{if(busy)return;stop();current--;render();}));
  if(current<items.length-1)nav.append(button(done(item)?'ไปท่าถัดไป':'ข้ามไปท่าถัดไป',()=>{if(busy)return;stop();current++;render();}));
  nav.append(button('จบการฝึก · ดูสรุป',()=>{if(busy)return;stop();summary=true;render();}));
  nav.append(button('กลับไปดูแผน',()=>{if(busy)return;stop();active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');}));session.append(nav);
 }
 function renderSummary(){
  const all=rows(),completed=all.filter(done),remaining=all.filter(x=>!done(x));
  session.append(el('h2','สรุปการฝึก'),el('strong','บันทึกครบ '+completed.length+' / '+all.length+' ท่า','training-progress'));
  const list=el('ul');for(const item of all){const r=draft(item);list.append(el('li',(done(item)?'✓ ':'○ ')+item.target.exercise+(r?.setLogs?' · '+r.setLogs.length+'/'+item.target.sets+' เซ็ต':done(item)?' · บันทึกแล้ว':' · ยังไม่บันทึกครบ')));}session.append(list);
  if(remaining.length)session.append(el('p','ยังเหลือ '+remaining.length+' ท่า กลับไปฝึกต่อได้ หรือส่งผลที่ทำแล้วให้เทรนเนอร์','muted'),button('กลับไปฝึกต่อ',()=>{summary=false;current=all.findIndex(x=>!done(x));render();},'primary'));
  const message=el('p');message.setAttribute('role','status');
  session.append(button('ส่งผลให้เทรนเนอร์',async e=>{const b=e.currentTarget;b.disabled=true;try{await api('/api/reports',{method:'POST',body:JSON.stringify({day})});message.textContent='ส่งอาหารและผลการฝึกของวันที่เลือกให้ทีมแล้ว';window.dispatchEvent(new CustomEvent('training-report-sent'));}catch(error){message.textContent=error.message;}finally{b.disabled=false;}},'primary'),message,button('กลับไปดูแผน',()=>{active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');}));
 }
 window.addEventListener('training-plans',e=>{if(e.detail.day!==selected())return;plans=e.detail.plans;day=e.detail.day;overview();});
 window.addEventListener('training-start',start);
 document.getElementById('day').addEventListener('change',()=>{stop();active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');plans=[];day='';overview();});
 window.addEventListener('diary-records',overview);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&!busy)render();});
 overview();
}
