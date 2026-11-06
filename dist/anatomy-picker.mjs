import {searchExercises} from './exercise-picker.mjs?v=10';
import {musclesFor,MUSCLE_LABELS} from './exercise-muscles.mjs?v=2';

const GROUPS=[['pec','อก'],['deltoid','ไหล่'],['biceps','หน้าแขน'],['triceps','หลังแขน'],['abs','หน้าท้อง'],['oblique','ข้างท้อง'],['lat','ปีกหลัง'],['trap','บ่า / หลังบน'],['erector','หลังล่าง'],['glute','ก้น'],['quad','หน้าขา'],['hamstring','หลังขา'],['calf','น่อง']];
const SIDES={front:['pec','deltoid','biceps','abs','oblique','quad','calf'],back:['trap','deltoid','triceps','lat','erector','glute','hamstring','calf']};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function exercisesForMuscle(muscle,query=''){
 return searchExercises(query).filter(x=>x.group!=='คาร์ดิโอ'&&musclesFor(x.name,x.aliases)?.primary.includes(muscle));
}
export function createAnatomyPicker({onChoose,actionLabel='เพิ่มเข้าโปรแกรม'}={}){
 const root=el('section',undefined,'anatomy-picker'),title=el('h3','เลือกกล้ามเนื้อ → เลือกท่าฝึก');
 const layout=el('div',undefined,'anatomy-layout'),left=el('div'),right=el('div'),views=el('div',undefined,'anatomy-views'),map=el('div',undefined,'anatomy-map'),chips=el('div',undefined,'anatomy-chips');
 const heading=el('h4'),search=el('input'),list=el('div',undefined,'anatomy-results'),status=el('p','','muted'),more=el('button','ดูท่าเพิ่มเติม','quiet');
 search.type='search';search.placeholder='ค้นหาท่าในกล้ามเนื้อที่เลือก';search.setAttribute('aria-label','ค้นหาท่าตามกล้ามเนื้อ');status.setAttribute('role','status');more.type='button';
 let selected='pec',side='front',limit=6,preview=null,figure=null,mounting=null,drawTicket=0;
 map.setAttribute('aria-label','หุ่นกล้ามเนื้อ 3D หมุนดูและแตะเลือกกล้ามเนื้อได้');
 map.append(el('p','กำลังเตรียมหุ่นกล้ามเนื้อ 3D…','anatomy-loading'));
 async function drawFigure(){
  const ticket=++drawTicket;
  try{
   mounting??=import('./body3d.js?v=24').then(m=>{map.replaceChildren();return m.mountBody(map,{fixedView:'front',onMuscleSelect:key=>{if(GROUPS.some(([k])=>k===key))select(key);}});});
   figure=await mounting;
   if(ticket!==drawTicket)return;
   await figure.update({sex:'male',height:175,weight:72,body_fat:12,focus:{primary:[selected],secondary:[]}},'focus');
   if(ticket===drawTicket)figure.setView(side);
  }catch{mounting=null;map.replaceChildren(el('p','แสดงหุ่น 3D ไม่ได้ เลือกชื่อกล้ามเนื้อด้านล่างได้เลย','anatomy-loading'));}
 }
 if(typeof IntersectionObserver!=='undefined'){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();drawFigure();}});observer.observe(map);}
 const groupButtons=[],viewButtons=[];
 for(const [value,label] of [['front','ด้านหน้า'],['back','ด้านหลัง']]){const b=el('button',label,'quiet');b.type='button';b.onclick=()=>{side=value;if(!SIDES[side].includes(selected))select(side==='front'?'pec':'lat');else drawMap();};views.append(b);viewButtons.push([value,b]);}
 for(const [key,label] of GROUPS){const b=el('button',label,'quiet');b.type='button';b.onclick=()=>select(key);chips.append(b);groupButtons.push([key,b]);}
 function select(key){selected=key;limit=6;search.value='';if(!SIDES[side].includes(key))side=side==='front'?'back':'front';drawMap();render();}
 function drawMap(){
  if(figure||mounting)drawFigure();
  for(const [key,b] of viewButtons)b.setAttribute('aria-pressed',String(key===side));
  for(const [key,b] of groupButtons)b.setAttribute('aria-pressed',String(key===selected));
 }
 async function showPreview(name,button){
  button.disabled=true;
  try{const {createMuscleFocus}=await import('./exercise-preview.mjs?v=8');if(!preview){preview=createMuscleFocus();right.append(preview.el);}preview.show(name);preview.el.scrollIntoView({behavior:'smooth',block:'nearest'});}
  catch{status.textContent='เปิดตัวอย่างท่าไม่ได้ กรุณาลองอีกครั้ง';}finally{button.disabled=false;}
 }
 function render(){
  heading.textContent='ท่าฝึก'+MUSCLE_LABELS[selected];const matches=exercisesForMuscle(selected,search.value);list.replaceChildren();
  for(const x of matches.slice(0,limit)){
   const row=el('article',undefined,'anatomy-exercise'),info=el('div'),actions=el('div',undefined,'anatomy-actions');
   const muscles=musclesFor(x.name,x.aliases);info.append(el('strong',x.name),el('small','กล้ามเนื้อหลัก: '+muscles.primary.map(k=>MUSCLE_LABELS[k]||k).join(' · ')));
   const add=el('button',actionLabel,'primary'),view=el('button','ดูท่า 3D','quiet');add.type=view.type='button';
   add.setAttribute('aria-label',actionLabel+' '+x.name);add.onclick=()=>{status.textContent=onChoose?.(x)===false?'ยังไม่ได้เพิ่มท่า กรุณาตรวจข้อความในแบบฟอร์ม':'เพิ่ม '+x.name+' แล้ว';};view.onclick=()=>showPreview(x.name,view);
   actions.append(view,add);row.append(info,actions);list.append(row);
  }
  status.textContent=matches.length?'แสดง '+Math.min(limit,matches.length)+' จาก '+matches.length+' ท่า · กล้ามเนื้อหลักตรงกับส่วนที่เลือก':'ไม่พบท่า ลองค้นหาคำอื่น';more.hidden=matches.length<=limit;
  if(preview)preview.show('');
 }
 search.addEventListener('input',()=>{limit=6;render();});more.onclick=()=>{limit+=6;render();};
 left.append(views,map,el('p','ลากเพื่อหมุน · แตะกล้ามเนื้อเพื่อเลือก · สีส้มคือส่วนที่เลือก','muted'),chips);right.append(heading,search,list,more,status);layout.append(left,right);root.append(title,layout);drawMap();render();return root;
}
