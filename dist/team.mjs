import {organizeTeam,openTeamViewer,closeTeamViewer} from './team-layout.mjs?v=1';
import {teamGame} from './team-game.mjs?v=1';
import {nutritionEditor} from './nutrition.mjs?v=1';
import {weeklyCard,planComparison,feedbackPanel} from './coach-ui.mjs?v=2';
import {workoutDescription} from './progress.mjs?v=2';
import {traineeSnapshot,traineeCopyText} from './team-summary.mjs?v=5';
import {trainerPlanner} from './plans.mjs?v=11';
import {api} from './account.js?v=2';
import {createBodyViewer} from './body.mjs?v=35';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
const say=text=>{$('team-message').textContent=text;};
const send=(path,method,body)=>api(path,{method,body:body&&JSON.stringify(body)});
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
const roleName={owner:'ผู้สร้างทีม',trainer:'Trainer',trainee:'Trainee'};
const badge=role=>node('span',roleName[role],'role-badge '+role);
let myId='',openTeam=null,bodyView=null,teamDay=null,teamRequest=0;

async function act(work,done,after=refresh){try{await work();if(done)say(done);await after();}catch(error){say(error.message);}}
const refresh=()=>openTeam?showTeam(openTeam):loadTeams();

// ---- Team list ----
export async function loadTeams(){
 teamRequest++;bodyView?.dispose();bodyView=null;openTeam=null;$('team-detail-view').hidden=true;$('team-list-view').hidden=false;
 const {teams}=await api('/api/teams'),box=$('team-list');box.replaceChildren();
 document.querySelectorAll('.team-dot').forEach(dot=>{dot.hidden=!teams.some(t=>t.status==='invited');});
 if(!teams.length){const empty=node('div',undefined,'empty');empty.append(node('h3','ยังไม่มีทีม'),node('p','สร้างทีมของคุณด้านบน หรือส่ง ID (มุมขวาบน) ให้ผู้สร้างทีมเพื่อรับคำเชิญ'));box.append(empty);return;}
 for(const t of teams){
  const card=node('article',undefined,'team-tile'+(t.status==='invited'?' invited':'')),info=node('div',undefined,'team-tile-info');
  info.append(node('h3',t.name),node('p',(t.my_role==='owner'?'ทีมของคุณ':'สร้างโดย '+t.owner_name)+' · '+t.member_count+' คน','muted'));
  card.append(info);
  if(t.status==='invited'){
   const actions=node('div',undefined,'team-actions');
   actions.append(node('span','คำเชิญเป็น '+roleName[t.my_role],'team-badge'),
    button('ตอบรับ','primary',()=>act(()=>send('/api/teams/'+t.id+'/accept','POST'),'เข้าร่วมทีม '+t.name+' แล้ว')),
    button('ปฏิเสธ','quiet',()=>act(()=>send('/api/teams/'+t.id+'/members/'+encodeURIComponent(myId),'DELETE'),'ปฏิเสธคำเชิญแล้ว')));
   card.append(actions);
  } else {
   card.append(badge(t.my_role),node('span','›','team-tile-arrow'));
   card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','เปิดทีม '+t.name);
   card.onclick=()=>{say('');showTeam(t.id).catch(error=>say(error.message));};
   card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};
  }
  box.append(card);
 }
}

// ---- Team detail ----
const localDayTeam=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
// Daily report badge for trainees: has today's food log been sent?
function reportBadge(m){
 if(m.status!=='active')return null;
 return m.report_sent_at?node('span','ส่งสรุปแล้ว '+new Date(m.report_sent_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' น.','report-badge sent'):node('span','ยังไม่ส่งสรุปของวันที่เลือก','report-badge');
}
function memberRow(team,m,myRole){
 const row=node('div',undefined,'team-row'),info=node('div'),self=m.id===myId;
 row.dataset.name=(m.display_name+' '+m.member_code).toLowerCase();row.dataset.role=m.team_role;row.dataset.sent=String(Boolean(m.report_sent_at));row.dataset.active=String(m.status==='active');row.dataset.reviewed='false';
 info.append(node('strong',m.display_name+(self?' (คุณ)':'')),node('span',m.member_code+(m.is_owner?' · ผู้สร้างทีม':'')+(m.status==='invited'?' · รอตอบรับ':''),'muted'));
 const badge=reportBadge(m);if(badge)info.append(badge);
 const actions=node('div',undefined,'team-actions'),owner=myRole==='owner';
 if(!self&&m.status==='active'&&((owner&&!m.is_owner)||(myRole==='trainer'&&m.team_role==='trainee')))actions.append(button('ดูบันทึก','primary',()=>viewMember(team,m)));
 if(m.status==='active'&&(m.team_role==='trainee'||self)&&(owner||myRole==='trainer'))actions.append(button('จัดแผนฝึก','quiet',async()=>{const box=openTeamViewer();box.replaceChildren();try{bodyView?.dispose();bodyView=null;await trainerPlanner(box,team,m,{day:teamDay});}catch(e){say(e.message);}}));
 if(m.status==='active'&&(m.team_role==='trainee'||self)&&(owner||myRole==='trainer'))actions.append(button('กำหนดอาหาร','quiet',()=>{const box=openTeamViewer();bodyView?.dispose();bodyView=null;box.replaceChildren();nutritionEditor(box,team,m);box.scrollIntoView({behavior:'smooth',block:'start'});}));
 if(owner){
  const select=node('select');select.setAttribute('aria-label','บทบาทของ '+m.display_name);
  for(const role of ['trainer','trainee']){const o=node('option',roleName[role]);o.value=role;o.selected=m.team_role===role;select.append(o);}
  select.onchange=()=>act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'PATCH',{team_role:select.value}),m.display_name+' เป็น '+roleName[select.value]+' แล้ว');
  actions.append(select);
  if(!m.is_owner)actions.append(button(m.status==='invited'?'ยกเลิกคำเชิญ':'นำออก','quiet',()=>{if(confirm('นำ '+m.display_name+' ออกจากทีม '+team.name+'?'))act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'DELETE'),'นำออกจากทีมแล้ว');}));
 }
 const avatar=node('span',m.display_name.trim().slice(0,1).toUpperCase(),'team-avatar');avatar.setAttribute('aria-hidden','true');
 row.append(avatar,info,actions);
 if(m.status==='active'&&m.team_role==='trainee'&&(owner||myRole==='trainer')){
  const summary=node('section',undefined,'trainee-summary');summary.dataset.memberId=m.id;
  summary.append(node('p','กำลังโหลดน้ำหนักและอาหาร…','muted'));const fold=node('details',undefined,'team-member-fold');fold.append(node('summary','สรุปและคำแนะนำ'),summary);row.append(fold);
 }
 return row;
}
function teamDateBar(id,day,members){
 const section=node('section',undefined,'team-daily'),title=node('div',undefined,'team-daily-heading');
 title.append(node('h3','ข้อมูลทีมรายวัน'),node('p','เลือกวันที่เพื่อดูสรุปและบันทึกของสมาชิก','muted'));
 const bar=node('div',undefined,'team-daybar'),date=node('input'),frame=node('div',undefined,'team-date-control'),display=node('span',thaiDate(day));
 date.type='date';date.value=day;date.setAttribute('aria-label','วันที่ดูข้อมูลทีม');display.setAttribute('aria-hidden','true');frame.append(display,date);
 const change=next=>{if(!next)return;showTeam(id,next).catch(error=>say(error.message));};
 const move=offset=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+offset);change(localDayTeam(d));};
 const previous=button('‹','quiet',()=>move(-1)),next=button('›','quiet',()=>move(1));previous.setAttribute('aria-label','วันก่อนหน้า');next.setAttribute('aria-label','วันถัดไป');
 date.onchange=()=>change(date.value);bar.append(previous,frame,next,button('วันนี้','quiet',()=>change(localDayTeam())));
 const trainees=members.filter(m=>m.status==='active'),sent=trainees.filter(m=>m.report_sent_at).length;
 const stats=node('div',undefined,'team-daily-stats');stats.append(node('span','ส่งสรุปแล้ว '+sent+' คน'),node('span','ยังไม่ส่ง '+(trainees.length-sent)+' คน'));
 section.append(title,bar,stats);return section;
}
async function showTeam(id,day=teamDay||localDayTeam()){
 const request=++teamRequest;const {team,my_role,members}=await api('/api/teams/'+id+'?day='+encodeURIComponent(day));if(request!==teamRequest)return;openTeam=id;teamDay=day;bodyView?.dispose();bodyView=null;
 const view=$('team-detail-view');$('team-list-view').hidden=true;view.hidden=false;
 const head=node('div',undefined,'team-detail-head'),title=node('div');
 title.append(node('p','YOUR TRAINING SPACE','eyebrow'),node('h2',team.name),node('p','สร้างโดย '+team.owner.display_name+' · '+team.owner.member_code,'muted'));
 head.append(button('‹ ทีมทั้งหมด','quiet team-back',()=>{say('');loadTeams().catch(error=>say(error.message));}),title,badge(my_role));
 const all=[{...team.owner,status:'active',is_owner:true},...members];
 const summary=node('div',undefined,'team-summary');
 for(const [label,value] of [['สมาชิกในทีม',all.filter(m=>m.status==='active').length],['เทรนเนอร์',all.filter(m=>m.status==='active'&&m.team_role==='trainer').length],['รอตอบรับ',all.filter(m=>m.status==='invited').length]]){const card=node('div');card.append(node('strong',String(value)),node('span',label));summary.append(card);}
 view.replaceChildren(head,summary,teamDateBar(id,day,all));
 teamGame(view,team,day);
 if(my_role==='owner'){
  const form=node('form',undefined,'team-invite'),input=node('input'),role=node('select');
  input.placeholder='ID สมาชิก เช่น BM-3F9A0C';input.maxLength=20;input.required=true;input.autocomplete='off';input.setAttribute('aria-label','ID ที่ต้องการเชิญ');input.autocapitalize='characters';input.spellcheck=false;input.style.textTransform='uppercase';
  input.addEventListener('input',()=>{const start=input.selectionStart,end=input.selectionEnd;input.value=input.value.toUpperCase();if(start!==null&&end!==null)input.setSelectionRange(start,end);});
  for(const r of ['trainee','trainer']){const o=node('option','เชิญเป็น '+roleName[r]);o.value=r;role.append(o);}role.setAttribute('aria-label','บทบาทในทีม');
  form.append(input,role,node('button','เชิญ','primary'));
  form.onsubmit=e=>{e.preventDefault();act(()=>send('/api/teams/'+team.id+'/invites','POST',{member_code:input.value,team_role:role.value}),'ส่งคำเชิญแล้ว รอสมาชิกกดตอบรับ');};
  const box=node('section',undefined,'diary team-invite-card');box.append(node('p','GROW YOUR TEAM','eyebrow'),node('h3','ชวนมาเก่งไปด้วยกัน'),node('p','ใส่ ID สมาชิก เลือกบทบาท แล้วส่งคำเชิญเข้าทีม','muted'),form);view.append(box);
 }
 const groups=node('div',undefined,'team-member-grid');view.append(groups);
 if(my_role==='owner'||my_role==='trainer'){
  const toolbar=node('section',undefined,'team-filters'),search=node('input'),filter=node('select'),count=node('p',undefined,'muted');
  search.type='search';search.placeholder='ค้นหาชื่อลูกเทรนหรือ ID';search.setAttribute('aria-label','ค้นหาลูกเทรน');
  filter.setAttribute('aria-label','กรองสถานะลูกเทรน');
  for(const [value,label] of [['all','ลูกเทรนทั้งหมด'],['unsent','ยังไม่ส่งสรุป'],['sent','ส่งสรุปแล้ว'],['unreviewed','ยังไม่ได้ตรวจ']]){const option=node('option',label);option.value=value;filter.append(option);}
  function apply(){
   const rows=[...groups.querySelectorAll('.team-row[data-role="trainee"]')];let visible=0;
   for(const row of rows){const matches=row.dataset.name.includes(search.value.trim().toLowerCase())&&(filter.value==='all'||row.dataset.active==='true'&&(filter.value==='unsent'?row.dataset.sent==='false':filter.value==='sent'?row.dataset.sent==='true':row.dataset.reviewed!=='true'));row.hidden=!matches;if(matches)visible++;}
   count.textContent='แสดง '+visible+' / '+rows.length+' คน';
  }
  search.oninput=filter.onchange=apply;groups.addEventListener('review-updated',apply);toolbar.append(search,filter,count);groups.before(toolbar);queueMicrotask(apply);
 }
 for(const role of ['trainer','trainee']){
  const everyone=[{...team.owner,status:'active',is_owner:true},...members];
  const list=everyone.filter(m=>m.team_role===role),box=node('section',undefined,'diary team-members'),head=node('div',undefined,'list-heading');
  head.append(node('h3',role==='trainer'?'เทรนเนอร์':'ลูกเทรน'),node('span',list.length+' คน','pill'));box.append(head);
  if(!list.length)box.append(node('p',role==='trainer'?'ยังไม่มีเทรนเนอร์ในทีม':'ยังไม่มีลูกเทรนในทีม','muted'));
  for(const m of list)box.append(memberRow(team,m,my_role));
  groups.append(box);
 }
 loadTraineeSummaries(team,all,my_role,day,request,view);
 const viewer=node('section',undefined,'diary team-viewer');viewer.id='team-viewer';viewer.hidden=true;view.append(viewer);
 view.append(my_role==='owner'
  ?button('ลบทีมนี้','quiet team-delete',()=>{if(confirm('ลบทีม '+team.name+'? สมาชิกทุกคนจะออกจากทีม (บันทึกของแต่ละคนไม่หาย)'))act(()=>send('/api/teams/'+team.id,'DELETE'),'ลบทีมแล้ว',loadTeams);})
  :button('ออกจากทีม','quiet team-delete',()=>{if(confirm('ออกจากทีม '+team.name+'?'))act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(myId),'DELETE'),'ออกจากทีมแล้ว',loadTeams);}));
 organizeTeam(view,{onClose:()=>{bodyView?.dispose();bodyView=null;}});
}
async function copyTrainee(member,snapshot,day,box){
 const text=traineeCopyText(member,snapshot,day);
 try{await navigator.clipboard.writeText(text);say('คัดลอกข้อมูลของ '+member.display_name+' แล้ว');}
 catch{
  box.querySelector('.trainee-copy-fallback')?.remove();
  const field=node('textarea',undefined,'trainee-copy-fallback');field.value=text;field.readOnly=true;field.setAttribute('aria-label','ข้อมูลสำหรับคัดลอกของ '+member.display_name);
  box.append(field);field.focus();field.select();say('เลือกข้อความไว้แล้ว กดค้างหรือใช้คำสั่งคัดลอก');
 }
}
async function loadTraineeSummaries(team,members,role,day,request,view){
 if(role!=='owner'&&role!=='trainer')return;
 const trainees=members.filter(m=>m.status==='active'&&m.team_role==='trainee');
 for(let start=0;start<trainees.length;start+=4){
  if(request!==teamRequest)return;
  await Promise.all(trainees.slice(start,start+4).map(async member=>{
   const box=[...view.querySelectorAll('.trainee-summary')].find(e=>e.dataset.memberId===member.id);if(!box)return;
   try{
    const base='/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id);
    const data=await api(base+'/progress?day='+day);
    if(request!==teamRequest||!box.isConnected)return;
    const snapshot=traineeSnapshot(data.body,data.records,day);box.replaceChildren();
    const metrics=node('div',undefined,'trainee-metrics');
    metrics.append(node('strong','น้ำหนัก '+(snapshot.weight==null?'ยังไม่มีข้อมูล':snapshot.weight+' กก.')),node('strong','ส่วนสูง '+(snapshot.height==null?'ยังไม่มีข้อมูล':snapshot.height+' ซม.')));box.append(metrics);
    if(snapshot.weightDay)box.append(node('p','ชั่งเมื่อ '+thaiDate(snapshot.weightDay),'muted'));
    if(snapshot.heightDay)box.append(node('p','วัดส่วนสูงเมื่อ '+thaiDate(snapshot.heightDay),'muted'));
    box.append(button('คัดลอกข้อมูลทั้งหมด','quiet trainee-copy',()=>copyTrainee(member,snapshot,day,box)));
    const details=node('details',undefined,'trainee-details');details.append(node('summary','อาหาร / การฝึก / ความก้าวหน้า / คำแนะนำ'));
    const content=node('div',undefined,'trainee-details-content');details.append(content);box.append(details);
    content.append(node('h4','อาหาร · '+thaiDate(day)));
    if(!snapshot.meals.length)content.append(node('p','ยังไม่มีบันทึกอาหารในวันที่เลือก','muted'));
    for(const meal of snapshot.meals){const row=node('div',undefined,'trainee-meal');row.append(node('strong',[meal.meal,meal.time,meal.workoutTiming==='pre-workout'?'ก่อนฝึก':meal.workoutTiming==='post-workout'?'หลังฝึก':''].filter(Boolean).join(' · ')),node('p',meal.text));content.append(row);}
    content.append(node('h4','การฝึก'));
    if(!snapshot.workouts.length)content.append(node('p','ยังไม่มีบันทึกการฝึกในวันที่เลือก','muted'));
    for(const r of snapshot.workouts){const row=node('div',undefined,'trainee-meal');row.append(node('strong',r.exercise),node('p',workoutDescription(r)));if(r.notes)row.append(node('p',r.notes));content.append(row);}
    content.append(planComparison(data.plans,data.records),weeklyCard(data.records,data.body,day));
    await feedbackPanel(content,team,member,day,{canWrite:true,onReview:reviewed=>{
     if(request!==teamRequest||!box.isConnected)return;
     const row=box.closest('.team-row');row.dataset.reviewed=String(reviewed);
     let status=row.querySelector('.member-review');if(!status){status=node('span',undefined,'member-review');row.children[1].append(status);}
     status.textContent=reviewed?'ตรวจแล้ว':'ยังไม่ได้ตรวจ';status.classList.toggle('reviewed',reviewed);
     row.closest('.team-member-grid').dispatchEvent(new Event('review-updated'));
    }});
   }catch(error){
    if(request!==teamRequest||!box.isConnected)return;
    box.replaceChildren(node('p','โหลดข้อมูลไม่ครบ จึงยังคัดลอกไม่ได้: '+error.message,'muted'),button('ลองใหม่','quiet',()=>loadTraineeSummaries(team,[member],role,day,request,view)));
   }
  }));
 }
}
async function viewMember(team,member){
 const selectedDay=teamDay,selectedTeam=openTeam;const box=openTeamViewer();bodyView?.dispose();bodyView=null;box.replaceChildren(node('p','กำลังโหลดบันทึก…','muted'));box.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  const {records}=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id)+'?day='+encodeURIComponent(selectedDay));if(selectedTeam!==openTeam||selectedDay!==teamDay||!box.isConnected)return;
  const head=node('div',undefined,'list-heading');head.append(node('h2','บันทึกของ '+member.display_name),button('ปิด','quiet',()=>{closeTeamViewer();bodyView?.dispose();bodyView=null;}));
  box.replaceChildren(head,node('p',thaiDate(selectedDay),'team-record-date'),node('p',member.member_code+' · อ่านอย่างเดียว','muted'));
  bodyView?.dispose();bodyView=null;
  const body=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id)+'/body');
  if(selectedTeam!==openTeam||selectedDay!==teamDay||!box.isConnected)return;
  const historicalBody=body.records.filter(r=>r.day<=selectedDay);
  if(historicalBody.length){const card=node('section',undefined,'team-body');box.append(card);bodyView=createBodyViewer(card);bodyView.setTitle('หุ่นของ '+member.display_name);bodyView.show(historicalBody);}
  box.append(node('h3','บันทึกอาหารและการฝึก','team-log-title'));
  if(!records.length){box.append(node('p','ไม่มีบันทึกอาหารหรือการฝึกในวันที่เลือก','muted'));return;}
  for(const day of [...new Set(records.map(r=>r.day))].slice(0,30)){
   const group=node('section',undefined,'team-day');group.append(node('h3',thaiDate(day)));
   for(const r of records.filter(x=>x.day===day)){
    const row=node('div',undefined,'team-log '+(r.kind==='workout'?'workout':'meal'));
    if(r.kind==='workout'){
     const detail=[r.weight===null?'':(r.weight===0?'น้ำหนักตัว':r.weight+' กก.'),r.sets?r.sets+' เซ็ต':'',r.reps?r.reps+' ครั้ง':''].filter(Boolean).join(' · ');
     row.append(node('strong',r.exercise),node('span',[detail,r.notes].filter(Boolean).join(' — ')));
    } else row.append(node('strong',r.meal+(r.time?' · '+r.time:'')+(r.workoutTiming?' · '+r.workoutTiming:'')),node('span',r.text));
    group.append(row);
   }
   box.append(group);
  }
 }catch(error){box.replaceChildren(node('p',error.message,'muted'));}
}

export function initTeams(me){
 myId=me.id;
 $('team-create').onsubmit=e=>{e.preventDefault();const input=$('team-name');act(async()=>{const {team}=await send('/api/teams','POST',{name:input.value});input.value='';openTeam=team.id;},'สร้างทีมแล้ว เชิญสมาชิกด้วย ID ได้เลย');};
 document.querySelectorAll('[data-view="team"]').forEach(b=>b.addEventListener('click',()=>{say('');loadTeams().catch(error=>say(error.message));}));
 loadTeams().catch(()=>{});
}
