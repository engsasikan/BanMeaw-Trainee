import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
class Element extends EventTarget{
 constructor(tag){super();this.tagName=tag;this.children=[];this.value='';this.hidden=false;this.disabled=false;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
 set textContent(s){this.text=String(s);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(x=>x.textContent).join('');}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 replaceChildren(...nodes){this.text='';this.children=nodes;}
 setAttribute(k,v){this[k]=v;}
 removeAttribute(k){this[k]=false;}
 scrollIntoView(){}
 after(){}
 querySelector(){return flatten(this).find(x=>x.tagName==='button'&&x.type==='submit');}
}
const flatten=root=>[root,...root.children.flatMap(flatten)];
const pad=n=>String(n).padStart(2,'0'),dayOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),TODAY=dayOf(new Date()),TOMORROW=dayOf(new Date(Date.now()+864e5));
test('guided training saves each set, resumes, retries failures and handles supersets and date changes',async()=>{
 const nodes=new Map(['dashboard-panel','today-card','workout-panel','day'].map(id=>[id,new Element('div')]));nodes.get('day').value=TODAY;
 const doc=new EventTarget();doc.createElement=tag=>new Element(tag);doc.getElementById=id=>nodes.get(id);doc.hidden=false;
 globalThis.document=doc;globalThis.window=new EventTarget();
 const built=await build({entryPoints:['dist/training-session.mjs'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/dashboard\.mjs|account\.js|exercise-preview\.mjs/},args=>({path:args.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function switchView(){}; export async function api(){return {ok:true}}; export function createMuscleFocus(){return {el:document.createElement("section"),show(){}}};',loader:'js'}));}}]});
 const {initTrainingSession}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 let records=[],fail=false,writes=0;
 initTrainingSession({getRecords:()=>records,saveRecords:async next=>{writes++;if(fail)return false;records=next;window.dispatchEvent(new CustomEvent('diary-records'));return true;}});
 const plan={id:'11111111-1111-4111-8111-111111111111',day:TODAY,exercises:[{exercise:'Squat',sets:2,reps:12,weight:20,rest_seconds:30,superset:'A'},{exercise:'Row',sets:2,reps:10,weight:15,rest_seconds:0,superset:'A'}]};
 window.dispatchEvent(new CustomEvent('training-plans',{detail:{day:plan.day,plans:[plan]}}));window.dispatchEvent(new CustomEvent('training-start'));
 const session=nodes.get('workout-panel').children[0];
 const click=label=>{const b=flatten(session).find(x=>x.tagName==='button'&&(x.textContent===label||x['aria-label']===label));assert.ok(b,label);return b.onclick({currentTarget:b});};
 // Starting shows the day's overview first: exercise count, Super set block, then the start button.
 assert.match(session.textContent,/Super set A · ทำต่อกัน 2 รอบ/);assert.match(session.textContent,/2 เซ็ต × 12 ครั้ง/);
 click('เริ่มฝึก');
 const submit=()=>flatten(session).find(x=>x.tagName==='form').onsubmit({preventDefault(){}});
 const unit=flatten(session).find(x=>x.tagName==='select'&&x['aria-label']==='หน่วยน้ำหนักที่ยก');unit.value='lb';unit.dispatchEvent(new Event('change'));
 const weight=flatten(session).find(x=>x.tagName==='input'&&x.inputMode==='decimal');weight.value='100';
 click('+15');assert.ok(session.textContent.includes('ปรับเอง · แผนตั้งไว้ 30 วิ'));assert.ok(session.textContent.includes('45 วิ'));click('ใช้ตามแผน');click('−15');
 await submit();assert.deepEqual(records[0].setLogs,[{weight:100,weightUnit:'lb',reps:12}]);assert.equal(records[0].weightUnit,'lb');assert.equal(records[0].sessionComplete,false);assert.ok(session.textContent.includes('Row'));
 const rest=()=>flatten(session).find(x=>x.className==='ts-rest');
 assert.equal(rest().hidden,false);assert.match(rest().textContent,/00:15/);
 click('ข้ามเวลาพัก');assert.equal(rest().hidden,true);
 fail=true;await submit();assert.equal(records.length,1);assert.ok(session.textContent.includes('บันทึกไม่สำเร็จ'));fail=false;
 await submit();assert.equal(records.length,2);assert.ok(session.textContent.includes('Squat'));
 assert.equal(rest().hidden,true);
 click('หยุดชั่วคราว');click('✕ ออกจากโหมดฝึก');window.dispatchEvent(new CustomEvent('training-start'));click('ฝึกต่อ · ท่าที่ 1');assert.ok(session.textContent.includes('ทำเซ็ต 2 เสร็จแล้ว'));
 await submit();assert.equal(records.find(r=>r.exercise==='Squat').sessionComplete,true);await submit();assert.equal(records.find(r=>r.exercise==='Row').sessionComplete,true);
 // Pausing shows the menu; carrying on returns to the same exercise.
 click('หยุดชั่วคราว');assert.match(session.textContent,/หยุดชั่วคราว/);assert.match(session.textContent,/จบการฝึก · ดูสรุป/);
 click('▶ ฝึกต่อ');assert.ok(session.textContent.includes('Row'));
 click('จบการฝึกวันนี้ · ดูสรุป');assert.ok(session.textContent.includes('ฝึกครบทุกท่าแล้ว'));assert.match(session.textContent,/2\/2ท่า/);assert.equal(writes,5);
 nodes.get('day').value=TOMORROW;nodes.get('day').dispatchEvent(new Event('change'));assert.equal(session.hidden,true);assert.equal(nodes.get('workout-panel').classes.has('training-mode'),false);
});
test('training cannot start on a day other than today',async()=>{
 const nodes=new Map(['dashboard-panel','today-card','workout-panel','day'].map(id=>[id,new Element('div')]));nodes.get('day').value=TOMORROW;
 const doc=new EventTarget();doc.createElement=tag=>new Element(tag);doc.getElementById=id=>nodes.get(id);globalThis.document=doc;globalThis.window=new EventTarget();
 const built=await build({entryPoints:['dist/training-session.mjs'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/dashboard.mjs|account.js|exercise-preview.mjs/},args=>({path:args.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function switchView(){}; export async function api(){return {}}; export function createMuscleFocus(){return {el:document.createElement("section"),show(){}}};',loader:'js'}));}}]});
 const {initTrainingSession}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text+'//other').toString('base64'));
 initTrainingSession({getRecords:()=>[],saveRecords:async()=>true});
 window.dispatchEvent(new CustomEvent('training-plans',{detail:{day:TOMORROW,plans:[{id:'p',day:TOMORROW,exercises:[{exercise:'Squat',sets:1,reps:5}]}]}}));window.dispatchEvent(new CustomEvent('training-start'));
 assert.equal(nodes.get('workout-panel').children[0].hidden,true);
});
test('warm-up and cool-down show as parts of the overview, can be switched off, and moving between parts pauses for a break screen',async()=>{
 const nodes=new Map(['dashboard-panel','today-card','workout-panel','day'].map(id=>[id,new Element('div')]));nodes.get('day').value=TODAY;
 const doc=new EventTarget();doc.createElement=tag=>new Element(tag);doc.getElementById=id=>nodes.get(id);globalThis.document=doc;globalThis.window=new EventTarget();
 const built=await build({entryPoints:['dist/training-session.mjs'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/dashboard\.mjs|account\.js|exercise-preview\.mjs/},args=>({path:args.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function switchView(){}; export async function api(){return {ok:true}}; export function createMuscleFocus(){return {el:document.createElement("section"),show(){}}};',loader:'js'}));}}]});
 const {initTrainingSession}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text+'//phases').toString('base64'));
 initTrainingSession({getRecords:()=>[],saveRecords:async()=>true});
 const plan={id:'22222222-2222-4222-8222-222222222222',day:TODAY,exercises:[{exercise:'Jumping Jack',sets:1,seconds:30,phase:'warmup'},{exercise:'Squat',sets:2,reps:10},{exercise:'Hamstring Stretch',sets:1,seconds:30,phase:'cooldown'}]};
 window.dispatchEvent(new CustomEvent('training-plans',{detail:{day:TODAY,plans:[plan]}}));window.dispatchEvent(new CustomEvent('training-start'));
 const session=nodes.get('workout-panel').children[0];
 const click=label=>{const b=flatten(session).find(x=>x.tagName==='button'&&(x.textContent===label||x['aria-label']===label));assert.ok(b,label);return b.onclick({currentTarget:b});};
 assert.match(session.textContent,/วอร์มอัพ~\d+ นาที · 1 ท่า/);assert.match(session.textContent,/คูลดาวน์/);
 // Switching warm-up off leaves it out: the workout starts at Squat.
 const warm=flatten(session).find(x=>x.tagName==='input'&&x['aria-label']==='ปิดวอร์มอัพวันนี้');warm.checked=false;warm.onchange();
 click('เริ่มฝึก');assert.match(session.textContent,/ฝึกหลัก · ท่าที่ 1 จาก 2/);assert.ok(session.textContent.includes('Squat'));
 // Moving on from main work shows the break screen before the cool-down.
 click('ข้ามท่านี้ →');assert.match(session.textContent,/ฝึกหลักเสร็จแล้ว ✓/);assert.match(session.textContent,/ได้เวลาคูลดาวน์แล้ว/);
 click('เริ่มคูลดาวน์ →');assert.match(session.textContent,/คูลดาวน์ · ท่าที่ 2 จาก 2/);
 nodes.get('day').value=TOMORROW;nodes.get('day').dispatchEvent(new Event('change'));
});
