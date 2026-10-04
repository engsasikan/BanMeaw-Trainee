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
 const maximum=Math.max(1,...week.flatMap(d=>[d.foods,d.workouts])),chart=$('dashboard-chart');chart.replaceChildren();chart.classList.add('activity-week');
 const foodDays=week.filter(d=>d.foods>0).length,trainingDays=week.filter(d=>d.workouts>0).length;
 const summary=node('div',undefined,'activity-summary');
 for(const [label,value] of [['วันที่บันทึกอาหาร',foodDays],['วันที่บันทึกการฝึก',trainingDays]]){const item=node('div');item.append(node('strong',value+' / 7 วัน'),node('span',label));summary.append(item);}chart.append(summary);
 for(const d of week){
  const row=node('div',undefined,'activity-day'+(d.day===day?' is-selected':'')),date=node('div',undefined,'activity-date');
  date.append(node('strong',new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00'))));if(d.day===day)date.append(node('small','วันที่เลือก'));row.append(date);
  const details=node('div',undefined,'activity-details');
  if(!d.foods&&!d.workouts)details.append(node('span','ยังไม่มีบันทึก','activity-empty'));
  else for(const [key,label,unit,cls] of [['foods','อาหาร','รายการ','food-bar'],['workouts','ฝึก','ท่า','workout-bar']]){
   const line=node('div',undefined,'activity-line'),track=node('span',undefined,'activity-track'),bar=node('span',undefined,cls);bar.style.width=(d[key]/maximum*100)+'%';track.setAttribute('aria-hidden','true');track.append(bar);line.append(node('span',label,'activity-label'),track,node('span',d[key]+' '+unit,'activity-value'));details.append(line);
  }
  row.append(details);chart.append(row);
 }
 const foods=week.reduce((n,d)=>n+d.foods,0),workouts=week.reduce((n,d)=>n+d.workouts,0);$('dash-trend-note').textContent=foods||workouts?'รวมอาหาร '+foods+' รายการ · การฝึก '+workouts+' ท่าในช่วง 7 วันนี้':'เริ่มบันทึกอาหารหรือการฝึก เพื่อดูความต่อเนื่องในแต่ละวัน';
 const table=node('table'),thead=node('thead'),heading=node('tr');for(const text of ['วันที่','อาหาร','ท่า','เซ็ต']){const th=node('th',text);th.scope='col';heading.append(th);}thead.append(heading);const tbody=node('tbody');
 for(const d of [...week].reverse()){const tr=node('tr');for(const value of [new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00')),d.foods,d.workouts,d.sets+(d.missingSets?'*':'')])tr.append(node('td',String(value)));tbody.append(tr);}table.append(thead,tbody);$('metrics-history').replaceChildren(table);if(week.some(d=>d.missingSets))$('metrics-history').append(node('p','* นับเฉพาะเซ็ตที่ระบุไว้','muted'));
}
