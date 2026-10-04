import {localDay,MEALS} from './store.mjs';
export function weekDays(day,offset=0){
 const end=new Date(day+'T12:00:00');end.setDate(end.getDate()+offset);
 return Array.from({length:7},(_,i)=>{const d=new Date(end);d.setDate(d.getDate()-6+i);return localDay(d);});
}
export function weeklyProgress(records,body,day){
 const days=weekDays(day),previous=weekDays(day,-7);
 const average=dates=>{const values=dates.map(d=>body.find(r=>r.day===d&&r.weight!=null)?.weight).filter(v=>typeof v==='number'&&Number.isFinite(v));return {value:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null,count:values.length};};
 const current=average(days),before=average(previous);
 return {days,average:current.value,weighDays:current.count,previousAverage:before.value,change:current.value!=null&&before.value!=null?Math.round((current.value-before.value)*100)/100:null,trainingDays:days.filter(d=>records.some(r=>r.day===d&&r.kind==='workout')).length,completeFoodDays:days.filter(d=>MEALS.slice(0,3).every(meal=>records.some(r=>r.day===d&&r.kind!=='workout'&&r.meal===meal))).length};
}
export function comparePlan(plan,records){
 const used=new Set();
 return plan.exercises.map((target,index)=>{
  let actual=records.find(r=>r.sessionComplete!==false&&!used.has(r.id)&&r.day===plan.day&&r.kind==='workout'&&r.planId===plan.id&&r.planExerciseIndex===index);
  if(!actual)actual=records.find(r=>r.sessionComplete!==false&&!used.has(r.id)&&!r.planId&&(r.trainingType??'strength')===(target.trainingType??'strength')&&r.day===plan.day&&r.kind==='workout'&&r.exercise.trim().toLowerCase()===target.exercise.trim().toLowerCase());
  if(actual)used.add(actual.id);
  return {target,index,actual:actual??null};
 });
}
export function workoutDescription(r){
 return (r.trainingType==='cardio'?[r.duration!=null?r.duration+' นาที':'',r.distance!=null?r.distance+' กม.':'',r.incline!=null?'ความชัน '+r.incline+'%':'']:[r.weight==null?'ไม่ระบุน้ำหนัก':r.weight===0?'น้ำหนักตัว':r.weight+' กก.',r.sets!=null?r.sets+' เซ็ต':'',r.reps!=null?r.reps+' ครั้ง/เซ็ต':'']).filter(Boolean).join(' · ');
}
