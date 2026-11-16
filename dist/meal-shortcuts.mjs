// Shortcuts for noting meals: foods eaten often (one tap fills the form) and copying the day before's meals.
const key=text=>text.trim().replace(/\s+/g,' ').toLowerCase();
const shiftDay=(day,offset)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
const meals=records=>records.filter(r=>r.kind!=='workout'&&typeof r.text==='string'&&r.text.trim());

// Foods noted at least twice in the `days` before `day`, most often first. Each keeps the meal type it is
// usually eaten at and the numbers from its latest time, so the form can be filled from it.
export function frequentMeals(records,day,{days=60,limit=6}={}){
 const from=shiftDay(day,-days),groups=new Map();
 for(const r of meals(records)){
  if(r.day<from||r.day>day)continue;
  const k=key(r.text),group=groups.get(k)??{text:r.text.trim(),count:0,latest:r,mealCounts:new Map()};
  group.count++;group.mealCounts.set(r.meal,(group.mealCounts.get(r.meal)||0)+1);
  if(r.day+(r.time||'')>group.latest.day+(group.latest.time||'')){group.latest=r;group.text=r.text.trim();}
  groups.set(k,group);
 }
 return [...groups.values()].filter(g=>g.count>=2)
  .sort((a,b)=>b.count-a.count||b.latest.day.localeCompare(a.latest.day))
  .slice(0,limit)
  .map(g=>({text:g.text,count:g.count,meal:[...g.mealCounts].sort((a,b)=>b[1]-a[1])[0][0],
   ...(g.latest.kcal!=null?{kcal:g.latest.kcal}:{}),...(g.latest.protein!=null?{protein:g.latest.protein}:{}),
   ...(g.latest.workoutTiming?{workoutTiming:g.latest.workoutTiming}:{})}));
}

// The day before's meals that are not already on `day` (same meal type and food), as new records for `day`.
export function previousDayCopies(records,day,newId=()=>crypto.randomUUID()){
 const before=shiftDay(day,-1),list=meals(records);
 const present=new Set(list.filter(r=>r.day===day).map(r=>r.meal+'|'+key(r.text)));
 return list.filter(r=>r.day===before&&!present.has(r.meal+'|'+key(r.text)))
  .sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'))
  .map(r=>({id:newId(),day,meal:r.meal,time:r.time??'',text:r.text.trim(),
   ...(r.workoutTiming?{workoutTiming:r.workoutTiming}:{}),...(r.kcal!=null?{kcal:r.kcal}:{}),...(r.protein!=null?{protein:r.protein}:{})}));
}
export const previousDay=day=>shiftDay(day,-1);
