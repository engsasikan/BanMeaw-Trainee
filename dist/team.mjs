import {groupWorkouts} from './workout-groups.mjs?v=2';
import {organizeTeam,openTeamViewer,closeTeamViewer} from './team-layout.mjs?v=4';
import {teamGame} from './team-game.mjs?v=6';
import {nutritionEditor} from './nutrition.mjs?v=1';
import {weeklyCard,planComparison,feedbackPanel} from './coach-ui.mjs?v=6';
import {workoutDescription} from './progress.mjs?v=6';
import {traineeSnapshot,traineeCopyText} from './team-summary.mjs?v=9';
import {trainerPlanner} from './plans.mjs?v=40';
import {teamPrograms} from './team-program.mjs?v=9';
import {api} from './account.js?v=5';
import {createBodyViewer} from './body.mjs?v=40';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
function photoMark(name,avatar,className){
 const mark=node('span',name.trim().slice(0,1).toUpperCase(),className);
 mark.setAttribute('aria-hidden','true');
 if(avatar){
  const image=node('img');image.alt='';image.loading='lazy';
  image.onerror=()=>image.remove();
  image.src=avatar;mark.append(image);
 }
 return mark;
}
function teamPhotoSettings(team){
 const box=node('section',undefined,'diary team-photo-settings');
 const file=node('input');file.type='file';file.accept='image/*';file.hidden=true;
 const status=node('p',undefined,'muted');status.setAttribute('role','status');
 const choose=button(team.avatar?'เปลี่ยนรูปทีม':'เลือกรูปทีม','quiet',()=>file.click());
 const remove=button('นำรูปออก','quiet',()=>save('DELETE'));
 remove.hidden=!team.avatar;
 const path='/api/teams/'+team.id+'/avatar';
 function busy(value){choose.disabled=remove.disabled=file.disabled=value;}
 async function save(method,body){
  busy(true);status.textContent='กำลังบันทึกรูปทีม…';
  try{
   await api(path,{method,...(body?{headers:{'Content-Type':'image/jpeg'},body}:{})});
   await refresh();say(method==='DELETE'?'นำรูปทีมออกแล้ว':'บันทึกรูปทีมแล้ว');
  }catch(error){status.textContent=error.message;}
  finally{busy(false);}
 }
 file.onchange=async()=>{
  const selected=file.files[0];if(!selected)return;
  busy(true);status.textContent='กำลังเปิดรูป…';
  const url=URL.createObjectURL(selected);
  try{
   const image=new Image();image.src=url;await image.decode();
   const {cropPhoto}=await import('./profile.mjs?v=4');
   const blob=await cropPhoto(image,{title:'จัดกรอบรูปทีม'});
   if(!blob){status.textContent='';return;}
   await save('PUT',blob);
  }catch{status.textContent='เปิดรูปไม่ได้ ลองเลือกรูป JPG, PNG หรือ WebP';}
  finally{URL.revokeObjectURL(url);file.value='';busy(false);}
 };
 const actions=node('div',undefined,'team-photo-actions');actions.append(choose,remove);
 box.append(photoMark(team.name,team.avatar,'team-tile-mark'),node('h3','รูปทีม'),actions,file,status);
 return box;
}
function say(text,loading=false){
 const message=$('team-message');message.textContent=text;
 if(loading)message.dataset.loading='true';else delete message.dataset.loading;
}
const send=(path,method,body)=>api(path,{method,body:body&&JSON.stringify(body)});
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
const roleName={owner:'ผู้สร้างทีม',trainer:'เทรนเนอร์',trainee:'ลูกเทรน'};
const badge=role=>node('span',roleName[role],'role-badge '+role);
let copyWorkout,copyWorkouts;
let myId='',openTeam=null,bodyView=null,teamDay=null,teamRequest=0;

async function act(work,done,after=refresh){try{say('กำลังดำเนินการ…',true);await work();await after();say(done||'');}catch(error){say(error.message);}}
const refresh=()=>openTeam?showTeam(openTeam):loadTeams();

// ---- Team list ----
export async function loadTeams(){
 const request=++teamRequest;say('กำลังโหลดรายชื่อทีม…',true);bodyView?.dispose();bodyView=null;openTeam=null;$('team-detail-view').hidden=true;$('team-list-view').hidden=false;
 const {teams}=await api('/api/teams');if(request!==teamRequest)return;
 say('');window.dispatchEvent(new CustomEvent('teams-loaded',{detail:teams}));const box=$('team-list');box.replaceChildren();
 document.querySelectorAll('.team-dot').forEach(dot=>{dot.hidden=!teams.some(t=>t.status==='invited');});
 if(!teams.length){const empty=node('div',undefined,'empty');empty.append(node('h3','ยังไม่มีทีม'),node('p','กด + สร้างทีม หรือส่ง ID (มุมขวาบน) ให้ผู้สร้างทีมเพื่อรับคำเชิญ'));box.append(empty);return;}
 for(const t of teams){
  const card=node('article',undefined,'team-tile'+(t.status==='invited'?' invited':'')),info=node('div',undefined,'team-tile-info');
  info.append(node('h3',t.name),node('p',(t.my_role==='owner'?'ทีมของคุณ':'สร้างโดย '+t.owner_name)+' · '+t.member_count+' คน','muted'));
  card.append(photoMark(t.name,t.avatar,'team-tile-mark'),info);
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
function copyWorkoutButton(record,member){
 if(member.id===myId||!copyWorkout)return null;
 const control=button('คัดลอกท่า','quiet team-copy-workout team-copy-single',()=>{
  const result=copyWorkout(record);
  if(result.error)say(result.error);
 });
 control.setAttribute('aria-label','คัดลอก '+record.exercise+' มาฝึก');
 return control;
}
function copyAllWorkoutsButton(rows,member,label='คัดลอกทุกท่า',style='primary'){
 if(!rows.length||member.id===myId||!copyWorkouts)return null;
 return button(label,style+' team-copy-workout',()=>copyWorkouts(rows,member.display_name));
}
function appendMemberWorkouts(root,rows,member,createRow){
 let number=0;
 for(const group of groupWorkouts(rows)){
  if(group.rows.length===1){root.append(createRow(group.rows[0]));continue;}
  const section=node('section',undefined,'team-superset');
  const header=node('div',undefined,'team-superset-header'),heading=node('div');
  heading.append(node('h4','Super set '+(++number)),node('span',group.rows.length+' ท่าต่อเนื่อง','muted'));
  header.append(heading);
  const copy=copyAllWorkoutsButton(group.rows,member,'คัดลอกชุด','quiet');
  if(copy)header.append(copy);
  const sequence=node('ol',undefined,'team-superset-sequence');
  for(const row of group.rows){const item=node('li');item.append(createRow(row));sequence.append(item);}
  section.append(header,sequence);root.append(section);
 }
}
function openPlanner(team,member,day,{openCreate=false}={}){
 const box=openTeamViewer();
 bodyView?.dispose();bodyView=null;
 const progress=node('p','กำลังโหลดแผนฝึก…','muted');
 progress.dataset.loading='true';progress.setAttribute('role','status');
 const planner=node('div');box.replaceChildren(progress,planner);box.scrollIntoView({block:'start'});
 trainerPlanner(planner,team,member,{day,openCreate,draftKey:'banmeaw-plan-draft:'+myId+':'+team.id+':'+(member?.id??'team')})
  .catch(error=>{planner.prepend(node('p',error.message,'muted'));})
  .finally(()=>progress.remove());
}
function memberRow(team,m,myRole){
 const row=node('div',undefined,'team-row'),info=node('div'),self=m.id===myId;
 row.dataset.name=(m.display_name+' '+m.member_code).toLowerCase();row.dataset.role=m.team_role;row.dataset.sent=String(Boolean(m.report_sent_at));row.dataset.active=String(m.status==='active');row.dataset.reviewed='false';
 info.append(node('strong',m.display_name+(self?' (คุณ)':'')),node('span',m.member_code+(m.is_owner?' · ผู้สร้างทีม':'')+(m.status==='invited'?' · รอตอบรับ':''),'muted'));
 const badge=reportBadge(m);if(badge)info.append(badge);
 const actions=node('div',undefined,'team-actions'),manage=node('div',undefined,'team-actions'),owner=myRole==='owner';
 if(!self&&m.status==='active'&&((owner&&!m.is_owner)||(myRole==='trainer'&&m.team_role==='trainee')))actions.append(button('ดูบันทึก','primary',()=>viewMember(team,m)));
 if(m.status==='active'&&(m.team_role==='trainee'||self)&&(owner||myRole==='trainer'))manage.append(button('จัดแผนฝึก','quiet',()=>openPlanner(team,m,teamDay)));
 if(m.status==='active'&&(m.team_role==='trainee'||self)&&(owner||myRole==='trainer'))manage.append(button('กำหนดอาหาร','quiet',()=>{const box=openTeamViewer();bodyView?.dispose();bodyView=null;box.replaceChildren();nutritionEditor(box,team,m);box.scrollIntoView({behavior:'smooth',block:'start'});}));
 if(owner){
  const select=node('select');select.setAttribute('aria-label','บทบาทของ '+m.display_name);
  for(const role of ['trainer','trainee']){const o=node('option',roleName[role]);o.value=role;o.selected=m.team_role===role;select.append(o);}
  select.onchange=()=>act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'PATCH',{team_role:select.value}),m.display_name+' เป็น '+roleName[select.value]+' แล้ว');
  manage.append(select);
  if(!m.is_owner)manage.append(button(m.status==='invited'?'ยกเลิกคำเชิญ':'นำออก','quiet',()=>{if(confirm('นำ '+m.display_name+' ออกจากทีม '+team.name+'?'))act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'DELETE'),'นำออกจากทีมแล้ว');}));
 }
 const avatar=photoMark(m.display_name,m.avatar,'team-avatar');
 row.append(avatar,info);
 const panels=[];
 function addPanel(label,content){
  content.hidden=true;panels.push(content);
  const toggle=button(label,'quiet',()=>{
   const opening=content.hidden;
   for(const panel of panels)panel.hidden=true;
   for(const control of actions.querySelectorAll('[aria-expanded]'))control.setAttribute('aria-expanded','false');
   content.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));
  });
  toggle.setAttribute('aria-expanded','false');actions.append(toggle);
 }
 if(m.status==='active'&&m.team_role==='trainee'&&(owner||myRole==='trainer')){
  const summary=node('section',undefined,'trainee-summary');summary.dataset.memberId=m.id;
  summary.append(node('p','กำลังโหลดน้ำหนักและอาหาร…','muted'));
  addPanel('สรุปและคำแนะนำ',summary);
 }
 if(manage.childElementCount){
  const panel=node('div',undefined,'team-member-manage');
  panel.append(manage);addPanel('จัดการ',panel);
 }
 if(actions.childElementCount){actions.classList.add('team-roster-actions');row.append(actions,...panels);}
 return row;
}
function teamDateBar(id,day,members){
 const section=node('section',undefined,'team-daily'),title=node('div',undefined,'team-daily-heading');
 title.append(node('h3','วันที่ดูบันทึก'));
 const bar=node('div',undefined,'team-daybar'),date=node('input'),frame=node('div',undefined,'team-date-control'),display=node('span',thaiDate(day));
 date.type='date';date.value=day;date.setAttribute('aria-label','วันที่ดูข้อมูลทีม');display.setAttribute('aria-hidden','true');frame.append(display,date);
 const change=next=>{
  if(!next||next===day){date.value=day;return;}
  showTeam(id,next).catch(error=>{date.value=day;say(error.message);});
 };
 const move=offset=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+offset);change(localDayTeam(d));};
 const previous=button('‹','quiet',()=>move(-1)),next=button('›','quiet',()=>move(1));previous.setAttribute('aria-label','วันก่อนหน้า');next.setAttribute('aria-label','วันถัดไป');
 date.onchange=()=>change(date.value);bar.append(previous,frame,next,button('วันนี้','quiet',()=>change(localDayTeam())));
 const active=members.filter(m=>m.status==='active'),sent=active.filter(m=>m.report_sent_at).length;
 const stats=node('div',undefined,'team-daily-stats');stats.append(node('span','ส่งแล้ว '+sent+' / '+active.length+' คน'));
 title.append(stats);section.append(title,bar);return section;
}
async function showTeam(id,day=teamDay||localDayTeam()){
 const previousTab=$('team-detail-view').querySelector('[aria-selected="true"]')?.id.slice('team-tab-'.length);
 const tab=openTeam===id?previousTab:undefined;
 say('กำลังโหลดข้อมูลทีม…',true);
 const request=++teamRequest;const {team,my_role,members}=await api('/api/teams/'+id+'?day='+encodeURIComponent(day));if(request!==teamRequest)return;say('');openTeam=id;teamDay=day;bodyView?.dispose();bodyView=null;
 const view=$('team-detail-view');$('team-list-view').hidden=true;view.hidden=false;
 const head=node('div',undefined,'team-detail-head'),title=node('div');
 const identity=node('div',undefined,'team-identity'),mark=photoMark(team.name,team.avatar,'team-tile-mark');
 title.append(node('h2',team.name),node('p','สร้างโดย '+team.owner.display_name,'muted'));
 identity.append(mark,title,badge(my_role));
 head.append(button('‹ ทีมทั้งหมด','quiet team-back',()=>{say('');loadTeams().catch(error=>say(error.message));}),identity);
 const all=[{...team.owner,status:'active',is_owner:true},...members];
 view.replaceChildren(head,teamDateBar(id,day,all));
 teamGame(view,team,day);
 if(my_role==='owner'){
  const form=node('form',undefined,'team-invite'),input=node('input'),role=node('select');
  input.placeholder='ID สมาชิก เช่น BM-3F9A0C';input.maxLength=20;input.required=true;input.autocomplete='off';input.setAttribute('aria-label','ID ที่ต้องการเชิญ');input.autocapitalize='characters';input.spellcheck=false;input.style.textTransform='uppercase';
  input.addEventListener('input',()=>{const start=input.selectionStart,end=input.selectionEnd;input.value=input.value.toUpperCase();if(start!==null&&end!==null)input.setSelectionRange(start,end);});
  for(const r of ['trainee','trainer']){const o=node('option','เชิญเป็น '+roleName[r]);o.value=r;role.append(o);}role.setAttribute('aria-label','บทบาทในทีม');
  const scan=button('สแกน QR','quiet',async()=>{
   scan.disabled=true;scan.textContent='กำลังเปิด…';
   try{
    const {openMemberQr}=await import('./member-qr.mjs?v=3');
    if(form.isConnected)openMemberQr({onScan:code=>{input.value=code;role.focus();}});
   }catch{say('เปิดตัวสแกนไม่ได้ กรอก ID สมาชิกได้เลย');}
   finally{scan.disabled=false;scan.textContent='สแกน QR';}
  });
  const memberField=node('div',undefined,'team-invite-id');memberField.append(input,scan);
  form.append(memberField,role,node('button','เชิญ','primary'));
  form.onsubmit=e=>{e.preventDefault();act(()=>send('/api/teams/'+team.id+'/invites','POST',{member_code:input.value,team_role:role.value}),'ส่งคำเชิญแล้ว รอสมาชิกกดตอบรับ');};
  const generate=button('สร้าง QR เชิญเข้าทีม','primary',async()=>{
   generate.disabled=true;
   try{
    const {openMemberQr}=await import('./member-qr.mjs?v=3');
    const {token}=await send('/api/teams/'+team.id+'/qr-invite','POST');
    const link=new URL('/',location.origin);link.searchParams.set('joinTeam',team.id);link.searchParams.set('invite',token);
    if(generate.isConnected)openMemberQr({code:link.href,teamInvite:true});
   }catch(error){say(error.message);}
   finally{generate.disabled=false;}
  });
  const box=node('section',undefined,'diary team-invite-card');
  const manual=node('details');manual.append(node('summary','เชิญด้วย ID สมาชิก'),form);
  box.append(node('h3','เชิญสมาชิก'),node('p','สร้าง QR ให้คนอื่นสแกนเพื่อเข้าทีมเป็นลูกเทรน การสร้างใหม่จะแทน QR เดิม','muted'),generate,manual);view.append(box);
 }
 const groups=node('div',undefined,'team-member-grid');view.append(groups);
 if((my_role==='owner'||my_role==='trainer')&&all.some(m=>m.team_role==='trainee')){
  const toolbar=node('details',undefined,'team-filters'),search=node('input'),filter=node('select'),count=node('p',undefined,'muted');
  search.type='search';search.placeholder='ค้นหาชื่อหรือ ID';search.setAttribute('aria-label','ค้นหาสมาชิก');
  filter.setAttribute('aria-label','กรองสถานะลูกเทรน');
  for(const [value,label] of [['all','ทุกสถานะ'],['unsent','ยังไม่ส่งสรุป'],['sent','ส่งสรุปแล้ว'],['unreviewed','ลูกเทรนที่ยังไม่ได้ตรวจ']]){const option=node('option',label);option.value=value;filter.append(option);}
  function apply(){
   const rows=[...groups.querySelectorAll('.team-row')];let visible=0;
   for(const row of rows){const matches=row.dataset.name.includes(search.value.trim().toLowerCase())&&(filter.value==='all'||row.dataset.active==='true'&&(filter.value==='unsent'?row.dataset.sent==='false':filter.value==='sent'?row.dataset.sent==='true':row.dataset.role==='trainee'&&row.dataset.reviewed!=='true'));row.hidden=!matches;if(matches)visible++;}
   count.textContent=visible?'แสดง '+visible+' / '+rows.length+' คน':'ไม่พบสมาชิกที่ตรงกับตัวกรอง';
  }
  search.oninput=filter.onchange=apply;groups.addEventListener('review-updated',apply);toolbar.append(node('summary','ค้นหาและกรองสมาชิก'),search,filter,count);groups.before(toolbar);queueMicrotask(apply);
 }
 for(const role of ['trainee','trainer']){
  const list=all.filter(m=>m.team_role===role),box=node('section',undefined,'diary team-members'),head=node('div',undefined,'list-heading');
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
 const selectSection=organizeTeam(view,{tab,onClose:()=>{bodyView?.dispose();bodyView=null;}});
 if(my_role==='owner')view.querySelector('#team-section-manage').prepend(teamPhotoSettings(team));
 const coaching=my_role==='owner'||my_role==='trainer';
 view.querySelector('#team-section-program').append(teamPrograms(team,{api,myId,role:my_role,today:localDayTeam(),onTrainToday:()=>document.querySelector('[data-view="workout"]')?.click(),actions:coaching?[button('จัดแผนฝึกทั้งทีม','primary',()=>openPlanner(team,null,day))]:[],onPlanNew:coaching?()=>openPlanner(team,null,day,{openCreate:true}):null}));
 if(my_role==='owner'||my_role==='trainer'){
  const shortcuts=node('div',undefined,'team-member-shortcuts');
  shortcuts.append(button('จัดแผนฝึกทั้งทีม','primary',()=>openPlanner(team,null,day)));
  if(my_role==='owner')shortcuts.append(button('เชิญสมาชิก','quiet',()=>{
   selectSection('manage');view.querySelector('.team-invite-card .primary')?.focus();
  }));
  view.querySelector('#team-section-members').prepend(shortcuts);
 }
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
    const copyAll=copyAllWorkoutsButton(snapshot.workouts,member);if(copyAll)content.append(copyAll);
    if(!snapshot.workouts.length)content.append(node('p','ยังไม่มีบันทึกการฝึกในวันที่เลือก','muted'));
    appendMemberWorkouts(content,snapshot.workouts,member,r=>{
     const row=node('div',undefined,'trainee-meal');
     row.append(node('strong',r.exercise),node('p',workoutDescription(r)));
     if(r.notes)row.append(node('p',r.notes));
     const copy=copyWorkoutButton(r,member);if(copy)row.append(copy);
     return row;
    });
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
 const selectedDay=teamDay,selectedTeam=openTeam;const viewer=openTeamViewer(),box=node('div');viewer.replaceChildren(box);bodyView?.dispose();bodyView=null;box.replaceChildren(node('p','กำลังโหลดบันทึก…','muted'));box.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  const {records}=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id)+'?day='+encodeURIComponent(selectedDay));if(selectedTeam!==openTeam||selectedDay!==teamDay||!box.isConnected||viewer.hidden)return;
  const head=node('div',undefined,'list-heading');head.append(node('h2','บันทึกของ '+member.display_name),button('ปิด','quiet',()=>{closeTeamViewer();bodyView?.dispose();bodyView=null;}));
  box.replaceChildren(head,node('p',thaiDate(selectedDay),'team-record-date'),node('p',member.member_code+' · อ่านอย่างเดียว','muted'));
  bodyView?.dispose();bodyView=null;
  const body=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id)+'/body');
  if(selectedTeam!==openTeam||selectedDay!==teamDay||!box.isConnected||viewer.hidden)return;
  const historicalBody=body.records.filter(r=>r.day<=selectedDay);
  if(historicalBody.length){
   const fold=node('details',undefined,'team-body team-body-preview'),card=node('section');
   fold.append(node('summary','ดูหุ่นจำลอง 3D'),card);box.append(fold);
   fold.ontoggle=()=>{
    if(!fold.open||bodyView)return;
    bodyView=createBodyViewer(card,{isVisible:()=>fold.open});
    bodyView.setTitle('หุ่นของ '+member.display_name);bodyView.show(historicalBody);
   };
  }
  const workouts=records.filter(r=>r.kind==='workout'&&r.day===selectedDay);
  const toolbar=node('div',undefined,'team-workout-toolbar'),heading=node('div');
  heading.append(node('h3','บันทึกอาหารและการฝึก'),node('span',workouts.length+' ท่า · '+thaiDate(selectedDay),'muted'));
  toolbar.append(heading);
  const copyAll=copyAllWorkoutsButton(workouts,member);if(copyAll)toolbar.append(copyAll);
  box.append(toolbar);
  if(!records.length){box.append(node('p','ไม่มีบันทึกอาหารหรือการฝึกในวันที่เลือก','muted'));return;}
  for(const day of [...new Set(records.map(r=>r.day))].slice(0,30)){
   const group=node('section',undefined,'team-day team-workout-records');
   if(day!==selectedDay)group.append(node('h3',thaiDate(day)));
   const dayRecords=records.filter(r=>r.day===day);
   appendMemberWorkouts(group,dayRecords.filter(r=>r.kind==='workout'),member,r=>{
    const row=node('div',undefined,'team-log workout');
    const info=node('div',undefined,'team-workout-info');
    info.append(node('strong',r.exercise),node('span',workoutDescription(r)));
    if(r.notes)info.append(node('span',r.notes,'team-workout-note'));
    row.append(info);
    const copy=copyWorkoutButton(r,member);if(copy)row.append(copy);
    return row;
   });
   for(const r of dayRecords.filter(r=>r.kind!=='workout')){
    const row=node('div',undefined,'team-log meal');
    row.append(node('strong',r.meal+(r.time?' · '+r.time:'')+(r.workoutTiming?' · '+r.workoutTiming:'')),node('span',r.text));group.append(row);
   }
   box.append(group);
  }
 }catch(error){box.replaceChildren(node('p',error.message,'muted'));}
}

export function initTeams(me,{copyWorkout:copy,copyWorkouts:copyAll}={}){
 copyWorkout=copy;
 copyWorkouts=copyAll;
 myId=me.id;
 const dialog=$('team-create-dialog'),form=$('team-create'),input=$('team-name');
 const submit=$('team-create-save'),cancel=$('team-create-cancel'),message=$('team-create-status');
 $('team-create-open').onclick=()=>{message.textContent='';dialog.showModal();};
 cancel.onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(submit.disabled)event.preventDefault();});
 form.onsubmit=async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  const name=input.value.trim();
  if(!name){message.textContent='กรุณาใส่ชื่อทีม';input.focus();return;}
  submit.disabled=cancel.disabled=input.disabled=true;
  message.textContent='กำลังสร้างทีม…';message.dataset.loading='true';
  try{
   const {team}=await send('/api/teams','POST',{name});
   form.reset();dialog.close();
   try{await showTeam(team.id);say('สร้างทีมแล้ว เชิญสมาชิกด้วย ID ได้เลย');}
   catch(error){say(error.message);}
  }catch(error){message.textContent=error.message;}
  finally{submit.disabled=cancel.disabled=input.disabled=false;delete message.dataset.loading;}
 };
 document.querySelectorAll('[data-view="team"]').forEach(b=>b.addEventListener('click',()=>{say('');loadTeams().catch(error=>say(error.message));}));
 loadTeams().catch(error=>say(error.message));
}
