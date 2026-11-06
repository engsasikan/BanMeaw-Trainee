import {renderCalendar} from './calendar.mjs';
import {localDay} from './store.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function getWeek(records,day){return Array.from({length:7},(_,i)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()-6+i);const date=localDay(d),rows=records.filter(r=>r.day===date),workouts=rows.filter(r=>r.kind==='workout');return {day:date,foods:rows.length-workouts.length,workouts:workouts.length,sets:workouts.reduce((n,r)=>n+(r.sets??0),0),missingSets:workouts.filter(r=>r.sets===null).length};});}
export function switchView(view){
 const titles={dashboard:'ภาพรวมของวันนี้',workout:'บันทึกออกกำลังกาย',food:'บันทึกอาหาร',team:'ทีมของฉัน',settings:'โปรไฟล์ของฉัน'};if(!titles[view])return;
 for(const name of Object.keys(titles))$(name==='settings'?'settings-panel':name+'-panel').hidden=name!==view;
 document.querySelectorAll('[data-view][aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $('view-heading').textContent=titles[view];document.querySelector('.datebar').hidden=view==='settings'||view==='team';$('status').textContent='';
}
export function attachNavigation(){document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));}
export function renderDashboard(records,day){
 if(!day)return;renderCalendar(records,day);const week=getWeek(records,day),today=week[6];$('dash-meals').textContent=today.foods;$('dash-workouts').textContent=today.workouts;$('dash-sets').textContent=today.sets+' เซ็ตที่บันทึก'+(today.missingSets?' · '+today.missingSets+' ท่ายังไม่ระบุเซ็ต':'');
 const maximum=Math.max(1,...week.map(d=>d.foods+d.workouts)),chart=$('dashboard-chart');chart.replaceChildren();chart.classList.add('activity-week');
 const foodDays=week.filter(d=>d.foods>0).length,trainingDays=week.filter(d=>d.workouts>0).length;
 const summary=node('div',undefined,'activity-summary');
 for(const [label,value] of [['วันที่บันทึกอาหาร',foodDays],['วันที่บันทึกการฝึก',trainingDays]]){const item=node('div');item.append(node('strong',value+' / 7 วัน'),node('span',label));summary.append(item);}chart.append(summary);
 // Vertical bars, one per day: meals and workouts stacked, the selected day highlighted.
 const bars=node('div',undefined,'week-bars');bars.setAttribute('role','list');
 const weekday=new Intl.DateTimeFormat('th-TH',{weekday:'narrow'});
 for(const d of week){
  const total=d.foods+d.workouts,col=node('div',undefined,'week-bar'+(d.day===day?' is-selected':'')+(total?'':' is-empty'));col.setAttribute('role','listitem');
  col.setAttribute('aria-label',new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00'))+': อาหาร '+d.foods+' รายการ · ฝึก '+d.workouts+' ท่า');
  const track=node('div',undefined,'week-bar-track'),stack=node('div',undefined,'week-bar-stack');stack.style.height=(total/maximum*100)+'%';
  if(d.workouts){const w=node('span',undefined,'workout-bar');w.style.flexGrow=d.workouts;stack.append(w);}
  if(d.foods){const f=node('span',undefined,'food-bar');f.style.flexGrow=d.foods;stack.append(f);}
  if(d.day===day&&total)track.append(node('b',total+' รายการ','week-bar-tip'));
  track.append(stack);col.append(track,node('span',weekday.format(new Date(d.day+'T12:00:00')),'week-bar-day'));bars.append(col);
 }
 chart.append(bars);
 const foods=week.reduce((n,d)=>n+d.foods,0),workouts=week.reduce((n,d)=>n+d.workouts,0);const busiest=[...week].sort((a,b)=>(b.foods+b.workouts)-(a.foods+a.workouts))[0];$('dash-trend-note').textContent=foods||workouts?'วันที่ขยันที่สุด: '+new Intl.DateTimeFormat('th-TH',{weekday:'long'}).format(new Date(busiest.day+'T12:00:00'))+' · รวมอาหาร '+foods+' รายการ · การฝึก '+workouts+' ท่า':'เริ่มบันทึกอาหารหรือการฝึก เพื่อดูความต่อเนื่องในแต่ละวัน';
 const table=node('table'),thead=node('thead'),heading=node('tr');for(const text of ['วันที่','อาหาร','ท่า','เซ็ต']){const th=node('th',text);th.scope='col';heading.append(th);}thead.append(heading);const tbody=node('tbody');
 for(const d of [...week].reverse()){const tr=node('tr');for(const value of [new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00')),d.foods,d.workouts,d.sets+(d.missingSets?'*':'')])tr.append(node('td',String(value)));tbody.append(tr);}table.append(thead,tbody);$('metrics-history').replaceChildren(table);if(week.some(d=>d.missingSets))$('metrics-history').append(node('p','* นับเฉพาะเซ็ตที่ระบุไว้','muted'));
}
