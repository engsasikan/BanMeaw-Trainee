// "Your day" card on the overview: the daily routine of weighing in, logging each meal and
// sending the day's food log to the trainers (in the app, or shared to LINE / chat).
import {api} from './account.js?v=2';
import {localDay} from './store.mjs?v=10';
import {switchView} from './dashboard.mjs?v=9';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'long',day:'numeric',month:'short',year:'2-digit'}).format(new Date(day+'T12:00:00'));
const clock=iso=>new Date(iso).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
const MAIN_MEALS=[['มื้อเช้า','เช้า'],['มื้อกลางวัน','กลางวัน'],['มื้อเย็น','เย็น'],['ของว่าง','ของว่าง']];
const TIMING={'pre-workout':' (ก่อนฝึก)','post-workout':' (หลังฝึก)'};

let diary=[],body=[],me={},reportSentAt=null,quickWeigh=null;
const today=()=>localDay();
const todayMeals=()=>diary.filter(r=>r.day===today()&&r.kind!=='workout').sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
const todayWorkouts=()=>diary.filter(r=>r.day===today()&&r.kind==='workout');
const todayWeight=()=>body.find(r=>r.day===today()&&r.weight!=null);
const previousWeight=()=>body.find(r=>r.day<today()&&r.weight!=null);
const say=text=>{$('today-message').textContent=text;};

function render(){
 if(!$('today-card'))return;
 $('today-date').textContent=thaiDate(today());
 // 1. Morning weigh-in
 const w=todayWeight(),prev=previousWeight(),stepW=$('step-weight');
 stepW.classList.toggle('done',!!w);$('quick-weight').hidden=!!w;$('weight-done').hidden=!w;
 if(w){const diff=prev?Math.round((w.weight-prev.weight)*10)/10:null;$('weight-done').textContent=w.weight+' กก.'+(diff?(diff<0?' · ▼ ':' · ▲ ')+Math.abs(diff)+' กก. จากครั้งก่อน':'');}
 else if(prev)$('quick-weight-input').placeholder='ครั้งก่อน '+prev.weight;
 // 2. Meals
 const meals=todayMeals(),chips=$('meal-chips');chips.replaceChildren();
 for(const [meal,label] of MAIN_MEALS){
  const has=meals.some(r=>r.meal===meal),b=node('button',(has?'✓ ':'+ ')+label,'meal-chip'+(has?' done':''));b.type='button';
  b.setAttribute('aria-label',(has?'บันทึกแล้ว: ':'บันทึก')+meal);b.onclick=()=>openMeal(meal);chips.append(b);
 }
 const mainDone=['มื้อเช้า','มื้อกลางวัน','มื้อเย็น'].filter(m=>meals.some(r=>r.meal===m)).length;
 $('step-meals').classList.toggle('done',mainDone===3);$('meals-progress').textContent=mainDone+'/3 มื้อหลัก'+(meals.length?' · '+meals.length+' รายการ':'');
 // 3. Send to trainers
 $('step-send').classList.toggle('done',!!reportSentAt);
 $('send-done').hidden=!reportSentAt;if(reportSentAt)$('send-done').textContent='ส่งในแอปแล้ว '+clock(reportSentAt)+' น. · เทรนเนอร์ในทีมเห็นแล้ว';
 $('send-report').textContent=reportSentAt?'ส่งอีกครั้ง':'ส่งในแอป';
}
function openMeal(meal){
 switchView('food');
 if($('day').value!==today()){$('day').value=today();$('day').dispatchEvent(new Event('change'));}
 $('meal').value=meal;$('meal').dispatchEvent(new Event('change'));
 $('details').focus();$('meal-form').scrollIntoView({behavior:'smooth',block:'start'});
}
// Plain-text summary for LINE / chat.
function summary(){
 const lines=['BanMeaw · สรุป'+thaiDate(today()),(me.display_name||'')+(me.member_code?' ('+me.member_code+')':''),''];
 const w=todayWeight(),prev=previousWeight();
 if(w){const diff=prev?Math.round((w.weight-prev.weight)*10)/10:null;lines.push('⚖️ น้ำหนักเช้า '+w.weight+' กก.'+(diff?' ('+(diff<0?'▼':'▲')+Math.abs(diff)+')':''),'');}
 const meals=todayMeals();
 lines.push('🍽️ อาหาร');
 if(!meals.length)lines.push('• ยังไม่ได้บันทึกอาหาร');
 for(const r of meals)lines.push('• '+r.meal+(r.time?' '+r.time:'')+(TIMING[r.workoutTiming]||'')+' — '+r.text.replace(/\s+/g,' '));
 const workouts=todayWorkouts();
 if(workouts.length){lines.push('','💪 การฝึก');for(const r of workouts)lines.push('• '+r.exercise+[r.weight===null?'':(r.weight===0?' น้ำหนักตัว':' '+r.weight+' กก.'),r.sets&&r.reps?' '+r.sets+'×'+r.reps:r.sets?' '+r.sets+' เซ็ต':''].join(''));}
 return lines.join('\n');
}
async function markSent(){
 const {sent_at}=await api('/api/reports',{method:'POST',body:JSON.stringify({day:today()})});reportSentAt=sent_at;render();
}
async function loadReport(){
 try{({sent_at:reportSentAt}=await api('/api/reports?day='+today()));}catch{reportSentAt=null;}
 render();
}

export function initToday(account,{weigh}){
 me=account;quickWeigh=weigh;
 window.addEventListener('diary-records',e=>{diary=e.detail||[];render();});
 window.addEventListener('body-records',e=>{body=e.detail||[];render();});
 $('quick-weight').onsubmit=async e=>{
  e.preventDefault();const input=$('quick-weight-input'),kg=Number(input.value),btn=e.submitter||$('quick-weight').querySelector('button');
  if(!(kg>=10&&kg<=400)){say('กรุณาใส่น้ำหนัก 10–400 กก.');return;}
  btn.disabled=true;try{await quickWeigh(kg);input.value='';say('บันทึกน้ำหนักเช้านี้แล้ว');}catch(error){say(error.message);}finally{btn.disabled=false;}
 };
 $('weight-done').onclick=()=>switchView('settings');
 $('send-report').onclick=async()=>{
  if(!todayMeals().length&&!confirm('วันนี้ยังไม่มีมื้อที่บันทึก ส่งสรุปเลยไหม?'))return;
  try{await markSent();say('ส่งสรุปวันนี้ให้เทรนเนอร์ในแอปแล้ว');}catch(error){say(error.message);}
 };
 $('share-report').onclick=async()=>{
  const text=summary();
  try{
   if(navigator.share)await navigator.share({title:'สรุปอาหารวันนี้',text});
   else{await navigator.clipboard.writeText(text);say('คัดลอกสรุปแล้ว วางในแชท LINE ของเทรนเนอร์ได้เลย');}
   await markSent();
  }catch(error){if(error?.name!=='AbortError')say('แชร์ไม่สำเร็จ ลองกด "ส่งในแอป" แทน');}
 };
 // The routine follows the calendar day: refresh when the app comes back after midnight.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadReport();});
 loadReport();
}
