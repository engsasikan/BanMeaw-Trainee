import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
class Element extends EventTarget {
 constructor(tag){
  super();this.tagName=tag;this.children=[];this.value='';this.dataset={};
  this.classList={toggle:(name,enabled)=>{
   const classes=new Set((this.className||'').split(' ').filter(Boolean));
   if(enabled)classes.add(name);else classes.delete(name);
   this.className=[...classes].join(' ');
  }};
 }
 set textContent(v){this.text=String(v);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(x=>x.textContent).join('');}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);if(this.tagName==='select'&&this.children.length===1)this.value=node.value||'';}}
 prepend(...nodes){for(const node of nodes)node.parent=this;this.children.unshift(...nodes);}
 after(node){node.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this)+1,0,node);}
 remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);}
 replaceChildren(...nodes){this.text='';this.children=[];this.append(...nodes);}
 setAttribute(k,v){this[k]=v;}
 removeAttribute(k){delete this[k];}
 setCustomValidity(){}
 focus(){} scrollIntoView(){}
}
const flatten=n=>[n,...n.children.flatMap(flatten)];
const field=(row,label)=>flatten(row).find(x=>x.tagName==='label'&&x.text===label).children[0];
const click=(row,text)=>flatten(row).find(x=>x.tagName==='button'&&x.textContent===text).onclick();
test('planner pairs separate exercises, accepts custom names and saves superset order and rests',async()=>{
 globalThis.document={createElement:tag=>new Element(tag)};
 globalThis.__plannerWrites=[];
 const built=await build({entryPoints:['dist/plans.mjs'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'api-stub',setup(b){b.onResolve({filter:/account\.js/},()=>({path:'api',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export async function api(path,options){if(options){globalThis.__plannerWrites.push(JSON.parse(options.body));return {count:1};}return {plans:[]};}'}));}}]});
 const {trainerPlanner}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const root=new Element('div');await trainerPlanner(root,{id:'team'},{id:'member',display_name:'Test'},{day:'2026-10-16'});
 const rows=()=>flatten(root).filter(x=>x.className==='plan-exercise');
 function chooseCustom(row,name){const search=flatten(row).find(x=>x.type==='search');search.value=name;search.dispatchEvent(new Event('input'));const custom=flatten(row).find(x=>x.tagName==='button'&&x.textContent==='เพิ่มท่า: '+name);if(!custom.hidden){custom.onclick();return;}
  const enter=new Event('keydown');enter.key='Enter';search.dispatchEvent(enter);}
 chooseCustom(rows()[0],'Knee Push-up');
 click(rows()[0],'+ เพิ่มท่าใน Super set');
 assert.equal(rows().length,2);assert.equal(field(rows()[0],'Super set').value,'A');assert.equal(field(rows()[1],'Super set').value,'A');
 assert.equal(Number(field(rows()[0],'พัก (วินาที)').value),0);assert.equal(Number(field(rows()[1],'พัก (วินาที)').value),60);
 chooseCustom(rows()[1],'Machine Fly');
 click(root,'+ เพิ่มท่าฝึก');chooseCustom(rows()[2],'Custom Coach Move');
 click(rows()[2],'+ เพิ่มท่าใน Super set');chooseCustom(rows()[3],'Dumbbell Curl');
 assert.equal(field(rows()[2],'Super set').value,'B');assert.equal(field(rows()[3],'Super set').value,'B');
 const form=flatten(root).find(x=>x.tagName==='form');await form.onsubmit({preventDefault(){}});
 const exercises=globalThis.__plannerWrites[0].schedule[0].exercises;
 assert.deepEqual(exercises.map(x=>[x.exercise,x.superset,x.rest_seconds]),[['Knee Push-up','A',0],['Machine Fly','A',60],['Custom Coach Move','B',0],['Dumbbell Curl','B',60]]);
 // Adding a third movement keeps the group together before the following group.
 assert.equal(flatten(rows()[0]).find(x=>x.className==='quiet plan-pair').hidden,true);
 click(rows()[1],'+ เพิ่มท่าใน Super set');chooseCustom(rows()[2],'Third Move');
 assert.equal(field(rows()[2],'Super set').value,'A');assert.equal(Number(field(rows()[1],'พัก (วินาที)').value),0);
 await form.onsubmit({preventDefault(){}});
 assert.deepEqual(globalThis.__plannerWrites[1].schedule[0].exercises.map(x=>x.superset),['A','A','A','B','B']);
 // Muscle-map selection adds a real plan row, preserves existing rows, and persists.
 const anatomy=flatten(root).find(x=>x.className==='anatomy-picker');
 const selected=flatten(anatomy).find(x=>x.tagName==='button'&&x['aria-label']?.startsWith('เพิ่มเข้าโปรแกรม '));
 const exercise=selected['aria-label'].slice('เพิ่มเข้าโปรแกรม '.length);
 selected.onclick();assert.equal(rows().length,6);
 await form.onsubmit({preventDefault(){}});
 assert.equal(globalThis.__plannerWrites[2].schedule[0].exercises.at(-1).exercise,exercise);
 // The browser respects the same 30-exercise limit as manual additions.
 while(rows().length<30)selected.onclick();
 selected.onclick();assert.equal(rows().length,30);
 const status=flatten(anatomy).find(x=>x.tagName==='p'&&x.role==='status');
 assert.notEqual(status.textContent,'เพิ่ม '+exercise+' แล้ว');
 const monday=flatten(root).find(x=>x.id==='program-day-1');
 click(root,'จ.');
 assert.equal(monday.hidden,false);
 const toggle=flatten(monday).find(x=>x.type==='checkbox');
 toggle.checked=true;toggle.onchange();
 chooseCustom(flatten(monday).find(x=>x.className==='plan-exercise'),'Monday Move');
 click(root,'ศ.');
 assert.equal(monday.hidden,true);
 await form.onsubmit({preventDefault(){}});
 const program=globalThis.__plannerWrites.at(-1).schedule;
 assert.equal(program.find(day=>day.weekday===1).exercises[0].exercise,'Monday Move');
 assert.equal(program.find(day=>day.weekday===5).exercises.length,30);
 const friday=flatten(root).find(x=>x.id==='program-day-5');
 const fridayRows=()=>flatten(friday).filter(x=>x.className==='plan-exercise');
 click(fridayRows()[0],'↓ ลงในชุด');
 assert.equal(Number(field(fridayRows()[2],'พัก (วินาที)').value),60);
 click(fridayRows()[0],'↓ เลื่อนชุด');
 await form.onsubmit({preventDefault(){}});
 const reordered=globalThis.__plannerWrites.at(-1).schedule.find(day=>day.weekday===5).exercises;
 assert.deepEqual(reordered.slice(0,5).map(item=>item.exercise),
  ['Custom Coach Move','Dumbbell Curl','Machine Fly','Knee Push-up','Third Move']);
});
test('saved programs are listed one card per program and can be edited or deleted as a whole',async()=>{
 globalThis.document={createElement:tag=>new Element(tag)};
 globalThis.confirm=()=>true;
 const batch='44444444-4444-4444-8444-444444444444';
 const squat={exercise:'Squat',sets:3,reps:10,weight:20};
 globalThis.__programPlans=[
  {id:'a',batch_id:batch,day:'2030-01-07',exercises:[squat]},
  {id:'b',batch_id:batch,day:'2030-01-09',exercises:[{...squat,exercise:'Row'}]},
  {id:'c',batch_id:batch,day:'2030-01-14',exercises:[squat]},
 ];
 globalThis.__programCalls=[];
 const built=await build({entryPoints:['dist/plans.mjs'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'api-stub',setup(b){b.onResolve({filter:/account\.js/},()=>({path:'api',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export async function api(path,options={}){globalThis.__programCalls.push({path,method:options.method??"GET",body:options.body&&JSON.parse(options.body)});return options.method?{ok:true,count:2,locked:0}:{plans:globalThis.__programPlans};}'}));}}]});
 const {trainerPlanner}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const root=new Element('div');await trainerPlanner(root,null,null,{day:'2030-01-01'});
 const cards=flatten(root).filter(x=>x.className==='entry plan-program');
 assert.equal(cards.length,1);
 assert.match(cards[0].textContent,/จ\. พ\. · 3 วัน · เหลือ 3 วัน/);
 click(cards[0],'แก้ไขโปรแกรม');
 const fieldValue=label=>flatten(root).find(x=>x.tagName==='label'&&x.text===label).children.find(x=>x.tagName==='div').children.at(-1).value;
 assert.deepEqual([fieldValue('วันเริ่มโปรแกรม'),fieldValue('วันสิ้นสุด')],['2030-01-07','2030-01-14']);
 const form=flatten(root).find(x=>x.tagName==='form');
 await form.onsubmit({preventDefault(){}});
 const put=globalThis.__programCalls.find(call=>call.method==='PUT');
 assert.equal(put.path,'/api/personal-plans?batch='+batch);
 assert.deepEqual(put.body.schedule.map(day=>[day.weekday,day.exercises[0].exercise]),[[1,'Squat'],[3,'Row']]);
 assert.deepEqual([put.body.start,put.body.end],['2030-01-07','2030-01-14']);
 click(flatten(root).find(x=>x.className==='entry plan-program'),'ลบโปรแกรม');
 await new Promise(resolve=>setTimeout(resolve));
 assert.equal(globalThis.__programCalls.find(call=>call.method==='DELETE').path,'/api/personal-plans?batch='+batch);
});
