import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupWorkouts,renderWorkoutGroups} from '../dist/workout-groups.mjs';
import {openTeamWorkoutCopy} from '../dist/team-workout-copy.mjs';

test('team copy preserves explicit supersets and starts each weight blank',async()=>{
 class Element extends EventTarget{
  constructor(tag){super();this.tag=tag;this.children=[];this.value='';this.dataset={};}
  append(...children){this.children.push(...children);}
  setAttribute(){}
  showModal(){}
  close(){}
 }
 const body=new Element('body');
 globalThis.document={body,createElement:tag=>new Element(tag)};
 const day='2026-11-14',source=[
  {day,exercise:'Press',supersetId:'original',weight:20,sets:3,reps:8},
  {day,exercise:'Lunge',weight:10},
  {day,exercise:'Curl',supersetId:'original',weight:15},
 ];
 let saved;
 const history=[{kind:'workout',day:'2026-11-13',exercise:' curl ',weight:27.5,weightUnit:'lb'},
  {kind:'workout',day:'2026-11-15',exercise:'Curl',weight:99}];
 openTeamWorkoutCopy({source,member:'Member',day,history,save:async rows=>{saved=rows;return true;},onSaved(){}});
 const form=body.children[0].children[0],list=form.children[1].children[1];
 assert.equal(list.children[0].className,'team-copy-group');
 const cards=[...list.children[0].children.slice(1),list.children[1]];
 const fields=cards.map(card=>card.children[4].children);
 const inputs=fields.map(([input])=>input);
 assert.ok(inputs.every(input=>input.value===''&&!input.required));
 const [sets,reps]=cards[0].children[2].children.map(label=>label.children[0]);
 assert.equal(sets.value,3);
 assert.equal(reps.value,8);
 sets.value=4;sets.valueAsNumber=4;reps.valueAsNumber=8;
 cards[2].children[1].children[0].value='Reverse Lunge';
 cards[2].children[6].children[0].value='My note';
 const previous=cards[1].children[5];
 assert.match(previous.textContent,/27.5 lb \/ 12.47 kg/);
 previous.onclick();
 assert.equal(inputs[1].value,12.47);
 const pounds=fields[1][1];pounds.value='lb';pounds.onchange();
 previous.onclick();
 assert.equal(inputs[1].value,27.5);
 inputs[0].value='0';inputs[0].valueAsNumber=0;
 inputs[1].valueAsNumber=27.5;
 assert.equal(inputs[1].max,'4409.25');
 await form.onsubmit({preventDefault(){}});
 assert.deepEqual(saved.map(row=>row.exercise),['Press','Curl','Reverse Lunge']);
 assert.deepEqual(saved.map(row=>row.weight),[0,27.5,null]);
 assert.equal(saved[0].sets,4);
 assert.equal(saved[0].reps,8);
 assert.equal(saved[2].notes,'My note');
 assert.deepEqual(saved.map(row=>row.weightUnit),['kg','lb','kg']);
 assert.equal(saved[0].supersetId,saved[1].supersetId);
 assert.notEqual(saved[0].supersetId,'original');
 assert.equal(saved[2].supersetId,undefined);
 assert.deepEqual(saved.map(row=>row.id).sort(),saved.map(row=>row.id));
});
test('only explicitly linked workouts on the same day are grouped, including separated records',()=>{
 const a={id:'a',day:'2026-10-16',supersetId:'pair'},b={id:'b',day:'2026-10-16'},c={id:'c',day:'2026-10-16',supersetId:'pair'},d={id:'d',day:'2026-10-15',supersetId:'pair'};
 assert.deepEqual(groupWorkouts([a,b,c,d]).map(g=>g.rows.map(r=>r.id)),[['a','c'],['b'],['d']]);
});
test('linked cards render in one numbered sequence while lone records keep their own card',()=>{
 class E{constructor(tag){this.tagName=tag;this.children=[];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this[k]=v;}}
 globalThis.document={createElement:tag=>new E(tag)};const root=new E('div'),made=[];
 const rows=[{id:'a',day:'2026-10-16',supersetId:'pair',sets:4},{id:'b',day:'2026-10-16',supersetId:'pair',sets:4},{id:'solo',day:'2026-10-16'}];
 renderWorkoutGroups(root,rows,row=>{const card=new E('article');card.id=row.id;made.push(row.id);return card;});
 assert.equal(root.children.length,2);assert.equal(root.children[0].className,'workout-superset');assert.equal(root.children[1].id,'solo');
 const box=root.children[0];assert.match(box.children[1].textContent,/4 รอบ/);const list=box.children[2];assert.equal(list.children.length,2);assert.equal(list.children[0].children[0].textContent,'ท่าที่ 1');assert.equal(list.children[1].children[0].textContent,'ท่าที่ 2');assert.equal(list.children[0].children[1].id,'a');assert.equal(list.children[1].children[1].id,'b');assert.deepEqual(made,['a','b','solo']);
 const lone=new E('div');renderWorkoutGroups(lone,[rows[0]],()=>new E('article'));assert.equal(lone.children[0].tagName,'article');
});

test('delete group action targets only members of the selected group and day',()=>{
 class E{constructor(tag){this.tagName=tag;this.children=[];}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this[k]=v;}}
 globalThis.document={createElement:tag=>new E(tag)};
 const root=new E('div'),rows=[{id:'a',day:'2026-10-21',supersetId:'one'},{id:'b',day:'2026-10-21',supersetId:'one'},{id:'c',day:'2026-10-20',supersetId:'one'},{id:'d',day:'2026-10-21',supersetId:'two'},{id:'e',day:'2026-10-21',supersetId:'two'},{id:'solo',day:'2026-10-21'}];
 let selected;
 renderWorkoutGroups(root,rows,()=>new E('article'),{onDeleteGroup:members=>{selected=members;}});
 const firstDelete=root.children[0].children[0].children[2].children[0];
 assert.equal(firstDelete.type,'button');assert.match(firstDelete['aria-label'],/2 ท่า/);firstDelete.onclick();
 assert.deepEqual(selected.map(r=>r.id),['a','b']);
 root.children[2].children[0].children[2].children[0].onclick();assert.deepEqual(selected.map(r=>r.id),['d','e']);
});
