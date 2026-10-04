import {api} from './account.js?v=2';
import {workoutDescription} from './progress.mjs?v=1';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const btn=(text,click,cls='quiet')=>{const b=el('button',text,cls);b.type='button';b.onclick=click;return b;};
const statuses={pending:'รอรับรางวัล',fulfilled:'รับรางวัลแล้ว',rejected:'ไม่อนุมัติ · คืนคะแนนแล้ว',cancelled:'ยกเลิก · คืนคะแนนแล้ว'};
export function teamGame(root,team,day){
 const box=el('section',undefined,'diary team-game'),content=el('div'),message=el('p',undefined,'game-message');message.setAttribute('role','status');box.append(content,message);root.append(box);
 const path='/api/teams/'+team.id+'/game';let seq=0,busy=false;const requests=new Map();
 function confirmAction(text,action){
  if(busy)return;const dialog=el('dialog',undefined,'game-confirm'),prompt=el('p',text),actions=el('div',undefined,'game-confirm-actions');dialog.setAttribute('aria-label','ยืนยันรายการ');
  const close=()=>{dialog.close();dialog.remove();};actions.append(btn('ยกเลิก',close),btn('ยืนยัน',()=>{close();action();},'primary'));dialog.append(prompt,actions);dialog.addEventListener('cancel',()=>dialog.remove());box.append(dialog);dialog.showModal();
 }

 async function run(action,body,success){if(busy)return;busy=true;box.querySelectorAll('button,input').forEach(e=>e.disabled=true);message.textContent='กำลังดำเนินการ…';
 try{await api(path+'/'+action,{method:'POST',body:JSON.stringify(body)});if(action==='redeem')requests.delete(body.reward);message.textContent=success;await load();}
 catch(error){message.textContent=error.message;}finally{busy=false;box.querySelectorAll('button,input').forEach(e=>e.disabled=e.dataset.locked==='true');}}
 async function load(){
  const request=++seq;try{const state=await api(path+'?day='+day);if(request!==seq||!box.isConnected)return;render(state);}
  catch(error){if(request!==seq||!box.isConnected)return;content.replaceChildren(el('h3','คะแนนและรางวัลทีม'),el('p','โหลดคะแนนไม่ได้: '+error.message,'muted'),btn('ลองใหม่',load));}
 }
 function render(state){
  content.replaceChildren();const me=state.players.find(p=>p.id===state.me);if(!me){content.append(el('p','ไม่พบสมาชิกของคุณในทีม'));return;}
  const title=el('div',undefined,'list-heading');title.append(el('h3','เล่นไปด้วยกัน · คะแนนทีม'),btn('โหลดคะแนนล่าสุด',load));content.append(title);
  const wallet=el('div',undefined,'game-wallet');wallet.append(el('strong',Number(me.balance).toLocaleString('th-TH')),el('span','คะแนนที่ใช้แลกได้'),el('small','สะสมทั้งหมด '+me.earned+' คะแนน'));content.append(wallet);
  const rules=el('details',undefined,'game-rules');rules.append(el('summary','กติกาคะแนน · ทุกบทบาทใช้กติกาเดียวกัน'),el('p','ส่งสรุปพร้อมอาหาร +10 · ครบเช้า/กลางวัน/เย็น +5 · บันทึกฝึกหรือระบุวันพัก +5 สูงสุด 20 คะแนน/วัน รับได้ครั้งเดียวหลังบันทึกครบ ย้อนหลังได้ 6 วันและต้องเป็นวันที่อยู่ในทีมแล้ว คะแนนรับแล้วไม่เพิ่มจากการแก้ย้อนหลัง ไม่ใช้ความเร็วในการลดน้ำหนักหรือยอดแคลอรีเป็นคะแนน','muted'),el('p','เมื่อกดส่งสรุปให้ทีม ทุกคนในทีมจะเห็นอาหารและการฝึกของวันที่ส่ง สรุปเดิมก่อนมีระบบทีมนี้จะยังไม่แสดงจนกดส่งอีกครั้ง เทรนเนอร์ร่วมส่งผลเหมือนสมาชิก และยังตรวจลูกทีมได้ คะแนนเป็นสิทธิ์รางวัลที่ทีมจัดให้ ไม่มีการสั่งซื้ออาหารอัตโนมัติ','muted'));content.append(rules);
  const report=el('div',undefined,'game-claim');report.append(el('h4','รับคะแนนวันที่ '+day));
  if(me.day_points!=null)report.append(el('p','รับแล้ว '+me.day_points+' คะแนน'+(me.rest_day?' · วันพัก':''),'game-success'));
  else{
   const rest=el('input');rest.type='checkbox';rest.id='game-rest-'+team.id;const label=el('label','วันนี้เป็นวันพักตามแผน');label.className='game-rest';label.prepend(rest);
   const entries=state.reports.filter(r=>r.user_id===state.me),meals=entries.filter(r=>r.payload.kind!=='workout'&&r.payload.text?.trim()),complete=['มื้อเช้า','มื้อกลางวัน','มื้อเย็น'].every(m=>meals.some(r=>r.payload.meal===m));
   const estimate=()=>me.sent_at&&meals.length?10+(complete?5:0)+(rest.checked||entries.some(r=>r.payload.kind==='workout')?5:0):0;
   const claim=btn('รับคะแนนของฉัน',()=>confirmAction('รับคะแนนวันที่ '+day+' จำนวน '+estimate()+' คะแนน? รับได้ครั้งเดียวต่อวัน หากยังบันทึกไม่ครบให้กลับไปบันทึกและส่งสรุปก่อน',()=>run('claim',{day,rest:rest.checked},'รับคะแนนแล้ว')),'primary');
   if(!me.sent_at||!meals.length||entries.some(r=>r.changed_after_send)){claim.disabled=true;claim.dataset.locked='true';}
   if(me.sent_at&&entries.some(r=>r.changed_after_send))report.append(el('p','มีการแก้ไขหลังส่ง กรุณาส่งสรุปอีกครั้งก่อนรับคะแนน','muted'));
   if(me.sent_at&&!meals.length)report.append(el('p','ต้องมีบันทึกอาหารอย่างน้อย 1 มื้อก่อนรับคะแนน','muted'));
   if(!state.claimable){claim.disabled=true;claim.dataset.locked='true';report.append(el('p','วันที่นี้อยู่นอกช่วงรับคะแนน','muted'));}
   if(!me.sent_at)report.append(el('p','บันทึกอาหารแล้วกด “ส่งในแอป” ในหน้าภาพรวมก่อนรับคะแนน','muted'));
   report.append(label,claim);
  }
  content.append(report);
  const catalog=el('div',undefined,'game-rewards');content.append(el('h4','แลกรางวัล'),catalog);
  for(const reward of state.rewards){
   const card=el('article',undefined,'game-reward');card.append(el('h4',reward.name),el('strong',reward.cost+' คะแนน'));
   const redeem=btn(reward.enabled?'แลก'+reward.name:'ปิดการแลก',()=>confirmAction('ใช้ '+reward.cost+' คะแนน แลก'+reward.name+'? คะแนนจะถูกหักและบันทึกคำขอในทีม',()=>{let id=requests.get(reward.code);if(!id){id=crypto.randomUUID();requests.set(reward.code,id);}run('redeem',{reward:reward.code,requestId:id},'แลกรางวัลแล้ว ดูรายการรอรับด้านล่าง');}),'primary');
   redeem.disabled=!reward.enabled||Number(me.balance)<Number(reward.cost);redeem.dataset.locked=String(redeem.disabled);card.append(redeem);if(reward.enabled&&redeem.disabled)card.append(el('small','ขาดอีก '+(reward.cost-me.balance)+' คะแนน','muted'));catalog.append(card);
  }
  if(state.owner){
   const settings=el('details',undefined,'game-settings');settings.append(el('summary','ตั้งค่าคะแนนที่ใช้แลกรางวัล'));
   for(const reward of state.rewards){const form=el('form'),label=el('label',reward.name+' (คะแนน)'),cost=el('input'),enabled=el('input'),enabledLabel=el('label','เปิดให้แลก'),save=el('button','บันทึก','quiet');cost.type='number';cost.min=1;cost.max=100000;cost.step=1;cost.required=true;cost.value=reward.cost;label.append(cost);enabled.type='checkbox';enabled.checked=reward.enabled;enabledLabel.prepend(enabled);enabledLabel.className='game-rest';form.append(label,enabledLabel,save);form.onsubmit=e=>{e.preventDefault();run('rewards',{code:reward.code,cost:Number(cost.value),enabled:enabled.checked},'บันทึกค่ารางวัลแล้ว');};settings.append(form);}content.append(settings);
  }
  const leaderboard=el('div',undefined,'game-players');content.append(el('h4','ทุกคนในทีม · เรียงตามคะแนนสะสม'),leaderboard);
  for(const player of state.players){
   const row=el('article',undefined,'game-player'),head=el('div',undefined,'game-player-head');head.append(el('strong',player.display_name+(player.id===state.me?' (คุณ)':'')),el('span',(player.team_role==='trainer'?'เทรนเนอร์':'ลูกทีม')+' · '+player.earned+' คะแนนสะสม'));row.append(head,el('p','คงเหลือ '+player.balance+' · วันนี้ '+(player.day_points??0)+' คะแนน · '+(player.sent_at?'ส่งสรุปแล้ว':'ยังไม่ส่งสรุป'),'muted'));
   const entries=state.reports.filter(r=>r.user_id===player.id);
   if(player.sent_at){const details=el('details');details.append(el('summary','ดูผลที่ส่ง · อาหารและการฝึก'));if(entries.some(r=>r.changed_after_send))details.append(el('p','มีการแก้ไขหลังส่ง กรุณาส่งสรุปอีกครั้ง','muted'));if(player.rest_day)details.append(el('p','ระบุเป็นวันพัก'));if(!entries.length)details.append(el('p','ยังไม่มีรายการอาหารหรือการฝึก','muted'));for(const {payload:r} of entries){const item=el('div',undefined,'game-report');item.append(el('strong',r.kind==='workout'?r.exercise:[r.meal,r.time].filter(Boolean).join(' · ')),el('p',r.kind==='workout'?workoutDescription(r):r.text));details.append(item);}row.append(details);}leaderboard.append(row);
  }
  const history=el('details',undefined,'game-history');history.open=state.redemptions.some(r=>r.status==='pending');history.append(el('summary','รายการแลกรางวัล · 50 รายการล่าสุด'));
  if(!state.redemptions.length)history.append(el('p','ยังไม่มีการแลกรางวัล','muted'));
  for(const r of state.redemptions){const item=el('div',undefined,'game-redemption'),reward=state.rewards.find(x=>x.code===r.reward);item.append(el('strong',r.display_name+' · '+(reward?.name||r.reward)),el('p',r.cost+' คะแนน · '+statuses[r.status],'muted'),el('small',new Date(r.created_at).toLocaleString('th-TH')));
   if(r.status==='pending'){const actions=el('div',undefined,'team-actions');
    if(r.user_id===state.me)actions.append(btn('ยกเลิกและคืนคะแนน',()=>confirmAction('ยกเลิกรายการนี้และคืน '+r.cost+' คะแนน?',()=>run('resolve',{id:r.id,status:'cancelled'},'ยกเลิกและคืนคะแนนแล้ว'))));
    if(state.coach){actions.append(btn('ยืนยันรับรางวัลแล้ว',()=>confirmAction('ยืนยันว่า '+r.display_name+' รับรางวัล'+(reward?.name||r.reward)+'แล้ว?',()=>run('resolve',{id:r.id,status:'fulfilled'},'ยืนยันรับรางวัลแล้ว'))));if(r.user_id!==state.me)actions.append(btn('ไม่อนุมัติและคืนคะแนน',()=>confirmAction('ไม่อนุมัติและคืน '+r.cost+' คะแนนให้ '+r.display_name+'?',()=>run('resolve',{id:r.id,status:'rejected'},'คืนคะแนนแล้ว'))));}item.append(actions);
   }history.append(item);
  }content.append(history);
  const awards=el('details',undefined,'game-history');awards.append(el('summary','ประวัติรับคะแนนของฉัน · 30 วันล่าสุดที่รับ'));for(const a of state.awards)awards.append(el('p',a.day+' · +'+a.points+' คะแนน'+(a.rest_day?' · วันพัก':'')));if(!state.awards.length)awards.append(el('p','ยังไม่มีประวัติรับคะแนน','muted'));content.append(awards);
 }
 content.append(el('p','กำลังโหลดคะแนน…','muted'));load();return box;
}
