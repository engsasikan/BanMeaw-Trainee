import {api} from './account.js?v=2';
import {createBodyViewer} from './body.mjs?v=5';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
const say=text=>{$('team-message').textContent=text;};
const send=(path,method,body)=>api(path,{method,body:body&&JSON.stringify(body)});
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
const roleName={owner:'ผู้สร้างทีม',trainer:'Trainer',trainee:'Trainee'};
const badge=role=>node('span',roleName[role],'role-badge '+role);
let myId='',openTeam=null,bodyView=null;

async function act(work,done,after=refresh){try{await work();if(done)say(done);await after();}catch(error){say(error.message);}}
const refresh=()=>openTeam?showTeam(openTeam):loadTeams();

// ---- Team list ----
export async function loadTeams(){
 openTeam=null;$('team-detail-view').hidden=true;$('team-list-view').hidden=false;
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
function memberRow(team,m,myRole){
 const row=node('div',undefined,'team-row'),info=node('div'),self=m.id===myId;
 info.append(node('strong',m.display_name+(self?' (คุณ)':'')),node('span',m.member_code+(m.is_owner?' · ผู้สร้างทีม':'')+(m.status==='invited'?' · รอตอบรับ':''),'muted'));
 const actions=node('div',undefined,'team-actions'),owner=myRole==='owner';
 if(!self&&m.status==='active'&&((owner&&!m.is_owner)||(myRole==='trainer'&&m.team_role==='trainee')))actions.append(button('ดูบันทึก','primary',()=>viewMember(team,m)));
 if(owner){
  const select=node('select');select.setAttribute('aria-label','บทบาทของ '+m.display_name);
  for(const role of ['trainer','trainee']){const o=node('option',roleName[role]);o.value=role;o.selected=m.team_role===role;select.append(o);}
  select.onchange=()=>act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'PATCH',{team_role:select.value}),m.display_name+' เป็น '+roleName[select.value]+' แล้ว');
  actions.append(select);
  if(!m.is_owner)actions.append(button(m.status==='invited'?'ยกเลิกคำเชิญ':'นำออก','quiet',()=>{if(confirm('นำ '+m.display_name+' ออกจากทีม '+team.name+'?'))act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(m.id),'DELETE'),'นำออกจากทีมแล้ว');}));
 }
 const avatar=node('span',m.display_name.trim().slice(0,1).toUpperCase(),'team-avatar');avatar.setAttribute('aria-hidden','true');
 row.append(avatar,info,actions);return row;
}
async function showTeam(id){
 const {team,my_role,members}=await api('/api/teams/'+id);openTeam=id;
 const view=$('team-detail-view');$('team-list-view').hidden=true;view.hidden=false;
 const head=node('div',undefined,'team-detail-head'),title=node('div');
 title.append(node('p','YOUR TRAINING SPACE','eyebrow'),node('h2',team.name),node('p','สร้างโดย '+team.owner.display_name+' · '+team.owner.member_code,'muted'));
 head.append(button('‹ ทีมทั้งหมด','quiet team-back',()=>{say('');loadTeams().catch(error=>say(error.message));}),title,badge(my_role));
 const all=[{...team.owner,status:'active',is_owner:true},...members];
 const summary=node('div',undefined,'team-summary');
 for(const [label,value] of [['สมาชิกในทีม',all.filter(m=>m.status==='active').length],['เทรนเนอร์',all.filter(m=>m.status==='active'&&m.team_role==='trainer').length],['รอตอบรับ',all.filter(m=>m.status==='invited').length]]){const card=node('div');card.append(node('strong',String(value)),node('span',label));summary.append(card);}
 view.replaceChildren(head,summary);
 if(my_role==='owner'){
  const form=node('form',undefined,'team-invite'),input=node('input'),role=node('select');
  input.placeholder='ID สมาชิก เช่น BM-3F9A0C';input.maxLength=20;input.required=true;input.autocomplete='off';input.setAttribute('aria-label','ID ที่ต้องการเชิญ');
  for(const r of ['trainee','trainer']){const o=node('option','เชิญเป็น '+roleName[r]);o.value=r;role.append(o);}role.setAttribute('aria-label','บทบาทในทีม');
  form.append(input,role,node('button','เชิญ','primary'));
  form.onsubmit=e=>{e.preventDefault();act(()=>send('/api/teams/'+team.id+'/invites','POST',{member_code:input.value,team_role:role.value}),'ส่งคำเชิญแล้ว รอสมาชิกกดตอบรับ');};
  const box=node('section',undefined,'diary team-invite-card');box.append(node('p','GROW YOUR TEAM','eyebrow'),node('h3','ชวนมาเก่งไปด้วยกัน'),node('p','ใส่ ID สมาชิก เลือกบทบาท แล้วส่งคำเชิญเข้าทีม','muted'),form);view.append(box);
 }
 const groups=node('div',undefined,'team-member-grid');view.append(groups);
 for(const role of ['trainer','trainee']){
  const everyone=[{...team.owner,status:'active',is_owner:true},...members];
  const list=everyone.filter(m=>m.team_role===role),box=node('section',undefined,'diary team-members'),head=node('div',undefined,'list-heading');
  head.append(node('h3',role==='trainer'?'เทรนเนอร์':'ลูกเทรน'),node('span',list.length+' คน','pill'));box.append(head);
  if(!list.length)box.append(node('p',role==='trainer'?'ยังไม่มีเทรนเนอร์ในทีม':'ยังไม่มีลูกเทรนในทีม','muted'));
  for(const m of list)box.append(memberRow(team,m,my_role));
  groups.append(box);
 }
 const viewer=node('section',undefined,'diary team-viewer');viewer.id='team-viewer';viewer.hidden=true;view.append(viewer);
 view.append(my_role==='owner'
  ?button('ลบทีมนี้','quiet team-delete',()=>{if(confirm('ลบทีม '+team.name+'? สมาชิกทุกคนจะออกจากทีม (บันทึกของแต่ละคนไม่หาย)'))act(()=>send('/api/teams/'+team.id,'DELETE'),'ลบทีมแล้ว',loadTeams);})
  :button('ออกจากทีม','quiet team-delete',()=>{if(confirm('ออกจากทีม '+team.name+'?'))act(()=>send('/api/teams/'+team.id+'/members/'+encodeURIComponent(myId),'DELETE'),'ออกจากทีมแล้ว',loadTeams);}));
}
async function viewMember(team,member){
 const box=$('team-viewer');box.hidden=false;box.replaceChildren(node('p','กำลังโหลดบันทึก…','muted'));box.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  const {records}=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id));
  const head=node('div',undefined,'list-heading');head.append(node('h2','บันทึกของ '+member.display_name),button('ปิด','quiet',()=>{box.hidden=true;bodyView?.dispose();bodyView=null;}));
  box.replaceChildren(head,node('p',member.member_code+' · ดูได้อย่างเดียว','muted'));
  bodyView?.dispose();bodyView=null;
  const body=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id)+'/body');
  if(body.records.length){const card=node('section',undefined,'team-body');box.append(card);bodyView=createBodyViewer(card);bodyView.setTitle('หุ่นของ '+member.display_name);bodyView.show(body.records);}
  box.append(node('h3','บันทึกอาหารและการฝึก','team-log-title'));
  if(!records.length){box.append(node('p','ยังไม่มีบันทึก','muted'));return;}
  for(const day of [...new Set(records.map(r=>r.day))].slice(0,30)){
   const group=node('section',undefined,'team-day');group.append(node('h3',thaiDate(day)));
   for(const r of records.filter(x=>x.day===day)){
    const row=node('div',undefined,'team-log '+(r.kind==='workout'?'workout':'meal'));
    if(r.kind==='workout'){
     const detail=[r.weight===null?'':(r.weight===0?'น้ำหนักตัว':r.weight+' กก.'),r.sets?r.sets+' เซ็ต':'',r.reps?r.reps+' ครั้ง':''].filter(Boolean).join(' · ');
     row.append(node('strong',r.exercise),node('span',[detail,r.notes].filter(Boolean).join(' — ')));
    } else row.append(node('strong',r.meal+(r.time?' · '+r.time:'')),node('span',r.text));
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
