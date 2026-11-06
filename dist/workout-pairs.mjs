import {attachWeightUnit} from './weight-units.mjs';
import {searchExercises} from './exercise-picker.mjs?v=11';
export function pairedWorkoutRows(first, partners, groupId) {
 if(!partners.length)return [first];
 return [first,...partners.map(p=>({id:p.id,day:first.day,kind:'workout',trainingType:'strength',exercise:p.exercise.trim(),weight:p.weight,sets:p.sets,reps:p.reps,notes:''}))].map(r=>({...r,supersetId:groupId}));
}
export function initWorkoutPairs({form,anchor,isEditing}) {
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const button=el('button','+ เพิ่มท่าใน Super set');button.type='button';button.id='workout-add-pair';button.className='quiet';
 const box=el('section'),hint=el('p','ท่าแรกอยู่ด้านบน กดเพิ่มท่าได้ตามต้องการ แล้วกดบันทึก Super set');box.hidden=true;box.className='workout-pairs';box.append(hint);anchor.after(box,button);
 let partners=[],groupId=null;
 function sync(){const enabled=document.getElementById('training-type').value==='strength'&&(!isEditing()||partners.length>0);button.hidden=!enabled;box.hidden=!enabled||!partners.length;partners.forEach((p,i)=>{p.legend.textContent='Super set · ท่าที่ '+(i+2);for(const field of p.fields)field.disabled=!enabled;});document.getElementById('workout-save').textContent=enabled&&partners.length?'บันทึก Super set':isEditing()?'บันทึกการแก้ไข':'บันทึกท่าออกกำลังกาย';}
 function clear(){for(const p of partners){p.dispose();p.row.remove();}partners=[];groupId=null;sync();}
 button.onclick=()=>{groupId??=crypto.randomUUID();const row=el('fieldset'),legend=el('legend','ท่าคู่ Super set'),fields=[];row.append(legend);
 const field=(label,type,min,max)=>{const l=el('label',label),i=el('input');i.type=type;if(min!=null)i.min=min;if(max!=null)i.max=max;fields.push(i);l.append(i);row.append(l);return i;};
 const exercise=field('ชื่อท่า','text',null,150);exercise.maxLength=150;exercise.required=true;exercise.placeholder='เช่น Machine Fly หรือพิมพ์ชื่อท่าเอง';
 const picker=el('div'),toggle=el('button','⌄'),dropdown=el('div'),options=el('div'),status=el('p');
 picker.className='exercise-picker';dropdown.className='exercise-dropdown';dropdown.hidden=true;
 const listId='pair-options-'+crypto.randomUUID();options.id=listId;options.setAttribute('role','listbox');options.setAttribute('aria-label','ท่าออกกำลังกาย');
 exercise.autocomplete='off';exercise.setAttribute('role','combobox');exercise.setAttribute('aria-autocomplete','list');exercise.setAttribute('aria-controls',listId);exercise.setAttribute('aria-expanded','false');
 toggle.type='button';toggle.setAttribute('aria-label','เปิดรายการท่าออกกำลังกาย');toggle.setAttribute('aria-controls',listId);toggle.setAttribute('aria-expanded','false');
 row.append(picker);picker.append(toggle,dropdown);dropdown.append(options,status);
 let matches=[],active=-1,preview=null,previewTimer,removed=false;
 const close=()=>{dropdown.hidden=true;exercise.setAttribute('aria-expanded','false');toggle.setAttribute('aria-expanded','false');exercise.removeAttribute('aria-activedescendant');active=-1;};
 async function showPreview(){
  const name=exercise.value.trim();if(!name||removed){preview?.show('');return;}
  const {createMuscleFocus}=await import('./exercise-preview.mjs?v=14');
  if(removed)return;
  if(!preview){preview=createMuscleFocus({collapsed:true});picker.after(preview.el);}
  preview.show(exercise.value);
 }
 const schedulePreview=()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>{showPreview();},200);};
 function choose(index){exercise.value=matches[index].name;exercise.setCustomValidity('');exercise.focus();close();schedulePreview();}
 function open(all=false){
  const found=searchExercises(all?'':exercise.value);matches=found.slice(0,60);active=-1;options.replaceChildren();
  matches.forEach((x,i)=>{const option=el('button');option.type='button';option.id=listId+'-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.append(el('span',x.name),el('small',x.group));option.addEventListener('pointerdown',e=>e.preventDefault());option.onclick=()=>choose(i);options.append(option);});
  status.textContent=!found.length?'ไม่พบท่า ใช้ชื่อที่พิมพ์แล้วบันทึกได้เลย':found.length>matches.length?'แสดง 60 จาก '+found.length+' ท่า พิมพ์เพิ่มเพื่อค้นหา':'';
  dropdown.hidden=false;exercise.setAttribute('aria-expanded','true');toggle.setAttribute('aria-expanded','true');
 }
 exercise.addEventListener('focus',()=>open());exercise.addEventListener('input',()=>{open();schedulePreview();});exercise.addEventListener('change',schedulePreview);
 toggle.onclick=()=>{if(dropdown.hidden){exercise.focus();open(true);}else close();};
 exercise.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(dropdown.hidden)open();if(matches.length){active=(active+(e.key==='ArrowDown'?1:matches.length-1)+matches.length)%matches.length;Array.from(options.children).forEach((o,i)=>o.setAttribute('aria-selected',String(i===active)));const selected=options.children[active];exercise.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});}}
  else if(e.key==='Enter'&&!dropdown.hidden&&active>=0){e.preventDefault();choose(active);}
  else if(e.key==='Escape'||e.key==='Tab')close();
 });
 row.addEventListener('focusout',()=>setTimeout(()=>{if(!row.contains(document.activeElement))close();},0));
 const dispose=()=>{removed=true;clearTimeout(previewTimer);preview?.destroy();};
 const weight=field('น้ำหนักที่ยก','number',0,2000);const weightUnit=attachWeightUnit(weight,row);fields.push(weightUnit.select);const sets=field('เซ็ต','number',1,1000),reps=field('ครั้ง / เซ็ต','number',1,1000);sets.step=reps.step=1;sets.required=reps.required=true;sets.value=document.getElementById('sets').value||3;reps.value=document.getElementById('reps').value||12;
 const remove=el('button','นำท่านี้ออก');remove.type='button';remove.className='quiet';row.append(remove);const p={id:crypto.randomUUID(),row,legend,fields,exercise,weight,weightUnit,sets,reps,dispose};partners.push(p);remove.onclick=()=>{partners=partners.filter(x=>x!==p);dispose();row.remove();sync();};box.append(row);sync();exercise.focus();};
 form.addEventListener('reset',clear);sync();
 return {sync,clear,rows(first){if(document.getElementById('training-type').value!=='strength'||!partners.length)return [first];return pairedWorkoutRows(first,partners.map(p=>({id:p.id,exercise:p.exercise.value,weight:p.weightUnit.read(),sets:Number(p.sets.value),reps:Number(p.reps.value)})),groupId);}};
}
