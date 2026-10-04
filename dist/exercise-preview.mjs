// Workout form: shows which muscles the chosen exercise works, on the user's own 3D body.
// Self-contained: attaches to the #exercise field and inserts its card after the field's hint.
import {musclesFor, MUSCLE_LABELS} from './exercise-muscles.mjs?v=1';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
let body={sex:'male'},figure=null,shown='',timer;
window.addEventListener('body-records',e=>{const latest=(e.detail||[])[0];if(latest)body=latest;if(shown)render(true);});

function card(){
 let box=$('exercise-focus');if(box)return box;
 const anchor=$('exercise-hint')||$('exercise-picker');if(!anchor)return null;
 box=node('section',undefined,'ex-focus');box.id='exercise-focus';box.hidden=true;box.setAttribute('aria-live','polite');
 const head=node('div',undefined,'ex-focus-head');head.append(node('strong','กล้ามเนื้อที่ท่านี้ใช้'),node('span','หุ่นของคุณ · หมุนดูได้','muted'));
 const chips=node('div',undefined,'ex-focus-chips');chips.id='exercise-focus-chips';
 const stage=node('div',undefined,'ex-focus-stage');stage.id='exercise-focus-stage';
 const legend=node('p',undefined,'ex-focus-legend');legend.innerHTML='<i class="p"></i>ทำงานหลัก <i class="s"></i>ช่วยเสริม';
 box.append(head,chips,stage,legend);anchor.after(box);return box;
}
async function render(force=false){
 const input=$('exercise');if(!input)return;
 const name=input.value.trim(),focus=name?musclesFor(name):null,box=card();if(!box)return;
 if(!focus){box.hidden=true;shown='';return;}
 if(!force&&name===shown)return;shown=name;box.hidden=false;
 const chips=$('exercise-focus-chips');chips.replaceChildren(
  ...focus.primary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip p')),
  ...focus.secondary.map(m=>node('span',MUSCLE_LABELS[m]||m,'ex-chip s')));
 try{
  figure??=(await import('./body3d.js?v=14')).mountBody($('exercise-focus-stage'));
  await figure.update({...body,focus},'focus');
 }catch{$('exercise-focus-stage').replaceChildren(node('p','อุปกรณ์นี้แสดง 3D ไม่ได้ ดูชื่อกล้ามเนื้อด้านบนแทน','muted'));}
}
const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,200);};
function attach(){
 const input=$('exercise');if(!input){setTimeout(attach,500);return;}
 for(const ev of ['input','change','blur'])input.addEventListener(ev,schedule);
 $('exercise-options')?.addEventListener('click',schedule);
 input.form?.addEventListener('reset',()=>setTimeout(render,0));
 // Editing an existing entry fills the field from code: re-check when the workout panel is shown.
 document.querySelectorAll('[data-view="workout"]').forEach(b=>b.addEventListener('click',schedule));
 setInterval(()=>{if(!input.closest('[hidden]')&&input.value.trim()!==shown)render();},800); // value set from code (editing an entry)
 schedule();
}
attach();
