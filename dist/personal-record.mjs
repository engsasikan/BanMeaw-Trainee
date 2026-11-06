// Personal records: did this workout beat everything logged for the same exercise up to its day?
// Needs at least one earlier record of the exercise; a first try is not a record.
import {fromKg,preferredWeightUnit} from './weight-units.mjs';
const normalize=s=>(s||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const num=n=>typeof n==='number'&&Number.isFinite(n);
const type=r=>r.trainingType||'strength';
const sets=r=>(r.setLogs?.length?r.setLogs:[{weight:r.weight,reps:r.reps}]).filter(s=>num(s.weight)||num(s.reps));
const top=(list,key)=>{const v=list.map(x=>x[key]).filter(num);return v.length?Math.max(...v):null;};
// Most reps done at exactly this weight (or more) in a list of sets.
const repsAt=(list,w)=>top(list.filter(s=>num(s.weight)&&s.weight>=w),'reps');

export function personalRecord(records,row){
 if(row?.kind!=='workout'||!row.exercise)return null;
 const history=records.filter(r=>r.kind==='workout'&&r.id!==row.id&&r.day<=row.day&&type(r)===type(row)&&normalize(r.exercise)===normalize(row.exercise));
 if(!history.length)return null;
 if(type(row)==='cardio'){
  for(const [key,label,unit] of [['distance','ระยะทางไกลที่สุด','กม.'],['duration','เวลานานที่สุด','นาที']]){
   const before=top(history,key);if(num(row[key])&&row[key]>0&&before!==null&&row[key]>before)return {kind:key,label,value:row[key],before,unit};
  }
  return null;
 }
 const mine=sets(row),past=history.flatMap(sets);
 const weight=top(mine,'weight'),best=top(past,'weight');
 if(weight>0&&best!==null&&weight>best)return {kind:'weight',label:'น้ำหนักมากที่สุด',value:weight,before:best,unit:'kg'};
 if(weight>0&&best!==null&&weight===best){
  const reps=repsAt(mine,weight),before=repsAt(past,weight);
  if(num(reps)&&num(before)&&reps>before)return {kind:'reps-at-weight',label:'ครั้งมากที่สุดที่น้ำหนักนี้',value:reps,before,unit:'ครั้ง',weight};
 }
 if(!(weight>0)&&!(best>0)){
  const reps=top(mine,'reps'),before=top(past,'reps');
  if(num(reps)&&num(before)&&reps>before)return {kind:'reps',label:'ครั้งมากที่สุด',value:reps,before,unit:'ครั้ง'};
 }
 return null;
}

const show=(value,unit,u)=>unit==='kg'?fromKg(value,u)+' '+u:value+' '+unit;
export function recordText(row,pr,u=preferredWeightUnit()){
 const at=pr.kind==='reps-at-weight'?' ที่ '+show(pr.weight,'kg',u):'';
 return '🏆 สถิติใหม่! '+row.exercise+' · '+pr.label+' '+show(pr.value,pr.unit,u)+at+' (เดิม '+show(pr.before,pr.unit,u)+')';
}
