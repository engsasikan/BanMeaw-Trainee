import {effortText} from './effort.mjs?v=4';
import {formatLoggedWeight} from './weight-units.mjs';
// The team's "โปรแกรมฝึก" tab: a list of programs (one per saved batch, shown by its date range), and for each
// a Monday–Sunday view of what to train. Read-only here; trainers change programs with the team planner.
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const WEEK=[['จ.','MON','วันจันทร์'],['อ.','TUE','วันอังคาร'],['พ.','WED','วันพุธ'],['พฤ.','THU','วันพฤหัสบดี'],['ศ.','FRI','วันศุกร์'],['ส.','SAT','วันเสาร์'],['อา.','SUN','วันอาทิตย์']];
const shortDate=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'});
const fullDate=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'});
const at=day=>new Date(day+'T12:00:00');
// Monday = 0 … Sunday = 6
export const weekdayIndex=day=>(at(day).getDay()+6)%7;
export function exerciseLine(x,{withGroup=true}={}){
 if(x.trainingType==='cardio'){
  const parts=[x.duration+' นาที'];
  if(x.speed!=null)parts.push(x.speed+' กม./ชม.');
  if(x.incline!=null)parts.push('ชัน '+x.incline+'%');
  if(x.distance!=null)parts.push(x.distance+' กม.');
  return x.exercise+' · '+parts.join(' · ');
 }
 const load=x.weight==null?'':' · '+formatLoggedWeight(x);
 return x.exercise+' · '+x.sets+' เซ็ต × '+effortText(x)+load+(withGroup&&x.superset?' · Super set '+x.superset:'');
}
// rows: {batch, day, exercises}. Each batch becomes one program with its date range and, for every weekday,
// the exercises of the next occurrence from today (or the last one, once the program has ended).
export function groupPrograms(rows,today){
 const byBatch=new Map();
 for(const row of rows){if(!byBatch.has(row.batch))byBatch.set(row.batch,[]);byBatch.get(row.batch).push(row);}
 const programs=[...byBatch].map(([batch,list])=>{
  list.sort((a,b)=>a.day<b.day?-1:a.day>b.day?1:0);
  const first=list[0].day,last=list.at(-1).day,week=Array.from({length:7},()=>null);
  for(let i=0;i<7;i++){const days=list.filter(row=>weekdayIndex(row.day)===i);const pick=days.find(row=>row.day>=today)??days.at(-1);if(pick)week[i]={day:pick.day,exercises:pick.exercises};}
  return {batch,first,last,days:list.length,week,status:last<today?'ended':first>today?'upcoming':'current',today:list.find(row=>row.day===today)||null};
 });
 const rank={current:0,upcoming:1,ended:2};
 return programs.sort((a,b)=>rank[a.status]-rank[b.status]||(a.status==='ended'?(a.first<b.first?1:-1):(a.first<b.first?-1:1)));
}
const rangeText=p=>shortDate.format(at(p.first))+' – '+fullDate.format(at(p.last));
const trainingDays=p=>WEEK.filter((_,i)=>p.week[i]).map(([short])=>short).join(' ');
const statusText={current:'กำลังใช้อยู่',upcoming:'เริ่มเร็วๆ นี้',ended:'จบแล้ว'};
// Super set groups in order of appearance: [{letter, count}]
export function supersetGroups(exercises){const seen=new Map();for(const x of exercises)if(x.superset&&x.trainingType!=='cardio')seen.set(x.superset,(seen.get(x.superset)||0)+1);return [...seen].filter(([,n])=>n>1).map(([letter,count])=>({letter,count}));}
// Exercises as a numbered list; each Super set is one boxed step whose exercises are done back to back.
export function exerciseList(exercises){
 const list=node('ol',undefined,'program-exercises'),groups=new Set(supersetGroups(exercises).map(g=>g.letter)),boxes=new Map();
 for(const x of exercises){
  if(!groups.has(x.superset)){list.append(node('li',exerciseLine(x)));continue;}
  let box=boxes.get(x.superset);
  if(!box){const li=node('li',undefined,'program-superset'),inner=node('ul');li.append(node('strong','Super set '+x.superset+' · ทำต่อกันสลับไปจนครบเซ็ต'),inner);list.append(li);box=inner;boxes.set(x.superset,box);}
  box.append(node('li',exerciseLine(x,{withGroup:false})));
 }
 return list;
}
function previewNames(exercises){const names=exercises.slice(0,2).map(x=>x.exercise);return names.join(', ')+(exercises.length>2?' …':'');}
function programList(box,programs,open){
 const list=node('div',undefined,'program-list');
 for(const p of programs){
  const card=node('button',undefined,'program-card '+p.status);card.type='button';
  card.append(node('span',statusText[p.status],'program-status'),node('strong','โปรแกรม '+rangeText(p)),node('small',p.days+' วันฝึก · '+trainingDays(p)),node('span','›','program-chevron'));
  card.onclick=()=>open(p);list.append(card);
 }
 box.append(list);
}
function programDetail(box,p,today,{onBack,onTrainToday}){
 const back=node('button','‹ โปรแกรมทั้งหมด','quiet program-back');back.type='button';back.onclick=onBack;
 const head=node('div',undefined,'program-head');head.append(node('span',statusText[p.status],'program-status'),node('h3','โปรแกรม '+rangeText(p)),node('p',p.days+' วันฝึก · ดูได้อย่างเดียว แก้ไขได้เฉพาะเทรนเนอร์','muted'));
 const strip=node('div',undefined,'program-week-strip');
 WEEK.forEach(([short],i)=>{const cell=node('span',undefined,'program-week-cell'+(p.week[i]?' has':'')+(p.today&&weekdayIndex(today)===i?' now':''));cell.append(node('small',short),node('b',p.week[i]?String(p.week[i].exercises.length):'–'));cell.title=p.week[i]?p.week[i].exercises.length+' ท่า':'วันพัก';strip.append(cell);});
 const rows=node('div',undefined,'program-days');
 WEEK.forEach(([short,en,name],i)=>{
  const row=node('div',undefined,'program-day-row'+(p.week[i]?'':' rest')),stamp=node('div',undefined,'program-stamp');stamp.append(node('span',en),node('strong',short));
  if(!p.week[i]){const rest=node('div',undefined,'program-day-card');rest.append(node('strong','วันพัก'),node('small','ไม่มีท่าในโปรแกรม'));row.append(stamp,rest);rows.append(row);return;}
  const {exercises}=p.week[i],card=node('details',undefined,'program-day-card');
  const summary=node('summary');const sets=supersetGroups(exercises);summary.append(node('strong',name+' · '+previewNames(exercises)),node('small',exercises.length+' ท่า'+(sets.length?' · Super set '+sets.map(g=>g.letter).join(', '):'')));
  const steps=exerciseList(exercises);
  card.append(summary,steps);row.append(stamp,card);rows.append(row);
 });
 box.append(back,head,strip);
 if(p.today&&onTrainToday){const go=node('button','ไปฝึกตามแผนวันนี้ →','primary program-go');go.type='button';go.onclick=onTrainToday;box.append(go);}
 box.append(rows);
}
export function renderPrograms(box,rows,today,{onTrainToday,actions=[]}={}){
 const programs=groupPrograms(rows,today);
 const showList=()=>{
  box.replaceChildren(node('h3','โปรแกรมการฝึก'));
  if(actions.length){const bar=node('div',undefined,'program-actions');bar.append(...actions);box.append(bar);}
  if(!programs.length){box.append(node('p','เทรนเนอร์ยังไม่ได้จัดโปรแกรมให้ทีมนี้','muted'));return;}
  programList(box,programs,p=>{box.replaceChildren();programDetail(box,p,today,{onBack:showList,onTrainToday});box.scrollIntoView({block:'start'});});
 };
 showList();
}
// Trainees read their own copies (one row per day, with its batch); owners and trainers read the team's list.
export function teamPrograms(team,{api,myId,role,today,onTrainToday,actions}){
 const box=node('section',undefined,'diary team-program');
 box.append(node('h3','โปรแกรมการฝึก'),node('p','กำลังโหลดโปรแกรม…','muted'));
 const trainer=role==='owner'||role==='trainer';
 api('/api/teams/'+team.id+'/plans'+(trainer?'':'/'+encodeURIComponent(myId)))
  .then(({plans})=>renderPrograms(box,plans.map(p=>({batch:trainer?p.id:p.batch_id??p.id,day:p.day,exercises:p.exercises})),today,{onTrainToday,actions}))
  .catch(error=>{box.replaceChildren(node('h3','โปรแกรมการฝึก'),node('p','โหลดโปรแกรมไม่สำเร็จ · '+error.message,'muted'));});
 return box;
}
