import {groupWorkouts} from './workout-groups.mjs?v=2';
import {preferredWeightUnit,fromKg,toKg} from './weight-units.mjs';

export function openTeamWorkoutCopy({source,member,day,history=[],save,onSaved}){
 const orderedGroups=groupWorkouts(source);
 const batchId=crypto.randomUUID();
 let ordinal=0,groupNumber=0;
 const unit=preferredWeightUnit();
 const make=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
 const dialog=make('dialog'),form=make('form'),title=make('h2','คัดลอกท่าฝึกทั้งหมด');
 dialog.className='team-workout-copy';
 title.id='team-copy-title';dialog.setAttribute('aria-labelledby',title.id);
 const dateLabel=make('label','วันที่บันทึกของคุณ'),date=make('input');
 date.type='date';date.required=true;date.value=day;dateLabel.append(date);
 const list=make('div');list.className='team-copy-list';
 const drafts=orderedGroups.flatMap(({rows})=>{
  const groupId=rows.length>1?crypto.randomUUID():null;
  const section=groupId?make('section'):list;
  if(groupId){
   section.className='team-copy-group';
   section.append(make('h3','Super set '+(++groupNumber)));
   list.append(section);
  }
  return rows.map(record=>{
   const {exercise,trainingType}=record;
   const cardio=trainingType==='cardio';
   const row={id:batchId+'-'+String(++ordinal).padStart(4,'0'),kind:'workout',exercise,trainingType:cardio?'cardio':'strength',
    sets:null,reps:null};
   if(groupId&&!cardio)row.supersetId=groupId;
   const card=make('fieldset'),name=make('legend',exercise);
   card.append(name);
   const nameLabel=make('label','ชื่อท่า'),nameInput=make('input');
   Object.assign(nameInput,{value:exercise,maxLength:150,required:true});
   nameLabel.append(nameInput);card.append(nameLabel);
   const metrics=make('div');metrics.className='team-copy-metrics';
   const fields=cardio?
    [['duration','เวลา (นาที)',0,1440,'any'],['distance','ระยะทาง (กม.)',0,1000,'any'],['incline','ความชัน (%)',0,100,'any'],['speed','ความเร็ว (กม./ชม.)',0,50,'any']]:
    [['sets','เซ็ต',1,1000,'1'],record.seconds!=null?['seconds','วินาที / เซ็ต',1,3600,'1']:['reps','ครั้ง / เซ็ต',1,1000,'1']];
   const metricInputs=fields.map(([key,label,min,max,step])=>{
    const wrapper=make('label',label),input=make('input');
    Object.assign(input,{type:'number',min,max,step,value:record[key]??'',required:key==='duration'});
    wrapper.append(input);metrics.append(wrapper);return [key,input];
   });
   card.append(metrics);
   const weight=make('input'),unitPicker=make('select'),previous=make('button');
   if(!cardio){
    const fields=make('div');fields.className='team-copy-load';
    const label=make('label','น้ำหนักที่ใช้');label.htmlFor='copy-weight-'+ordinal;
    Object.assign(weight,{id:label.htmlFor,type:'number',inputMode:'decimal',min:'0',step:'any',placeholder:'0 ถ้าใช้น้ำหนักตัว'});
    for(const value of ['kg','lb']){const option=make('option',value);option.value=value;unitPicker.append(option);}
    unitPicker.setAttribute('aria-label','หน่วยน้ำหนักของ '+exercise);
    unitPicker.value=unit;
    unitPicker.onchange=()=>{weight.max=String(fromKg(2000,unitPicker.value));};
    unitPicker.onchange();
    fields.append(weight,unitPicker);card.append(label,fields);
    previous.type='button';previous.className='quiet team-copy-previous';previous.hidden=true;
    card.append(previous);
   }
   const notes=make('input'),notesLabel=make('label','หมายเหตุ');
   notes.maxLength=1000;notes.placeholder='ไม่บังคับ';notesLabel.append(notes);card.append(notesLabel);
   section.append(card);
   return {row,nameInput,notes,metricInputs,weight,unitPicker,cardio,previous};
  });
 });
 const normalize=name=>name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
 const recent=[...history].filter(row=>row.kind==='workout'&&row.trainingType!=='cardio')
  .sort((a,b)=>b.day.localeCompare(a.day));
 function showPrevious(){
  for(const {nameInput,weight,unitPicker,cardio,previous} of drafts){
   if(cardio)continue;
   const match=recent.find(item=>item.day<=date.value&&normalize(item.exercise)===normalize(nameInput.value)&&
    (item.weight!=null||item.setLogs?.some(set=>set.weight!=null)));
   const load=match?.setLogs?.findLast(set=>set.weight!=null)??match;
   previous.hidden=!load;
   if(!load)continue;
   const kg=toKg(load.weight,load.weightUnit);
   previous.textContent='ครั้งล่าสุด '+fromKg(kg,'lb')+' lb / '+fromKg(kg,'kg')+' kg · ใช้ค่านี้';
   previous.onclick=()=>{weight.value=fromKg(kg,unitPicker.value);};
  }
 }
 date.onchange=showPrevious;
 for(const {nameInput} of drafts)nameInput.oninput=showPrevious;
 showPrevious();
 const status=make('p');status.setAttribute('role','status');status.className='profile-operation';
 const actions=make('div');actions.className='profile-measurement-actions';
 const submit=make('button','บันทึก '+drafts.length+' ท่า'),cancel=make('button','ยกเลิก');
 submit.className='primary';cancel.className='quiet';cancel.type='button';
 cancel.onclick=()=>dialog.close();
 let saving=false;
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 form.onsubmit=async event=>{
  event.preventDefault();
  if(saving)return;
  const numeric=input=>input.value===''?null:input.valueAsNumber;
  const rows=drafts.map(({row,nameInput,notes,metricInputs,weight,unitPicker,cardio})=>({...row,day:date.value,
   exercise:nameInput.value.trim(),notes:notes.value.trim(),
   ...Object.fromEntries(metricInputs.map(([key,input])=>[key,numeric(input)])),
   ...(cardio?{weight:null}:{weight:numeric(weight),weightUnit:unitPicker.value})}));
  saving=true;submit.disabled=cancel.disabled=true;
  date.disabled=true;
  status.textContent='กำลังบันทึกท่าฝึก…';status.dataset.loading='true';
  try{
   if(!await save(rows)){
    status.textContent='บันทึกได้ไม่ครบ กดบันทึกอีกครั้งเพื่อทำต่อโดยไม่เพิ่มท่าซ้ำ';
    return;
   }
  }catch(error){
   status.textContent=error.message;
   return;
  }finally{
   saving=false;submit.disabled=cancel.disabled=false;delete status.dataset.loading;
  }
  dialog.close();onSaved(rows);
 };
 actions.append(submit,cancel);
 const header=make('div'),scroll=make('div'),footer=make('div');
 header.className='team-copy-header';scroll.className='team-copy-scroll';footer.className='team-copy-footer';
 header.append(title,make('p',member+' · '+drafts.length+' ท่า'));
 scroll.append(dateLabel,list);footer.append(status,actions);
 form.append(header,scroll,footer);
 dialog.append(form);document.body.append(dialog);dialog.showModal();
}
