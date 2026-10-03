import {localDay} from './store.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function getWeek(records,day){return Array.from({length:7},(_,i)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()-6+i);const date=localDay(d),rows=records.filter(r=>r.day===date),workouts=rows.filter(r=>r.kind==='workout');return {day:date,foods:rows.length-workouts.length,workouts:workouts.length,sets:workouts.reduce((n,r)=>n+(r.sets??0),0),missingSets:workouts.filter(r=>r.sets===null).length};});}
export function switchView(view){
 const titles={dashboard:'ภาพรวมของวันนี้',workout:'บันทึกออกกำลังกาย',food:'บันทึกอาหาร',team:'ทีมของฉัน',settings:'บัญชีของฉัน'};if(!titles[view])return;
 for(const name of Object.keys(titles))$(name==='settings'?'settings-panel':name+'-panel').hidden=name!==view;
 document.querySelectorAll('[data-view][aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $('view-heading').textContent=titles[view];document.querySelector('.datebar').hidden=view==='settings'||view==='team';$('status').textContent='';
}
export function attachNavigation(){document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));}
export function renderDashboard(records,day){
 if(!day)return;const week=getWeek(records,day),today=week[6];$('dash-meals').textContent=today.foods;$('dash-workouts').textContent=today.workouts;$('dash-sets').textContent=today.sets+' เซ็ตที่บันทึก'+(today.missingSets?' · '+today.missingSets+' ท่ายังไม่ระบุเซ็ต':'');
 const maximum=Math.max(1,...week.flatMap(d=>[d.foods,d.workouts]));$('dashboard-chart').replaceChildren();
 for(const d of week){const column=node('div',undefined,'chart-column'),bars=node('div',undefined,'chart-bars');for(const [key,cls] of [['foods','food-bar'],['workouts','workout-bar']]){const bar=node('span',undefined,cls);bar.style.height=(d[key]/maximum*100)+'%';bars.append(bar);}column.append(node('span',d.foods+' / '+d.workouts,'chart-count'),bars,node('span',new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00')),'chart-day'));column.setAttribute('aria-label',d.day+' อาหาร '+d.foods+' รายการ ออกกำลังกาย '+d.workouts+' ท่า');$('dashboard-chart').append(column);}
 const count=week.reduce((n,d)=>n+d.foods+d.workouts,0);$('dash-trend-note').textContent=count?'รวม '+count+' รายการในช่วง 7 วันนี้':'ยังไม่มีข้อมูลในช่วงนี้ เริ่มบันทึกอาหารหรือการฝึกได้เลย';
 const table=node('table'),thead=node('thead'),heading=node('tr');for(const text of ['วันที่','อาหาร','ท่า','เซ็ต']){const th=node('th',text);th.scope='col';heading.append(th);}thead.append(heading);const tbody=node('tbody');
 for(const d of [...week].reverse()){const tr=node('tr');for(const value of [new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(d.day+'T12:00:00')),d.foods,d.workouts,d.sets+(d.missingSets?'*':'')])tr.append(node('td',String(value)));tbody.append(tr);}table.append(thead,tbody);$('metrics-history').replaceChildren(table);if(week.some(d=>d.missingSets))$('metrics-history').append(node('p','* นับเฉพาะเซ็ตที่ระบุไว้','muted'));
}
