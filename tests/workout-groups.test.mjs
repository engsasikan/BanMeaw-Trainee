import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupWorkouts,renderWorkoutGroups} from '../dist/workout-groups.mjs';
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
