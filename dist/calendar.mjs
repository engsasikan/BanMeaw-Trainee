import {localDay} from './store.mjs';
let month=null,lastSelected=null,currentRecords=[];
const $=id=>document.getElementById(id);
export function monthCells(year,index){
 const first=new Date(year,index,1,12),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
 return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {day:localDay(d),number:d.getDate(),inMonth:d.getMonth()===index};});
}
function changeMonth(offset){month=new Date(month.getFullYear(),month.getMonth()+offset,1,12);paint();}
function paint(){
 const selected=$('day').value,today=localDay();
 $('calendar-month').textContent=new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(month);
 const counts=new Map();for(const row of currentRecords){if(!counts.has(row.day))counts.set(row.day,{food:0,workout:0});counts.get(row.day)[row.kind==='workout'?'workout':'food']++;}
 const grid=$('calendar-days');grid.replaceChildren();
 for(const cell of monthCells(month.getFullYear(),month.getMonth())){
  const b=document.createElement('button');b.type='button';b.className='calendar-day'+(!cell.inMonth?' outside':'')+(cell.day===selected?' selected':'')+(cell.day===today?' is-today':'');b.textContent=cell.number;b.setAttribute('aria-pressed',String(cell.day===selected));if(cell.day===today)b.setAttribute('aria-current','date');
  const count=counts.get(cell.day)||{food:0,workout:0};b.setAttribute('aria-label',new Intl.DateTimeFormat('th-TH',{dateStyle:'full'}).format(new Date(cell.day+'T12:00:00'))+' อาหาร '+count.food+' รายการ การฝึก '+count.workout+' ท่า');
  const marks=document.createElement('span');marks.className='calendar-marks';marks.setAttribute('aria-hidden','true');for(const [kind,n] of Object.entries(count))if(n){const dot=document.createElement('i');dot.className=kind;marks.append(dot);}b.append(marks);
  b.onclick=()=>{$('day').value=cell.day;$('day').dispatchEvent(new Event('change'));};grid.append(b);
 }
 const count=counts.get(selected)||{food:0,workout:0};$('calendar-selection').textContent=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(selected+'T12:00:00'))+' · อาหาร '+count.food+' รายการ · การฝึก '+count.workout+' ท่า';
}
export function renderCalendar(records,day){
 if(!$('calendar-days')||!day)return;currentRecords=records;
 if(day!==lastSelected){const d=new Date(day+'T12:00:00');month=new Date(d.getFullYear(),d.getMonth(),1,12);lastSelected=day;}
 $('calendar-prev').onclick=()=>changeMonth(-1);$('calendar-next').onclick=()=>changeMonth(1);
 $('calendar-today').onclick=()=>{$('day').value=localDay();month=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);$('day').dispatchEvent(new Event('change'));};paint();
}
