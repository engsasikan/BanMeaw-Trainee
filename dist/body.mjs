import {api} from './account.js?v=2';
import {FIELDS,SEGMENTS,GROUPS,validateBody,resolveBodyRecords,BOWEL_STATUS_LABELS} from './body-data.mjs';
import {localDay} from './store.mjs';
import {createWeightChart} from './weight-chart.mjs?v=1';
import {parseInBodyCsv} from './inbody-csv.mjs?v=1';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls,onclick)=>{const b=node('button',text,cls);b.type='button';b.onclick=onclick;return b;};
const thaiDate=day=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(day+'T12:00:00'));
const fmt=(key,v)=>v==null?'–':v+(FIELDS[key].unit?' '+FIELDS[key].unit:'');
let threeModule;
const loadThree=()=>threeModule??=import('./body3d.js?v=25');

// A self-contained body card (3D figure, mode switch, stats, date picker); used on the
// profile page and in a trainer's view of a team member.
export function createBodyViewer(root,{onSelect,isVisible=()=>true}={}){
 root.classList.add('body-viewer');
 const head=node('div',undefined,'list-heading'),picker=node('select');picker.setAttribute('aria-label','เลือกวันที่วัด');
 head.append(node('h2','หุ่นของฉัน'),picker);
 const modes=node('div',undefined,'body-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','รูปแบบการแสดงผล');
 const stage=node('div',undefined,'body-stage'),legend=node('p',undefined,'body-legend'),stats=node('div',undefined,'body-stats'),note=node('p',undefined,'muted body-estimate');
 legend.setAttribute('role','status');
 root.replaceChildren(head,modes,legend,stage,stats,note);
 let records=[],current=null,mode='composition',figure=null,fallbackSex='male',drawVersion=0;
 for(const [key,label] of [['composition','กล้าม/ไขมัน'],['shape','รูปร่าง'],['muscle','กล้ามเนื้อแต่ละส่วน']]){
  const b=button(label,'quiet',()=>{mode=key;draw();});b.dataset.mode=key;modes.append(b);
 }
 picker.onchange=()=>{current=records.find(r=>r.id===picker.value);draw();onSelect?.(current);};
 async function draw(){
  if(!isVisible())return;
  const version=++drawVersion;
  modes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  stats.replaceChildren();note.textContent='';
  if(!current&&mode!=='composition'){stage.classList.add('empty-stage');legend.textContent='กรอกค่าร่างกายเพื่อดูหุ่น 3D';}
  else stage.classList.remove('empty-stage');
  try{
   legend.textContent='กำลังโหลดหุ่น 3D…';legend.dataset.loading='true';
   const three=await loadThree();
   if(version!==drawVersion||!isVisible())return;
   if(!figure){figure=three.mountBody(stage);}
   const shape=await figure.update({...current,sex:current?.sex||fallbackSex},mode);
   if(version!==drawVersion)return;
   if(!current){legend.textContent='กรอกค่าร่างกายเพื่อดูหุ่น 3D';return;}
   legend.textContent=mode==='composition'?'สีแดง = กล้ามเนื้อ · สีเหลือง = ภาพประมาณไขมันสะสมแยกแต่ละส่วน · บริเวณสีแดงไม่ได้หมายความว่าไม่มีไขมัน':mode==='fat'?'สีส้มเข้ม = ไขมันมาก · สีอ่อน = ไขมันน้อย':mode==='muscle'?'🟦 ต่ำกว่ามาตรฐาน · ⬜ มาตรฐาน (100%) · 🟧 สูงกว่ามาตรฐาน — ดู % แต่ละส่วนในตารางด้านล่าง':'รูปร่างจากส่วนสูง น้ำหนัก ไขมัน กล้ามเนื้อ และสัดส่วนที่กรอก';
   if(mode!=='muscle'&&shape.estimated.length)note.textContent='ประมาณจากส่วนสูงและน้ำหนัก: '+shape.estimated.map(k=>FIELDS[k].label).join(', ');
   if(mode==='composition')note.textContent='ภาพจำลองตามเพศและค่าร่างกายที่กรอก ไม่ใช่ภาพตรวจวัดตำแหน่งกล้ามเนื้อหรือไขมันจริง';
   if(mode==='fat'&&SEGMENTS.every(([s])=>current['fat_'+s]==null))note.textContent='ไม่มีค่าไขมันแต่ละส่วน (InBody 380 ไม่วัดค่านี้) จึงใช้ % ไขมันรวมทั้งตัว';
   if(mode==='muscle'&&SEGMENTS.every(([s])=>current['mus_'+s]==null&&current['musp_'+s]==null))note.textContent='ยังไม่ได้กรอกความสมดุลกล้ามเนื้อแต่ละส่วน';
  }catch{if(version!==drawVersion)return;stage.classList.add('empty-stage');legend.textContent='อุปกรณ์นี้แสดง 3D ไม่ได้ แต่ยังดูตัวเลขได้';}
  finally{if(version===drawVersion)delete legend.dataset.loading;}
  if(!current)return;
  if(mode==='fat')note.append(' · สีเป็นการแสดงระดับจากค่าที่บันทึก ไม่ใช่ตำแหน่งไขมันที่ตรวจวัดจริง');
  if(mode==='muscle')note.append(' · หุ่นจำลองกล้ามเนื้อบนโครงร่างแบบลีน ไม่รวมการขยายจากไขมันและรอบตัว; รายส่วนแสดงเฉพาะค่าที่กรอก');
  const bmi=current.height&&current.weight?Math.round(current.weight/(current.height/100)**2*10)/10:null;
  const items=mode==='muscle'?[['เพศ',(current.sex||fallbackSex)==='female'?'หญิง':'ชาย'],['ส่วนสูง',fmt('height',current.height)],['กล้ามเนื้อโครงร่าง',fmt('muscle',current.muscle)]]:[['เพศ',(current.sex||fallbackSex)==='female'?'หญิง':'ชาย'],['น้ำหนัก',fmt('weight',current.weight)],['BMI',bmi??'–'],['ไขมัน (PBF)',fmt('body_fat',current.body_fat)],['กล้ามเนื้อโครงร่าง',fmt('muscle',current.muscle)]];
  const whr=current.whr??(current.waist&&current.hip?Math.round(current.waist/current.hip*100)/100:null);
  for(const [label,key,value] of [['มวลไขมัน','body_fat_mass'],['ไขมันช่องท้อง','visceral'],['คะแนน InBody','score'],['เผาผลาญพื้นฐาน','bmr'],['เอว/สะโพก','whr',whr],['อัตราส่วน ECW','ecw_ratio']]){
   const v=value!==undefined?value:current[key];if(mode!=='muscle'&&v!=null)items.push([label,fmt(key,v)]);
  }
  const grid=node('div',undefined,'body-stat-grid');for(const [k,v] of items){const cell=node('div');cell.append(node('span',k),node('strong',String(v)));grid.append(cell);}stats.append(grid);
  if(mode==='fat'||mode==='muscle'){
   const table=node('div',undefined,'body-seg-grid');
   for(const [s,label] of SEGMENTS){
    const value=mode==='fat'?fmt('fat_'+s,current['fat_'+s]):[current['mus_'+s]!=null?fmt('mus_'+s,current['mus_'+s]):'',current['musp_'+s]!=null?current['musp_'+s]+'%':''].filter(Boolean).join(' · ')||'–';
    const cell=node('div');cell.append(node('span',label),node('strong',value));table.append(cell);
   }
   stats.append(table);
  }
 }
 return {
  draw,
  show(list,selectedId,sex){
   if(sex)fallbackSex=sex;list=resolveBodyRecords(list);records=list;current=list.find(r=>r.id===selectedId)||list[0]||null;
   picker.replaceChildren(...list.map(r=>{const o=node('option',thaiDate(r.day));o.value=r.id;o.selected=r===current;return o;}));picker.hidden=!list.length;
   draw();
  },
  setTitle(text){head.querySelector('h2').textContent=text;},
  // Show an unsaved record from the form (live preview while typing).
  preview(record){current=record;picker.value='';draw();},
  dispose(){figure?.dispose();figure=null;},
 };
}

// ---- Profile page (own measurements) ----
let records=[],editing=null,viewer,profileSex=null;
const input=key=>$('bf-'+key);
// Only fields shown in the form; others (e.g. removed sections) keep their saved values.
const FORM_KEYS=GROUPS.flatMap(g=>g.keys);
function buildForm(){
 const root=$('body-groups');root.replaceChildren();
 for(const group of GROUPS){
  const section=node('details'),grid=node('div',undefined,'body-fields'+(group.segments?' pairs':''));section.open=!!group.open;
  section.append(node('summary',group.title));
  if(group.segments)section.append(node('p','กรอกได้ทั้งกิโลกรัมและ % ตามแถวในใบผล (100% = มาตรฐาน)','muted body-hint'));
  if(group.hint)section.append(node('p',group.hint,'muted body-hint'));
  for(const key of group.keys){
   const f=FIELDS[key],wrap=node('div'),label=node('label',f.label+(f.unit?' ('+f.unit+')':'')),field=node('input');
   label.htmlFor='bf-'+key;
   Object.assign(field,{id:'bf-'+key,type:'number',min:f.min,max:f.max,step:String(10**-f.dp),inputMode:f.min<0?'text':'decimal',placeholder:'–'});
   wrap.append(label,field);grid.append(wrap);
  }
  section.append(grid);root.append(section);
 }
}
// With a sex set on the profile, every measurement uses it and the per-record picker is hidden.
function applySexSetting(){$('body-sex').closest('div').hidden=!!profileSex;}
// The form, 3D figure, stats and history always show the same record: the one being
// edited, or (for a new day) the latest record, whose values prefill the form.
function fillValues(src,day){
 $('body-day').value=day;$('body-sex').value=profileSex??src?.sex??'male';
 for(const key of FORM_KEYS)input(key).value=src?.[key]??'';
 $('body-note').value=editing?src?.note??'':'';
 $('body-bowel-status').value=editing?src?.bowelStatus??'':'';
}
function openRecord(r){
 editing=r.id;fillValues(resolveBodyRecords(records).find(x=>x.id===r.id)||r,r.day);viewer.show(records,r.id);renderHistory();
 $('body-form-title').textContent='ค่าวันที่ '+thaiDate(r.day);
 $('body-save').textContent='บันทึกการแก้ไข';
}
function startDay(day=localDay()){
 const existing=records.find(r=>r.day===day);
 if(existing){openRecord(existing);return;}
 const latest=resolveBodyRecords(records)[0]||null;
 editing=null;fillValues(latest,day);viewer.show(records,latest?.id);renderHistory();
 $('body-form-title').textContent=latest?'บันทึกค่าใหม่ · เริ่มจากค่าล่าสุด '+thaiDate(latest.day):'บันทึกค่าร่างกาย';
 $('body-save').textContent='บันทึกค่าร่างกาย';
}
function renderHistory(){
 const box=$('body-history');box.replaceChildren();
 if(!records.length){box.append(node('p','ยังไม่มีประวัติ กรอกค่าครั้งแรกด้านบนได้เลย','muted'));return;}
 for(const r of records){
  const row=node('div',undefined,'team-row'+(r.id===editing?' selected':'')),info=node('div');
  info.append(node('strong',thaiDate(r.day)+(r===records[0]?' · ล่าสุด':'')),node('span',[r.weight!=null?r.weight+' กก.':'',BOWEL_STATUS_LABELS[r.bowelStatus]||'',r.body_fat!=null?'ไขมัน '+r.body_fat+'%':'',r.muscle!=null?'กล้ามเนื้อ '+r.muscle+' กก.':'',r.score!=null?'คะแนน '+r.score:''].filter(Boolean).join(' · ')||'มีค่าสัดส่วน','muted'));
  const actions=node('div',undefined,'team-actions');
  actions.append(button('แก้ไข','quiet',()=>{openRecord(r);showEditor();}),
   button('ลบ','quiet',async()=>{if(!confirm('ลบค่าร่างกายวันที่ '+thaiDate(r.day)+'?'))return;try{await api('/api/body/'+encodeURIComponent(r.id),{method:'DELETE'});if(editing===r.id)editing=null;await loadBody();say('ลบแล้ว');}catch(error){say(error.message);}}));
  row.append(info,actions);box.append(row);
 }
}
function status(element,text,loading=false){
 element.textContent=text;
 if(loading)element.dataset.loading='true';else delete element.dataset.loading;
}
const say=(text,loading)=>status($('body-message'),text,loading);
function showEditor(){
 const groups=$('body-groups');
 for(const section of groups.children)section.open=section===groups.firstElementChild;
 $('body-extras').open=false;
 $('body-editor').hidden=false;
 $('body-form-title').focus({preventScroll:true});
 $('body-editor').scrollIntoView({block:'start'});
}
function closeEditor(){
 $('body-editor').hidden=true;
 editing=null;
 status($('body-save-status'),'');
}
function renderProfileResults(){
 const latest=records[0],result=$('profile-results');
 $('profile-results-date').textContent=latest?thaiDate(latest.day):'';
 if(!latest){result.replaceChildren(node('p','ยังไม่มีผลวัด เริ่มจากไฟล์ InBody หรือกรอกเอง','muted'));return;}
 const grid=node('div',undefined,'profile-result-grid');
 for(const [key,label] of [['weight','น้ำหนัก'],['muscle','กล้ามเนื้อ'],['body_fat','ไขมัน'],['score','คะแนน InBody']]){
  const cell=node('div');cell.append(node('span',label),node('strong',fmt(key,latest[key])));grid.append(cell);
 }
 result.replaceChildren(grid,button('แก้ไขผลนี้','quiet profile-result-edit',()=>{openRecord(latest);showEditor();}));
}
// Overview card: latest weight, change since the previous weigh-in, key numbers and a trend line.
let weightChart;
function renderWeightCard(){
 // Follows the overview's selected date: the latest weigh-in on or before that day.
 const selected=$('day')?.value||localDay();
 const withWeight=records.filter(r=>r.weight!=null&&r.day<=selected),latest=withWeight[0],previous=withWeight[1];
 if(!$('weight-value'))return;
 $('weight-title').textContent=latest?.day===selected?(selected===localDay()?'น้ำหนักวันนี้':'น้ำหนักวันที่เลือก'):'น้ำหนักล่าสุด';
 $('weight-value').textContent=latest?latest.weight:'–';$('weight-date').textContent=latest?thaiDate(latest.day)+(BOWEL_STATUS_LABELS[latest.bowelStatus]?' · '+BOWEL_STATUS_LABELS[latest.bowelStatus]:''):'ยังไม่มีข้อมูล';
 const change=$('weight-change');change.className='weight-change';
 if(!latest)change.textContent='บันทึกค่าร่างกายครั้งแรกในหน้าโปรไฟล์';
 else if(!previous)change.textContent='ค่าแรกที่บันทึก';
 else{
  const diff=Math.round((latest.weight-previous.weight)*10)/10;
  change.textContent=diff===0?'เท่าเดิม จาก '+thaiDate(previous.day):(diff<0?'▼ ':'▲ ')+Math.abs(diff)+' กก. จาก '+thaiDate(previous.day);
  change.classList.add(diff<0?'down':diff>0?'up':'same');
 }
 const bmi=latest?.height?Math.round(latest.weight/(latest.height/100)**2*10)/10:null;
 $('weight-chips').replaceChildren(...[['ไขมัน',latest?.body_fat!=null?latest.body_fat+'%':null],['กล้ามเนื้อ',latest?.muscle!=null?latest.muscle+' กก.':null],['BMI',bmi]].filter(([,v])=>v!=null).map(([k,v])=>{const c=node('span');c.append(node('b',String(v)),' '+k);return c;}));
 $('weight-open').textContent=latest?'ดูโปรไฟล์ร่างกาย':'บันทึกค่าร่างกาย';
 // Weight trend chart up to the selected day; target from the latest InBody target weight.
 weightChart??=createWeightChart($('weight-chart'));
 weightChart.update(records.filter(r=>r.weight!=null).map(r=>({day:r.day,weight:r.weight,bowelStatus:r.bowelStatus})),selected,records.find(r=>r.target_weight!=null&&r.day<=selected)?.target_weight??null);
}
async function loadBody(selectedId){
 window.dispatchEvent(new Event('body-loading'));
 try{({records}=await api('/api/body'));}catch(error){window.dispatchEvent(new CustomEvent('body-load-error',{detail:error.message}));throw error;}
 window.dispatchEvent(new CustomEvent('body-records',{detail:records}));
 if(profileSex&&records.some(r=>r.sex!==profileSex)){
  // Older measurements saved before the sex setting: show and store them with it.
  records=records.map(r=>({...r,sex:profileSex}));
  api('/api/me',{method:'PATCH',body:JSON.stringify({sex:profileSex})}).catch(()=>{});
 }
 renderWeightCard();renderProfileResults();
 const selected=records.find(r=>r.id===selectedId)??records.find(r=>r.id===editing);
 if(!$('body-editor').hidden){if(selected)openRecord(selected);else startDay();}
 else{viewer.show(records,undefined,profileSex);renderHistory();}
}
// Morning weigh-in from the overview: updates today's record or starts one from the latest.
export async function quickWeigh(kg,day=localDay(),bowelStatus=''){
 const existing=records.find(r=>r.day===day),base=resolveBodyRecords(records.filter(r=>r.day<=day))[0];
 const row={...base,...existing,id:existing?.id||crypto.randomUUID(),day,sex:profileSex??base?.sex??'male',note:existing?.note??'',weight:kg,bowelStatus};
 const valid=validateBody(row);
 await api('/api/body/'+encodeURIComponent(valid.id),{method:'PUT',body:JSON.stringify(valid)});
 await loadBody(valid.id);
}
export function initBody(me={}){
 profileSex=me.sex??null;
 window.addEventListener('backup-restored',async()=>{try{const updated=await api('/api/me');profileSex=updated.sex??null;$('profile-sex').value=profileSex??'';applySexSetting();await loadBody();}catch(error){say(error.message);}});
 window.addEventListener('diary-records',renderWeightCard); // date bar / calendar changes
 const figure=$('body-figure');
 viewer=createBodyViewer($('body-viewer'),{isVisible:()=>figure.open&&!$('settings-panel').hidden});
 figure.ontoggle=()=>{if(figure.open)viewer.draw();};
 buildForm();applySexSetting();
 const sexSetting=$('profile-sex');sexSetting.value=profileSex??'';
 sexSetting.onchange=async()=>{
  const sex=sexSetting.value||null;sexSetting.disabled=true;say('กำลังบันทึกการตั้งค่า…',true);
  try{
   await api('/api/me',{method:'PATCH',body:JSON.stringify({sex})});profileSex=sex;
   applySexSetting();editing=null;await loadBody();
   say(sex?'ตั้งค่าเพศเป็น'+(sex==='female'?'ผู้หญิง':'ผู้ชาย')+'แล้ว ค่าใหม่ที่บันทึกจะใช้หุ่น'+(sex==='female'?'ผู้หญิง':'ผู้ชาย'):'ยกเลิกการระบุเพศแล้ว');
  }catch(error){sexSetting.value=profileSex??'';say(error.message);}
  finally{sexSetting.disabled=false;}
 };
 $('body-cancel').onclick=()=>{closeEditor();viewer.show(records,undefined,profileSex);$('body-add').focus();};
 $('body-add').onclick=()=>{status($('body-save-status'),'');startDay();showEditor();};
 // Picking a date opens that day's record, or starts a new one for it (keeping typed values).
 $('body-day').addEventListener('change',()=>{
  const day=$('body-day').value,r=records.find(x=>x.day===day);
  if(r)openRecord(r);else if(editing){startDay(day);}
  else $('body-form-title').textContent='บันทึกค่าใหม่ วันที่ '+thaiDate(day);
 });
 // Re-shape the figure as the form changes, before saving.
 let previewTimer;
 const preview=()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>{
  if($('body-editor').hidden)return;
  const row={id:'preview',day:$('body-day').value,sex:$('body-sex').value};
  for(const key of FORM_KEYS){const v=Number(input(key).value);const f=FIELDS[key];row[key]=input(key).value.trim()!==''&&v>=f.min&&v<=f.max?v:null;}
  viewer.preview(row);
 },250);};
 $('body-form').addEventListener('input',preview);$('body-form').addEventListener('change',preview);
 const file=node('input');
 file.type='file';file.accept='.csv,text/csv';file.hidden=true;
 const choose=$('inbody-choose');choose.onclick=()=>file.click();
 const measurement=node('select');measurement.hidden=true;measurement.setAttribute('aria-label','เลือกผลวัดจากไฟล์ InBody');
 const importStatus=node('p',undefined,'profile-operation');importStatus.setAttribute('role','status');
 $('inbody-controls').append(file,measurement,importStatus);
 let imported=[];
 function fillInBody({day,values}){
  const existing=records.find(r=>r.day===day);
  startDay(day);
  if(!existing){
   const previous=records.find(record=>record.day<=day);
   fillValues(previous?{sex:previous.sex}:null,day);
   $('body-form-title').textContent='บันทึกค่าใหม่ วันที่ '+thaiDate(day);
  }
  for(const [key,value] of Object.entries(values)){
   input(key).value=value;
  }
  preview();
  status(importStatus,'');
  status($('body-save-status'),'ตรวจค่าจาก InBody ก่อนบันทึก'+(existing?' · จะอัปเดตผลวัดวันเดียวกัน':''));
  showEditor();
 }
 measurement.onchange=()=>{const selected=imported[measurement.value];if(selected)fillInBody(selected);};
 file.onchange=async()=>{
  const selected=file.files[0];if(!selected)return;
  file.value='';choose.disabled=true;$('body-add').disabled=true;measurement.hidden=true;imported=[];
  status(importStatus,'กำลังอ่านไฟล์ InBody…',true);
  try{
   const rows=parseInBodyCsv(await selected.text());
   await bodyReady;
   imported=rows;
   if(rows.length===1){fillInBody(rows[0]);return;}
   const placeholder=node('option','เลือกวันที่และเวลาที่ต้องการนำเข้า');placeholder.value='';placeholder.disabled=true;
   measurement.replaceChildren(placeholder,...rows.map(({day,time},index)=>{
    const option=node('option',thaiDate(day)+' · '+time);option.value=index;return option;
   }));
   measurement.value='';measurement.hidden=false;
   status(importStatus,'เลือกผลวัดจาก '+rows.length+' รายการ');
  }catch(error){status(importStatus,error.message);}
  finally{choose.disabled=false;$('body-add').disabled=false;}
 };
 $('body-form').onsubmit=async e=>{
  e.preventDefault();const save=$('body-save'),cancel=$('body-cancel'),message=$('body-save-status');
  save.disabled=cancel.disabled=choose.disabled=$('body-add').disabled=true;
  status(message,'กำลังบันทึกค่าร่างกาย…',true);
  try{
   const day=$('body-day').value,id=editing||records.find(x=>x.day===day)?.id||crypto.randomUUID(); // one record per day
   const row={id,day,sex:$('body-sex').value,note:$('body-note').value,bowelStatus:$('body-bowel-status').value};
   const saved=records.find(x=>x.id===id);
   for(const key of Object.keys(FIELDS)){if(!FORM_KEYS.includes(key)){row[key]=saved?.[key]??null;continue;}const raw=input(key).value.trim();row[key]=raw===''?null:Number(raw);}
   const valid=validateBody(row);
   await api('/api/body/'+encodeURIComponent(valid.id),{method:'PUT',body:JSON.stringify(valid)});
   closeEditor();
   try{await loadBody();say('บันทึกค่าร่างกายแล้ว');$('body-message').scrollIntoView({block:'center'});}
   catch{say('บันทึกแล้ว แต่โหลดผลล่าสุดไม่สำเร็จ');$('body-retry').hidden=false;}
  }catch(error){status(message,error.message==='ข้อมูลร่างกายไม่ถูกต้อง'?'มีค่าที่อยู่นอกช่วงที่รับได้ กรุณาตรวจอีกครั้ง':error.message);}
  finally{save.disabled=cancel.disabled=choose.disabled=$('body-add').disabled=false;}
 };
 let bodyReady;
 function loadProfile(){
  say('กำลังโหลดค่าร่างกาย…',true);
  choose.disabled=$('body-add').disabled=true;
  $('body-retry').hidden=true;
  bodyReady=loadBody();
  bodyReady.then(()=>say(''),()=>{
   say('โหลดค่าร่างกายไม่สำเร็จ');
   $('body-retry').hidden=false;
  }).finally(()=>{choose.disabled=$('body-add').disabled=!$('body-retry').hidden;});
 }
 $('body-retry').onclick=loadProfile;
 document.querySelectorAll('[data-view="settings"]').forEach(button=>button.addEventListener('click',()=>{
  if(figure.open)viewer.draw();
 }));
 loadProfile();
}
