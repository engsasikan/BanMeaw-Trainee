// Shows which muscles an exercise works, on the user's own 3D body.
// Attaches to the workout form's #exercise field, and exports createMuscleFocus() for the guided training screen.
import {musclesFor, MUSCLE_LABELS} from './exercise-muscles.mjs?v=2';
import {motionFor} from './exercise-motion.mjs?v=4';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let body={sex:'male'},timer;
const views=new Set();
window.addEventListener('body-records',e=>{const latest=(e.detail||[])[0];if(latest)body=latest;for(const v of views)v.refresh();});

// One muscle card with its own 3D figure; show(name) updates it in place.
export function createMuscleFocus(){
 const box=node('section',undefined,'ex-focus');box.hidden=true;box.setAttribute('aria-live','polite');
 const head=node('div',undefined,'ex-focus-head');const play=node('button','หยุดท่า','ex-focus-play');play.type='button';play.hidden=true;
 head.append(node('strong','กล้ามเนื้อที่ท่านี้ใช้'),node('span','หุ่นของคุณ · หมุนดูได้','muted'),play);
 const chips=node('div',undefined,'ex-focus-chips'),stage=node('div',undefined,'ex-focus-stage');
 const legend=node('p',undefined,'ex-focus-legend');legend.innerHTML='<i class="p"></i>ทำงานหลัก <i class="s"></i>ช่วยเสริม';
 box.append(head,chips,stage,legend);
 let figure=null,mounting=null,shown='',focus=null,motion=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const label=()=>{play.textContent=playing?'หยุดท่า':'เล่นท่า';play.setAttribute('aria-pressed',String(!playing));};
 play.onclick=()=>{playing=!playing;label();figure?.setPlaying(playing);};
 async function draw(){
  try{
   // One figure per card: draws that start while body3d is still loading share the same mount.
   mounting??=import('./body3d.js?v=19').then(m=>m.mountBody(stage));
   figure=await mounting;
   figure.setPlaying(playing);
   await figure.update({...body,focus,motion},'focus');
   play.hidden=!figure.hasMotion();label();
  }catch{mounting=null;figure=null;stage.replaceChildren(node('p','อุปกรณ์นี้แสดง 3D ไม่ได้ ดูชื่อกล้ามเนื้อด้านบนแทน','muted'));}
 }
 const view={el:box,
  show(name){
   name=(name||'').trim();focus=name?musclesFor(name):null;motion=name?motionFor(name):null;
   if(!focus){box.hidden=true;shown='';return;}
   box.hidden=false;if(name===shown&&figure)return;shown=name;
   chips.replaceChildren(
    ...focus.primary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip p')),
    ...focus.secondary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip s')));
   draw();
  },
  refresh(){if(focus)draw();}};
 views.add(view);return view;
}

// Workout form: card after the exercise field's hint.
let formView=null;
function render(){
 const input=$('exercise'),anchor=$('exercise-hint')||$('exercise-picker');if(!input||!anchor)return;
 if(!formView){formView=createMuscleFocus();formView.el.id='exercise-focus';anchor.after(formView.el);}
 formView.show(input.value);
}
const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,200);};
function attach(){
 const input=$('exercise');if(!input){setTimeout(attach,500);return;}
 for(const ev of ['input','change','blur'])input.addEventListener(ev,schedule);
 $('exercise-options')?.addEventListener('click',schedule);
 input.form?.addEventListener('reset',()=>setTimeout(render,0));
 // Editing an existing entry fills the field from code: re-check when the workout panel is shown.
 document.querySelectorAll('[data-view="workout"]').forEach(b=>b.addEventListener('click',schedule));
 let last=input.value;
 setInterval(()=>{if(!input.closest('[hidden]')&&input.value!==last){last=input.value;render();}},800); // value set from code (editing an entry)
 schedule();
}
attach();
