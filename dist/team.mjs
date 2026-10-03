import {api} from './account.js?v=2';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
const say=text=>{$('team-message').textContent=text;};
const send=(path,method,body)=>api(path,{method,body:body&&JSON.stringify(body)});
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
let myId='',loaded=false;
async function act(work,done){try{await work();if(done)say(done);await loadTeams();}catch(error){say(error.message);}}

function renderMemberships(list){
 const box=$('team-memberships');box.replaceChildren();
 if(!list.length){box.append(node('p','ยังไม่มีทีม เมื่อเทรนเนอร์เชิญคุณ คำเชิญจะแสดงที่นี่','muted'));return;}
 for(const m of list){
  const card=node('article',undefined,'team-row'),info=node('div'),actions=node('div',undefined,'team-actions');
  info.append(node('strong',m.team_name),node('span','เทรนเนอร์ '+m.trainer_name+' · '+m.trainer_code,'muted'));
  const leave=()=>send('/api/teams/'+m.team_id+'/members/'+encodeURIComponent(myId),'DELETE');
  if(m.status==='invited'){
   card.classList.add('invited');info.append(node('span','รอคุณตอบรับ · เทรนเนอร์จะเห็นบันทึกอาหารและการฝึกของคุณหลังตอบรับ','team-badge'));
   actions.append(button('ตอบรับ','primary',()=>act(()=>send('/api/teams/'+m.team_id+'/accept','POST'),'เข้าร่วมทีม '+m.team_name+' แล้ว')),
    button('ปฏิเสธ','quiet',()=>act(leave,'ปฏิเสธคำเชิญแล้ว')));
  } else actions.append(button('ออกจากทีม','quiet',()=>{if(confirm('ออกจากทีม '+m.team_name+'? เทรนเนอร์จะดูบันทึกของคุณไม่ได้อีก'))act(leave,'ออกจากทีมแล้ว');}));
  card.append(info,actions);box.append(card);
 }
}

function renderTeams(teams){
 const box=$('team-owned');box.replaceChildren();
 if(!teams.length){box.append(node('p','ยังไม่มีทีม ตั้งชื่อทีมด้านบนเพื่อเริ่มเป็นเทรนเนอร์','muted'));return;}
 for(const t of teams){
  const card=node('article',undefined,'team-card'),head=node('div',undefined,'list-heading');
  head.append(node('h3',t.name),node('span',t.members.filter(m=>m.status==='active').length+' คนในทีม','pill'));
  const form=node('form',undefined,'team-invite'),input=node('input');
  input.placeholder='ID ลูกเทรน เช่น BM-3F9A0C';input.maxLength=20;input.required=true;input.autocomplete='off';input.setAttribute('aria-label','ID ลูกเทรนที่ต้องการเชิญ');
  form.append(input,node('button','เชิญเข้าทีม','primary'));
  form.onsubmit=e=>{e.preventDefault();act(()=>send('/api/teams/'+t.id+'/invites','POST',{member_code:input.value}),'ส่งคำเชิญแล้ว รอลูกเทรนกดตอบรับ');};
  const list=node('div',undefined,'team-members');
  if(!t.members.length)list.append(node('p','ยังไม่มีสมาชิก ขอ ID จากลูกเทรนแล้วเชิญเข้าทีม','muted'));
  for(const m of t.members){
   const row=node('div',undefined,'team-row'),info=node('div'),actions=node('div',undefined,'team-actions');
   info.append(node('strong',m.display_name),node('span',m.member_code+(m.status==='invited'?' · รอตอบรับ':''),'muted'));
   if(m.status==='active')actions.append(button('ดูบันทึก','primary',()=>viewMember(t,m)));
   actions.append(button(m.status==='invited'?'ยกเลิกคำเชิญ':'นำออก','quiet',()=>{if(confirm('นำ '+m.display_name+' ออกจากทีม '+t.name+'?'))act(()=>send('/api/teams/'+t.id+'/members/'+encodeURIComponent(m.id),'DELETE'),'นำออกจากทีมแล้ว');}));
   row.append(info,actions);list.append(row);
  }
  const remove=button('ลบทีม','quiet team-delete',()=>{if(confirm('ลบทีม '+t.name+'? สมาชิกทุกคนจะออกจากทีม (บันทึกของแต่ละคนไม่หาย)'))act(()=>send('/api/teams/'+t.id,'DELETE'),'ลบทีมแล้ว');});
  card.append(head,form,list,remove);box.append(card);
 }
}

async function viewMember(team,member){
 const box=$('team-viewer');box.hidden=false;box.replaceChildren(node('p','กำลังโหลดบันทึก…','muted'));box.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  const {records}=await api('/api/teams/'+team.id+'/members/'+encodeURIComponent(member.id));
  const head=node('div',undefined,'list-heading');head.append(node('h2','บันทึกของ '+member.display_name),button('ปิด','quiet',()=>{box.hidden=true;}));
  box.replaceChildren(head,node('p',member.member_code+' · ทีม '+team.name+' · ดูได้อย่างเดียว','muted'));
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

export async function loadTeams(){
 const {teams,memberships}=await api('/api/teams');loaded=true;
 renderTeams(teams);renderMemberships(memberships);
 const pending=memberships.some(m=>m.status==='invited');
 document.querySelectorAll('.team-dot').forEach(dot=>{dot.hidden=!pending;});
}
export function initTeams(me){
 myId=me.id;$('my-member-code').textContent=me.member_code||'-';
 $('copy-member-code').onclick=async()=>{try{await navigator.clipboard.writeText(me.member_code);say('คัดลอก ID แล้ว ส่งให้เทรนเนอร์ได้เลย');}catch{say('คัดลอกไม่ได้ กรุณาจด ID: '+me.member_code);}};
 $('team-create').onsubmit=e=>{e.preventDefault();const input=$('team-name');act(async()=>{await send('/api/teams','POST',{name:input.value});input.value='';},'สร้างทีมแล้ว เชิญลูกเทรนด้วย ID ได้เลย');};
 document.querySelectorAll('[data-view="team"]').forEach(b=>b.addEventListener('click',()=>{if(loaded)say('');loadTeams().catch(error=>say(error.message));}));
 loadTeams().catch(()=>{});
}
