import {previousExercise} from './diary-tools.mjs?v=1';
import {api} from './account.js?v=2';
import {weeklyProgress,comparePlan,workoutDescription} from './progress.mjs?v=2';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function weeklyCard(records,body,day){
 const data=weeklyProgress(records,body,day),card=el('section',undefined,'weekly-progress');
 card.append(el('h3','ความก้าวหน้า 7 วัน'),el('p',data.days[0]+' – '+day,'muted'));
 const grid=el('div',undefined,'weekly-grid');
 for(const [label,value,note] of [
 ['น้ำหนักเฉลี่ย',data.average==null?'ยังไม่มีข้อมูล':data.average+' กก.','จากวันที่ชั่ง '+data.weighDays+'/7 วัน'],
 ['เทียบ 7 วันก่อน',data.change==null?'ข้อมูลยังไม่พอ':(data.change>0?'+':'')+data.change+' กก.','เทียบค่าเฉลี่ยของวันที่มีบันทึก'],
 ['วันฝึก',data.trainingDays+'/7 วัน','มีบันทึกการฝึก'],
 ['อาหารครบ',data.completeFoodDays+'/7 วัน','บันทึกมื้อเช้า กลางวัน และเย็น']]){
  const metric=el('div');metric.append(el('span',label),el('strong',value),el('small',note));grid.append(metric);
 }
 card.append(grid);return card;
}
export function planComparison(plans,records,{onStart}={}){
 const box=el('section',undefined,'plan-comparison');
 if(!plans.length){box.append(el('p','ไม่มีแผนฝึกในวันที่เลือก','muted'));return box;}
 box.append(el('h3','แผนและผลที่ทำจริง'));
 for(const plan of plans){
  const comparisons=comparePlan(plan,records),card=el('div',undefined,'plan-result-card');
  card.append(el('strong',(plan.team_name||'แผนฝึก')+' · บันทึกแล้ว '+comparisons.filter(r=>r.actual).length+'/'+comparisons.length+' ท่า'));
  for(const {target,index,actual} of comparisons){
   const row=el('div',undefined,'plan-result-row');
   row.append(el('strong',target.exercise),el('p','แผน: '+workoutDescription(target)));
   row.append(el('p',actual?'ทำจริง: '+workoutDescription(actual):'ยังไม่ได้บันทึก','muted'));
   if(onStart){const previous=previousExercise(records,target.exercise,target.trainingType||'strength',plan.day);row.append(el('p',previous?'ครั้งก่อน: '+workoutDescription(previous):'ยังไม่มีผลครั้งก่อน','muted'));}
   if(actual?.setLogs?.length){const fold=el('details'),list=el('ol');fold.append(el('summary','ดูผลแต่ละเซ็ต'));for(const set of actual.setLogs)list.append(el('li',(set.weight==null?'ไม่ระบุน้ำหนัก':set.weight+' กก.')+' · '+set.reps+' ครั้ง'));fold.append(list);row.append(fold);}
   if(actual?.notes)row.append(el('p',actual.notes,'muted'));
   if(onStart){const button=el('button',actual?'แก้ไขผลท่านี้':'บันทึกผลท่านี้','quiet');button.type='button';button.onclick=()=>onStart({plan,target,index,actual});row.append(button);}
   card.append(row);
  }
  box.append(card);
 }
 return box;
}
export async function feedbackPanel(root,team,member,day,{canWrite=false,onReview}={}){
 const section=el('section',undefined,'feedback-panel');root.append(section);
 const path='/api/teams/'+team.id+'/feedback/'+encodeURIComponent(member.id)+'?day='+day;
 let request=0;
 async function load(){
  const seq=++request,{feedback}=await api(path);if(seq!==request||!section.isConnected)return;
  section.replaceChildren(el('h4','คำแนะนำจากเทรนเนอร์'));
  const validReview=feedback.some(f=>f.reviewed&&f.review_current!==false&&(!member.report_sent_at||new Date(f.created_at)>=new Date(member.report_sent_at)));
  section.append(el('p',validReview?'ตรวจแล้ว':'ยังไม่ได้ตรวจ','review-status'));
  onReview?.(validReview);
  if(!feedback.length)section.append(el('p','ยังไม่มีคำแนะนำสำหรับวันนี้','muted'));
  for(const f of feedback){const item=el('div',undefined,'feedback-item');item.append(el('strong',f.author_name),el('small',new Date(f.created_at).toLocaleString('th-TH')),el('p',f.text||(f.reviewed?'ตรวจบันทึกแล้ว':'')));section.append(item);}
  if(canWrite){
   const form=el('form'),text=el('textarea'),label=el('label','คำแนะนำ'),review=el('input'),reviewLabel=el('label','ตรวจบันทึกวันนี้แล้ว'),save=el('button','ส่งคำแนะนำ','primary'),message=el('p',undefined,'muted');
   text.maxLength=2000;text.rows=3;text.placeholder='เช่น เพิ่มโปรตีนในมื้อกลางวัน';text.setAttribute('aria-label','คำแนะนำถึง '+member.display_name);label.append(text);
   review.type='checkbox';review.checked=true;reviewLabel.prepend(review);reviewLabel.className='review-check';message.setAttribute('role','status');
   form.append(label,reviewLabel,save,message);section.append(form);
   form.onsubmit=async e=>{e.preventDefault();if(!text.value.trim()&&!review.checked){message.textContent='ใส่คำแนะนำหรือเลือกตรวจแล้ว';return;}save.disabled=true;try{await api(path,{method:'POST',body:JSON.stringify({text:text.value,reviewed:review.checked})});await load();}catch(error){message.textContent=error.message;}finally{save.disabled=false;}};
  }
 }
 try{await load();}catch(error){section.replaceChildren(el('p','โหลดคำแนะนำไม่สำเร็จ: '+error.message,'muted'));const retry=el('button','ลองใหม่','quiet');retry.type='button';retry.onclick=()=>feedbackPanel(root,team,member,day,{canWrite,onReview}).then(()=>section.remove());section.append(retry);}
 return section;
}
export function initProgress(){
 let records=[],body=[],feedbackDay='',feedbackRequest=0;
 const day=()=>document.getElementById('day').value;
 const render=()=>{
  const panel=document.getElementById('weekly-progress');if(panel&&day())panel.replaceChildren(weeklyCard(records,body,day()));
 };
 async function ownFeedback(){
  const selected=day();if(!selected)return;feedbackDay=selected;const seq=++feedbackRequest,box=document.getElementById('own-feedback');if(!box)return;
  try{const {feedback}=await api('/api/feedback?day='+selected);if(seq!==feedbackRequest||day()!==selected)return;box.replaceChildren();
   box.append(el('h3','คำแนะนำสำหรับวันที่เลือก'));
   if(!feedback.length)box.append(el('p','ยังไม่มีคำแนะนำจากเทรนเนอร์','muted'));
   for(const f of feedback){const item=el('div',undefined,'feedback-item');item.append(el('strong',f.author_name+' · '+f.team_name),el('small',new Date(f.created_at).toLocaleString('th-TH')),el('p',f.text||(f.reviewed?'ตรวจบันทึกแล้ว':'')));box.append(item);}
  }catch(error){if(seq===feedbackRequest)box.replaceChildren(el('p','โหลดคำแนะนำไม่สำเร็จ: '+error.message,'muted'));}
 }
 window.addEventListener('diary-records',e=>{records=e.detail||[];render();if(feedbackDay!==day())ownFeedback();});
 window.addEventListener('body-records',e=>{body=e.detail||[];render();});
 document.querySelector('[data-view="dashboard"]').addEventListener('click',ownFeedback);
 document.getElementById('feedback-refresh').onclick=ownFeedback;
}
