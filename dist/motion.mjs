// Small bits of motion so the diary answers back: the cat cheers when something is saved,
// numbers count up, new cards slide in and finishing the day throws confetti.
// Everything here is decoration: it reads the page and never changes saved data.
import {personalRecord,recordText} from './personal-record.mjs?v=1';
const $=id=>document.getElementById(id);
export const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Restart a CSS animation class even when it is already on the element.
export function replay(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);el.addEventListener('animationend',()=>el.classList.remove(cls),{once:true});}

const counting=new WeakMap();
// Count the number at the start of el's text up (or down) from what it showed last time.
export function countUp(el,ms=600){
 if(!el)return;const match=/^(\d+)(.*)$/s.exec(el.textContent);if(!match)return;
 const to=Number(match[1]),rest=match[2],state=counting.get(el)||{shown:0};
 cancelAnimationFrame(state.frame);const from=state.shown;state.shown=to;counting.set(el,state);
 if(from===to||reducedMotion()){el.textContent=to+rest;return;}
 const start=performance.now();
 const step=now=>{const t=Math.min(1,(now-start)/ms),eased=1-(1-t)**3;el.textContent=Math.round(from+(to-from)*eased)+rest;if(t<1)state.frame=requestAnimationFrame(step);};
 el.textContent=from+rest;state.frame=requestAnimationFrame(step);
}

// The cat pops up from the bottom with a short message.
let toast=null,toastTimer=null,proudUntil=0;
export function cheer(text,mood='happy'){
 if(typeof document==='undefined'||!text)return;
 // A celebration keeps the stage for a moment; a smaller cheer right after it would hide it.
 if(mood==='proud')proudUntil=Date.now()+3000;else if(Date.now()<proudUntil)return;
 if(!toast){
  toast=document.createElement('div');toast.className='cat-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  const img=document.createElement('img');img.src='/cat-icon-192.png';img.width=56;img.height=56;img.alt='';
  const bubble=document.createElement('p');toast.append(img,bubble);toast.onclick=()=>toast.classList.remove('show');document.body.append(toast);
 }
 toast.dataset.mood=mood;toast.querySelector('p').textContent=text;
 toast.classList.remove('show');void toast.offsetWidth;toast.classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3200);
 for(const cat of document.querySelectorAll('.brand-icon,.welcome-mini-cat'))replay(cat,'cat-jump');
}

// A short confetti burst in the app's colours, drawn on a throwaway canvas.
export function confetti(){
 if(typeof document==='undefined'||reducedMotion())return;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width=innerWidth,h=canvas.height=innerHeight;canvas.className='confetti';document.body.append(canvas);
 const colours=['#ff7028','#ffa36c','#ffd7bd','#7fd6a0','#ffffff','#ffcf3f'];
 const bits=Array.from({length:140},()=>({x:w/2+(Math.random()-.5)*w*.3,y:h*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*13-4,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.3,s:6+Math.random()*6,c:colours[Math.floor(Math.random()*colours.length)]}));
 const start=performance.now();
 const frame=now=>{
  const t=now-start;ctx.clearRect(0,0,w,h);ctx.globalAlpha=Math.max(0,1-Math.max(0,t-1600)/800);
  for(const b of bits){b.vy+=.35;b.vx*=.99;b.x+=b.vx;b.y+=b.vy;b.r+=b.vr;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.r);ctx.fillStyle=b.c;ctx.fillRect(-b.s/2,-b.s/4,b.s,b.s/2);ctx.restore();}
  if(t<2400)requestAnimationFrame(frame);else canvas.remove();
 };
 requestAnimationFrame(frame);
}
export function celebrate(text){confetti();cheer(text,'proud');}

const MEAL_CHEERS=['อร่อยไหม? จดไว้แล้วนะ','เก่งมาก จดครบทุกคำ','แมวจำให้แล้ว เมี้ยว~'];
const WORKOUT_CHEERS=['สุดยอด! อีกนิดก็แข็งแรงขึ้นแล้ว','กล้ามขอบคุณนะ 💪','เยี่ยม! แมวภูมิใจในตัวคุณ'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
// What to say about records that just appeared; null when nothing new or too many to be a single save (import, restore).
export function cheerFor(added){
 if(!added.length||added.length>4)return null;
 const workouts=added.filter(r=>r.kind==='workout');
 if(workouts.length)return (workouts.length>1?'บันทึก '+workouts.length+' ท่าแล้ว':'บันทึก '+workouts[0].exercise+' แล้ว')+' · '+pick(WORKOUT_CHEERS);
 return 'บันทึก'+added[0].meal+'แล้ว · '+pick(MEAL_CHEERS);
}

let started=false;
export function initMotion(){
 if(started)return;started=true;
 let records=[];
 window.addEventListener('diary-records',e=>{
  records=e.detail||[];
  for(const id of ['dash-meals','dash-workouts','food-meal-count'])countUp($(id));
  for(const el of document.querySelectorAll('.activity-summary strong'))countUp(el);
 });
 // app.js fires this after a save, with only the rows that save created.
 window.addEventListener('diary-added',e=>{
  const added=e.detail||[];
  for(const r of added)for(const card of document.querySelectorAll('[data-id="'+CSS.escape(r.id)+'"]'))replay(card,'entry-new');
  // A new personal record beats a plain cheer.
  const pr=added.length<=4&&added.map(r=>[r,personalRecord(records,r)]).find(([,p])=>p);
  if(pr){celebrate(recordText(...pr));return;}
  const text=cheerFor(added);if(text)cheer(text);
 });
 window.addEventListener('banmeaw-cheer',e=>cheer(e.detail?.text,e.detail?.mood));
 window.addEventListener('banmeaw-celebrate',e=>celebrate(e.detail?.text));
}
