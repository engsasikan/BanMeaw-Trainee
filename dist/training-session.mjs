import {attachWeightUnit,formatLoggedWeight} from './weight-units.mjs';
import {comparePlan,workoutDescription} from './progress.mjs?v=6';
import {previousExercise,remainingSeconds} from './diary-tools.mjs?v=4';
import {switchView} from './dashboard.mjs?v=13';
import {api} from './account.js?v=4';
import {createMuscleFocus} from './exercise-preview.mjs?v=15';
import {localDay} from './store.mjs?v=18';
import {attachEffortUnit,looksTimed,effortText} from './effort.mjs?v=4';
import {targetText,estimateMinutes,mainMuscles,workoutBlocks,workoutStats,estimateKcal} from './workout-overview.mjs?v=2';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function initTrainingSession({getRecords,saveRecords}){
 const session=el('section',undefined,'diary guided-training');session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');document.getElementById('workout-panel').prepend(session);
 const focus=createMuscleFocus();
 let plans=[],activePlanId=null,day='',items=[],current=0,active=false,busy=false,deadline=null,restTotal=0,ticker=null,summary=false,overview=false,paused=false,pausedRest=null,clockTicker=null,holdTicker=null,media=null;
 // Full screen while training: the page behind does not scroll.
 const fullScreen=on=>{session.classList[on?'add':'remove']('ts-full');document.body?.classList[on?'add':'remove']('ts-open');};
 const clearClocks=()=>{clearInterval(clockTicker);clearInterval(holdTicker);clockTicker=holdTicker=null;};
 // The workout clock, kept for the browser tab: when it started, time spent paused, and whether it is
 // paused or finished now. Leaving and coming back keeps counting.
 const startKey=()=>'banmeaw-workout-start:'+day+':'+(activePlanId||'all'),clocks=new Map();
 const writeClock=value=>{clocks.set(startKey(),value);try{sessionStorage.setItem(startKey(),JSON.stringify(value));}catch{}return value;};
 const freshClock=()=>writeClock({start:Date.now(),paused:0,pausedAt:null,endedAt:null});
 const startedAt=()=>{try{const saved=JSON.parse(sessionStorage.getItem(startKey()));if(saved?.start)return saved;}catch{}return clocks.get(startKey())??freshClock();};
 const elapsedSeconds=()=>{const c=startedAt(),end=c.endedAt??c.pausedAt??Date.now();return Math.max(0,Math.floor((end-c.start-c.paused)/1000));};
 const pauseClock=()=>{const c=startedAt();if(!c.pausedAt&&!c.endedAt)writeClock({...c,pausedAt:Date.now()});};
 const resumeClock=()=>{const c=startedAt(),since=c.endedAt??c.pausedAt;if(since)writeClock({...c,paused:c.paused+Date.now()-since,pausedAt:null,endedAt:null});};
 const endClock=()=>{const c=startedAt();if(!c.endedAt)writeClock({...c,endedAt:c.pausedAt??Date.now(),pausedAt:null});};
 const clockText=seconds=>(seconds>=3600?Math.floor(seconds/3600)+':':'')+String(Math.floor(seconds%3600/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 // A small picture of the exercise: its GIF when the library has one, otherwise its first letter.
 function thumb(target){
  const box=el('span',undefined,'ts-thumb');box.append(el('b',target.trainingType==='cardio'?'🏃':(target.exercise||'?').trim().charAt(0).toUpperCase()));
  (media??=import('./exercise-media.mjs?v=1').catch(()=>null)).then(m=>{
   const url=m?.gifFor?.(target.exercise);if(!url)return;
   const img=el('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
   img.onload=()=>box.classList.add('has-img');img.onerror=()=>img.remove();img.src=url;box.append(img);
  });
  return box;
 }
 const restKey=item=>'banmeaw-rest:'+item.plan.id+':'+item.index,planRest=item=>item.target.rest_seconds??60;
 // Rest between sets: the plan's value by default, or the trainee's own choice for this exercise.
 const restMemo=new Map(),restFor=item=>{if(restMemo.has(restKey(item)))return restMemo.get(restKey(item));try{const v=localStorage.getItem(restKey(item));if(v!==null&&Number.isInteger(Number(v)))return Number(v);}catch{}return planRest(item);};
 const setRest=(item,value)=>{const v=Math.min(600,Math.max(0,value));restMemo.set(restKey(item),v);try{v===planRest(item)?localStorage.removeItem(restKey(item)):localStorage.setItem(restKey(item),String(v));}catch{}return v;};
 const restText=v=>v===0?'ไม่พัก':v<60?v+' วิ':Math.floor(v/60)+':'+String(v%60).padStart(2,'0')+' นาที';
 const selected=()=>document.getElementById('day').value;
 const rows=()=>plans.filter(plan=>!activePlanId||plan.id===activePlanId).flatMap(plan=>comparePlan(plan,getRecords()).map(r=>({...r,plan})));
 const draft=item=>getRecords().find(r=>r.day===day&&r.planId===item.plan.id&&r.planExerciseIndex===item.index);
 const done=item=>!!comparePlan(item.plan,getRecords())[item.index]?.actual;
 function button(text,fn,cls='quiet'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
 function stop(){clearInterval(ticker);ticker=null;deadline=null;restTotal=0;}
 // Starting opens the day's overview first; the workout itself begins from its start button.
 function start(event){if(busy||!plans.length||day!==selected()||day!==localDay())return;activePlanId=event.detail?.planId??null;items=rows();if(!items.length)return;stop();current=Math.max(0,items.findIndex(x=>!done(x)));summary=false;overview=true;active=true;session.hidden=false;fullScreen(true);document.getElementById('workout-panel').classList.add('training-mode');switchView('workout');render();session.scrollIntoView({behavior:'smooth',block:'start'});}
 function leave(){if(busy)return false;stop();clearClocks();active=false;session.hidden=true;fullScreen(false);document.getElementById('workout-panel').classList.remove('training-mode');return true;}
 function begin(index){if(busy)return;stop();items=rows();current=Math.max(0,index);overview=false;summary=false;paused=false;pausedRest=null;resumeClock();render();session.scrollTo?.(0,0);}
 // Pause: the clock and any rest countdown stop until the workout carries on.
 function pause(){
  if(busy)return;
  pausedRest=deadline?{left:Math.max(0,deadline-Date.now()),total:restTotal}:null;
  stop();pauseClock();paused=true;render();
 }
 function resume(){
  paused=false;resumeClock();
  if(pausedRest?.left){deadline=Date.now()+pausedRest.left;restTotal=pausedRest.total;}
  pausedRest=null;render();
 }
 function renderPause(){
  const box=el('section',undefined,'ts-pause');
  box.append(el('p','หยุดชั่วคราว','eyebrow'),el('h2',clockText(elapsedSeconds()),'ts-pause-time'),el('p','ฝึกไปแล้ว · ท่าที่ '+(current+1)+' จาก '+items.length+' · '+items[current].target.exercise,'muted'));
  const menu=el('div',undefined,'ts-pause-menu');
  menu.append(
   button('↻ เริ่มใหม่ตั้งแต่ท่าแรก',()=>{if(!confirm('เริ่มจับเวลาใหม่และกลับไปท่าแรก?\nเซ็ตที่บันทึกแล้วยังอยู่'))return;paused=false;pausedRest=null;freshClock();current=0;render();},'ts-pause-item'),
   button('✓ จบการฝึก · ดูสรุป',()=>{paused=false;pausedRest=null;summary=true;render();},'ts-pause-item good'),
   button('✕ ออกจากโหมดฝึก',leave,'ts-pause-item danger'));
  box.append(menu,el('p','เซ็ตที่บันทึกแล้วเก็บไว้ทุกครั้ง ออกแล้วกลับมาฝึกต่อได้','muted ts-pause-note'),button('▶ ฝึกต่อ',resume,'primary ts-resume'));
  session.append(box);
 }
 // What comes after this exercise, shown faded under the current one; tapping it moves on.
 function upNext(last,go){
  if(last)return;
  const next=items[current+1].target,card=button('',go,'ts-next');
  const text=el('span',undefined,'ts-next-text');text.append(el('small','ต่อไป'),el('strong',next.exercise),el('small',targetText(next)));
  card.append(thumb(next),text,el('span','›','ts-next-go'));card.setAttribute('aria-label','ไปท่าถัดไป · '+next.exercise);
  session.append(card);
 }
 function renderOverview(){
  const all=items,plan=all[0].plan,targets=all.map(x=>x.target);
  const finished=all.filter(done).length,next=all.findIndex(x=>!done(x));
  const head=el('header',undefined,'tso-head');
  const close=button('✕',leave,'ts-exit tso-close');close.setAttribute('aria-label','ออกจากโหมดฝึก');
  const date=new Date(day+'T12:00:00');
  head.append(close,el('p',new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long'}).format(date)+' · วันนี้','eyebrow'),
   el('h2',new Intl.DateTimeFormat('th-TH',{weekday:'long'}).format(date),'tso-title'),el('p',plan.team_name||'แผนจากเทรนเนอร์','tso-plan'));
  const stats=el('div',undefined,'tso-stats'),stat=(value,label)=>{const s=el('span',undefined,'tso-stat');s.append(el('b',value),el('small',label));return s;};
  const muscles=mainMuscles(targets);
  stats.append(stat(String(all.length),'ท่า'),stat('~'+estimateMinutes(targets),'นาที'),...(muscles.length?[stat(muscles.join(' · '),'กล้ามเนื้อหลัก')]:[]));
  head.append(stats);
  if(finished)head.append(el('p','ทำแล้ว '+finished+' / '+all.length+' ท่า','tso-progress'));
  const go=button(next<0?'ดูสรุปการฝึก':all.some(x=>draft(x))?'ฝึกต่อ · ท่าที่ '+(next+1):'เริ่มฝึก',()=>next<0?(overview=false,summary=true,render()):begin(next),'primary tso-start');
  const bar=el('div',undefined,'tso-start-bar');bar.append(go);
  const list=el('div',undefined,'tso-list');
  const row=({item,index})=>{
   const r=button('',()=>begin(index),'tso-row'+(done(item)?' done':''));
   const text=el('span',undefined,'tso-row-text');text.append(el('strong',item.target.exercise),el('small',targetText(item.target)));
   r.append(thumb(item.target),text,el('span',done(item)?'✓':String(index+1),'tso-row-mark'));
   r.setAttribute('aria-label',(done(item)?'ทำแล้ว · ':'')+item.target.exercise+' · '+targetText(item.target));
   return r;
  };
  for(const block of workoutBlocks(all)){
   const group=el('section',undefined,'tso-block'+(block.superset?' superset':''));
   if(block.superset)group.append(el('p','Super set '+block.superset+' · ทำต่อกัน '+block.rounds+' รอบ','tso-block-label'));
   group.append(...block.entries.map(row));list.append(group);
  }
  session.append(head,bar,list);
 }
 function navigation(finished,last){
  const next=()=>{if(busy)return;stop();if(last)summary=true;else current++;render();if(last&&rows().every(done))window.dispatchEvent(new CustomEvent('banmeaw-celebrate',{detail:{text:'ฝึกครบทุกท่าตามแผนแล้ว! 🔥'}}));};
  upNext(last,next);
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
   try{const ok=await saveRecords([...getRecords().filter(r=>r.id!==row.id),row]);if(!ok){notice.textContent='บันทึกไม่สำเร็จ ลองกดอีกครั้ง';return;}render();}
   catch(error){notice.textContent=error.message;}finally{busy=false;save.disabled=false;}
  };
  next=navigation(finished,last);
 }
 function render(){
  if(!active)return;
  clearClocks();session.replaceChildren();
  if(overview){renderOverview();return;}
  if(summary){endClock();renderSummary();return;}
  if(paused){renderPause();return;}
  // Top bar: back to the overview, time since the workout started, pause.
  const top=el('div',undefined,'ts-bar'),elapsed=el('div',undefined,'ts-elapsed'),elapsedClock=el('b');
  const back=button('‹ ภาพรวม',()=>{if(busy)return;stop();overview=true;render();},'ts-back');
  const pauseButton=button('Ⅱ',pause,'ts-exit ts-pause-button');pauseButton.setAttribute('aria-label','หยุดชั่วคราว');
  elapsed.append(elapsedClock,el('small','ผ่านไป'));top.append(back,elapsed,pauseButton);session.append(top);
  const tickClock=()=>{elapsedClock.textContent=clockText(elapsedSeconds());};tickClock();clockTicker=setInterval(tickClock,1000);
  const item=items[current],saved=draft(item),logs=saved?.setLogs||[],target=item.target,sets=Math.max(1,target.sets||1),finished=logs.length>=sets,last=current===items.length-1;
  // 1. Where am I: one bar per exercise in today's plan.
  const steps=el('ol',undefined,'ts-steps');
  items.forEach((x,i)=>{const li=el('li',undefined,i===current?'now':done(x)?'done':'');li.title=x.target.exercise;steps.append(li);});
  top.append(steps);
  const hero=el('div',undefined,'ts-hero');hero.append(el('p','ท่าที่ '+(current+1)+' จาก '+items.length+' · '+(item.plan.team_name||'แผนจากเทรนเนอร์'),'ts-sub'),el('h2',target.exercise,'ts-name'));session.append(hero);
  // The exercise picture sits right under its name, as the main thing on screen.
  focus.show(target.exercise);session.append(focus.el);
  // 2. What the trainer asked for.
  const goal=el('div',undefined,'ts-goal'),chip=(label,value)=>{const c=el('span',undefined,'ts-chip');c.append(el('small',label),el('b',value));return c;};
  if(target.trainingType==='cardio'){
   goal.append(chip('เวลา',target.duration+' นาที'));
   if(target.incline!=null)goal.append(chip('ความชัน',target.incline+'%'));
   if(target.speed!=null)goal.append(chip('ความเร็ว',target.speed+' กม./ชม.'));
   if(target.distance!=null)goal.append(chip('ระยะทาง',target.distance+' กม.'));
   hero.append(el('p','เป้าหมายวันนี้','ts-label'),goal);cardioStep(item,saved,last);return;
  }
  else goal.append(chip('จำนวน',sets+' เซ็ต'),chip('เซ็ตละ',effortText(target)||'-'),chip('น้ำหนัก',target.weight==null?'ตามไหว':formatLoggedWeight(target)));
  hero.append(el('p','เป้าหมายวันนี้','ts-label'),goal);
  // Rest between sets: starts at the plan's value, the trainee can change it.
  const restSet=el('div',undefined,'ts-rest-set'),restInfo=el('div'),restValue=el('b',undefined,'ts-rest-value'),restNote=el('small');
  const reset=button('ใช้ตามแผน',()=>changeRest(planRest(item)-restFor(item)),'ts-rest-reset');
  const showRest=()=>{const v=restFor(item),custom=v!==planRest(item);restValue.textContent=restText(v);restNote.textContent=custom?'ปรับเอง · แผนตั้งไว้ '+restText(planRest(item)):'ตามที่แผนตั้งไว้';reset.hidden=!custom;};
  const changeRest=delta=>{const before=restFor(item),after=setRest(item,before+delta);showRest();if(deadline&&after!==before){deadline+=(after-before)*1000;restTotal=Math.max(1,restTotal+after-before);}};
  const less=button('−15',()=>changeRest(-15),'ts-step'),more=button('+15',()=>changeRest(15),'ts-step');less.setAttribute('aria-label','ลดเวลาพัก 15 วินาที');more.setAttribute('aria-label','เพิ่มเวลาพัก 15 วินาที');
  const stepper=el('div',undefined,'ts-stepper');stepper.append(less,restValue,more);
  restInfo.append(el('span','พักระหว่างเซ็ต'),restNote,reset);restSet.append(restInfo,stepper);showRest();
  if(target.superset)hero.append(el('p','Super set '+target.superset+' · ทำสลับกับท่าในกลุ่มเดียวกันตามลำดับ','muted'));
  // 3. Sets: done / now / later.
  const track=el('ol',undefined,'ts-sets');
  for(let i=0;i<Math.max(sets,logs.length+(finished?0:1));i++){const r=logs[i],li=el('li',undefined,r?'done':i===logs.length?'now':'');li.append(el('small','เซ็ต '+(i+1)),el('b',r?'✓ '+effortText(r):i===logs.length?'ตอนนี้':'รอ'));li.append(el('small',r?(r.weight==null?'':formatLoggedWeight(r)):''));track.append(li);}
  const rest=el('div',undefined,'ts-rest'),ring=el('div',undefined,'ts-ring'),clock=el('p',undefined,'training-clock');
  const restLabel=el('small','พักก่อนฝึกต่อ');restLabel.setAttribute('role','status');
  const skip=button('ข้ามเวลาพัก',()=>{stop();rest.hidden=true;},'ts-skip');
  const shift=delta=>{if(!deadline)return;deadline=Math.max(Date.now(),deadline+delta*1000);restTotal=Math.max(1,restTotal+delta);tick();};
  const minus=button('−15 วิ',()=>shift(-15),'ts-step'),plus=button('+15 วิ',()=>shift(15),'ts-step');
  const restActions=el('div',undefined,'ts-rest-actions');restActions.append(minus,skip,plus);
  rest.hidden=!deadline;
  ring.append(clock,restLabel);rest.append(ring,restActions);session.append(rest,track);
  // 4. Log the set just done.
  const form=el('form',undefined,'ts-log'),weight=el('input'),reps=el('input'),weightLabel=el('label','น้ำหนักที่ยก'),repsLabel=el('label','ทำได้กี่ครั้ง');
  weight.type=reps.type='number';weight.min=0;weight.max=2000;weight.step='.01';weight.placeholder='ไม่ระบุ';weight.value=logs.at(-1)?.weight??target.weight??'';weight.inputMode='decimal';
  reps.min=1;reps.max=1000;reps.step=1;reps.required=true;reps.inputMode='numeric';weightLabel.append(weight);repsLabel.append(reps);
  // Holds like a plank are logged in seconds; the switch starts from the plan, the last set, or the exercise name.
  const effort=attachEffortUnit(reps,{label:repsLabel,host:repsLabel});const lastSet=logs.at(-1);
  const timed=lastSet?lastSet.seconds!=null:target.seconds!=null||looksTimed(target.exercise);effort.set(timed);
  reps.value=timed?(lastSet?.seconds??target.seconds??30):(lastSet?.reps??target.reps??12);
  const metrics=el('div',undefined,'training-live-metrics');metrics.append(weightLabel,repsLabel);const weightUnit=attachWeightUnit(weight,metrics);const priorLoad=logs.at(-1)??target;if(priorLoad.weight!=null||logs.length)weightUnit.set(priorLoad.weight,priorLoad.weightUnit);
  const notice=el('p',undefined,'muted');notice.setAttribute('role','status');
  const save=el('button',finished?'+ บันทึกเซ็ตเพิ่ม':'✓ ทำเซ็ต '+(logs.length+1)+' เสร็จแล้ว',finished?'quiet':'primary');save.type='submit';save.disabled=busy;
  // Holds (plank): count the set's seconds down on screen, then save the set.
  const hold=button('',()=>{
   if(holdTicker){clearInterval(holdTicker);holdTicker=null;showHold();return;}
   const total=Math.max(1,Number(reps.value)||30),end=Date.now()+total*1000;
   const tickHold=()=>{const left=Math.max(0,Math.ceil((end-Date.now())/1000));hold.textContent=left?'⏱ '+clockText(left)+' · แตะเพื่อหยุด':'ครบ '+total+' วินาทีแล้ว · กดบันทึกเซ็ต';hold.classList[left?'add':'remove']('running');if(!left){clearInterval(holdTicker);holdTicker=null;navigator.vibrate?.([200,100,200]);}};
   holdTicker=setInterval(tickHold,250);tickHold();
  },'ts-hold');
  const showHold=()=>{hold.hidden=!effort.timed();if(!holdTicker)hold.textContent='⏱ เริ่มจับเวลา '+(reps.value||0)+' วินาที';};
  reps.addEventListener('input',showHold);effort.select.addEventListener('change',showHold);showHold();
  const next=()=>{if(busy)return;stop();if(last)summary=true;else current++;render();if(last&&rows().every(done))window.dispatchEvent(new CustomEvent('banmeaw-celebrate',{detail:{text:'ฝึกครบทุกท่าตามแผนแล้ว! 🔥'}}));};
  if(finished){const doneBox=el('div',undefined,'ts-done');doneBox.append(el('strong','ครบ '+sets+' เซ็ตแล้ว เก่งมาก!'),button(last?'ดูสรุปการฝึก →':'ไปท่าถัดไป →',next,'primary'));session.append(doneBox);}
  form.append(el('p',finished?'ทำเกินเป้าได้ บันทึกเพิ่มได้เลย':'ทำเซ็ต '+(logs.length+1)+' แล้วกรอกผลจริง','ts-label'),metrics,hold,save);
  // The rest setting is a setting, so it sits under the log form rather than above the picture.
  session.append(form,notice,restSet);
  const previous=previousExercise(getRecords(),target.exercise,'strength',day);
  session.append(el('p',previous?'ครั้งก่อน ('+previous.day+'): '+workoutDescription(previous):'ยังไม่มีผลครั้งก่อนของท่านี้','ts-prev'));
  function tick(){
   const left=remainingSeconds(deadline);
   const time=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
   if(clock.textContent!==time)clock.textContent=time;
   ring.setAttribute('style','--p:'+(restTotal?Math.min(1,left/restTotal):0).toFixed(3));
   if(left)return;
   stop();rest.classList.add('over');minus.hidden=plus.hidden=true;
   restLabel.textContent='ครบเวลาพักแล้ว เริ่มฝึกต่อได้';
   skip.textContent='ปิด';
   navigator.vibrate?.([150,100,150]);
  }
  if(deadline){ticker=setInterval(tick,250);tick();}
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||selected()!==day)return;busy=true;save.disabled=true;notice.textContent='กำลังบันทึกเซ็ต…';
   const latest=draft(item),nextLogs=[...(latest?.setLogs||[]),{...weightUnit.read(),...(effort.timed()?{seconds:Number(reps.value)}:{reps:Number(reps.value)})}];
   if(nextLogs.length>100){busy=false;save.disabled=false;notice.textContent='บันทึกได้สูงสุด 100 เซ็ตต่อท่า';return;}
   const row={id:latest?.id||crypto.randomUUID(),kind:'workout',day,trainingType:'strength',exercise:target.exercise,planId:item.plan.id,planExerciseIndex:item.index,weight:nextLogs.at(-1).weight,weightUnit:nextLogs.at(-1).weightUnit,sets:nextLogs.length,reps:nextLogs.at(-1).reps??null,...(nextLogs.at(-1).seconds!=null?{seconds:nextLogs.at(-1).seconds}:{}),notes:latest?.notes||'',setLogs:nextLogs,sessionComplete:nextLogs.length>=target.sets};
   try{
    const ok=await saveRecords([...getRecords().filter(r=>r.id!==row.id),row]);
    if(!ok){notice.textContent='บันทึกไม่สำเร็จ กรอกไว้แล้ว กดจบเซ็ตเพื่อลองใหม่';return;}
    if(!active||selected()!==row.day)return;
    stop();
    const restSeconds=restFor(item);
    if(target.superset){
     const group=items.map((x,i)=>({x,i})).filter(({x})=>x.plan.id===item.plan.id&&x.target.superset===target.superset);
     const candidates=[...group.filter(x=>x.i>current),...group.filter(x=>x.i<=current)];
     const next=candidates.find(({x})=>!done(x));
     if(next)current=next.i;
    }
    if(restSeconds>0&&(!row.sessionComplete||!last||current<items.length-1)){deadline=Date.now()+restSeconds*1000;restTotal=restSeconds;}
    render();
    if(deadline)session.querySelector('.ts-rest')?.scrollIntoView({block:'nearest'});
   }catch(error){notice.textContent=error.message;}
   finally{busy=false;save.disabled=false;session.querySelector('button[type="submit"]')?.removeAttribute('disabled');}
  };
  upNext(last,next);
  // 5. Move between exercises.
  const nav=el('div',undefined,'training-actions');
  nav.append(current>0?button('← ท่าก่อนหน้า',()=>{if(busy)return;stop();current--;render();}):el('span'));
  if(!last)nav.append(button(finished?'ท่าถัดไป →':'ข้ามท่านี้ →',next));
  session.append(nav,button('จบการฝึกวันนี้ · ดูสรุป',()=>{if(busy)return;stop();summary=true;render();},'ts-finish'));
 }
 function renderSummary(){
  const all=rows(),completed=all.filter(done),remaining=all.filter(x=>!done(x)),seconds=elapsedSeconds();
  const record=item=>draft(item)??item.actual;
  const stats=workoutStats(all.map(item=>({target:item.target,record:record(item)})));
  const complete=!remaining.length,date=new Date(day+'T12:00:00');
  const head=el('header',undefined,'tss-head'+(complete?' complete':''));
  const close=button('✕',leave,'ts-exit tso-close');close.setAttribute('aria-label','ออกจากโหมดฝึก');
  head.append(close,el('span',complete?'🏆':'💪','tss-badge'),el('p',complete?'ฝึกครบทุกท่าแล้ว เก่งมาก!':'สรุปการฝึก · บันทึกแล้ว '+completed.length+' / '+all.length+' ท่า','tss-kicker'),
   el('h2',new Intl.DateTimeFormat('th-TH',{weekday:'long'}).format(date)+' · '+(all[0].plan.team_name||'แผนฝึก'),'tss-title'),
   el('p',clockText(seconds),'tss-time'),el('small','เวลาฝึกทั้งหมด','tss-time-label'));
  const grid=el('div',undefined,'tss-stats'),stat=(value,label)=>{const box=el('span',undefined,'tss-stat');box.append(el('b',value),el('small',label));return box;};
  grid.append(stat(completed.length+'/'+all.length,'ท่า'),stat(String(stats.sets),'เซ็ต'));
  if(stats.reps)grid.append(stat(stats.reps.toLocaleString('th-TH'),'ครั้ง'));
  if(stats.holdSeconds)grid.append(stat(clockText(stats.holdSeconds),'เวลาค้างท่า'));
  if(stats.cardioMinutes)grid.append(stat(String(Math.round(stats.cardioMinutes)),'นาทีคาร์ดิโอ'));
  if(stats.volumeKg)grid.append(stat(stats.volumeKg.toLocaleString('th-TH'),'kg รวมที่ยก'));
  if(seconds>=60)grid.append(stat('~'+estimateKcal(seconds),'kcal (ประมาณ)'));
  const list=el('div',undefined,'tss-list');
  for(const item of all){
   const r=record(item),row=el('div',undefined,'tss-row'+(done(item)?' done':''));
   const text=el('span',undefined,'tso-row-text');
   text.append(el('strong',item.target.exercise),el('small',r?workoutDescription(r)+(r.setLogs&&!done(item)?' · '+r.setLogs.length+'/'+item.target.sets+' เซ็ต':''):'ยังไม่ได้บันทึก'));
   row.append(thumb(item.target),text,el('span',done(item)?'✓':'○','tso-row-mark'));list.append(row);
  }
  const message=el('p',undefined,'tss-message');message.setAttribute('role','status');
  const actions=el('div',undefined,'tss-actions');
  if(remaining.length)actions.append(button('กลับไปฝึกต่อ · เหลือ '+remaining.length+' ท่า',()=>{summary=false;resumeClock();current=all.findIndex(x=>!done(x));render();},'quiet'));
  actions.append(button('ส่งผลให้เทรนเนอร์',async e=>{const b=e.currentTarget;b.disabled=true;try{await api('/api/reports',{method:'POST',body:JSON.stringify({day})});message.textContent='ส่งอาหารและผลการฝึกของวันที่เลือกให้ทีมแล้ว';window.dispatchEvent(new CustomEvent('training-report-sent'));}catch(error){message.textContent=error.message;}finally{b.disabled=false;}},'primary'));
  actions.append(button('แชร์ผลการฝึก',async()=>{
   const text=[(complete?'ฝึกครบแล้ว 💪 ':'ฝึกวันนี้ 💪 ')+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(date),
    '⏱ '+clockText(seconds)+' · '+completed.length+'/'+all.length+' ท่า · '+stats.sets+' เซ็ต'+(stats.volumeKg?' · '+stats.volumeKg.toLocaleString('th-TH')+' kg':''),
    ...all.map(item=>{const r=record(item);return (done(item)?'✓ ':'○ ')+item.target.exercise+(r?' · '+workoutDescription(r):'');}),'#BanMeaw'].join('\n');
   try{if(navigator.share)await navigator.share({title:'ผลการฝึก',text});else{await navigator.clipboard.writeText(text);message.textContent='คัดลอกผลการฝึกแล้ว วางในแชทได้เลย';}}
   catch(error){if(error?.name!=='AbortError')message.textContent='แชร์ไม่สำเร็จ';}
  },'quiet'),button('เสร็จ',leave,'tss-done'));
  session.append(head,grid,list,message,actions);
 }
 window.addEventListener('training-plans',e=>{if(e.detail.day!==selected())return;plans=e.detail.plans;day=e.detail.day;});
 window.addEventListener('training-start',start);
 document.getElementById('day').addEventListener('change',()=>{stop();clearClocks();fullScreen(false);active=false;session.hidden=true;document.getElementById('workout-panel').classList.remove('training-mode');plans=[];day='';});
 return {leave};
}
