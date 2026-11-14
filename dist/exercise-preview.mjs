// Shows which muscles an exercise works, on the user's own 3D body.
// Attaches to the workout form's #exercise field, and exports createMuscleFocus() for the guided training screen.
import {musclesFor, MUSCLE_LABELS} from './exercise-muscles.mjs?v=2';
import {demonstrationFor} from './exercise-demo.mjs?v=1';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let body={sex:'male'},timer;
const views=new Set();
window.addEventListener('body-records',e=>{const latest=(e.detail||[])[0];if(latest)body=latest;for(const v of views)v.refresh();});

// One muscle card with its own 3D figure; show(name) updates it in place.
export function createMuscleFocus({collapsed=false}={}){
 const box=node('section',undefined,'ex-focus');box.hidden=true;box.setAttribute('aria-live','polite');
 const head=node('div',undefined,'ex-focus-head');const play=node('button','หยุดท่า','ex-focus-play');play.type='button';play.hidden=true;
 const hint=node('span','หุ่นของคุณ · หมุนดูได้','muted');head.append(node('strong','กล้ามเนื้อที่ท่านี้ใช้'),hint,play);
 const chips=node('div',undefined,'ex-focus-chips'),stage=node('div',undefined,'ex-focus-stage');
 const legend=node('p',undefined,'ex-focus-legend');legend.innerHTML='<i class="p"></i>ทำงานหลัก <i class="s"></i>ช่วยเสริม';
 const exerciseName=node('h4'),approximation=node('p','ภาพจำลองท่าพื้นฐาน · รายละเอียดอุปกรณ์และรูปแบบการฝึกอาจต่างจากท่าจริง','muted');
 // Demo GIF linked from ExerciseDB's server (see scripts/build-exercise-media.mjs); hidden when there is none.
 const gif=node('figure',undefined,'ex-gif');gif.hidden=true;
 const gifCredit=node('figcaption');gifCredit.append('ภาพท่าจาก ');
 const gifLink=node('a','ExerciseDB');gifLink.href='https://github.com/ExerciseDB/exercisedb-api';gifLink.target='_blank';gifLink.rel='noopener noreferrer';
 gifCredit.append(gifLink);
 // With a GIF the 3D figure is left out entirely (not even loaded); if the GIF fails, the 3D comes back.
 let previewRequest=0,useGif=false,checkingGif=false;
 function layout(){
  const hideFigure=useGif||checkingGif;
  stage.hidden=hint.hidden=approximation.hidden=hideFigure;
  if(hideFigure){play.hidden=true;figure?.setPlaying(false);}
  if(!hideFigure&&focus&&!content.hidden)draw();
 }
 async function showGif(name){
  const request=++previewRequest;
  useGif=false;checkingGif=true;gif.hidden=true;layout();
  const url=await import('./exercise-media.mjs?v=1').then(m=>m.gifFor(name)).catch(()=>null);
  if(request!==previewRequest)return;
  checkingGif=false;useGif=!!url;gif.hidden=!url;
  if(url){
   const img=node('img');img.loading='lazy';img.decoding='async';img.width=180;img.height=180;img.referrerPolicy='no-referrer';
   img.alt='ภาพเคลื่อนไหวท่า '+name;
   img.onerror=()=>{if(request!==previewRequest)return;useGif=false;gif.hidden=true;layout();};
   gif.replaceChildren(img,gifCredit);img.src=url;
  }
  layout();
 }
 const content=node('div');content.append(exerciseName,gif,head,chips,stage,legend,approximation);
 const toggle=node('button','ดูตัวอย่างท่า','quiet ex-preview-toggle');toggle.type='button';toggle.setAttribute('aria-expanded',String(!collapsed));
 content.hidden=collapsed;toggle.hidden=!collapsed;box.append(toggle,content);
 toggle.onclick=()=>{content.hidden=!content.hidden;toggle.textContent=content.hidden?'ดูตัวอย่างท่า':'ซ่อนตัวอย่างท่า';toggle.setAttribute('aria-expanded',String(!content.hidden));if(content.hidden)figure?.setPlaying(false);layout();};
 let figure=null,mounting=null,shown='',focus=null,motion=null,demo=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const label=()=>{play.textContent=playing?'หยุดท่า':'เล่นท่า';play.setAttribute('aria-pressed',String(!playing));};
 play.onclick=()=>{playing=!playing;label();figure?.setPlaying(playing);};
 async function draw(){
  try{
   // One figure per card: draws that start while body3d is still loading share the same mount.
   mounting??=import('./body3d.js?v=26').then(m=>m.mountBody(stage));
   figure=await mounting;
   await figure.update({...body,focus,motion,demo},'focus');
   const inactive=!focus||content.hidden||checkingGif||useGif;
   figure.setPlaying(playing&&!inactive);
   play.hidden=inactive||!figure.hasMotion();label();
  }catch{mounting=null;figure=null;stage.replaceChildren(node('p','อุปกรณ์นี้แสดง 3D ไม่ได้ ดูชื่อกล้ามเนื้อด้านบนแทน','muted'));}
 }
 const view={el:box,
  show(name){
   exerciseName.textContent=name||'';
   name=(name||'').trim();focus=name?musclesFor(name):null;demo=name?demonstrationFor(name):null;motion=demo?.motion??null;
   if(name&&!focus&&demo)focus={primary:[],secondary:[]};
   approximation.textContent=demo?.quality==='protocol'?demo.description:demo?.quality==='muscle-group'?'ภาพ 3D กล้ามเนื้อ · ท่านี้ยังไม่มีแอนิเมชันเฉพาะ จึงไม่แสดงท่าอื่นแทน':'ภาพจำลองการเคลื่อนไหวโดยประมาณ · '+(demo?.description||'รายละเอียดอาจต่างจากท่าจริง');
   if(demo?.quality==='muscle-group')motion=null;
   if(!focus){box.hidden=true;shown='';++previewRequest;figure?.setPlaying(false);return;}
   box.hidden=false;if(name===shown)return;shown=name;
   chips.replaceChildren(
    ...focus.primary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip p')),
    ...focus.secondary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip s')));
   showGif(name); // decides GIF or 3D, then draws the 3D only when there is no GIF
  },
  refresh(){if(focus&&!content.hidden&&!checkingGif&&!useGif)draw();},destroy(){focus=null;++previewRequest;views.delete(view);figure?.dispose?.();box.remove();}};
 views.add(view);return view;
}

// Workout form: card after the exercise field's hint.
let formView=null;
function render(){
 const input=$('exercise'),anchor=$('exercise-hint')||$('exercise-picker');if(!input||!anchor)return;
 if(!formView){formView=createMuscleFocus({collapsed:true});formView.el.id='exercise-focus';anchor.after(formView.el);}
 formView.show(input.value);
}
const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,200);};
function attach(){
 const input=$('exercise');if(!input){setTimeout(attach,500);return;}
 // Multiple import URLs must still attach only one preview to this input.
 if(input.dataset.muscleFocusAttached)return;
 input.dataset.muscleFocusAttached='true';
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
