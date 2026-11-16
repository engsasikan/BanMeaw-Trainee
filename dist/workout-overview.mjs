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
// The parts of a workout, in order. Exercises without a phase are main work.
export const PHASES=[['warmup','วอร์มอัพ'],['main','ฝึกหลัก'],['cooldown','คูลดาวน์']];
export const phaseOf=target=>target?.phase==='warmup'||target?.phase==='cooldown'?target.phase:'main';
export const phaseLabel=phase=>PHASES.find(([key])=>key===phase)?.[1]??'ฝึกหลัก';
// Exercises in order; neighbours in the same plan and Super set become one block done round by round.
export function workoutBlocks(items){
 const blocks=[];
 items.forEach((item,index)=>{
  const group=item.target.trainingType==='cardio'?null:item.target.superset||null,last=blocks.at(-1);
  if(group&&last?.superset===group&&last.planId===item.plan.id&&last.phase===phaseOf(item.target))last.entries.push({item,index});
  else blocks.push({superset:group,planId:item.plan.id,phase:phaseOf(item.target),entries:[{item,index}]});
 });
 for(const block of blocks){
  if(block.entries.length<2)block.superset=null;
  block.rounds=Math.max(...block.entries.map(({item})=>Math.max(1,item.target.sets||1)));
 }
 return blocks;
}
// What a finished (or partly finished) workout added up to. entries: [{target, record}] where record is the
// saved result for that exercise, if any. Volume is in kilograms; pounds are converted.
export function workoutStats(entries){
 const stats={exercises:entries.length,logged:0,sets:0,reps:0,holdSeconds:0,cardioMinutes:0,volumeKg:0};
 for(const {target,record} of entries){
  if(!record)continue;
  stats.logged++;
  if((record.trainingType??target.trainingType)==='cardio'){stats.cardioMinutes+=record.duration||0;continue;}
  const logs=record.setLogs?.length?record.setLogs:[{weight:record.weight,weightUnit:record.weightUnit,reps:record.reps,seconds:record.seconds}];
  for(const set of logs){
   stats.sets++;
   if(set.seconds!=null)stats.holdSeconds+=set.seconds;
   else{stats.reps+=set.reps||0;if(set.weight)stats.volumeKg+=(set.weightUnit==='lb'?set.weight*0.45359237:set.weight)*(set.reps||0);}
  }
 }
 stats.volumeKg=Math.round(stats.volumeKg);
 return stats;
}
// Energy per minute is MET × body weight (kg) ÷ 60 (1 MET ≈ 1 kcal per kg per hour).
// Treadmill walking and running use the ACSM equations, so speed and incline count; without a speed, cardio is
// taken as moderate (MET 5). Gym time outside cardio, rests included, is resistance training at MET 3.5.
export function cardioMet({speed,incline}={}){
 if(!speed)return 5;
 const metresPerMinute=speed*1000/60,grade=(incline||0)/100,running=speed>=8;
 const oxygen=running?0.2*metresPerMinute+0.9*metresPerMinute*grade+3.5:0.1*metresPerMinute+1.8*metresPerMinute*grade+3.5;
 return oxygen/3.5;
}
const STRENGTH_MET=3.5;
// cardio: saved cardio results ({duration in minutes, speed, incline}). Without a body weight the old rough
// figure (5 kcal a minute) is used and `fromWeight` is false, so the screen can say so.
export function estimateKcal(seconds,{cardio=[],weightKg=null}={}){
 if(!(weightKg>0))return {kcal:Math.round(seconds/60*5),fromWeight:false};
 const cardioMinutes=cardio.reduce((total,r)=>total+(r.duration||0),0);
 const cardioKcal=cardio.reduce((total,r)=>total+cardioMet(r)*weightKg*(r.duration||0)/60,0);
 const strengthMinutes=Math.max(0,seconds/60-cardioMinutes);
 return {kcal:Math.round(cardioKcal+STRENGTH_MET*weightKg*strengthMinutes/60),fromWeight:true};
}
// Standard warm-up and cool-down, used when the trainer's plan has none of its own. Picked by what the main work
// trains most: legs, upper body, or a general mix. Every move is timed and has a demo picture in the library.
const move=(exercise,seconds,phase,source='standard')=>({exercise,sets:1,seconds,weight:null,rest_seconds:0,phase,standard:true,source});
// A trainer's or member's own set ({exercise, seconds} moves) as timed steps, like the standard ones.
export const routineMoves=(moves,phase,source)=>(moves??[]).map(({exercise,seconds})=>move(exercise,seconds,phase,source));
const WARMUP={
 general:[['Jack Jump (กระโดดตบ)',45],['Inchworm (เดินมือ)',45],['World Greatest Stretch (ยืดทั้งตัว)',60],['Squat To Overhead Reach With Twist (สควอตบิดตัว)',45]],
 lower:[['Jack Jump (กระโดดตบ)',45],['Walking High Knees Lunge (ยกเข่าสลับลันจ์)',45],['World Greatest Stretch (ยืดทั้งตัว)',60],['Squat To Overhead Reach With Twist (สควอตบิดตัว)',45]],
 upper:[['Jack Jump (กระโดดตบ)',45],['Inchworm (เดินมือ)',45],['Dynamic Chest Stretch (เปิดอก)',45],['World Greatest Stretch (ยืดทั้งตัว)',60]],
};
const COOLDOWN={
 general:[['Hamstring Stretch (ยืดต้นขาหลัง)',40],['Chest And Front Of Shoulder Stretch (ยืดอกและไหล่)',40],['Spine Twist (บิดหลัง)',40],['Neck Side Stretch (ยืดคอ)',30]],
 lower:[['Hamstring Stretch (ยืดต้นขาหลัง)',40],['Intermediate Hip Flexor And Quad Stretch (ยืดสะโพกและต้นขาหน้า)',40],['Seated Glute Stretch (ยืดก้น)',40],['Calf Stretch With Hands Against Wall (ยืดน่อง)',30]],
 upper:[['Chest And Front Of Shoulder Stretch (ยืดอกและไหล่)',40],['Kneeling Lat Stretch (ยืดปีกหลัง)',40],['Spine Twist (บิดหลัง)',40],['Neck Side Stretch (ยืดคอ)',30]],
};
const LOWER=new Set(['quad','glute','hamstring','calf','adductor','abductor']),UPPER=new Set(['pec','deltoid','lat','trap','biceps','triceps','flexor','rhomboid']);
export function workoutFocus(targets){
 let lower=0,upper=0;
 for(const t of targets){if(t.trainingType==='cardio')continue;for(const m of musclesFor(t.exercise)?.primary??[]){if(LOWER.has(m))lower++;if(UPPER.has(m))upper++;}}
 return lower>upper*1.5?'lower':upper>lower*1.5?'upper':'general';
}
export function standardRoutine(targets){
 const focus=workoutFocus(targets.filter(t=>phaseOf(t)==='main'));
 return {focus,warmup:WARMUP[focus].map(([name,s])=>move(name,s,'warmup')),cooldown:COOLDOWN[focus].map(([name,s])=>move(name,s,'cooldown'))};
}
