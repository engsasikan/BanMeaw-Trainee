import {LIBRARY} from './exercise-library.mjs?v=1';
export const EXERCISES=[
 ['HIIT','คาร์ดิโอ','cardio คาดิโอ ฮิต เอชไอไอที interval training สลับหนักเบา'],['HIIT วิ่งสลับเดิน','คาร์ดิโอ','cardio คาดิโอ ฮิต interval running sprint walking treadmill ลู่วิ่ง สลับหนักเบา'],['HIIT ปั่นจักรยาน','คาร์ดิโอ','cardio คาดิโอ ฮิต interval cycling bike สลับหนักเบา'],['HIIT น้ำหนักตัว','คาร์ดิโอ','cardio คาดิโอ ฮิต interval bodyweight circuit เบอร์พี กระโดด สลับหนักเบา'],
 ['เดินชัน','คาร์ดิโอ','cardio คาดิโอ incline walking uphill treadmill เดินขึ้นเนิน ลู่วิ่ง'],['เดินเร็ว','คาร์ดิโอ','cardio คาดิโอ walking treadmill ลู่วิ่ง'],['วิ่ง','คาร์ดิโอ','cardio running jogging ลู่วิ่ง'],['ปั่นจักรยาน','คาร์ดิโอ','cardio cycling bike'],['เครื่องเดินวงรี','คาร์ดิโอ','cardio elliptical'],['ขึ้นบันได','คาร์ดิโอ','cardio stair climber'],['ว่ายน้ำ','คาร์ดิโอ','cardio swimming'],['กระโดดเชือก','คาร์ดิโอ','cardio jump rope'],
 ['Barbell Squat','ขา','สควอต สควอท บาร์เบล'],['Goblet Squat','ขา','กอบเล็ต ดัมเบล สควอต'],['Leg Press','ขา','เลกเพรส เครื่องดันขา'],['Leg Extension','ขา','เหยียดขา หน้าขา'],['Leg Curl','ขา','งอขา หลังขา'],['Romanian Deadlift','ขา','rdl โรมาเนียน เดดลิฟต์ หลังขา'],['Deadlift','ขา / หลัง','เดดลิฟต์ เดดลิฟท์'],['Lunge','ขา','ลันจ์'],['Bulgarian Split Squat','ขา','บัลแกเรียน สปลิต สควอต'],['Hip Thrust','สะโพก','ฮิปทรัสต์ ก้น'],['Glute Bridge','สะโพก','กลูตบริดจ์ ก้น'],['Calf Raise','น่อง','ยกน่อง'],
 ['Barbell Bench Press','อก','เบนช์เพรส บาร์เบล'],['Dumbbell Bench Press','อก','เบนช์เพรส ดัมเบล'],['Incline Dumbbell Press','อก','อกบน ดัมเบล'],['Chest Press Machine','อก','เครื่องดันอก เชสต์เพรส'],['Cable Fly','อก','เคเบิลฟลาย'],['Pec Deck Fly','อก','เพ็กเด็ค ฟลาย'],['Push-up','อก','วิดพื้น pushup'],
 ['Lat Pulldown','หลัง','แลตพูลดาวน์ ลาต พูลดาวน์ ดึงหลัง'],['Seated Cable Row','หลัง','ซีทเต็ด เคเบิลโรว์ ดึงหลัง'],['Dumbbell Row','หลัง','ดัมเบลโรว์'],['Barbell Row','หลัง','บาร์เบลโรว์'],['Pull-up','หลัง','ดึงข้อ pullup'],['Assisted Pull-up','หลัง','ดึงข้อ เครื่องช่วย'],['Face Pull','ไหล่ / หลัง','เฟซพูล'],
 ['Dumbbell Shoulder Press','ไหล่','ดัมเบล โชลเดอร์เพรส'],['Overhead Press','ไหล่','ohp บาร์เบล โอเวอร์เฮดเพรส'],['Lateral Raise','ไหล่','ยกข้าง เลเทอรัลเรส'],['Rear Delt Fly','ไหล่','ไหล่หลัง รีร์เดลต์'],
 ['Dumbbell Biceps Curl','แขน','ไบเซป เคิร์ล หน้าแขน'],['Barbell Biceps Curl','แขน','บาร์เบล เคิร์ล หน้าแขน'],['Hammer Curl','แขน','แฮมเมอร์เคิร์ล'],['Triceps Pushdown','แขน','หลังแขน ไตรเซป พุชดาวน์'],['Overhead Triceps Extension','แขน','หลังแขน เหยียดแขน'],['Dips','แขน / อก','ดิปส์'],
 ['Plank','แกนกลาง','แพลงก์ ท้อง'],['Crunch','ท้อง','ครันช์'],['Hanging Leg Raise','ท้อง','ยกขาห้อยตัว'],['Cable Crunch','ท้อง','เคเบิลครันช์'],['Russian Twist','ท้อง','รัสเซียนทวิสต์'],
 ['Treadmill','คาร์ดิโอ','ลู่วิ่ง เดิน วิ่ง'],['Stationary Bike','คาร์ดิโอ','จักรยาน ปั่น'],['Rowing Machine','คาร์ดิโอ','เครื่องกรรเชียง พายเรือ'],['Elliptical','คาร์ดิโอ','เครื่องเดินวงรี'],['Jump Rope','คาร์ดิโอ','กระโดดเชือก']
].map(([name,group,aliases])=>({name,group,aliases}));
const normalize=s=>s.toLocaleLowerCase().normalize('NFKC').replace(/[-_]/g,' ').trim();
// Full library (hasaneyldrm/exercises-dataset) after the hand-picked list, skipping names already in it.
// Keep library aliases for names that are also in the hand-picked list.
for (const x of EXERCISES) { const row=LIBRARY.find(r=>normalize(r[0])===normalize(x.name)); if(row) x.aliases+=' '+row[2]; }
const curated=new Set(EXERCISES.map(x=>normalize(x.name)));
const MORE=LIBRARY.filter(([name])=>!curated.has(normalize(name))).map(([name,group,aliases])=>({name,group,aliases}));
export const SHOW_LIMIT=60;
// Common spellings people type that differ from the library names.
const TYPOS={db:'dumbbell',bendover:'bent over',matchine:'machine',bend:'bent',bentover:'bent over',dumbell:'dumbbell',dumbel:'dumbbell',barbel:'barbell',kettlebel:'kettlebell',pushup:'push up',pullup:'pull up',chinup:'chin up',situp:'sit up',shoulderpress:'shoulder press',benchpress:'bench press',legpress:'leg press'};
// Hand-picked first, then library names that match, then library muscle/equipment matches.
export function searchExercises(query){
 const searchable=s=>normalize(s).split(/\s+/).filter(Boolean).flatMap(t=>(TYPOS[t]??t).split(' ')).join(' ');
 const tokens=searchable(query).split(' ').filter(Boolean),hit=(x,text)=>tokens.every(t=>searchable(text).includes(t));
 const more=MORE.filter(x=>hit(x,x.name+' '+x.group+' '+x.aliases));
 return [...EXERCISES.filter(x=>hit(x,x.name+' '+x.group+' '+x.aliases)),...more.filter(x=>hit(x,x.name)),...more.filter(x=>!hit(x,x.name))];
}
export function bindExercisePicker({input,toggle,wrapper,dropdown,list,empty,find=searchExercises,onChoose,custom}){
 let matches=[],active=-1,buttons=[];
 const more=document.createElement('p');more.className='exercise-more';more.hidden=true;list.after(more);
 function close(){
  dropdown.hidden=true;input.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');active=-1;
 }
 function highlight(){
  buttons.forEach((button,index)=>button.setAttribute('aria-selected',String(index===active)));
  if(active>=0){input.setAttribute('aria-activedescendant',buttons[active].id);buttons[active].scrollIntoView({block:'nearest'});}
 }
 function choose(exercise){
  input.value=exercise.name;input.setCustomValidity('');close();
  onChoose?.(exercise);
 }
 function open(all=false){
  const found=find(all?'':input.value);
  matches=found.slice(0,SHOW_LIMIT);active=-1;list.replaceChildren();buttons=[];
  matches.forEach((exercise,index)=>{
   const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.id=list.id+'-'+index;
   button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   const name=document.createElement('span'),group=document.createElement('small');name.textContent=exercise.name;group.textContent=exercise.group??'';
   button.append(name,group);button.onclick=()=>choose(exercise);buttons.push(button);list.append(button);
  });
  if(custom){
   const name=input.value.trim();
   custom.hidden=!name||found.some(exercise=>normalize(exercise.name)===normalize(name));
   custom.textContent='เพิ่มท่า: '+name;
  }
  more.hidden=found.length<=matches.length;
  more.textContent='แสดง '+matches.length+' จาก '+found.length+' ท่า พิมพ์เพิ่มเพื่อค้นหา';
  empty.hidden=matches.length>0;dropdown.hidden=false;
  input.setAttribute('aria-expanded','true');toggle?.setAttribute('aria-expanded','true');
  input.removeAttribute('aria-activedescendant');
 }
 if(custom)custom.onclick=()=>choose({name:input.value.trim()});
 dropdown.addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.preventDefault();});
 input.addEventListener('focus',()=>open());input.addEventListener('input',()=>open());
 if(toggle)toggle.onclick=()=>{if(dropdown.hidden){input.focus();open(true);}else close();};
 input.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(dropdown.hidden)open();
   if(matches.length){active=event.key==='ArrowDown'?(active+1)%matches.length:active<0?matches.length-1:(active-1+matches.length)%matches.length;highlight();}
  }else if(event.key==='Enter'&&!dropdown.hidden){
   if(active>=0){event.preventDefault();choose(matches[active]);}
   else if(custom&&input.value.trim()){event.preventDefault();choose(matches.find(exercise=>normalize(exercise.name)===normalize(input.value))??{name:input.value.trim()});}
  }else if(event.key==='Escape'){event.preventDefault();close();}
  else if(event.key==='Tab')close();
 });
 wrapper.addEventListener('focusout',()=>setTimeout(()=>{if(!wrapper.contains(document.activeElement))close();},0));
 return {close,choose};
}
export function attachExercisePicker(){
 const byId=id=>document.getElementById(id),input=byId('exercise'),wrapper=byId('exercise-picker');
 const dropdown=byId('exercise-dropdown'),custom=document.createElement('button');
 custom.type='button';custom.hidden=true;dropdown.prepend(custom);
 const {close}=bindExercisePicker({input,wrapper,toggle:byId('exercise-toggle'),dropdown,custom,
  list:byId('exercise-options'),empty:byId('exercise-no-results'),onChoose:()=>{input.dispatchEvent(new Event('change'));input.focus();}});
 document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close();});
 const form=byId('workout-form');form.addEventListener('reset',close);form.addEventListener('submit',close);
 document.querySelectorAll('[data-view="food"]').forEach(button=>button.addEventListener('click',close));
}
