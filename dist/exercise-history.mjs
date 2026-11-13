import {fromKg,preferredWeightUnit,formatWeight} from './weight-units.mjs';
const normalize=s=>(s||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
export function exerciseHistory(records,exercise,day,exclude){
 return records.filter(r=>r.kind==='workout'&&(r.trainingType||'strength')==='strength'&&normalize(r.exercise)===normalize(exercise)&&r.day<=day&&r.id!==exclude).sort((a,b)=>a.day.localeCompare(b.day)).map(r=>{
  const logs=r.setLogs?.length?r.setLogs:[{weight:r.weight,reps:r.reps}];
  const weights=logs.map(s=>s.weight).filter(n=>typeof n==='number'&&Number.isFinite(n));
  const reps=logs.map(s=>s.reps).filter(n=>typeof n==='number'&&Number.isFinite(n));
  return {...r,logs,peakWeight:weights.length?Math.max(...weights):null,peakReps:reps.length?Math.max(...reps):null};
 });
}
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const WEIGHT_COLOR='#ff792e',REPS_COLOR='#72c6ff';
// Round an axis top up to 1, 2, 2.5 or 5 × 10ⁿ so the four gridlines land on readable numbers.
function niceMax(v){const raw=Math.max(1,v)*1.05/4,p=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].find(s=>s*p>=raw)*p;return step*4;}
const short=n=>Number(n.toFixed(1));
// One chart, two lines: weight on the left axis (orange), reps on the right axis (blue).
function chart(rows,unit){
 const wrap=el('div');wrap.className='exercise-history-chart';
 const legend=el('div');legend.className='exercise-history-legend';
 for(const [color,text] of [[WEIGHT_COLOR,'น้ำหนักสูงสุด ('+unit+') · แกนซ้าย'],[REPS_COLOR,'ครั้งสูงสุด · แกนขวา']]){const item=el('span',text);item.style.setProperty('--dot',color);legend.append(item);}
 wrap.append(el('h4','น้ำหนักและจำนวนครั้ง'),legend);
 const W=360,H=210,L=40,R=320,T=14,B=170;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','กราฟน้ำหนักและจำนวนครั้งสูงสุดตามลำดับการบันทึก');
 const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;svg.append(n);return n;};
 const weights=rows.map(r=>r.peakWeight==null?null:Number(fromKg(r.peakWeight,unit))),reps=rows.map(r=>r.peakReps);
 const wMax=niceMax(Math.max(0,...weights.filter(v=>v!=null))),rMax=niceMax(Math.max(0,...reps.filter(v=>v!=null)));
 for(let i=0;i<=4;i++){const y=B-i*(B-T)/4;add('line',{x1:L,y1:y,x2:R,y2:y,stroke:'currentColor',opacity:'.15'});
  add('text',{x:L-6,y:y+4,'text-anchor':'end',fill:WEIGHT_COLOR,'font-size':11},short(wMax*i/4));
  add('text',{x:R+6,y:y+4,'text-anchor':'start',fill:REPS_COLOR,'font-size':11},short(rMax*i/4));}
 const x=i=>rows.length===1?(L+R)/2:L+12+i*(R-L-24)/(rows.length-1);
 const labels=rows.length<=6;
 const yOf=(v,max)=>v==null?null:B-v/max*(B-T),wy=weights.map(v=>yOf(v,wMax)),ry=reps.map(v=>yOf(v,rMax));
 // Each value label sits on the side away from the other line, so the two never overlap where the lines cross.
 const series=(values,max,color,tip,label,mine,other,above)=>{
  const y=v=>B-v/max*(B-T);let segment=[];
  const flush=()=>{if(segment.length>1)add('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'});segment=[];};
  values.forEach((v,i)=>{if(v==null){flush();return;}segment.push(x(i)+','+y(v));});flush();
  values.forEach((v,i)=>{if(v==null)return;const dot=add('circle',{cx:x(i),cy:y(v),r:4.5,fill:color,stroke:'#1d1d1d','stroke-width':1.5,tabindex:0});const t=document.createElementNS(ns,'title');t.textContent=rows[i].day+' · บันทึกที่ '+(i+1)+': '+tip(i,v);dot.append(t);
   if(labels)add('text',{x:x(i),y:Math.min(B-4,Math.max(T+10,y(v)+((other[i]==null?above:(mine[i]<other[i]||(mine[i]===other[i]&&above)))?-9:16))),'text-anchor':'middle',fill:color,'font-size':11,'font-weight':600},label(v));});
 };
 series(weights,wMax,WEIGHT_COLOR,i=>formatWeight(rows[i].peakWeight,unit),v=>short(v),wy,ry,true);
 series(reps,rMax,REPS_COLOR,(i,v)=>v+' ครั้ง',v=>v+'×',ry,wy,false);
 const ticks=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])];
 for(const i of ticks)add('text',{x:x(i),y:H-16,'text-anchor':rows.length===1?'middle':i===0?'start':i===rows.length-1?'end':'middle',fill:'currentColor','font-size':11},rows[i].day.slice(5).replace('-','/')+' #'+(i+1));
 wrap.append(svg);return wrap;
}
export function createExerciseHistory(){
 const box=el('section');box.className='exercise-history';box.setAttribute('aria-label','กราฟประวัติท่าที่เลือก');
 function update(records,exercise,type,day,exclude){
  box.hidden=type==='cardio'||!exercise.trim();box.replaceChildren();if(box.hidden)return;
  const rows=exerciseHistory(records,exercise,day,exclude),unit=preferredWeightUnit();box.append(el('h3','ประวัติ · '+exercise));
  if(!rows.length){box.append(el('p','ยังไม่มีประวัติท่านี้ เมื่อบันทึกแล้วจะดูกราฟย้อนหลังได้ที่นี่'));return;}
  box.append(el('p',rows.length+' บันทึก ถึง '+day+' · จุดเรียงจากเก่าไปใหม่ แต่ละจุดคือหนึ่งบันทึก'));
  box.append(chart(rows,unit));
  box.append(el('p','แต่ละจุดคือค่าสูงสุดของบันทึกนั้น · ดูน้ำหนักคู่กับจำนวนครั้งจริงทุกเซ็ตได้ในตารางด้านล่าง'));
  const details=el('details'),summary=el('summary','ดูประวัติทุกเซ็ต ('+rows.length+' บันทึก)'),scroll=el('div'),table=el('table'),head=el('thead'),tr=el('tr');scroll.className='exercise-history-table';for(const t of ['บันทึก','วันที่','ผลการฝึก'])tr.append(el('th',t));head.append(tr);table.append(head);const body=el('tbody');
  [...rows].reverse().forEach((r,i)=>{const row=el('tr');row.append(el('td','#'+(rows.length-i)),el('td',r.day));const cell=el('td');if(r.setLogs?.length){r.logs.forEach((s,j)=>cell.append(el('div','เซ็ต '+(j+1)+': '+formatWeight(s.weight,unit)+' × '+(s.reps??'ไม่ระบุ')+' ครั้ง')));}else cell.textContent=formatWeight(r.weight,unit)+' · '+(r.sets??'ไม่ระบุ')+' เซ็ต × '+(r.reps??'ไม่ระบุ')+' ครั้ง';if(r.sessionComplete===false)cell.append(el('div','ยังฝึกไม่ครบ'));row.append(cell);body.append(row);});table.append(body);scroll.append(table);details.append(summary,scroll);box.append(details);
 }
 return {element:box,update};
}
