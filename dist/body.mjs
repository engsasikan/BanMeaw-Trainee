import {api} from './account.js?v=2';
import {FIELDS,SEGMENTS,BASIC,GIRTHS,validateBody} from './body-data.mjs';
import {localDay} from './store.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(day+'T12:00:00'));
const fmt=(key,v)=>v==null?'–':v+' '+FIELDS[key].unit;
let threeModule;
const loadThree=()=>threeModule??=import('./body3d.js?v=3');

// A self-contained body card (3D figure, mode switch, stats, date picker); used on the
// profile page and in a trainer's view of a team member.
export function createBodyViewer(root){
 root.classList.add('body-viewer');
 const head=node('div',undefined,'list-heading'),picker=node('select');picker.setAttribute('aria-label','เลือกวันที่วัด');
 head.append(node('h2','หุ่นของฉัน'),picker);
 const modes=node('div',undefined,'body-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','รูปแบบการแสดงผล');
 const stage=node('div',undefined,'body-stage'),legend=node('p',undefined,'body-legend'),stats=node('div',undefined,'body-stats'),note=node('p',undefined,'muted body-estimate');
 root.replaceChildren(head,modes,stage,legend,stats,note);
 let records=[],current=null,mode='shape',figure=null;
 for(const [key,label] of [['shape','รูปร่าง'],['fat','ไขมัน'],['muscle','กล้ามเนื้อ']]){
  const b=button(label,'quiet',()=>{mode=key;draw();});b.dataset.mode=key;modes.append(b);
 }
 picker.onchange=()=>{current=records.find(r=>r.id===picker.value);draw();};
 async function draw(){
  modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  stats.replaceChildren();note.textContent='';
  if(!current){stage.classList.add('empty-stage');legend.textContent='กรอกค่าร่างกายเพื่อดูหุ่น 3D';}
  else stage.classList.remove('empty-stage');
  try{
   const three=await loadThree();
   if(!figure){figure=three.mountBody(stage);}
   const shape=await figure.update(current||{},mode);
   if(!current)return;
   legend.textContent=mode==='fat'?'สีส้มเข้ม = ไขมันเกินมาตรฐาน · สีอ่อน = ไขมันน้อย (ตามค่าแต่ละส่วน)':mode==='muscle'?'สีฟ้าเข้ม = กล้ามเนื้อมาก · สีเทา = น้อย (เทียบค่าเฉลี่ย)':'รูปร่างจากส่วนสูง น้ำหนัก และสัดส่วนที่กรอก';
   if(shape.estimated.length)note.textContent='ประมาณจากส่วนสูงและน้ำหนัก: '+shape.estimated.map(k=>FIELDS[k].label).join(', ');
   if(mode!=='shape'&&SEGMENTS.every(([s])=>current[(mode==='fat'?'fat_':'mus_')+s]==null))note.textContent=(mode==='fat'?'ยังไม่ได้กรอกไขมันแต่ละส่วน ใช้ % ไขมันรวมแทน':'ยังไม่ได้กรอกกล้ามเนื้อแต่ละส่วน');
  }catch{stage.classList.add('empty-stage');legend.textContent='อุปกรณ์นี้แสดง 3D ไม่ได้ แต่ยังดูตัวเลขได้';}
  if(!current)return;
  const bmi=current.height&&current.weight?Math.round(current.weight/(current.height/100)**2*10)/10:null;
  const items=[['น้ำหนัก',fmt('weight',current.weight)],['BMI',bmi??'–'],['ไขมัน',fmt('body_fat',current.body_fat)],['กล้ามเนื้อ',fmt('muscle',current.muscle)]];
  if(current.visceral!=null)items.push(['ไขมันช่องท้อง',fmt('visceral',current.visceral)]);
  if(current.waist&&current.hip)items.push(['เอว/สะโพก',(current.waist/current.hip).toFixed(2)]);
  const grid=node('div',undefined,'body-stat-grid');for(const [k,v] of items){const cell=node('div');cell.append(node('span',k),node('strong',String(v)));grid.append(cell);}stats.append(grid);
  if(mode!=='shape'){
   const prefix=mode==='fat'?'fat_':'mus_',table=node('div',undefined,'body-seg-grid');
   for(const [s,label] of SEGMENTS){const cell=node('div');cell.append(node('span',label),node('strong',fmt(prefix+s,current[prefix+s])));table.append(cell);}
   stats.append(table);
  }
 }
 return {
  show(list,selectedId){
   records=list;current=list.find(r=>r.id===selectedId)||list[0]||null;
   picker.replaceChildren(...list.map(r=>{const o=node('option',thaiDate(r.day));o.value=r.id;o.selected=r===current;return o;}));picker.hidden=!list.length;
   draw();
  },
  setTitle(text){head.querySelector('h2').textContent=text;},
  // Show an unsaved record from the form (live preview while typing).
  preview(record){current=record;picker.value='';draw().then(()=>{if(current===record)legend.textContent='ตัวอย่างจากค่าที่กำลังกรอก (ยังไม่บันทึก)';});},
  dispose(){figure?.dispose();figure=null;},
 };
}

// ---- Profile page (own measurements) ----
let records=[],editing=null,viewer;
const input=key=>$('bf-'+key);
function buildForm(){
 const groups={'body-basic':BASIC,'body-girths':GIRTHS,'body-fat':SEGMENTS.map(([s])=>'fat_'+s),'body-muscle':SEGMENTS.map(([s])=>'mus_'+s)};
 for(const [id,keys] of Object.entries(groups)){
  const box=$(id);box.replaceChildren();
  for(const key of keys){const f=FIELDS[key],wrap=node('div'),label=node('label',f.label+' ('+f.unit+')'),field=node('input');
   label.htmlFor='bf-'+key;Object.assign(field,{id:'bf-'+key,type:'number',min:f.min,max:f.max,step:'0.1',inputMode:'decimal',placeholder:'–'});
   wrap.append(label,field);box.append(wrap);}
 }
}
function fillForm(r){
 editing=r?.id??null;$('body-day').value=r?.day??localDay();
 const last=records[0];$('body-sex').value=r?.sex??last?.sex??'male';
 for(const key of Object.keys(FIELDS))input(key).value=r?.[key]??(!r&&key==='height'&&last?.height?last.height:'');
 $('body-note').value=r?.note??'';
 $('body-form-title').textContent=r?'แก้ไขค่าวันที่ '+thaiDate(r.day):'บันทึกค่าร่างกาย';
 $('body-cancel').hidden=!r;$('body-save').textContent=r?'บันทึกการแก้ไข':'บันทึกค่าร่างกาย';
}
function renderHistory(selectedId){
 const box=$('body-history');box.replaceChildren();
 if(!records.length){box.append(node('p','ยังไม่มีประวัติ กรอกค่าครั้งแรกด้านบนได้เลย','muted'));return;}
 for(const r of records){
  const row=node('div',undefined,'team-row'),info=node('div');
  info.append(node('strong',thaiDate(r.day)),node('span',[r.weight!=null?r.weight+' กก.':'',r.body_fat!=null?'ไขมัน '+r.body_fat+'%':'',r.muscle!=null?'กล้ามเนื้อ '+r.muscle+' กก.':''].filter(Boolean).join(' · ')||'มีค่าสัดส่วน','muted'));
  const actions=node('div',undefined,'team-actions');
  actions.append(button('ดูหุ่น','primary',()=>{viewer.show(records,r.id);$('body-viewer').scrollIntoView({behavior:'smooth',block:'start'});}),
   button('แก้ไข','quiet',()=>{fillForm(r);$('body-form').scrollIntoView({behavior:'smooth',block:'start'});}),
   button('ลบ','quiet',async()=>{if(!confirm('ลบค่าร่างกายวันที่ '+thaiDate(r.day)+'?'))return;try{await api('/api/body/'+encodeURIComponent(r.id),{method:'DELETE'});await loadBody();say('ลบแล้ว');}catch(error){say(error.message);}}));
  row.append(info,actions);box.append(row);
 }
}
const say=text=>{$('body-message').textContent=text;};
async function loadBody(selectedId){
 ({records}=await api('/api/body'));
 viewer.show(records,selectedId);renderHistory();if(!editing)fillForm(null);
}
export function initBody(){
 viewer=createBodyViewer($('body-viewer'));buildForm();fillForm(null);
 $('body-cancel').onclick=()=>{fillForm(null);viewer.show(records);};
 // Re-shape the figure as the form changes, before saving.
 let previewTimer;
 const preview=()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>{
  const row={id:'preview',day:$('body-day').value,sex:$('body-sex').value};
  for(const key of Object.keys(FIELDS)){const v=Number(input(key).value);const f=FIELDS[key];row[key]=input(key).value.trim()!==''&&v>=f.min&&v<=f.max?v:null;}
  viewer.preview(row);
 },250);};
 $('body-form').addEventListener('input',preview);$('body-form').addEventListener('change',preview);
 $('body-form').onsubmit=async e=>{
  e.preventDefault();const button=$('body-save');button.disabled=true;
  try{
   const row={id:editing||crypto.randomUUID(),day:$('body-day').value,sex:$('body-sex').value,note:$('body-note').value};
   for(const key of Object.keys(FIELDS)){const raw=input(key).value.trim();row[key]=raw===''?null:Number(raw);}
   const valid=validateBody(row);
   await api('/api/body/'+encodeURIComponent(valid.id),{method:'PUT',body:JSON.stringify(valid)});
   editing=null;await loadBody(valid.id);say('บันทึกค่าร่างกายแล้ว');
  }catch(error){say(error.message==='ข้อมูลร่างกายไม่ถูกต้อง'?'มีค่าที่อยู่นอกช่วงที่รับได้ กรุณาตรวจอีกครั้ง':error.message);}
  finally{button.disabled=false;}
 };
 document.querySelectorAll('[data-view="settings"]').forEach(b=>b.addEventListener('click',()=>loadBody().catch(error=>say(error.message))));
}
