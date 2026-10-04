import test from 'node:test';
import assert from 'node:assert/strict';
import {previousExercise,recentChoices,remainingSeconds} from '../dist/diary-tools.mjs';
test('previous result excludes current day, future, edited record and other training types',()=>{
 const base={kind:'workout',exercise:'Squat',trainingType:'strength'};
 const rows=[{...base,id:'a',day:'2026-10-01',weight:10},{...base,id:'b',day:'2026-10-03',weight:20},{...base,id:'c',day:'2026-10-04'},{...base,id:'d',day:'2026-10-05'},{...base,id:'e',day:'2026-10-03',trainingType:'cardio'}];
 assert.equal(previousExercise(rows,' squat ','strength','2026-10-04').id,'b');
 assert.equal(previousExercise(rows,'Squat','strength','2026-10-04','b').id,'a');
 assert.equal(previousExercise(rows,'Bench','strength','2026-10-04'),null);
});
test('reuse keeps newest distinct meals and exercises and excludes future records',()=>{
 const rows=[{day:'2026-10-01',meal:'มื้อเช้า',text:'ไข่'},{day:'2026-10-03',meal:'มื้อเช้า',text:'ไข่'},{day:'2026-10-05',meal:'มื้อเช้า',text:'ข้าว'},{day:'2026-10-02',kind:'workout',exercise:'Squat'}];
 assert.equal(recentChoices(rows,false,'2026-10-04').length,1);
 assert.equal(recentChoices(rows,false,'2026-10-04')[0].day,'2026-10-03');
 assert.equal(recentChoices(rows,true,'2026-10-04')[0].exercise,'Squat');
});
test('rest countdown uses elapsed real time after background suspension',()=>{
 assert.equal(remainingSeconds(60000,0),60);
 assert.equal(remainingSeconds(60000,30501),30);
 assert.equal(remainingSeconds(60000,120000),0);
});
