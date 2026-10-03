// Weight trend chart for the overview (single series, SVG). The range ends at the page's
// selected day, with a crosshair tooltip, the target weight as a dashed reference line and
// a screen-reader table of the same points.
const SVG='http://www.w3.org/2000/svg';
const el=(tag,attrs={},parent)=>{const e=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const shortDate=day=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(new Date(day+'T12:00:00'));
const longDate=day=>new Intl.DateTimeFormat('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'}).format(new Date(day+'T12:00:00'));
const dayNum=day=>Date.parse(day+'T12:00:00Z')/864e5;
const RANGES=[['30','30 วัน'],['90','90 วัน'],['all','ทั้งหมด']];

export function createWeightChart(root){
 root.classList.add('weight-chart');
 const head=node('div',undefined,'wc-head'),title=node('h3','กราฟน้ำหนัก'),ranges=node('div',undefined,'wc-ranges');
 ranges.setAttribute('role','group');ranges.setAttribute('aria-label','ช่วงเวลาของกราฟ');
 const plot=node('div',undefined,'wc-plot'),tip=node('div',undefined,'wc-tip'),stats=node('div',undefined,'wc-stats'),table=node('table',undefined,'visually-hidden');
 tip.hidden=true;head.append(title,ranges);plot.append(tip);root.replaceChildren(head,plot,stats,table);
 let range='90',state={points:[],end:null,target:null};
 for(const [key,label] of RANGES){const b=node('button',label,'wc-range');b.type='button';b.dataset.range=key;b.onclick=()=>{range=key;draw();};ranges.append(b);}
 new ResizeObserver(()=>draw()).observe(plot);

 function draw(){
  ranges.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===range)));
  const {end,target}=state,all=state.points.filter(p=>p.day<=end);
  const pts=range==='all'?all:all.filter(p=>dayNum(end)-dayNum(p.day)<Number(range));
  [...plot.querySelectorAll('svg,.wc-empty')].forEach(e=>e.remove());tip.hidden=true;stats.replaceChildren();table.replaceChildren();
  if(pts.length<2){plot.append(node('p',all.length<2?'ชั่งน้ำหนักอย่างน้อย 2 วัน แล้วกราฟจะขึ้นที่นี่':'ช่วงนี้มีน้ำหนักแค่ 1 ครั้ง ลองเลือกช่วงที่ยาวขึ้น','wc-empty'));return;}
  const W=Math.max(260,plot.clientWidth),H=190,L=40,R=16,T=14,B=26;
  // Y: nice 1/2/5 kg steps around the data (and the target when it is close by).
  const ws=pts.map(p=>p.weight),tgt=target!=null&&Math.abs(target-ws.at(-1))<=15?target:null;
  let lo=Math.min(...ws,tgt??Infinity),hi=Math.max(...ws,tgt??-Infinity);
  const step=[1,2,5,10].find(s=>(hi-lo)/s<=4)||10;lo=Math.floor((lo-0.3)/step)*step;hi=Math.ceil((hi+0.3)/step)*step;
  const x0=dayNum(pts[0].day),x1=Math.max(dayNum(pts.at(-1).day),x0+1);
  const X=d=>L+(dayNum(d)-x0)/(x1-x0)*(W-L-R),Y=w=>T+(hi-w)/(hi-lo)*(H-T-B);
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,width:W,height:H,role:'img','aria-label':'กราฟน้ำหนัก '+pts.length+' ครั้ง ล่าสุด '+ws.at(-1)+' กก.'});
  // Recessive grid + y labels
  for(let v=lo;v<=hi+1e-9;v+=step){el('line',{x1:L,x2:W-R,y1:Y(v),y2:Y(v),class:'wc-grid'},svg);el('text',{x:L-8,y:Y(v)+4,class:'wc-axis','text-anchor':'end'},svg).textContent=String(v);}
  // X labels: first, middle, last
  const idx=[...new Set([0,Math.floor((pts.length-1)/2),pts.length-1])];
  for(const i of idx){const t=el('text',{x:X(pts[i].day),y:H-6,class:'wc-axis','text-anchor':i===0?'start':i===pts.length-1?'end':'middle'},svg);t.textContent=shortDate(pts[i].day);}
  if(tgt!=null){el('line',{x1:L,x2:W-R,y1:Y(tgt),y2:Y(tgt),class:'wc-target'},svg);el('text',{x:W-R,y:Y(tgt)-6,class:'wc-target-label','text-anchor':'end'},svg).textContent='เป้าหมาย '+tgt;}
  // Area + line
  const line=pts.map((p,i)=>(i?'L':'M')+X(p.day).toFixed(1)+','+Y(p.weight).toFixed(1)).join('');
  const defs=el('defs',{},svg),grad=el('linearGradient',{id:'wc-fill',x1:0,x2:0,y1:0,y2:1},defs);
  el('stop',{offset:'0','stop-color':'#ff7028','stop-opacity':'0.22'},grad);el('stop',{offset:'1','stop-color':'#ff7028','stop-opacity':'0'},grad);
  el('path',{d:line+`L${X(pts.at(-1).day).toFixed(1)},${H-B}L${X(pts[0].day).toFixed(1)},${H-B}Z`,fill:'url(#wc-fill)'},svg);
  el('path',{d:line,class:'wc-line'},svg);
  if(pts.length<=40)for(const p of pts.slice(0,-1))el('circle',{cx:X(p.day),cy:Y(p.weight),r:3,class:'wc-dot'},svg);
  const last=pts.at(-1);el('circle',{cx:X(last.day),cy:Y(last.weight),r:5,class:'wc-dot last'},svg);
  const label=el('text',{x:X(last.day)-8,y:Y(last.weight)-10,class:'wc-last','text-anchor':'end'},svg);label.textContent=last.weight+' กก.';
  // Crosshair + tooltip (hit area is the whole plot)
  const cross=el('line',{y1:T,y2:H-B,class:'wc-cross',visibility:'hidden'},svg),focus=el('circle',{r:6,class:'wc-focus',visibility:'hidden'},svg);
  const hit=el('rect',{x:L,y:0,width:W-L-R,height:H,fill:'transparent'},svg);
  const show=ev=>{
   const box=svg.getBoundingClientRect(),mx=(ev.clientX-box.left)*W/box.width;
   let i=0;for(let k=1;k<pts.length;k++)if(Math.abs(X(pts[k].day)-mx)<Math.abs(X(pts[i].day)-mx))i=k;
   const p=pts[i],px=X(p.day),py=Y(p.weight),prev=pts[i-1];
   cross.setAttribute('x1',px);cross.setAttribute('x2',px);cross.setAttribute('visibility','visible');
   focus.setAttribute('cx',px);focus.setAttribute('cy',py);focus.setAttribute('visibility','visible');
   const diff=prev?Math.round((p.weight-prev.weight)*10)/10:null;
   tip.replaceChildren(node('span',longDate(p.day)),node('strong',p.weight+' กก.'),...(diff!==null?[node('span',(diff===0?'เท่าเดิม':(diff<0?'▼ ':'▲ ')+Math.abs(diff)+' กก.')+' จากครั้งก่อน','wc-diff '+(diff<0?'down':diff>0?'up':''))]:[]));
   tip.hidden=false;const left=px/W*plot.clientWidth;tip.style.left=Math.min(Math.max(left,70),plot.clientWidth-70)+'px';tip.style.top=Math.max(py/H*190-64,0)+'px';
  };
  const hide=()=>{cross.setAttribute('visibility','hidden');focus.setAttribute('visibility','hidden');tip.hidden=true;};
  hit.addEventListener('pointermove',show);hit.addEventListener('pointerdown',show);hit.addEventListener('pointerleave',hide);
  plot.prepend(svg);
  // Summary for the range
  const first=pts[0],change=Math.round((last.weight-first.weight)*10)/10;
  const items=[['ช่วงนี้',(change===0?'เท่าเดิม':(change<0?'▼ ':'▲ ')+Math.abs(change)+' กก.'),change<0?'down':change>0?'up':''],['เริ่มต้น',first.weight+' กก.'],['ต่ำสุด',Math.min(...ws)+' กก.'],['สูงสุด',Math.max(...ws)+' กก.']];
  // Distance to the target is shown even when the target is too far away to draw on the chart.
  if(target!=null){const left=Math.round((last.weight-target)*10)/10;items.push(['เป้าหมาย '+target,left===0?'ถึงแล้ว 🎉':(left>0?'อีก '+left+' กก.':'ต่ำกว่า '+Math.abs(left)+' กก.')]);}
  for(const [k,v,cls] of items){const c=node('div');c.append(node('span',k),node('strong',v,cls||''));stats.append(c);}
  table.append(node('caption','น้ำหนักตามวันที่'));
  for(const p of pts){const tr=node('tr');tr.append(node('td',longDate(p.day)),node('td',p.weight+' กก.'));table.append(tr);}
 }
 return {update(points,end,target){state={points:[...points].sort((a,b)=>a.day.localeCompare(b.day)),end,target};draw();}};
}
