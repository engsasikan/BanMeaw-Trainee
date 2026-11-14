import {formatLoggedWeight} from './weight-units.mjs';
// Read-only view of the program a trainer prepared for this team, shown to trainees on the team page.
// Trainees can look at every upcoming day but cannot change anything; training starts from the training tab.
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const dayName=new Intl.DateTimeFormat('th-TH',{weekday:'long',day:'numeric',month:'short'});
export function exerciseLine(x){
 if(x.trainingType==='cardio'){
  const parts=[x.duration+' นาที'];
  if(x.speed!=null)parts.push(x.speed+' กม./ชม.');
  if(x.incline!=null)parts.push('ชัน '+x.incline+'%');
  if(x.distance!=null)parts.push(x.distance+' กม.');
  return x.exercise+' · '+parts.join(' · ');
 }
 const load=x.weight==null?'':' · '+formatLoggedWeight(x);
 return x.exercise+' · '+x.sets+' เซ็ต × '+x.reps+' ครั้ง'+load+(x.superset?' · Super set '+x.superset:'');
}
// plans: this member's own copies of the team's plans ({day, exercises}); today: 'YYYY-MM-DD'.
export function renderTeamProgram(box,plans,today,{onTrainToday,limit=14}={}){
 const upcoming=plans.filter(p=>p.day>=today).sort((a,b)=>a.day<b.day?-1:a.day>b.day?1:0);
 box.replaceChildren(node('h3','โปรแกรมจากเทรนเนอร์'));
 if(!upcoming.length){box.append(node('p','เทรนเนอร์ยังไม่ได้จัดโปรแกรมให้ทีมในวันข้างหน้า','muted'));return;}
 box.append(node('p','ดูท่าที่เทรนเนอร์เตรียมไว้ได้ แก้ไขได้เฉพาะเทรนเนอร์ เริ่มฝึกได้ในวันที่มีแผนจากแท็บฝึก','muted'));
 const list=node('div',undefined,'team-program-days');
 for(const plan of upcoming.slice(0,limit)){
  const isToday=plan.day===today;
  const item=node('details',undefined,'team-program-day'+(isToday?' today':''));item.open=isToday;
  const summary=node('summary');
  summary.append(node('strong',(isToday?'วันนี้ · ':'')+dayName.format(new Date(plan.day+'T12:00:00'))),node('span',plan.exercises.length+' ท่า','muted'));
  const steps=node('ol');for(const x of plan.exercises)steps.append(node('li',exerciseLine(x)));
  item.append(summary,steps);
  if(isToday&&onTrainToday){const go=node('button','ไปฝึกตามแผนวันนี้ →','primary');go.type='button';go.onclick=onTrainToday;item.append(go);}
  list.append(item);
 }
 box.append(list);
 if(upcoming.length>limit)box.append(node('p','และอีก '+(upcoming.length-limit)+' วันถัดไป','muted'));
}
export function teamProgram(team,myId,{api,today,onTrainToday}){
 const box=node('section',undefined,'diary team-program');
 box.append(node('h3','โปรแกรมจากเทรนเนอร์'),node('p','กำลังโหลดโปรแกรม…','muted'));
 api('/api/teams/'+team.id+'/plans/'+encodeURIComponent(myId))
  .then(({plans})=>{if(box.isConnected||!box.parentNode)renderTeamProgram(box,plans,today,{onTrainToday});})
  .catch(error=>{box.replaceChildren(node('h3','โปรแกรมจากเทรนเนอร์'),node('p','โหลดโปรแกรมไม่สำเร็จ · '+error.message,'muted'));});
 return box;
}
