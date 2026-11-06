// Compact log composer. Existing field IDs and saving remain the source of truth.
export function initCompactWorkout(){
 const $=id=>document.getElementById(id),make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const form=$('workout-form');form.classList.add('compact-workout');
 const type=$('training-type'),tabs=make('div',null,'workout-type-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','ประเภทการฝึก');
 const tabButtons=[];
 for(const [value,text] of [['strength','เวท / น้ำหนักตัว'],['cardio','คาร์ดิโอ']]){const b=make('button',text);b.type='button';b.onclick=()=>{type.value=value;type.dispatchEvent(new Event('change'));};tabs.append(b);tabButtons.push([b,value]);}
 const sync=()=>tabButtons.forEach(([b,value])=>b.setAttribute('aria-pressed',String(type.value===value)));
 type.before(tabs);type.addEventListener('change',sync);window.addEventListener('workout-type-change',sync);form.addEventListener('reset',()=>setTimeout(sync,0));sync();
 const strength=$('strength-fields'),metrics=make('div',null,'workout-metrics');
 const weightBox=make('div'),weightLabel=form.querySelector('label[for="weight"]');weightLabel.textContent='น้ำหนัก';weightBox.append(weightLabel,$('weight'));
 const row=$('sets').closest('.form-row');const setBox=$('sets').parentElement,repBox=$('reps').parentElement;
 metrics.append(weightBox,setBox,repBox);row.remove();strength.prepend(metrics);
 const unit=$('weight').closest('#strength-fields').querySelector('select');
 if(unit){const label=unit.parentElement;label.classList.add('compact-unit');label.firstChild.textContent='หน่วย ';for(const option of unit.options)option.textContent=option.value==='kg'?'กก.':'ปอนด์';}
 const notes=make('details',null,'workout-extra'),summary=make('summary','หมายเหตุเพิ่มเติม');notes.append(summary,form.querySelector('label[for="workout-notes"]'),$('workout-notes'));$('workout-save').before(notes);
 const helper=form.querySelector('#strength-fields > .input-hint');if(helper)helper.textContent='ใช้น้ำหนักตัว ใส่ 0 · ใช้น้ำหนักและจำนวนครั้งเดียวกันทุกเซ็ต';
 const resetDefaults=()=>{if(!$('sets').value)$('sets').value=3;if(!$('reps').value)$('reps').value=12;notes.open=false;};
 resetDefaults();form.addEventListener('reset',()=>setTimeout(resetDefaults,0));
 const recent=make('div',null,'workout-recent');$('exercise-picker').before(recent);
 window.addEventListener('diary-records',event=>{
  recent.replaceChildren();const seen=new Set();const rows=[...(event.detail||[])].filter(r=>r.kind==='workout').sort((a,b)=>b.day.localeCompare(a.day)).filter(r=>{const key=r.exercise.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
  if(!rows.length)return;recent.append(make('span','ใช้ล่าสุด'));
  for(const r of rows){const b=make('button',r.exercise);b.type='button';b.onclick=()=>{type.value=r.trainingType||'strength';type.dispatchEvent(new Event('change'));$('exercise').value=r.exercise;$('exercise').dispatchEvent(new Event('change'));$('exercise').setCustomValidity('');$('exercise').focus();};recent.append(b);}
 });
 const title=$('workout-form-title');title.textContent='บันทึกท่าที่ฝึก';
 const composer=$('workout-composer');if(composer)composer.querySelector('summary').textContent='2 · บันทึกผล / เพิ่มท่าเอง';
}
