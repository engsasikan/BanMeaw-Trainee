import {initTrainingSession} from './training-session.mjs?v=5';
import {signInWithGoogle} from './google-signin.mjs?v=2';
import {initDiaryTools} from './diary-tools.mjs?v=1';
import {initNutrition} from './nutrition.mjs?v=1';
import {initPasswordReset,initBackup} from './account-extras.mjs?v=3';
import {initProgress} from './coach-ui.mjs?v=2';
import {initProfile} from './profile.mjs?v=3';
import {showDailyPlans} from './plans.mjs?v=10';
import {auth,api} from './account.js?v=4';
import {localDay,read,write,validateRecords,mergeRecords,mealForTime} from './store.mjs?v=14';
import {attachExercisePicker} from './exercise-picker.mjs?v=9';
import {attachNavigation,renderDashboard,switchView} from './dashboard.mjs?v=9';
import {initTeams} from './team.mjs?v=27';
import {initBody,quickWeigh} from './body.mjs?v=28';
import {initToday} from './today.mjs?v=8';
const $=id=>document.getElementById(id);let records=[],editing=null,workoutEditing=null,storageOK=true;
attachExercisePicker();
attachNavigation();
const workoutComposer=node('details',undefined,'workout-composer');workoutComposer.id='workout-composer';
workoutComposer.append(node('summary','＋ เพิ่มท่านอกแผน / คาร์ดิโอ'));
const compose=$('workout-form').closest('.compose');compose.before(workoutComposer);workoutComposer.append(compose);
function openWorkoutComposer(){workoutComposer.open=true;}

function tell(message){$('status').textContent=message;}
const legacyRecords=(()=>{try{return read(localStorage);}catch{return [];}})();storageOK=false;
$('day').value=localDay();$('time').value=new Date().toTimeString().slice(0,5);$('meal').value=mealForTime($('time').value)||'มื้อเช้า';
let saving=false,workoutPlan=null;
initTrainingSession({getRecords:()=>records,saveRecords});
const diaryTools=initDiaryTools({getRecords:()=>records,getEditing:()=>workoutEditing,reuseMeal:r=>{editing=null;$('form-title').textContent='เพิ่มมื้ออาหาร';$('save').textContent='บันทึกมื้ออาหาร';$('cancel').hidden=false;$('meal').value=r.meal;$('details').value=r.text;document.querySelectorAll('[name="workout-timing"]').forEach(i=>i.checked=i.value===(r.workoutTiming||''));count();$('details').setCustomValidity('');$('details').focus();},reuseWorkout:r=>{resetWorkout();openWorkoutComposer();$('training-type').value=r.trainingType||'strength';updateTrainingType();$('exercise').value=r.exercise;for(const key of ['weight','sets','reps','duration','distance','incline','speed'])$(key).value=r[key]??'';$('workout-notes').value=r.notes||'';$('exercise').setCustomValidity('');$('workout-cancel').hidden=false;$('exercise').dispatchEvent(new Event('change'));}});

async function loadRecords(){const result=await api('/api/entries');records=result.records;storageOK=true;render();}
async function saveRecords(next,formId=null){
 if(!storageOK||saving){tell('กรุณารอให้โหลดหรือบันทึกข้อมูลเสร็จ');if(formId)diaryTools.setStatus(formId,'error','ยังบันทึกไม่ได้ กรุณารอให้โหลดหรือบันทึกข้อมูลเสร็จแล้วลองใหม่');return false;}
 saving=true;if(formId)diaryTools.setStatus(formId,'saving','กำลังบันทึก…');document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#import,#migrate-local').forEach(b=>b.disabled=true);
 try{
  const valid=validateRecords(next),old=new Map(records.map(r=>[r.id,r]));
  for(const row of valid){const previous=old.get(row.id);if(previous&&JSON.stringify(validateRecords([previous])[0])===JSON.stringify(row))continue;await api('/api/entries/'+encodeURIComponent(row.id),{method:'PUT',headers:{'If-Match':String(previous?._revision||0)},body:JSON.stringify(row)});}
  for(const previous of records)if(!valid.some(r=>r.id===previous.id))await api('/api/entries/'+encodeURIComponent(previous.id),{method:'DELETE',headers:{'If-Match':String(previous._revision)}});
  await loadRecords();return true;
 }catch(error){tell(error.message);try{await loadRecords();const actual=validateRecords(records),desired=validateRecords(next);if(JSON.stringify([...actual].sort((a,b)=>a.id.localeCompare(b.id)))===JSON.stringify([...desired].sort((a,b)=>a.id.localeCompare(b.id))))return true;}catch{}if(formId)diaryTools.setStatus(formId,'error','บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ · '+error.message);return false;}
 finally{saving=false;document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#import,#migrate-local').forEach(b=>b.disabled=false);}
}

function reset(){editing=null;$('meal-form').reset();$('time').value=new Date().toTimeString().slice(0,5);$('meal').value=mealForTime($('time').value)||'มื้อเช้า';$('form-title').textContent='เพิ่มมื้ออาหาร';$('save').textContent='บันทึกมื้ออาหาร';$('cancel').hidden=true;$('count').textContent='0 / 3,000';resetWorkout();}
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function renderMeals(){
 const day=$('day').value;if(!day)return;
 $('date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 const meals=records.filter(r=>r.day===day&&r.kind!=='workout').sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 $('total').textContent=meals.length+' รายการ';$('entries').replaceChildren();
 if(!meals.length){const box=node('div',undefined,'empty');box.append(node('span','+','empty-symbol'),node('h3','ยังไม่มีมื้อที่บันทึก'),node('p','เริ่มจดมื้อแรกของวันนี้ได้เลย'));$('entries').append(box);return;}
 for(const r of meals){const card=node('article',undefined,'entry'),top=node('div',undefined,'entry-top');top.append(node('h3',r.meal));if(r.time)top.append(node('time',r.time));card.append(top);if(r.workoutTiming)card.append(node('span',r.workoutTiming==='pre-workout'?'Pre-workout · ก่อนฝึก':'Post-workout · หลังฝึก','meal-timing-badge'));card.append(node('p',r.text,'entry-text'));const actions=node('div',undefined,'entry-actions');const edit=node('button','แก้ไข');edit.type='button';edit.setAttribute('aria-label','แก้ไข '+r.meal+' '+r.time);edit.onclick=()=>{editing=r.id;$('meal').value=r.meal;$('time').value=r.time;$('details').value=r.text;document.querySelectorAll('[name="workout-timing"]').forEach(input=>input.checked=input.value===(r.workoutTiming||''));$('form-title').textContent='แก้ไขมื้ออาหาร';$('save').textContent='บันทึกการแก้ไข';$('cancel').hidden=false;count();$('details').focus();$('meal-form').scrollIntoView({behavior:'smooth',block:'center'});};const del=node('button','ลบ','delete');del.type='button';del.setAttribute('aria-label','ลบ '+r.meal+' '+r.time);del.onclick=async()=>{if(confirm('ลบรายการ '+r.meal+' นี้ไหม?')){if(await saveRecords(records.filter(x=>x.id!==r.id))){if(editing===r.id)reset();render();tell('ลบรายการแล้ว');}}};actions.append(edit,del);card.append(actions);$('entries').append(card);}
}
function count(){$('count').textContent=$('details').value.length.toLocaleString('en-US')+' / 3,000';}
function updateTrainingType(){const cardio=$('training-type').value==='cardio';$('strength-fields').hidden=cardio;$('cardio-fields').hidden=!cardio;for(const id of ['weight','sets','reps'])$(id).disabled=cardio;for(const id of ['duration','distance','incline','speed'])$(id).disabled=!cardio;$('duration').required=cardio;$('exercise').placeholder=cardio?'ค้นหา เช่น เดิน วิ่ง ปั่นจักรยาน':'ค้นหาชื่อท่า เช่น squat หรือ ขา';}
$('training-type').addEventListener('change',updateTrainingType);updateTrainingType();
function resetWorkout(){workoutEditing=null;workoutPlan=null;$('workout-form').reset();updateTrainingType();$('workout-form-title').textContent='เพิ่มท่าออกกำลังกาย';$('workout-save').textContent='บันทึกท่าออกกำลังกาย';$('workout-cancel').hidden=true;}
function render(){renderMeals();renderWorkouts();renderDashboard(records,$('day').value);window.dispatchEvent(new CustomEvent('diary-records',{detail:records}));}
function renderWorkouts(){
 const day=$('day').value;if(!day)return;
 $('workout-date-label').textContent=new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(day+'T12:00:00'));
 let plans=document.getElementById('daily-training-plans');if(!plans){plans=node('section',undefined,'diary');plans.id='daily-training-plans';$('workout-panel').prepend(plans);}plans.dataset.day=day;showDailyPlans(plans,day,{records,onStart:startPlanExercise});
 const rows=records.filter(r=>r.kind==='workout'&&r.day===day);$('workout-total').textContent=rows.length+' รายการ';$('workout-entries').replaceChildren();
 if(!rows.length){const box=node('div',undefined,'empty');box.append(node('span','+','empty-symbol'),node('h3','ยังไม่มีท่าที่บันทึก'),node('p','เลือกท่าจากแผนด้านบนแล้วบันทึกผล หรือเปิดเพิ่มท่านอกแผน'));$('workout-entries').append(box);return;}
 for(const r of rows){
  const card=node('article',undefined,'entry');card.append(node('span',r.trainingType==='cardio'?'คาร์ดิโอ':'เวท / น้ำหนักตัว','meal-timing-badge'));card.append(node('h3',r.exercise));
  const metrics=node('div',undefined,'workout-metrics');for(const [label,value] of (r.trainingType==='cardio'?[['เวลา',r.duration+' นาที'],['ระยะทาง',r.distance==null?'ไม่ระบุ':r.distance+' กม.'],['ความชัน',r.incline==null?'ไม่ระบุ':r.incline+'%'],['ความเร็ว',r.speed==null?'ไม่ระบุ':r.speed+' กม./ชม.']]:[['น้ำหนัก',r.weight===null?'ไม่ระบุ':r.weight===0?'น้ำหนักตัว':r.weight+' กก.'],['เซ็ต',r.sets===null?'ไม่ระบุ':String(r.sets)],['ครั้ง / เซ็ต',r.reps===null?'ไม่ระบุ':String(r.reps)]])){const metric=node('div');metric.append(node('span',label),node('strong',value));metrics.append(metric);}card.append(metrics);if(r.setLogs?.length){const fold=node('details'),list=node('ol');fold.append(node('summary','ดูผลแต่ละเซ็ต'+(r.sessionComplete===false?' · ยังฝึกไม่ครบ':'')));for(const set of r.setLogs)list.append(node('li',(set.weight==null?'ไม่ระบุน้ำหนัก':set.weight+' กก.')+' · '+set.reps+' ครั้ง'));fold.append(list);card.append(fold);}if(r.notes)card.append(node('p',r.notes,'entry-text'));
  const actions=node('div',undefined,'entry-actions'),edit=node('button','แก้ไข'),del=node('button','ลบ','delete');edit.type=del.type='button';edit.setAttribute('aria-label','แก้ไขท่า '+r.exercise);del.setAttribute('aria-label','ลบท่า '+r.exercise);
  edit.onclick=()=>{openWorkoutComposer();workoutEditing=r.id;workoutPlan=r.planId?{planId:r.planId,planExerciseIndex:r.planExerciseIndex,exercise:r.exercise}:null;$('training-type').value=r.trainingType||'strength';updateTrainingType();$('duration').value=r.duration??'';$('distance').value=r.distance??'';$('incline').value=r.incline??'';$('speed').value=r.speed??'';$('exercise').value=r.exercise;$('weight').value=r.weight??'';$('sets').value=r.sets??'';$('reps').value=r.reps??'';$('workout-notes').value=r.notes;$('workout-form-title').textContent='แก้ไขท่าออกกำลังกาย';$('workout-save').textContent='บันทึกการแก้ไข';$('workout-cancel').hidden=false;diaryTools.updatePrevious();$('exercise').focus();$('workout-form').scrollIntoView({behavior:'smooth',block:'center'});};
  del.onclick=async()=>{if(confirm('ลบท่า '+r.exercise+' นี้ไหม?')&&await saveRecords(records.filter(x=>x.id!==r.id))){if(workoutEditing===r.id)resetWorkout();render();tell('ลบรายการออกกำลังกายแล้ว');}};actions.append(edit,del);card.append(actions);$('workout-entries').append(card);
 }
}
function startPlanExercise({plan,target,index,actual}){
 const partial=records.find(r=>r.day===plan.day&&r.planId===plan.id&&r.planExerciseIndex===index);
 resetWorkout();openWorkoutComposer();workoutEditing=actual?.id??partial?.id??null;
 workoutPlan={planId:plan.id,planExerciseIndex:index,exercise:target.exercise};
 const row=actual??partial??target;switchView('workout');
 $('training-type').value=row.trainingType||'strength';updateTrainingType();
 $('exercise').value=target.exercise;diaryTools.setRest(target.rest_seconds??60);diaryTools.updatePrevious();
 for(const key of ['weight','sets','reps','duration','distance','incline','speed'])$(key).value=row[key]??'';
 $('workout-notes').value=row.notes??'';
 $('workout-form-title').textContent=(actual?'แก้ไขผล: ':'บันทึกผล: ')+target.exercise;
 $('workout-cancel').hidden=false;$('workout-form').scrollIntoView({behavior:'smooth',block:'start'});$('weight').focus();
}
function switchPanel(workout){switchView(workout?'workout':'food');}
$('workout-cancel').onclick=()=>{resetWorkout();workoutComposer.open=false;};
$('exercise').addEventListener('input',()=>$('exercise').setCustomValidity(''));
$('workout-form').addEventListener('submit',async e=>{
 e.preventDefault();const exercise=$('exercise').value.trim(),day=$('day').value;if(!exercise){$('exercise').setCustomValidity('กรุณาใส่ชื่อท่า');$('exercise').reportValidity();return;}if(!day){$('day').reportValidity();return;}
 const number=id=>$(id).value===''?null:Number($(id).value);
 const row={...(workoutPlan?.exercise===exercise?{planId:workoutPlan.planId,planExerciseIndex:workoutPlan.planExerciseIndex}:{}),id:workoutEditing||crypto.randomUUID(),kind:'workout',day,exercise,trainingType:$('training-type').value,duration:$('training-type').value==='cardio'?number('duration'):null,incline:$('training-type').value==='cardio'?number('incline'):null,speed:$('training-type').value==='cardio'?number('speed'):null,distance:$('training-type').value==='cardio'?number('distance'):null,weight:$('training-type').value==='cardio'?null:number('weight'),sets:$('training-type').value==='cardio'?null:number('sets'),reps:$('training-type').value==='cardio'?null:number('reps'),notes:$('workout-notes').value.trim()};
 workoutEditing=row.id;const next=[...records.filter(r=>r.id!==row.id),row];if(await saveRecords(next,'workout-form')){resetWorkout();workoutComposer.open=false;render();tell('บันทึกท่าออกกำลังกายแล้ว');diaryTools.setStatus('workout-form','success','บันทึกท่าออกกำลังกายแล้ว ✓');}
});
$('time').addEventListener('change',()=>{const meal=mealForTime($('time').value);if(meal)$('meal').value=meal;});
$('meal').addEventListener('change',()=>{const start={'มื้อเช้า':'08:00','มื้อกลางวัน':'12:00','มื้อเย็น':'16:00'}[$('meal').value];if(start)$('time').value=start;});
$('details').addEventListener('input',count);
$('meal-form').addEventListener('submit',async e=>{e.preventDefault();const text=$('details').value.trim(),day=$('day').value;if(!text){$('details').setCustomValidity('กรุณาใส่รายละเอียดอาหาร');$('details').reportValidity();return;}if(!day){$('day').reportValidity();return;}const row={id:editing||crypto.randomUUID(),day,meal:$('meal').value,time:$('time').value,text,workoutTiming:document.querySelector('[name="workout-timing"]:checked').value};editing=row.id;const next=[...records.filter(r=>r.id!==row.id),row];if(await saveRecords(next,'meal-form')){reset();render();tell('บันทึกเรียบร้อยแล้ว');diaryTools.setStatus('meal-form','success','บันทึกมื้ออาหารแล้ว ✓');}});
$('details').addEventListener('input',()=>$('details').setCustomValidity(''));
$('cancel').onclick=reset;$('day').onchange=()=>{reset();render();};
function moveDay(offset){const d=new Date(($('day').value||localDay())+'T12:00:00');d.setDate(d.getDate()+offset);$('day').value=localDay(d);reset();render();}
$('prev').onclick=()=>moveDay(-1);$('next').onclick=()=>moveDay(1);$('today').onclick=()=>{$('day').value=localDay();reset();render();};
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
 const label=document.getElementById('account-label');label.replaceChildren(me.display_name);if(!me.member_code)return;
 const chip=document.createElement('button');chip.type='button';chip.className='id-chip';chip.title='คัดลอก ID';chip.setAttribute('aria-label','คัดลอก ID '+me.member_code);
 const text=document.createElement('span');text.textContent='ID '+me.member_code;
 chip.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/></svg>';chip.prepend(text);
 chip.onclick=async()=>{try{await navigator.clipboard.writeText(me.member_code);text.textContent='คัดลอกแล้ว ✓';}catch{text.textContent=me.member_code;}chip.classList.add('copied');setTimeout(()=>{text.textContent='ID '+me.member_code;chip.classList.remove('copied');},1600);};
 label.append(chip);
}
async function boot(){
 try{const config=await fetch('/api/config').then(r=>r.json());googleLoginReady=config.googleLoginReady===true;if(!config.ready)throw Error('ระบบสมาชิกยังไม่พร้อมใช้งาน กรุณาลองอีกครั้งภายหลัง');const session=await auth.getSession();if(session.error)throw Error(session.error.message);if(!session.data?.user){const oauthError=new URLSearchParams(location.search).get('reset')==='1'?null:new URLSearchParams(location.search).get('error');if(new URLSearchParams(location.search).get('google')==='success'){authMessage.textContent='Google ยืนยันแล้ว แต่เบราว์เซอร์ไม่ได้ส่งข้อมูลเข้าสู่ระบบกลับมา กรุณาเปิดเว็บใน Chrome หรือ Safari แล้วลองใหม่';return;}authMessage.textContent=oauthError?'เข้าสู่ระบบด้วย Google ไม่สำเร็จ ('+oauthError+') กรุณาลองใหม่':'เข้าสู่ระบบเพื่อบันทึกข้อมูลและใช้ต่อจากเครื่องอื่น';return;}await loadRecords();const me=await api('/api/me');showAccount(me);/* a page bug must not block sign-in */for(const init of [initProfile,initTeams,initBody,m=>initToday(m,{weigh:quickWeigh})]){try{init(me);}catch(error){console.error(error);}}window.dispatchEvent(new CustomEvent('diary-records',{detail:records}));document.getElementById('account-panel').hidden=true;document.body.classList.remove('auth-view');document.querySelector('main').hidden=false;document.querySelector('.side-nav').hidden=false;document.getElementById('migrate-local').hidden=!legacyRecords.length;}
 catch(error){authMessage.textContent=error.message||'โหลดบัญชีไม่สำเร็จ';}
}
initPasswordReset();
initBackup({tell,loadRecords,isSaving:()=>saving,setBusy:value=>{
 saving=value;document.querySelectorAll('#meal-form button,#workout-form button,.entry-actions button,#body-save,#profile-sex,#profile-photo-choose,#profile-photo-remove,#account-logout').forEach(button=>button.disabled=value);
}});
initProgress();
initNutrition();
await boot();
