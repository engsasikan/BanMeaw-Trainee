import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairedWorkoutRows} from '../dist/workout-pairs.mjs';
import {validateRecords} from '../dist/store.mjs';
test('workout pairs persist individual measurements and grouping, including stable retry IDs',()=>{
 const first={id:'first',day:'2026-10-16',kind:'workout',exercise:'Knee Push-up',trainingType:'strength',weight:0,sets:3,reps:12,notes:''};
 const partner={id:'second',exercise:'Machine Fly',weight:20,sets:3,reps:10},group='11111111-1111-4111-8111-111111111111';
 const batch=pairedWorkoutRows(first,[partner],group),valid=validateRecords(batch);
 assert.equal(valid.length,2);assert.equal(valid[0].supersetId,group);assert.equal(valid[1].supersetId,group);assert.equal(valid[1].weight,20);assert.equal(valid[1].reps,10);
 assert.deepEqual(validateRecords(pairedWorkoutRows(first,[partner],group)),valid);
 assert.deepEqual(pairedWorkoutRows(first,[],null),[first]);
 assert.throws(()=>validateRecords([{...first,supersetId:'bad'}]));
 assert.throws(()=>validateRecords([{...first,trainingType:'cardio',duration:30,supersetId:group}]));
});

test('log composer adds and removes partners, disables cardio fields and retains draft on retry',async()=>{
 const {initWorkoutPairs}=await import('../dist/workout-pairs.mjs');
 class E extends EventTarget{
  constructor(tag){super();this.tagName=tag;this.children=[];this.value='';}
  append(...items){for(const x of items){x.parent=this;this.children.push(x);}}
  after(...items){const i=this.parent.children.indexOf(this);for(const x of items)x.parent=this.parent;this.parent.children.splice(i+1,0,...items);}
  remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);}
  setAttribute(k,v){this[k]=v;}
  replaceChildren(){this.children=[];}
  focus(){}
 }
 const fields=new Map(['training-type','workout-save','sets','reps'].map(id=>[id,new E('input')]));fields.get('training-type').value='strength';
 globalThis.document={createElement:tag=>new E(tag),getElementById:id=>fields.get(id)};
 const form=new E('form'),anchor=new E('div');form.append(anchor);let editing=false;
 const pairs=initWorkoutPairs({form,anchor,isEditing:()=>editing});const box=form.children[1],button=form.children[2];
 assert.equal(button.hidden,false);button.onclick();const row=box.children[1],inputs=row.children.filter(x=>x.tagName==='label').map(x=>x.children[0]).filter(x=>x.tagName==='input');
 inputs[0].value='Machine Fly';inputs[1].value='15';inputs[2].value='4';inputs[3].value='10';
 const first={id:'first',day:'2026-10-16',exercise:'Knee Push-up'};
 const batch=pairs.rows(first);assert.equal(batch.length,2);assert.equal(batch[1].weight,15);assert.equal(batch[1].sets,4);
 editing=true;assert.deepEqual(pairs.rows(first),batch);
 fields.get('training-type').value='cardio';pairs.sync();assert.equal(button.hidden,true);assert(inputs.every(x=>x.disabled));assert.equal(pairs.rows(first).length,1);
 fields.get('training-type').value='strength';pairs.sync();assert.deepEqual(pairs.rows(first),batch);
 form.dispatchEvent(new Event('reset'));assert.equal(pairs.rows(first).length,1);
 editing=false;pairs.sync();button.onclick();box.children[1].children.at(-1).onclick();assert.equal(pairs.rows(first).length,1);
 for(let i=0;i<15;i++)button.onclick();
 assert.equal(pairs.rows(first).length,16);
 assert.equal(form.children[form.children.indexOf(box)+1],button,'add button stays after all partner rows');
 assert.equal(box.children.at(-1).children[0].textContent,'Super set · ท่าที่ 16');
 box.children[1].children.at(-1).onclick();
 assert.equal(pairs.rows(first).length,15);
 assert.equal(form.children[form.children.indexOf(box)+1],button,'add button stays at the end after removal');
 assert.equal(box.children.at(-1).children[0].textContent,'Super set · ท่าที่ 15');
});
