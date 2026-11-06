// How the overview cat feels about a day, from what was logged here and what came from Apple Health.
//  cry     nothing logged (on today: only from noon; mornings are 'sleepy')
//  sleepy  today, before noon, nothing logged yet
//  free    something logged but no training: a free day, the cat is happy and relaxed
//  runner  trained, and every workout was running or walking
//  buff    a heavy session: lots of strength sets, or a long or hard workout
//  trained any other training
const RUN=/run|jog|treadmill|walk|sprint|วิ่ง|เดิน|ลู่/i;
const isRunName=s=>RUN.test(s||'');
const HEALTH_RUN=new Set(['Running','Walking','Hiking','TrackAndField']);
const HEALTH_STRENGTH=/Strength|HighIntensityInterval|CrossTraining|CoreTraining|Boxing|Kickboxing|MartialArts/;

export function catMood({day,today,hour=12,diary=[],body=[],health={}}){
 const rows=diary.filter(r=>r.day===day),workouts=rows.filter(r=>r.kind==='workout');
 const hDay=(health.days||[]).find(d=>d.day===day),hWorkouts=(health.workouts||[]).filter(w=>w.day===day);
 const weighed=body.some(r=>r.day===day&&r.weight!=null)||hDay?.weight!=null;
 const anything=rows.length||weighed||hWorkouts.length;
 if(!anything)return day===today&&hour<12?'sleepy':'cry';
 if(!workouts.length&&!hWorkouts.length)return 'free';
 const strength=workouts.filter(r=>(r.trainingType||'strength')==='strength');
 const sets=strength.reduce((n,r)=>n+(r.setLogs?.length||r.sets||0),0);
 const cardioMin=workouts.filter(r=>r.trainingType==='cardio').reduce((n,r)=>n+(r.duration||0),0)+hWorkouts.reduce((n,w)=>n+(w.durationMin||0),0);
 const hardWatch=hWorkouts.some(w=>HEALTH_STRENGTH.test(w.activity)&&(w.durationMin||0)>=40)||(hDay?.activeKcal||0)>=700||(hDay?.exerciseMin||0)>=75;
 if(sets>=12||strength.length>=4||hardWatch||cardioMin>=90)return 'buff';
 const allRun=workouts.every(r=>r.trainingType==='cardio'&&isRunName(r.exercise))&&hWorkouts.every(w=>HEALTH_RUN.has(w.activity));
 if(allRun)return 'runner';
 return 'trained';
}

export const MOOD_TEXT={
 cry:{today:'ยังไม่ได้บันทึกอะไรเลย แมวร้องไห้แล้ว 😿',past:'วันนั้นไม่มีบันทึกเลย แมวเศร้า 😿'},
 sleepy:{today:'แมวยังงัวเงีย ชั่งน้ำหนักปลุกแมวหน่อย 😴'},
 free:{today:'ฟรีเดย์! พักให้สบาย แมวแฮปปี้ 😸',past:'ฟรีเดย์ พักสบาย ๆ 😸'},
 runner:{today:'พี่นักวิ่งมาแล้ว! 🏃 ซิ่งไปเลย',past:'วันนั้นพี่นักวิ่งออกวิ่ง 🏃'},
 buff:{today:'วันนี้ฝึกหนัก แมวเฟิร์มสุด ๆ 💪🔥',past:'วันนั้นฝึกหนัก แมวเฟิร์ม 💪'},
 trained:{today:'ฝึกแล้ว เก่งมาก แมวภูมิใจ ✨',past:'วันนั้นได้ฝึก เยี่ยม ✨'},
};
export const moodText=(mood,isToday)=>MOOD_TEXT[mood]?.[isToday?'today':'past']||MOOD_TEXT[mood]?.today||'';
