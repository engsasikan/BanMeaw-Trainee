import {initDailySummary} from './daily-summary.mjs?v=4';
import {createExerciseHistory} from './exercise-history.mjs?v=4';
import {initCompactWorkout} from './compact-workout.mjs?v=3';
import {initHistoryText} from './history-text.mjs?v=5';
import {attachWeightUnit,formatLoggedWeight,preferredWeightUnit} from './weight-units.mjs';
import {attachEffortUnit,looksTimed,effortText,formatSeconds} from './effort.mjs?v=4';
import {renderWorkoutGroups} from './workout-groups.mjs?v=2';
import {initWorkoutPairs} from './workout-pairs.mjs?v=12';
import {initTrainingSession} from './training-session.mjs?v=37';
import {signInWithGoogle} from './google-signin.mjs?v=2';
import {initDiaryTools} from './diary-tools.mjs?v=6';
import {initNutrition} from './nutrition.mjs?v=3';
import {mealNumbers,dayTotals,progress} from './meal-nutrition.mjs?v=2';
import {frequentMeals,previousDayCopies,previousDay} from './meal-shortcuts.mjs?v=2';
import {initPasswordReset,initBackup} from './account-extras.mjs?v=6';
import {initProgress} from './coach-ui.mjs?v=6';
import {initProfile} from './profile.mjs?v=4';
import {showDailyPlans,trainerPlanner} from './plans.mjs?v=42';
import {programEnding,endingNotice} from './team-program.mjs?v=9';
import {createOutbox,isNetworkError} from './outbox.mjs?v=1';
import {planSnapshot,planChanges,changeSummary} from './plan-updates.mjs?v=1';
import {auth,api} from './account.js?v=5';
import {localDay,read,write,validateRecords,mergeRecords,mealForTime} from './store.mjs?v=19';
import {attachExercisePicker} from './exercise-picker.mjs?v=13';
import {attachNavigation,renderDashboard,switchView} from './dashboard.mjs?v=13';
import {initTeams,loadTeams} from './team.mjs?v=84';
import {openTeamWorkoutCopy} from './team-workout-copy.mjs?v=8';
import {initBody,quickWeigh} from './body.mjs?v=40';
import {initToday} from './today.mjs?v=23';
import {initMotion} from './motion.mjs?v=2';
import {initHealthHistory} from './health-ui.mjs?v=3';
import {personalRecord} from './personal-record.mjs?v=3';
import {createAnatomyPicker} from './anatomy-picker.mjs?v=3';
const $=id=>document.getElementById(id);let profileId,records=[],editing=null,workoutEditing=null,storageOK=true;
attachExercisePicker();
attachNavigation();
initDailySummary({getRecords:()=>records,onView:switchView});
initHistoryText({api});
const workoutWeight=attachWeightUnit($('weight'),$('strength-fields'));
// Holds like a plank are logged in seconds per set instead of reps.
const workoutEffort=attachEffortUnit($('reps'),{label:document.querySelector('label[for="reps"]'),host:$('reps').parentElement});
$('exercise').addEventListener('change',()=>{if(!workoutEditing)workoutEffort.set(looksTimed($('exercise').value));});
const workoutComposer=node('details',undefined,'workout-composer');workoutComposer.id='workout-composer';
workoutComposer.append(node('summary','＋ เพิ่มท่า / Super set / คาร์ดิโอ'));
// Trainers kept logging moves here expecting their team to get them; this is only their own diary.
const coachLogNote=node('div',undefined,'coach-log-note');coachLogNote.hidden=true;coachLogNote.setAttribute('role','note');
const coachLogText=node('div',undefined,'coach-log-text');coachLogText.append(node('strong','บันทึกส่วนตัวของคุณ'),node('p','ลูกเทรนจะไม่เห็นท่าที่บันทึกตรงนี้'));
const coachLogGo=node('button','จัดแผนให้ทีม →','coach-log-go');coachLogGo.type='button';coachLogGo.onclick=()=>document.querySelector('[data-view="team"]')?.click();
const coachLogIcon=node('span','i','coach-log-icon');coachLogIcon.setAttribute('aria-hidden','true');
coachLogNote.append(coachLogIcon,coachLogText,coachLogGo);
workoutComposer.append(coachLogNote);
window.addEventListener('teams-loaded',e=>{coachLogNote.hidden=!e.detail.some(t=>t.status==='active'&&(t.my_role==='owner'||t.my_role==='trainer'));});
const compose=$('workout-form').closest('.compose');compose.before(workoutComposer);workoutComposer.append(compose);
function openWorkoutComposer(){showWorkoutSection('log');}

function tell(message){$('status').textContent=message;}
const legacyRecords=(()=>{try{return read(localStorage);}catch{return [];}})();storageOK=false;
$('day').value=localDay();$('time').value=new Date().toTimeString().slice(0,5);$('meal').value=mealForTime($('time').value)||'มื้อเช้า';
let saving=false,workoutPlan=null,workoutPairs=null;
const trainingSession=initTrainingSession({getRecords:()=>records,saveRecords});
const diaryTools=initDiaryTools({getRecords:()=>records,getEditing:()=>workoutEditing,reuseMeal:r=>{editing=null;openMealForm();$('form-title').textContent='เพิ่มมื้ออาหาร';$('save').textContent='บันทึกมื้ออาหาร';$('meal').value=r.meal;$('details').value=r.text;$('meal-kcal').value=r.kcal??'';$('meal-protein').value=r.protein??'';$('meal-carbs').value=r.carbs??'';document.querySelectorAll('[name="workout-timing"]').forEach(i=>i.checked=i.value===(r.workoutTiming||''));count();$('details').setCustomValidity('');$('details').focus();},reuseWorkout:fillWorkoutDraft});

initCompactWorkout();

// Changes made without a connection wait in this browser and are sent when it comes back.
let outbox=null,flushing=false;
const outboxFor=()=>outbox??=profileId?createOutbox('banmeaw-outbox:'+profileId):null;
const sendChange=op=>api('/api/entries/'+encodeURIComponent(op.id),op.type==='put'
 ?{method:'PUT',headers:{'If-Match':String(op.revision)},body:JSON.stringify(op.row)}
 :{method:'DELETE',headers:{'If-Match':String(op.revision)}});
const syncBadge=node('button','','sync-badge');syncBadge.type='button';syncBadge.hidden=true;syncBadge.onclick=()=>flushOutbox();document.body.append(syncBadge);
function showSync(){
 const waiting=outbox?.size||0;syncBadge.hidden=!waiting;if(!waiting)return;
 syncBadge.classList.toggle('offline',navigator.onLine===false);
 syncBadge.textContent=flushing?'กำลังส่ง '+waiting+' รายการ…':(navigator.onLine===false?'📴 ออฟไลน์ · ':'⏳ ')+'รอส่ง '+waiting+' รายการ · แตะเพื่อส่ง';
}
async function flushOutbox(){
 const box=outboxFor();if(!box?.size||flushing||saving)return;
 flushing=saving=true;showSync();
 try{
  const result=await box.flush(sendChange);
  if(result.sent||result.refused.length){
   saving=false;await loadRecords();
   // A change refused only because it already arrived (its reply was lost on the way back) is not a conflict.
   const same=(a,b)=>JSON.stringify(validateRecords([a])[0])===JSON.stringify(validateRecords([b])[0]);
   const conflicts=result.refused.filter(({op})=>{const now=records.find(r=>r.id===op.id&&!r._pending);return op.type==='put'?!(now&&same(now,op.row)):!!now;});
   if(conflicts.length)tell(conflicts.length+' รายการที่บันทึกตอนออฟไลน์ส่งไม่ได้ เพราะข้อมูลเปลี่ยนจากอีกเครื่อง · '+conflicts[0].error.message);
   else if(!box.size)tell('ส่งข้อมูลที่บันทึกตอนออฟไลน์ครบแล้ว');
  }
 }catch{}
 finally{flushing=saving=false;showSync();}
}
window.addEventListener('online',()=>{showSync();flushOutbox();});window.addEventListener('offline',showSync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)flushOutbox();});
setInterval(()=>{if(outbox?.size)flushOutbox();},30000);
// A note at the top of the app when a trainer has added, changed or cancelled this member's upcoming plans
// since they last looked, with a dot on the workout tab until they do.
const planNotice=node('section',undefined,'plan-update-notice');planNotice.hidden=true;planNotice.setAttribute('role','status');
document.querySelector('main')?.prepend(planNotice);
let lastPlanCheck=0;
const markWorkoutTab=on=>document.querySelectorAll('[data-view="workout"]').forEach(b=>b.classList.toggle('has-update',on));
async function checkPlanUpdates(){
 if(!profileId||Date.now()-lastPlanCheck<60000)return;lastPlanCheck=Date.now();
 const today=localDay(),key='banmeaw-plan-seen:'+profileId;
 try{
  const {plans}=await api('/api/plans?range=upcoming&day='+today),current=planSnapshot(plans,profileId,today);
  let previous=null;try{previous=JSON.parse(localStorage.getItem(key));}catch{}
  const seen=()=>{try{localStorage.setItem(key,JSON.stringify(current));}catch{}planNotice.hidden=true;markWorkoutTab(false);};
  const changes=planChanges(previous,current,today),total=changes.added.length+changes.changed.length+changes.removed.length;
  if(!previous||!total){seen();return;}
  const first=[...changes.added,...changes.changed].sort((a,b)=>a.day.localeCompare(b.day))[0];
  const text=node('div',undefined,'plan-update-text');
  text.append(node('strong','เทรนเนอร์อัปเดตแผนฝึกของคุณ'),...changeSummary(changes).map(line=>node('small',line)));
  const actions=node('div',undefined,'plan-update-actions');
  const look=node('button',first?'ดูแผน':'ดูโปรแกรมฝึก','primary');look.type='button';
  look.onclick=()=>{seen();switchView('workout');showWorkoutSection('program');if(first)selectDay(first.day);else refreshDailyPlans();document.getElementById('workout-program')?.scrollIntoView({block:'start'});};
  const ok=node('button','รับทราบ','quiet');ok.type='button';ok.onclick=seen;
  actions.append(look,ok);
  planNotice.replaceChildren(node('span','🔔','plan-update-icon'),text,actions);planNotice.hidden=false;markWorkoutTab(true);
 }catch{lastPlanCheck=0;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkPlanUpdates();});
async function loadRecords(){const result=await api('/api/entries');records=outboxFor()?.apply(result.records)??result.records;storageOK=true;render();showSync();}
async function saveRecords(next,formId=null){
 if(!storageOK||saving){tell('กรุณารอให้โหลดหรือบันทึกข้อมูลเสร็จ');if(formId)diaryTools.setStatus(formId,'error','ยังบันทึกไม่ได้ กรุณารอให้โหลดหรือบันทึกข้อมูลเสร็จแล้วลองใหม่');return false;}
 saving=true;if(formId)diaryTools.setStatus(formId,'saving','กำลังบันทึก…');document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#import,#migrate-local').forEach(b=>b.disabled=true);
 try{
  const valid=validateRecords(next),old=new Map(records.map(r=>[r.id,r])),changes=[];
  for(const row of valid){const previous=old.get(row.id);if(previous&&JSON.stringify(validateRecords([previous])[0])===JSON.stringify(row))continue;changes.push({type:'put',id:row.id,row,revision:previous?._revision||0});}
  for(const previous of records)if(!valid.some(r=>r.id===previous.id))changes.push({type:'delete',id:previous.id,revision:previous._revision||0});
  // Without a connection, changes go to the outbox (behind anything already waiting, to keep their order).
  const box=outboxFor();let queued=false;
  for(const change of changes){
   if(box&&(queued||box.size)){box.add(change);queued=true;continue;}
   try{await sendChange(change);}catch(error){if(!box||!isNetworkError(error))throw error;box.add(change);queued=true;}
  }
  if(queued){
   const waiting=new Set(box.list().map(op=>op.id));
   records=valid.map(r=>({...r,...(old.get(r.id)?._revision!=null?{_revision:old.get(r.id)._revision}:{}),...(waiting.has(r.id)?{_pending:true}:{})}));
   render();showSync();
   const offline=navigator.onLine===false;
   if(formId)diaryTools.setStatus(formId,'saved',offline?'บันทึกไว้ในเครื่องแล้ว · จะส่งเมื่อมีอินเทอร์เน็ต':'บันทึกไว้ในเครื่องแล้ว · กำลังส่ง');
   tell(offline?'ไม่มีอินเทอร์เน็ต · บันทึกไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์':'บันทึกไว้ในเครื่องแล้ว · กำลังส่งต่อให้');
   // Back online with older changes still waiting: send them all now rather than at the next retry.
   if(!offline)setTimeout(flushOutbox,0);
   const added=valid.filter(r=>!old.has(r.id));if(added.length)window.dispatchEvent(new CustomEvent('diary-added',{detail:added}));
   return true;
  }
  await loadRecords();const added=valid.filter(r=>!old.has(r.id));if(added.length)window.dispatchEvent(new CustomEvent('diary-added',{detail:added}));return true;
 }catch(error){tell(error.message);try{await loadRecords();const actual=validateRecords(records),desired=validateRecords(next);if(JSON.stringify([...actual].sort((a,b)=>a.id.localeCompare(b.id)))===JSON.stringify([...desired].sort((a,b)=>a.id.localeCompare(b.id))))return true;}catch{}if(formId)diaryTools.setStatus(formId,'error','บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ · '+error.message);return false;}
 finally{saving=false;document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#import,#migrate-local').forEach(b=>b.disabled=false);}
}

function reset(){editing=null;$('meal-form').reset();closeMealForm();$('time').value=new Date().toTimeString().slice(0,5);$('meal').value=mealForTime($('time').value)||'มื้อเช้า';$('form-title').textContent='เพิ่มมื้ออาหาร';$('save').textContent='บันทึกมื้ออาหาร';$('count').textContent='0 / 3,000';resetWorkout();}
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
// The day's food: a summary (meals, kcal and protein against the trainer's goal) and the meals in time order.
// Goals: from a trainer if one has set them, otherwise the member's own (set right on this page).
let nutritionGoals=[],ownGoal=null,ownGoalOpen=false;
window.addEventListener('nutrition-goals',event=>{nutritionGoals=event.detail?.goals??[];ownGoal=event.detail?.own??null;renderMeals();});
function ownGoalForm(){
 const form=node('form',undefined,'own-goal-form'),fields=node('div',undefined,'meal-numbers');
 const field=(id,label,unit,min,max,step,value,required)=>{const box=node('label',label+' ');box.append(node('span',unit,'optional'));const input=node('input');input.type='number';input.id=id;input.min=min;input.max=max;input.step=step;input.required=required;input.inputMode='decimal';input.value=value??'';box.append(input);fields.append(box);return input;};
 const kcal=field('own-kcal','พลังงาน','kcal/วัน',1,20000,1,ownGoal?.calories,true),protein=field('own-protein','โปรตีน','g/วัน',0.1,1000,0.1,ownGoal?.protein,true),carbs=field('own-carbs','คาร์บ','g/วัน',0,3000,0.1,ownGoal?.carbs,false);
 const save=node('button',ownGoal?'บันทึกเป้าหมาย':'ตั้งเป้าหมาย','primary');save.type='submit';
 const cancel=node('button','ยกเลิก','quiet');cancel.type='button';cancel.onclick=()=>{ownGoalOpen=false;renderMeals();};
 const actions=node('div',undefined,'own-goal-actions');actions.append(save,cancel);
 if(ownGoal){const clear=node('button','ลบเป้าหมาย','quiet own-goal-clear');clear.type='button';clear.onclick=async()=>{if(!confirm('ลบเป้าหมายของคุณ?'))return;try{await api('/api/nutrition',{method:'PUT',body:JSON.stringify({clear:true})});ownGoal=null;ownGoalOpen=false;renderMeals();tell('ลบเป้าหมายแล้ว');}catch(error){tell(error.message);}};actions.append(clear);}
 const message=node('p',undefined,'muted');message.setAttribute('role','status');
 form.append(node('strong','เป้าหมายต่อวันของฉัน'),fields,node('small','ไม่รู้จะตั้งเท่าไหร่ ถามเทรนเนอร์ หรือเริ่มจากน้ำหนักตัว (กก.) × 30 kcal และโปรตีน × 1.6 g','muted'),actions,message);
 form.onsubmit=async event=>{
  event.preventDefault();save.disabled=true;message.textContent='กำลังบันทึก…';
  try{const result=await api('/api/nutrition',{method:'PUT',body:JSON.stringify({calories:Number(kcal.value),protein:Number(protein.value),carbs:carbs.value===''?null:Number(carbs.value)})});ownGoal=result.own;ownGoalOpen=false;renderMeals();tell('บันทึกเป้าหมายแล้ว');}
  catch(error){message.textContent=error.message;save.disabled=false;}
 };
 return form;
}
function renderFoodToday(meals,day){
 const box=$('food-today'),totals=dayTotals(meals),trainerGoal=nutritionGoals[0],goal=trainerGoal??ownGoal;
 const isToday=day===localDay(),title=isToday?'วันนี้':new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
 const head=node('div',undefined,'food-today-head');head.append(node('p','FOOD DIARY · '+title,'eyebrow'),node('h2',meals.length?meals.length+' มื้อ':'ยังไม่มีมื้อ'));
 const chips=node('div',undefined,'food-meal-chips');
 for(const meal of ['มื้อเช้า','มื้อกลางวัน','มื้อเย็น','ของว่าง','เครื่องดื่ม']){const n=meals.filter(r=>r.meal===meal).length;if(n)chips.append(node('span',meal+(n>1?' ×'+n:'')));}
 head.append(chips);
 const bars=node('div',undefined,'intake-bars');
 const bar=(label,value,target,unit)=>{
  const row=node('div',undefined,'intake-row'),p=progress(value,target),top=node('div',undefined,'intake-top');
  top.append(node('span',label),node('strong',value.toLocaleString('th-TH')+(target?' / '+Number(target).toLocaleString('th-TH'):'')+' '+unit));
  row.append(top);
  if(p){const track=node('div',undefined,'intake-track'+(p.over?' over':''));const fill=node('span');fill.style.width=(p.ratio*100).toFixed(1)+'%';track.append(fill);track.setAttribute('role','progressbar');track.setAttribute('aria-valuenow',String(p.percent));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-label',label+' '+p.percent+'% ของเป้าหมาย');row.append(track,node('small',p.over?'เกินเป้า '+(p.percent-100)+'%':'เหลือ '+Math.max(0,Math.round((target-value)*10)/10).toLocaleString('th-TH')+' '+unit,'muted'));}
  return row;
 };
 bars.append(bar('พลังงาน',totals.kcal,goal?.calories,'kcal'),bar('โปรตีน',totals.protein,goal?.protein,'g'),bar('คาร์บ',totals.carbs,goal?.carbs,'g'));
 const notes=node('div',undefined,'food-today-notes');
 if(trainerGoal)notes.append(node('small','เป้าหมายจาก '+trainerGoal.trainer_name+' · '+trainerGoal.team_name,'muted'));
 else{
  // No trainer goal: the member manages their own.
  const line=node('div',undefined,'own-goal-line');
  line.append(node('small',ownGoal?'เป้าหมายที่คุณตั้งเอง':'ยังไม่มีเป้าหมาย · ตั้งเองได้ หรือรอเทรนเนอร์กำหนดให้','muted'));
  const open=node('button',ownGoal?'แก้เป้าหมาย':'ตั้งเป้าหมายเอง','quiet own-goal-open');open.type='button';open.onclick=()=>{ownGoalOpen=true;renderMeals();};
  if(!ownGoalOpen)line.append(open);
  notes.append(line);
 }
 if(totals.missing)notes.append(node('small',totals.missing+' มื้อยังไม่ได้ใส่ตัวเลข จึงยังไม่รวมในยอด','food-today-missing'));
 box.replaceChildren(head,bars,notes,...(!trainerGoal&&ownGoalOpen?[ownGoalForm()]:[]));
}
// Foods eaten often (a tap fills the form) and copying the day before's meals.
function renderMealShortcuts(day){
 const box=$('meal-shortcuts');box.replaceChildren();
 const copies=previousDayCopies(records,day);
 if(copies.length){
  const before=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(previousDay(day)+'T12:00:00'));
  const copy=node('button','⎘ คัดลอก '+copies.length+' มื้อจาก'+(day===localDay()?'เมื่อวาน':' '+before),'meal-copy');copy.type='button';
  copy.onclick=async()=>{
   if(!confirm('คัดลอกมื้อเหล่านี้มาที่'+(day===localDay()?'วันนี้':'วันที่เลือก')+'?\n\n'+copies.map(r=>'• '+r.meal+(r.time?' '+r.time:'')+': '+r.text.split(/\r?\n/)[0].slice(0,60)).join('\n')+'\n\nแก้หรือลบทีละมื้อได้หลังคัดลอก'))return;
   copy.disabled=true;
   if(await saveRecords([...records,...previousDayCopies(records,day)])){render();tell('คัดลอก '+copies.length+' มื้อแล้ว');}else copy.disabled=false;
  };
  box.append(copy);
 }
 const frequent=frequentMeals(records,day);
 if(frequent.length){
  const chips=node('div',undefined,'meal-frequent');chips.setAttribute('role','group');chips.setAttribute('aria-label','อาหารที่กินบ่อย');
  chips.append(node('span','กินบ่อย','meal-frequent-label'));
  for(const food of frequent){
   const chip=node('button',undefined,'meal-chip');chip.type='button';
   chip.append(node('span',food.text.split(/\r?\n/)[0]),...(food.kcal!=null?[node('small',food.kcal+' kcal')]:[]));
   chip.title=food.text;chip.setAttribute('aria-label','จดมื้อ: '+food.text.split(/\r?\n/)[0]+' (กินมาแล้ว '+food.count+' ครั้ง)');
   chip.onclick=()=>{
    reset();openMealForm();
    // Today the meal follows the clock; another day keeps the meal this food is usually eaten at.
    $('meal').value=day===localDay()?(mealForTime($('time').value)||food.meal):food.meal;
    $('details').value=food.text;$('meal-kcal').value=food.kcal??'';$('meal-protein').value=food.protein??'';$('meal-carbs').value=food.carbs??'';
    document.querySelectorAll('[name="workout-timing"]').forEach(input=>input.checked=input.value===(food.workoutTiming||''));
    count();$('details').setCustomValidity('');$('details').focus({preventScroll:true});
   };
   chips.append(chip);
  }
  box.append(chips);
 }
}
function openMealForm(){
 $('meal-compose').hidden=false;$('meal-add-open').hidden=true;
 requestAnimationFrame(()=>{$('meal-compose').scrollIntoView({behavior:'smooth',block:'start'});});
}
function closeMealForm(){$('meal-compose').hidden=true;$('meal-add-open').hidden=false;}
function renderMeals(){
 const day=$('day').value;if(!day)return;
 $('date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 $('list-title').textContent=day===localDay()?'มื้อของวันนี้':'มื้อของวันที่เลือก';
 const meals=records.filter(r=>r.day===day&&r.kind!=='workout').sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 $('total').textContent=meals.length+' รายการ';$('entries').replaceChildren();
 renderFoodToday(meals,day);renderMealShortcuts(day);
 if(!meals.length){const box=node('div',undefined,'empty');box.append(node('span','+','empty-symbol'),node('h3','ยังไม่มีมื้อที่บันทึก'),node('p','กด "+ เพิ่มมื้อ" เพื่อจดมื้อแรกของวัน'));$('entries').append(box);return;}
 for(const r of meals){const card=node('article',undefined,'entry');card.dataset.id=r.id;const top=node('div',undefined,'entry-top');top.append(node('h3',r.meal));if(r.time)top.append(node('time',r.time));card.append(top);if(r.workoutTiming)card.append(node('span',r.workoutTiming==='pre-workout'?'Pre-workout · ก่อนฝึก':'Post-workout · หลังฝึก','meal-timing-badge'));card.append(node('p',r.text,'entry-text'));
  const numbers=mealNumbers(r);if(numbers)card.append(node('p',numbers,'meal-numbers-line'));
  const actions=node('div',undefined,'entry-actions');const edit=node('button','แก้ไข');edit.type='button';edit.setAttribute('aria-label','แก้ไข '+r.meal+' '+r.time);edit.onclick=()=>{editing=r.id;openMealForm();$('meal').value=r.meal;$('time').value=r.time;$('details').value=r.text;$('meal-kcal').value=r.kcal??'';$('meal-protein').value=r.protein??'';$('meal-carbs').value=r.carbs??'';document.querySelectorAll('[name="workout-timing"]').forEach(input=>input.checked=input.value===(r.workoutTiming||''));$('form-title').textContent='แก้ไขมื้ออาหาร';$('save').textContent='บันทึกการแก้ไข';count();$('details').focus({preventScroll:true});};const del=node('button','ลบ','delete');del.type='button';del.setAttribute('aria-label','ลบ '+r.meal+' '+r.time);del.onclick=async()=>{if(confirm('ลบรายการ '+r.meal+' นี้ไหม?')){if(await saveRecords(records.filter(x=>x.id!==r.id))){if(editing===r.id)reset();render();tell('ลบรายการแล้ว');}}};actions.append(edit,del);card.append(actions);$('entries').append(card);}
}
function count(){$('count').textContent=$('details').value.length.toLocaleString('en-US')+' / 3,000';}
function updateTrainingType(){window.dispatchEvent(new Event('workout-type-change'));const cardio=$('training-type').value==='cardio';$('strength-fields').hidden=cardio;$('cardio-fields').hidden=!cardio;for(const id of ['weight','sets','reps'])$(id).disabled=cardio;workoutWeight.select.disabled=cardio;for(const id of ['duration','distance','incline','speed'])$(id).disabled=!cardio;$('duration').required=cardio;$('exercise').placeholder=cardio?'ค้นหา เช่น เดิน วิ่ง ปั่นจักรยาน':'ค้นหาชื่อท่า เช่น squat หรือ ขา';workoutPairs?.sync();}
$('training-type').addEventListener('change',updateTrainingType);updateTrainingType();
$('exercise').addEventListener('change',()=>{if(/^HIIT(?:\s|$)/i.test($('exercise').value.trim())){$('training-type').value='cardio';updateTrainingType();}});
workoutPairs=initWorkoutPairs({form:$('workout-form'),anchor:$('strength-fields'),isEditing:()=>!!workoutEditing});
const anatomyBrowser=node('section',undefined,'diary workout-anatomy');anatomyBrowser.id='workout-anatomy';
anatomyBrowser.append(createAnatomyPicker({compact:true,actionLabel:'เลือกท่านี้',onChoose:exercise=>{
 if(workoutEditing&&!confirm('กำลังแก้ไขรายการ ต้องการเปลี่ยนเป็นบันทึกท่าใหม่ไหม?'))return false;
 resetWorkout();openWorkoutComposer();$('training-type').value='strength';updateTrainingType();$('exercise').value=exercise.name;
 $('exercise').dispatchEvent(new Event('change'));$('workout-form-title').textContent='บันทึกผล · '+exercise.name;
 $('workout-form').scrollIntoView({behavior:'smooth',block:'start'});$('weight').focus({preventScroll:true});
}}));workoutComposer.before(anatomyBrowser);
const workoutHistory=$('workout-list-title').closest('section');workoutHistory.id='workout-history';$('workout-list-title').textContent='ผลการฝึกที่บันทึกแล้ว';
const workoutNav=node('div',undefined,'workout-section-nav');workoutNav.setAttribute('role','group');workoutNav.setAttribute('aria-label','เมนูหน้าฝึก');
const programPanel=node('section',undefined,'workout-program');programPanel.id='workout-program';
const dailyPlans=node('section',undefined,'diary training-entry');
// Personal programs are managed on their own full screen, opened from the button beside the page title.
const personalEditor=node('div');
const programSheet=node('section',undefined,'program-sheet');programSheet.hidden=true;programSheet.setAttribute('aria-label','จัดการโปรแกรมฝึก');
const sheetBar=node('div',undefined,'program-sheet-bar'),sheetBack=node('button','‹ กลับ','program-sheet-back');sheetBack.type='button';
sheetBar.append(sheetBack,node('strong','จัดการโปรแกรมฝึก'));programSheet.append(sheetBar,personalEditor);document.body.append(programSheet);
let personalPlanner=null;
function openProgramSheet({create=false}={}){
 programSheet.hidden=false;document.body.classList.add('ts-open');programSheet.scrollTop=0;
 loadPersonalPlanner().then(()=>{if(create)personalPlanner?.create();});
}
function closeProgramSheet(){programSheet.hidden=true;document.body.classList.remove('ts-open');}
sheetBack.onclick=closeProgramSheet;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!programSheet.hidden)closeProgramSheet();});
$('program-manage-open').onclick=()=>openProgramSheet();
async function loadPersonalPlanner(){
 if(!profileId||personalEditor.dataset.state)return;
 personalEditor.dataset.state='loading';
 personalEditor.replaceChildren(node('p','กำลังโหลดโปรแกรมส่วนตัว…','muted'));
 const host=node('div');
 try{
  personalPlanner=await trainerPlanner(host,null,null,{day:$('day').value||localDay(),scroll:false,draftKey:'banmeaw-plan-draft:personal:'+profileId,onSaved:firstDay=>{refreshEnding();if(firstDay&&firstDay!==$('day').value)selectDay(firstDay);else refreshDailyPlans();}});
  personalEditor.replaceChildren(host);personalEditor.dataset.state='ready';
 }catch(error){
  const retry=node('button','ลองโหลดอีกครั้ง','quiet');retry.type='button';retry.onclick=()=>{delete personalEditor.dataset.state;loadPersonalPlanner();};
  personalEditor.replaceChildren(node('p','โหลดโปรแกรมส่วนตัวไม่สำเร็จ · '+error.message,'muted'),retry);personalEditor.dataset.state='failed';
 }
}
// A reminder above the week view when the personal program is about to run out (or just has).
const endingBox=node('div',undefined,'program-ending-slot');let endingChecked=false;
async function refreshEnding(){
 if(!profileId)return;endingChecked=true;
 try{
  const {plans}=await api('/api/personal-plans'),ending=programEnding(plans,localDay());
  const notice=ending&&endingNotice(ending,{subject:'โปรแกรมส่วนตัว',onAction:()=>openProgramSheet({create:true}),dismissKey:'banmeaw-ending-hidden:personal:'+profileId});
  endingBox.replaceChildren(...(notice?[notice]:[]));
 }catch{endingChecked=false;}
}
function refreshDailyPlans(){if(!endingChecked)refreshEnding();return showDailyPlans(dailyPlans,$('day').value||localDay(),{records,onStart:startPlanExercise,onSelectDay:selectDay});}
programPanel.append(endingBox,dailyPlans);
anatomyBrowser.before(programPanel);
const workoutSections=[['program','โปรแกรมฝึก',programPanel],['pick','เลือกท่า',anatomyBrowser],['log','บันทึกผล',workoutComposer],['history','ประวัติ',workoutHistory]].map(([key,title,panel])=>{
 const button=node('button',title);button.type='button';button.setAttribute('aria-controls',panel.id);button.onclick=()=>{showWorkoutSection(key);if(key==='program')openTodayPlans();if(panel.getBoundingClientRect().top<workoutNav.getBoundingClientRect().bottom)panel.scrollIntoView({block:'start'});};workoutNav.append(button);return {key,button,panel};
});
// The program tab always opens on today: only today's plan can be trained.
function openTodayPlans(){if($('day').value!==localDay())selectDay(localDay());}
document.querySelectorAll('[data-view="workout"]').forEach(b=>b.addEventListener('click',()=>{if(!programPanel.hidden)openTodayPlans();}));
programPanel.before(workoutNav);workoutComposer.open=true;workoutComposer.classList.add('workout-section-composer');showWorkoutSection('program');
function showWorkoutSection(key){
 for(const entry of workoutSections){const active=entry.key===key;entry.panel.hidden=!active;entry.button.setAttribute('aria-pressed',String(active));}
}
function resetWorkout(){$('weight').required=false;workoutEditing=null;workoutPlan=null;$('workout-form').reset();workoutEffort.set(false);updateTrainingType();$('workout-form-title').textContent='เพิ่มท่าออกกำลังกาย';$('workout-save').textContent='บันทึกท่าออกกำลังกาย';$('workout-cancel').hidden=true;}
function render(){renderMeals();renderWorkouts();renderDashboard(records,$('day').value);window.dispatchEvent(new CustomEvent('diary-records',{detail:records}));}
function renderWorkouts(){
 const day=$('day').value;if(!day)return;
 $('workout-date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 refreshDailyPlans();
 const rows=records.filter(r=>r.kind==='workout'&&r.day===day);$('workout-total').textContent=rows.length+' รายการ';$('workout-entries').replaceChildren();
 if(!rows.length){const box=node('div',undefined,'empty'),add=node('button','บันทึกท่าที่ฝึก','quiet');add.type='button';add.onclick=()=>{openWorkoutComposer();$('exercise').focus();};box.append(node('h3','ยังไม่มีผลการฝึกของวันนี้'),add);$('workout-entries').append(box);return;}
 renderWorkoutGroups($('workout-entries'),rows,r=>{
  const card=node('article',undefined,'entry');card.dataset.id=r.id;card.append(node('span',r.trainingType==='cardio'?'คาร์ดิโอ':'เวท / น้ำหนักตัว','meal-timing-badge'));const pr=personalRecord(records,r);if(pr){const badge=node('span','🏆 PR','pr-badge');badge.title='สถิติใหม่: '+pr.label;card.append(badge);}card.append(node('h3',r.exercise));
  const metrics=node('div',undefined,'workout-metrics');for(const [label,value] of (r.trainingType==='cardio'?[['เวลา',r.duration+' นาที'],['ระยะทาง',r.distance==null?'ไม่ระบุ':r.distance+' กม.'],['ความชัน',r.incline==null?'ไม่ระบุ':r.incline+'%'],['ความเร็ว',r.speed==null?'ไม่ระบุ':r.speed+' กม./ชม.']]:[['น้ำหนัก',formatLoggedWeight(r)],['เซ็ต',r.sets===null?'ไม่ระบุ':String(r.sets)],r.seconds!=null?['เวลา / เซ็ต',formatSeconds(r.seconds)]:['ครั้ง / เซ็ต',r.reps===null?'ไม่ระบุ':String(r.reps)]])){const metric=node('div');metric.append(node('span',label),node('strong',value));metrics.append(metric);}card.append(metrics);if(r.setLogs?.length){const fold=node('details'),list=node('ol');fold.append(node('summary','ดูผลแต่ละเซ็ต'+(r.sessionComplete===false?' · ยังฝึกไม่ครบ':'')));for(const set of r.setLogs)list.append(node('li',(set.weight==null?'ไม่ระบุน้ำหนัก':formatLoggedWeight(set))+' · '+effortText(set)));fold.append(list);card.append(fold);}if(r.notes)card.append(node('p',r.notes,'entry-text'));
  if(r.trainingType!=='cardio'){
   const historyFold=node('details',undefined,'workout-history-fold'),historySummary=node('summary','ดูกราฟน้ำหนักและจำนวนครั้งย้อนหลัง');
   historySummary.setAttribute('aria-label','ดูกราฟประวัติ '+r.exercise);historyFold.append(historySummary);
   let history=null;
   historyFold.addEventListener('toggle',()=>{if(!historyFold.open)return;if(!history){history=createExerciseHistory();historyFold.append(history.element);}history.update(records,r.exercise,'strength',day);});
   card.append(historyFold);
  }
  const actions=node('div',undefined,'entry-actions'),edit=node('button','แก้ไข'),del=node('button','ลบ','delete');edit.type=del.type='button';edit.setAttribute('aria-label','แก้ไขท่า '+r.exercise);del.setAttribute('aria-label','ลบท่า '+r.exercise);
  edit.onclick=()=>{workoutPairs.clear();openWorkoutComposer();workoutEditing=r.id;workoutPlan=r.planId?{planId:r.planId,planExerciseIndex:r.planExerciseIndex,exercise:r.exercise}:null;$('training-type').value=r.trainingType||'strength';updateTrainingType();$('duration').value=r.duration??'';$('distance').value=r.distance??'';$('incline').value=r.incline??'';$('speed').value=r.speed??'';$('exercise').value=r.exercise;workoutWeight.set(r.weight,r.weightUnit);$('sets').value=r.sets??'';workoutEffort.set(r.seconds!=null);$('reps').value=r.seconds??r.reps??'';$('workout-notes').value=r.notes;$('workout-form-title').textContent='แก้ไขท่าออกกำลังกาย';$('workout-save').textContent='บันทึกการแก้ไข';$('workout-cancel').hidden=false;diaryTools.updatePrevious();workoutPairs.resume(r,records);$('exercise').focus();$('workout-form').scrollIntoView({behavior:'smooth',block:'center'});};
  del.onclick=async()=>{if(confirm('ลบท่า '+r.exercise+' นี้ไหม?')&&await saveRecords(records.filter(x=>x.id!==r.id))){if(workoutEditing===r.id)resetWorkout();render();tell('ลบรายการออกกำลังกายแล้ว');}};actions.append(edit,del);card.append(actions);return card;
 },{onDeleteGroup:async members=>{
  if(saving)return;
  if(!confirm('ลบ Super set กลุ่มนี้ทั้งหมด '+members.length+' ท่าใช่ไหม?'))return;
  const ids=new Set(members.map(r=>r.id));
  if(await saveRecords(records.filter(r=>!ids.has(r.id)))){if(ids.has(workoutEditing))resetWorkout();render();tell('ลบ Super set ทั้งกลุ่มแล้ว');}
 }});
}
function startPlanExercise({plan,target,index,actual}){
 const partial=records.find(r=>r.day===plan.day&&r.planId===plan.id&&r.planExerciseIndex===index);
 resetWorkout();openWorkoutComposer();workoutEditing=actual?.id??partial?.id??null;
 workoutPlan={planId:plan.id,planExerciseIndex:index,exercise:target.exercise};
 const row=actual??partial??target;switchView('workout');
 $('training-type').value=row.trainingType||'strength';updateTrainingType();
 $('exercise').value=target.exercise;diaryTools.setRest(target.rest_seconds??60);diaryTools.updatePrevious();
 for(const key of ['weight','sets','reps','duration','distance','incline','speed'])$(key).value=row[key]??'';workoutWeight.set(row.weight,row.weightUnit);
 const timed=(row.seconds??target.seconds)!=null;workoutEffort.set(timed);if(timed)$('reps').value=row.seconds??target.seconds;
 $('workout-notes').value=row.notes??'';
 $('workout-form-title').textContent=(actual?'แก้ไขผล: ':'บันทึกผล: ')+target.exercise;
 $('workout-cancel').hidden=false;$('workout-form').scrollIntoView({behavior:'smooth',block:'start'});$('weight').focus();
}
function fillWorkoutDraft(row){
 resetWorkout();openWorkoutComposer();
 $('training-type').value=row.trainingType||'strength';updateTrainingType();
 $('exercise').value=row.exercise;
 for(const key of ['sets','reps','duration','distance','incline','speed'])$(key).value=row[key]??'';
 workoutWeight.set(row.weight,row.weightUnit);
 $('workout-notes').value=row.notes||'';
 $('exercise').setCustomValidity('');
 $('workout-cancel').hidden=false;
 $('exercise').dispatchEvent(new Event('change'));
}
function copyTeamWorkout(source){
 if(saving)return {error:'กำลังบันทึก กรุณาลองอีกครั้ง'};
 if(workoutEditing&&!confirm('ออกจากการแก้ไขในฟอร์มเพื่อเปิดท่าที่คัดลอกไหม?'))return {};
 if(!trainingSession.leave())return {error:'กำลังบันทึกผลจากแผนฝึก กรุณาลองอีกครั้ง'};
 const {exercise,trainingType,sets,reps,duration,distance,incline,speed}=source;
 switchView('workout');
 fillWorkoutDraft({exercise,trainingType,sets,reps,duration,distance,incline,speed,weightUnit:preferredWeightUnit()});
 const cardio=$('training-type').value==='cardio';
 $('workout-form-title').textContent='คัดลอกท่า · '+exercise;
 diaryTools.setStatus('workout-form','','แก้ค่าการฝึกก่อนบันทึกได้');
 $('workout-form').scrollIntoView({block:'start'});
 $(cardio?'duration':'weight').focus({preventScroll:true});
 return {};
}
function copyAllTeamWorkouts(source,member){
 openTeamWorkoutCopy({source,member,day:localDay(),history:records,
  save:rows=>{
   const ids=new Set(rows.map(row=>row.id));
   return saveRecords([...records.filter(row=>!ids.has(row.id)),...rows]);
  },
  onSaved:rows=>{
   if($('day').value!==rows[0].day){$('day').value=rows[0].day;$('day').dispatchEvent(new Event('change'));}
   trainingSession.leave();
   switchView('workout');showWorkoutSection('history');
   tell('บันทึกท่าที่คัดลอกแล้ว '+rows.length+' ท่า');
   $('workout-history').scrollIntoView({block:'start'});
  }
 });
}
function switchPanel(workout){switchView(workout?'workout':'food');}
$('workout-cancel').onclick=()=>{resetWorkout();showWorkoutSection('history');workoutNav.scrollIntoView({block:'nearest'});};
$('exercise').addEventListener('input',()=>$('exercise').setCustomValidity(''));
$('workout-form').addEventListener('submit',async e=>{
 e.preventDefault();const exercise=$('exercise').value.trim(),day=$('day').value;if(!exercise){$('exercise').setCustomValidity('กรุณาใส่ชื่อท่า');$('exercise').reportValidity();return;}if(!day){$('day').reportValidity();return;}
 const number=id=>$(id).value===''?null:Number($(id).value);
 const row={...(workoutPlan?.exercise===exercise?{planId:workoutPlan.planId,planExerciseIndex:workoutPlan.planExerciseIndex}:{}),id:workoutEditing||crypto.randomUUID(),kind:'workout',day,exercise,trainingType:$('training-type').value,duration:$('training-type').value==='cardio'?number('duration'):null,incline:$('training-type').value==='cardio'?number('incline'):null,speed:$('training-type').value==='cardio'?number('speed'):null,distance:$('training-type').value==='cardio'?number('distance'):null,...($('training-type').value==='cardio'?{weight:null}:workoutWeight.read()),sets:$('training-type').value==='cardio'?null:number('sets'),...($('training-type').value==='cardio'?{reps:null}:workoutEffort.read()),notes:$('workout-notes').value.trim()};
 const previous=records.find(r=>r.id===row.id);if(previous?.supersetId&&row.trainingType==='strength')row.supersetId=previous.supersetId;
 if(previous?.setLogs?.length&&previous.exercise===row.exercise&&previous.trainingType===row.trainingType&&previous.planId===row.planId&&
  previous.weight===row.weight&&(previous.weightUnit??'kg')===(row.weightUnit??'kg')&&previous.sets===row.sets&&previous.reps===row.reps&&(previous.seconds??null)===(row.seconds??null)){
  row.setLogs=previous.setLogs;
  if(previous.sessionComplete!==undefined)row.sessionComplete=previous.sessionComplete;
 }
 const batch=workoutPairs.rows(row);workoutEditing=row.id;const replacements=new Map(batch.map(r=>[r.id,r])),existingIds=new Set(records.map(r=>r.id));const next=[...records.map(r=>replacements.get(r.id)||r),...batch.filter(r=>!existingIds.has(r.id))];if(await saveRecords(next,'workout-form')){resetWorkout();showWorkoutSection('history');render();workoutNav.scrollIntoView({block:'nearest'});tell('บันทึกท่าออกกำลังกายแล้ว');diaryTools.setStatus('workout-form','success','บันทึกท่าออกกำลังกายแล้ว ✓');}
});
$('time').addEventListener('change',()=>{const meal=mealForTime($('time').value);if(meal)$('meal').value=meal;});
$('meal').addEventListener('change',()=>{const start={'มื้อเช้า':'08:00','มื้อกลางวัน':'12:00','มื้อเย็น':'16:00'}[$('meal').value];if(start)$('time').value=start;});
$('details').addEventListener('input',count);
$('meal-form').addEventListener('submit',async e=>{e.preventDefault();const text=$('details').value.trim(),day=$('day').value;if(!text){$('details').setCustomValidity('กรุณาใส่รายละเอียดอาหาร');$('details').reportValidity();return;}if(!day){$('day').reportValidity();return;}const number=(id,parse)=>$(id).value===''?undefined:parse($(id).value);
 const row={id:editing||crypto.randomUUID(),day,meal:$('meal').value,time:$('time').value,text,workoutTiming:document.querySelector('[name="workout-timing"]:checked').value,kcal:number('meal-kcal',v=>Math.round(Number(v))),protein:number('meal-protein',v=>Math.round(Number(v)*10)/10),carbs:number('meal-carbs',v=>Math.round(Number(v)*10)/10)};
 for(const id of ['meal-kcal','meal-protein','meal-carbs'])if(!$(id).reportValidity())return;editing=row.id;const next=[...records.filter(r=>r.id!==row.id),row];if(await saveRecords(next,'meal-form')){reset();render();tell('บันทึกเรียบร้อยแล้ว');diaryTools.setStatus('meal-form','success','บันทึกมื้ออาหารแล้ว ✓');}});
$('details').addEventListener('input',()=>$('details').setCustomValidity(''));
$('cancel').onclick=reset;$('meal-add-open').onclick=()=>{reset();openMealForm();$('details').focus({preventScroll:true});};$('day').onchange=()=>{reset();render();};
function selectDay(day){if($('day').value===day)return;$('day').value=day;$('day').dispatchEvent(new Event('change'));}
function moveDay(offset){const d=new Date(($('day').value||localDay())+'T12:00:00');d.setDate(d.getDate()+offset);selectDay(localDay(d));}
$('prev').onclick=()=>moveDay(-1);$('next').onclick=()=>moveDay(1);$('today').onclick=()=>selectDay(localDay());
$('export').onclick=()=>{if(!storageOK){tell('อ่านข้อมูลเดิมไม่ได้ จึงยังสำรองไม่ได้ กรุณาลองเปิดใหม่');return;}const blob=new Blob([JSON.stringify({version:2,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='meal-diary-'+localDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);tell('ส่งออกข้อมูลแล้ว เก็บไฟล์นี้ไว้สำหรับนำเข้าภายหลัง');};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>15000000)throw new Error('ไฟล์ใหญ่เกินไป');const payload=JSON.parse(await file.text());if(![1,2].includes(payload.version))throw new Error('ไม่รองรับไฟล์นี้');const incoming=validateRecords(payload.records);if(!confirm('นำเข้า '+incoming.length+' รายการ? ข้อมูลเดิมจะยังอยู่ และรายการที่ซ้ำจะไม่ถูกเพิ่ม'))return;if(await saveRecords(mergeRecords(records,incoming))){render();tell('นำเข้าข้อมูลเรียบร้อยแล้ว');}}catch{tell('นำเข้าไม่สำเร็จ กรุณาเลือกไฟล์สำรองจากเว็บนี้ ข้อมูลเดิมยังอยู่');}finally{e.target.value='';}};
render();
const authMessage=document.getElementById('auth-message');
const accountForm=document.getElementById('account-form');
let signup=false,googleLoginReady=false;
document.getElementById('account-toggle').onclick=()=>{signup=!signup;document.getElementById('account-name-field').hidden=!signup;document.getElementById('account-name').required=signup;document.getElementById('account-title').textContent=signup?'สมัครสมาชิก':'เข้าสู่ระบบ';document.getElementById('account-submit').textContent=signup?'สมัครสมาชิก':'เข้าสู่ระบบ';document.getElementById('account-toggle').textContent=signup?'มีบัญชีแล้ว เข้าสู่ระบบ':'ยังไม่มีบัญชี? สมัครสมาชิก';document.getElementById('account-password').autocomplete=signup?'new-password':'current-password';};
accountForm.onsubmit=async event=>{event.preventDefault();const button=document.getElementById('account-submit');button.disabled=true;authMessage.textContent='กำลังดำเนินการ…';try{const email=document.getElementById('account-email').value.trim(),password=document.getElementById('account-password').value;const result=signup?await auth.signUp.email({email,password,name:document.getElementById('account-name').value.trim()}):await auth.signIn.email({email,password});if(result.error)throw Error(result.error.message);const session=await auth.getSession();if(session.data?.user)location.reload();else authMessage.textContent='สมัครแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชี แล้วเข้าสู่ระบบ';}catch(error){authMessage.textContent=error.message||'เข้าสู่ระบบไม่สำเร็จ';}finally{button.disabled=false;}};
document.getElementById('google-signin').onclick=async()=>{const button=document.getElementById('google-signin');button.disabled=true;authMessage.textContent='กำลังไปหน้า Google…';try{if(googleLoginReady)location.assign('/api/google/start');else await signInWithGoogle(auth,location.origin,url=>location.assign(url));}catch(error){authMessage.textContent=error.message||'เข้าสู่ระบบด้วย Google ไม่สำเร็จ';button.disabled=false;}};
document.getElementById('account-logout').onclick=async()=>{if(saving)return;try{const result=await auth.signOut();if(result.error)throw Error(result.error.message);location.reload();}catch(error){tell(error.message);}};
document.getElementById('refresh-data').onclick=async()=>{if(saving)return;try{await loadRecords();tell('โหลดข้อมูลล่าสุดแล้ว');}catch(error){tell(error.message);}};
document.getElementById('migrate-local').onclick=async()=>{if(!legacyRecords.length||!confirm('นำ '+legacyRecords.length+' รายการจากเครื่องนี้เข้าในบัญชีปัจจุบัน?'))return;if(await saveRecords(mergeRecords(records,legacyRecords)))tell('นำข้อมูลในเครื่องเข้าบัญชีแล้ว ข้อมูลเดิมในเครื่องยังอยู่');};
document.getElementById('send-code').onclick=async()=>{const email=document.getElementById('account-email').value.trim();if(!email||!document.getElementById('account-email').reportValidity())return;const button=document.getElementById('send-code');button.disabled=true;try{const result=await auth.emailOtp.sendVerificationOtp({email,type:'email-verification'});if(result.error)throw Error(result.error.message);document.getElementById('verify-form').hidden=false;authMessage.textContent='กรอกรหัสจากอีเมลเพื่อยืนยันบัญชี';}catch(error){authMessage.textContent=error.message;}finally{button.disabled=false;}};
document.getElementById('verify-form').onsubmit=async event=>{event.preventDefault();const button=document.getElementById('verify-submit');button.disabled=true;try{const result=await auth.emailOtp.verifyEmail({email:document.getElementById('account-email').value.trim(),otp:document.getElementById('verify-code').value.trim()});if(result.error)throw Error(result.error.message);document.getElementById('verify-form').hidden=true;authMessage.textContent='ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ';}catch(error){authMessage.textContent=error.message;}finally{button.disabled=false;}};
function showAccount(me){
 const label=document.getElementById('account-label'),name=document.createElement('span');name.className='account-display-name';name.textContent=me.display_name;label.replaceChildren(name);if(!me.member_code)return;
 const chip=document.createElement('button');chip.type='button';chip.className='id-chip';chip.title='คัดลอก ID';chip.setAttribute('aria-label','คัดลอก ID '+me.member_code);
 const text=document.createElement('span');text.textContent='ID '+me.member_code;
 chip.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/></svg>';chip.prepend(text);
 chip.onclick=async()=>{try{await navigator.clipboard.writeText(me.member_code);text.textContent='คัดลอกแล้ว ✓';}catch{text.textContent=me.member_code;}chip.classList.add('copied');setTimeout(()=>{text.textContent='ID '+me.member_code;chip.classList.remove('copied');},1600);};
 const qr=node('button','QR','id-chip');qr.type='button';qr.setAttribute('aria-label','แสดง QR สมาชิกของฉัน');
 qr.onclick=async()=>{
  qr.disabled=true;
  try{const {openMemberQr}=await import('./member-qr.mjs?v=3');openMemberQr({code:me.member_code});}
  catch{tell('เปิด QR ไม่สำเร็จ กรุณาลองอีกครั้ง');}
  finally{qr.disabled=false;}
 };
 label.append(chip,qr);
}
const inviteParams=new URLSearchParams(location.search);
const inviteKey='banmeaw-team-invite';
const joinTeam=inviteParams.get('joinTeam'),inviteToken=inviteParams.get('invite');
if(joinTeam&&inviteToken){
 try{sessionStorage.setItem(inviteKey,JSON.stringify({team:joinTeam,token:inviteToken}));}catch{}
}
async function joinPendingTeam(){
 let pending=joinTeam&&inviteToken?{team:joinTeam,token:inviteToken}:null;
 try{pending??=JSON.parse(sessionStorage.getItem(inviteKey));}catch{}
 if(!pending)return;
 switchView('team');
 const status=$('team-message');
 if(!confirm('เข้าทีมจาก QR ที่สแกนหรือไม่?')){
  clearInvite();
  return;
 }
 status.textContent='กำลังเข้าทีม…';
 try{
  await api('/api/teams/'+encodeURIComponent(pending.team)+'/join-qr',{method:'POST',body:JSON.stringify({token:pending.token})});
  clearInvite();
  try{await loadTeams();status.textContent='เข้าทีมแล้ว';}
  catch{status.textContent='เข้าทีมแล้ว แตะเมนูทีมเพื่อโหลดรายชื่ออีกครั้ง';}
 }catch(error){status.textContent=error.message;}
}
function clearInvite(){
 try{sessionStorage.removeItem(inviteKey);}catch{}
 const url=new URL(location.href);
 url.searchParams.delete('joinTeam');url.searchParams.delete('invite');
 history.replaceState(history.state,'',url);
}
async function boot(){
 try{const config=await fetch('/api/config').then(r=>r.json());googleLoginReady=config.googleLoginReady===true;if(!config.ready)throw Error('ระบบสมาชิกยังไม่พร้อมใช้งาน กรุณาลองอีกครั้งภายหลัง');const session=await auth.getSession();if(session.error)throw Error(session.error.message);if(!session.data?.user){const oauthError=new URLSearchParams(location.search).get('reset')==='1'?null:new URLSearchParams(location.search).get('error');if(new URLSearchParams(location.search).get('google')==='success'){authMessage.textContent='Google ยืนยันแล้ว แต่เบราว์เซอร์ไม่ได้ส่งข้อมูลเข้าสู่ระบบกลับมา กรุณาเปิดเว็บใน Chrome หรือ Safari แล้วลองใหม่';return;}authMessage.textContent=oauthError?'เข้าสู่ระบบด้วย Google ไม่สำเร็จ ('+oauthError+') กรุณาลองใหม่':'เข้าสู่ระบบเพื่อบันทึกข้อมูลและใช้ต่อจากเครื่องอื่น';return;}await loadRecords();const me=await api('/api/me');profileId=me.id;globalThis.__banmeawMember=me.id;nutrition.load();checkPlanUpdates();if(outboxFor().size){records=outbox.apply(records);render();showSync();flushOutbox();}showAccount(me);/* a page bug must not block sign-in */for(const init of [initProfile,m=>initTeams(m,{copyWorkout:copyTeamWorkout,copyWorkouts:copyAllTeamWorkouts}),initBody,m=>initToday(m,{weigh:quickWeigh}),initMotion,initHealthHistory]){try{init(me);}catch(error){console.error(error);}}window.dispatchEvent(new CustomEvent('diary-records',{detail:records}));document.getElementById('account-panel').hidden=true;document.body.classList.remove('auth-view');document.querySelector('main').hidden=false;document.querySelector('.side-nav').hidden=false;document.getElementById('migrate-local').hidden=!legacyRecords.length;await joinPendingTeam();}
 catch(error){authMessage.textContent=error.message||'โหลดบัญชีไม่สำเร็จ';}
}
initPasswordReset();
initBackup({tell,loadRecords,isSaving:()=>saving,setBusy:value=>{
 saving=value;document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#body-save,#profile-sex,#profile-photo-choose,#profile-photo-remove,#account-logout').forEach(button=>button.disabled=value);
}});
initProgress();
const nutrition=initNutrition();
await boot();
