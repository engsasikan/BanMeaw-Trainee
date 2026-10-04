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
 querySelector(){return flatten(this).find(x=>x.tagName==='button'&&x.type==='submit');}
}
const flatten=root=>[root,...root.children.flatMap(flatten)];
test('guided training saves each set, resumes, retries failures and handles supersets and date changes',async()=>{
 const nodes=new Map(['dashboard-panel','workout-panel','day'].map(id=>[id,new Element('div')]));nodes.get('day').value='2026-10-04';
 const doc=new EventTarget();doc.createElement=tag=>new Element(tag);doc.getElementById=id=>nodes.get(id);doc.hidden=false;
 globalThis.document=doc;globalThis.window=new EventTarget();
 const built=await build({entryPoints:['dist/training-session.mjs'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/dashboard\.mjs|account\.js/},args=>({path:args.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function switchView(){}; export async function api(){return {ok:true}};',loader:'js'}));}}]});
 const {initTrainingSession}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 let records=[],fail=false,writes=0;
 initTrainingSession({getRecords:()=>records,saveRecords:async next=>{writes++;if(fail)return false;records=next;window.dispatchEvent(new CustomEvent('diary-records'));return true;}});
 const plan={id:'11111111-1111-4111-8111-111111111111',day:'2026-10-04',exercises:[{exercise:'Squat',sets:2,reps:12,weight:20,rest_seconds:0,superset:'A'},{exercise:'Row',sets:2,reps:10,weight:15,rest_seconds:0,superset:'A'}]};
 window.dispatchEvent(new CustomEvent('training-plans',{detail:{day:plan.day,plans:[plan]}}));window.dispatchEvent(new CustomEvent('training-start'));
 const session=nodes.get('workout-panel').children[0];
 const click=label=>{const b=flatten(session).find(x=>x.tagName==='button'&&x.textContent===label);assert.ok(b,label);return b.onclick({currentTarget:b});};
 const submit=()=>flatten(session).find(x=>x.tagName==='form').onsubmit({preventDefault(){}});
 await submit();assert.equal(records[0].setLogs.length,1);assert.equal(records[0].sessionComplete,false);assert.ok(session.textContent.includes('Row'));
 fail=true;await submit();assert.equal(records.length,1);assert.ok(session.textContent.includes('บันทึกไม่สำเร็จ'));fail=false;
 await submit();assert.equal(records.length,2);assert.ok(session.textContent.includes('Squat'));
 click('กลับไปดูแผน');window.dispatchEvent(new CustomEvent('training-start'));assert.ok(session.textContent.includes('บันทึกแล้ว 1 / 2 เซ็ต'));
 await submit();assert.equal(records.find(r=>r.exercise==='Squat').sessionComplete,true);await submit();assert.equal(records.find(r=>r.exercise==='Row').sessionComplete,true);
 click('จบการฝึก · ดูสรุป');assert.ok(session.textContent.includes('บันทึกครบ 2 / 2 ท่า'));assert.equal(writes,5);
 nodes.get('day').value='2026-10-05';nodes.get('day').dispatchEvent(new Event('change'));assert.equal(session.hidden,true);assert.equal(nodes.get('workout-panel').classes.has('training-mode'),false);
});
