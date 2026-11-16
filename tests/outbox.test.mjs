import test from 'node:test';import assert from 'node:assert/strict';
import {createOutbox,isNetworkError} from '../dist/outbox.mjs';
const memoryStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};};
const set=(id,reps)=>({id,kind:'workout',day:'2026-11-16',exercise:'Squat',sets:1,reps,weight:null,notes:''});
test('offline changes fold per record, survive a reload and show as waiting',()=>{
 const storage=memoryStorage(),box=createOutbox('k',storage);
 box.add({type:'put',id:'a',row:set('a',10),revision:0});
 box.add({type:'put',id:'a',row:set('a',12),revision:0});
 box.add({type:'put',id:'b',row:set('b',8),revision:3});
 box.add({type:'delete',id:'b',revision:4});
 box.add({type:'put',id:'c',row:set('c',5),revision:0});
 box.add({type:'delete',id:'c',revision:0});
 assert.deepEqual(box.list().map(op=>[op.type,op.id,op.revision,op.row?.reps]),[['put','a',0,12],['delete','b',3,undefined]],'created then deleted offline sends nothing; the first base revision is kept');
 const reloaded=createOutbox('k',storage);assert.equal(reloaded.size,2);
 const shown=reloaded.apply([{...set('b',8),_revision:3},{...set('z',1),_revision:1}]);
 assert.deepEqual(shown.map(r=>[r.id,r._pending??false]),[['z',false],['a',true]]);
});
test('sending stops at the first lost connection and keeps the rest; refused changes are dropped and reported',async()=>{
 const box=createOutbox('k',memoryStorage());
 for(const id of ['a','b','c'])box.add({type:'put',id,row:set(id,1),revision:0});
 let calls=0;
 let result=await box.flush(async op=>{calls++;if(op.id==='b')throw new TypeError('Failed to fetch');});
 assert.deepEqual([result.sent,result.left,box.list().map(op=>op.id)],[1,2,['b','c']]);
 result=await box.flush(async op=>{if(op.id==='b')throw Error('รายการเปลี่ยนจากอุปกรณ์อื่น');});
 assert.deepEqual([result.sent,result.refused.map(r=>r.op.id),box.size],[1,['b'],0]);
 assert.equal(isNetworkError(new TypeError('Failed to fetch')),true);
 assert.equal(isNetworkError(Error('บันทึกไม่สำเร็จ')),globalThis.navigator?.onLine===false);
});
