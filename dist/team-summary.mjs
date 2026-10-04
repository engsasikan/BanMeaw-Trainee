export function traineeSnapshot(bodyRecords,records,day){
 const history=bodyRecords.filter(r=>r.day<=day).sort((a,b)=>b.day.localeCompare(a.day));
 const weight=history.find(r=>r.weight!=null),height=history.find(r=>r.height!=null);
 return {weight:weight?.weight??null,height:height?.height??null,weightDay:weight?.day??null,heightDay:height?.day??null,meals:records.filter(r=>r.day===day&&r.kind!=='workout').sort((a,b)=>(a.time||'').localeCompare(b.time||'')),workouts:records.filter(r=>r.day===day&&r.kind==='workout')};
}
export function traineeCopyText(member,snapshot,day){
 const lines=['สรุปประจำวัน · '+day,member.display_name,member.member_code,'','ข้อมูลร่างกาย','• น้ำหนัก: '+(snapshot.weight==null?'ยังไม่มีข้อมูล':snapshot.weight+' กก. (ชั่ง '+snapshot.weightDay+')'),'• ส่วนสูง: '+(snapshot.height==null?'ยังไม่มีข้อมูล':snapshot.height+' ซม. (วัด '+snapshot.heightDay+')')];
 if(snapshot.meals?.length){
  lines.push('','อาหาร');
  for(const meal of snapshot.meals){lines.push('','• '+[meal.meal,meal.time,({'pre-workout':'ก่อนฝึก','post-workout':'หลังฝึก'}[meal.workoutTiming]||meal.workoutTiming)].filter(Boolean).join(' · '));for(const line of (meal.text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean))lines.push('  – '+line);}
 }
 if(snapshot.workouts?.length){
  lines.push('','ออกกำลังกาย');
  for(const r of snapshot.workouts){
   const detail=r.trainingType==='cardio'
    ? [r.duration!=null?r.duration+' นาที':'',r.distance!=null?r.distance+' กม.':'',r.incline!=null?'ความชัน '+r.incline+'%':'']
    : [r.weight==null?'':r.weight===0?'น้ำหนักตัว':r.weight+' กก.',r.sets!=null?r.sets+' เซ็ต':'',r.reps!=null?r.reps+' ครั้ง/เซ็ต':''];
   lines.push('','• '+r.exercise,'  – '+detail.filter(Boolean).join(' · '));
   if(r.setLogs?.length)r.setLogs.forEach((set,index)=>lines.push('  – เซ็ต '+(index+1)+': '+(set.weight==null?'ไม่ระบุน้ำหนัก':set.weight+' กก.')+' · '+set.reps+' ครั้ง'));if(r.sessionComplete===false)lines.push('  – ยังทำไม่ครบตามแผน');
   if(r.notes)for(const line of r.notes.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))lines.push('  – หมายเหตุ: '+line);
  }
 }
 return lines.filter(line=>line!==undefined).join('\n');
}
