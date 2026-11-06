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
function chart(rows,key,title,unit){
 const wrap=el('div'),heading=el('h4',title);wrap.className='exercise-history-chart';wrap.append(heading);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 220');svg.setAttribute('role','img');svg.setAttribute('aria-label',title+' ตามลำดับการบันทึก');
 const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;svg.append(n);return n;};
 const values=rows.map(r=>r[key]==null?null:key==='peakWeight'?Number(fromKg(r[key],unit)):r[key]);const max=Math.max(1,...values.filter(v=>v!=null))*1.1;
 for(let i=0;i<=4;i++){const y=175-i*38;add('line',{x1:54,y1:y,x2:616,y2:y,stroke:'currentColor',opacity:'.15'});add('text',{x:46,y:y+4,'text-anchor':'end',fill:'currentColor','font-size':12},Number((max*i/4).toFixed(1)));}
 const x=i=>rows.length===1?335:54+i*562/(rows.length-1),y=v=>175-v/max*152;
 let segment=[];const flush=()=>{if(segment.length)add('polyline',{points:segment.join(' '),fill:'none',stroke:key==='peakWeight'?'#ff792e':'#72c6ff','stroke-width':3});segment=[];};
 values.forEach((v,i)=>{if(v==null){flush();return;}segment.push(x(i)+','+y(v));});flush();
 values.forEach((v,i)=>{if(v==null)return;const dot=add('circle',{cx:x(i),cy:y(v),r:5,fill:key==='peakWeight'?'#ff792e':'#72c6ff',tabindex:0});const tip=document.createElementNS(ns,'title');tip.textContent=rows[i].day+' · บันทึกที่ '+(i+1)+': '+(key==='peakWeight'?formatWeight(rows[i][key],unit):v+' ครั้ง');dot.append(tip);});
 const ticks=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])];for(const i of ticks)add('text',{x:x(i),y:202,'text-anchor':'middle',fill:'currentColor','font-size':12},rows[i].day.slice(5)+' (#'+(i+1)+')');
 wrap.append(svg);return wrap;
}
export function createExerciseHistory(){
 const box=el('section');box.className='exercise-history';box.setAttribute('aria-label','กราฟประวัติท่าที่เลือก');
 function update(records,exercise,type,day,exclude){
  box.hidden=type==='cardio'||!exercise.trim();box.replaceChildren();if(box.hidden)return;
  const rows=exerciseHistory(records,exercise,day,exclude),unit=preferredWeightUnit();box.append(el('h3','ประวัติ · '+exercise));
  if(!rows.length){box.append(el('p','ยังไม่มีประวัติท่านี้ เมื่อบันทึกแล้วจะดูกราฟย้อนหลังได้ที่นี่'));return;}
  box.append(el('p',rows.length+' บันทึก ถึง '+day+' · จุดเรียงจากเก่าไปใหม่ แต่ละจุดคือหนึ่งบันทึก'));
  box.append(chart(rows,'peakWeight','น้ำหนักสูงสุดต่อเซ็ต ('+unit+')',unit),chart(rows,'peakReps','จำนวนครั้งสูงสุดต่อเซ็ต (ครั้ง)',unit));
  box.append(el('p','กราฟใช้ค่าสูงสุดของแต่ละบันทึก ดูน้ำหนักและจำนวนครั้งที่คู่กันจริงได้ในตาราง · น้ำหนักตัว = 0 · ค่าที่ไม่ระบุจะเว้นช่องในกราฟ'));
  const details=el('details'),summary=el('summary','ดูประวัติทุกเซ็ต ('+rows.length+' บันทึก)'),scroll=el('div'),table=el('table'),head=el('thead'),tr=el('tr');scroll.className='exercise-history-table';for(const t of ['บันทึก','วันที่','ผลการฝึก'])tr.append(el('th',t));head.append(tr);table.append(head);const body=el('tbody');
  [...rows].reverse().forEach((r,i)=>{const row=el('tr');row.append(el('td','#'+(rows.length-i)),el('td',r.day));const cell=el('td');if(r.setLogs?.length){r.logs.forEach((s,j)=>cell.append(el('div','เซ็ต '+(j+1)+': '+formatWeight(s.weight,unit)+' × '+(s.reps??'ไม่ระบุ')+' ครั้ง')));}else cell.textContent=formatWeight(r.weight,unit)+' · '+(r.sets??'ไม่ระบุ')+' เซ็ต × '+(r.reps??'ไม่ระบุ')+' ครั้ง';if(r.sessionComplete===false)cell.append(el('div','ยังฝึกไม่ครบ'));row.append(cell);body.append(row);});table.append(body);scroll.append(table);details.append(summary,scroll);box.append(details);
 }
 return {element:box,update};
}
