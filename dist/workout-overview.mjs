import {formatLoggedWeight} from './weight-units.mjs';
import {effortText} from './effort.mjs?v=4';
import {musclesFor,MUSCLE_LABELS} from './exercise-muscles.mjs?v=2';
// Pure helpers for the screen shown before a workout starts: what the plan asks for, how long it takes,
// which muscles it works, and how exercises group into Super sets.

// "3 เซ็ต × 12 ครั้ง · 20 kg", "30 วินาที", or "20 นาที · ชัน 12%" for cardio.
export function targetText(t){
 if(t.trainingType==='cardio')return [t.duration+' นาที',t.speed!=null?t.speed+' กม./ชม.':'',t.incline!=null?'ชัน '+t.incline+'%':'',t.distance!=null?t.distance+' กม.':''].filter(Boolean).join(' · ');
 const sets=Math.max(1,t.sets||1),effort=effortText(t);
 return (sets>1?sets+' เซ็ต × ':'')+(effort||'-')+(t.weight==null?'':' · '+formatLoggedWeight(t));
}
// Rough time: work per set (holds use their seconds, reps take about 3 seconds each), the rest the plan
// sets after each set, and half a minute to move between exercises.
export function estimateMinutes(targets){
 const seconds=targets.reduce((total,t)=>{
  if(t.trainingType==='cardio')return total+(t.duration||0)*60+30;
  const sets=Math.max(1,t.sets||1),work=t.seconds??Math.max(20,(t.reps??10)*3);
  return total+sets*work+sets*(t.rest_seconds??60)+30;
 },0);
 return Math.max(1,Math.round(seconds/60));
}
// The muscles most exercises in the plan work, as Thai labels.
export function mainMuscles(targets,limit=3){
 const count=new Map();
 for(const t of targets)for(const muscle of musclesFor(t.exercise)?.primary??[])count.set(muscle,(count.get(muscle)||0)+1);
 return [...count].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([muscle])=>MUSCLE_LABELS[muscle]).filter(Boolean);
}
// Exercises in order; neighbours in the same plan and Super set become one block done round by round.
export function workoutBlocks(items){
 const blocks=[];
 items.forEach((item,index)=>{
  const group=item.target.trainingType==='cardio'?null:item.target.superset||null,last=blocks.at(-1);
  if(group&&last?.superset===group&&last.planId===item.plan.id)last.entries.push({item,index});
  else blocks.push({superset:group,planId:item.plan.id,entries:[{item,index}]});
 });
 for(const block of blocks){
  if(block.entries.length<2)block.superset=null;
  block.rounds=Math.max(...block.entries.map(({item})=>Math.max(1,item.target.sets||1)));
 }
 return blocks;
}
