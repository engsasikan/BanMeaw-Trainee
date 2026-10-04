import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weeklyProgress,comparePlan,weekDays} from '../dist/progress.mjs';
import {MEALS,validateRecords} from '../dist/store.mjs';
test('weekly averages use one measurement per recorded day and compare previous window',()=>{
 const records=MEALS.slice(0,3).map(meal=>({day:'2026-10-04',meal}));
 records.push({day:'2026-10-04',kind:'workout'},{day:'2026-10-04',kind:'workout'},{day:'2026-10-03',kind:'workout'});
 const summary=weeklyProgress(records,[{day:'2026-10-04',weight:80},{day:'2026-10-04',weight:90},{day:'2026-10-03',weight:82},{day:'2026-09-26',weight:84},{day:'2026-10-05',weight:100}],'2026-10-04');
 assert.equal(summary.average,81);assert.equal(summary.weighDays,2);assert.equal(summary.change,-3);assert.equal(summary.trainingDays,2);assert.equal(summary.completeFoodDays,1);
 assert.equal(weekDays('2026-01-02')[0],'2025-12-27');
});
test('missing body history does not imply zero or a trend',()=>{
 const summary=weeklyProgress([],[],'2026-10-04');assert.equal(summary.average,null);assert.equal(summary.change,null);assert.equal(summary.weighDays,0);
});
test('duplicate exercises are matched once; other plans and other days cannot complete this plan',()=>{
 const plan={id:'p',day:'2026-10-04',exercises:[{exercise:'Squat'},{exercise:'Squat'},{exercise:'Row'}]};
 const rows=[{id:'a',day:plan.day,kind:'workout',exercise:'Squat',planId:'p',planExerciseIndex:1},{id:'b',day:plan.day,kind:'workout',exercise:'Squat'},{id:'c',day:plan.day,kind:'workout',exercise:'Row',planId:'other'},{id:'d',day:'2026-10-03',kind:'workout',exercise:'Row'}];
 const result=comparePlan(plan,rows);assert.equal(result[0].actual.id,'b');assert.equal(result[1].actual.id,'a');assert.equal(result[2].actual,null);
});
test('plan references survive workout validation and malformed references fail',()=>{
 const row={id:'w',kind:'workout',day:'2026-10-04',exercise:'Squat',weight:20,sets:3,reps:12,notes:'',planId:'11111111-1111-4111-8111-111111111111',planExerciseIndex:0};
 assert.equal(validateRecords([row])[0].planId,row.planId);assert.throws(()=>validateRecords([{...row,planExerciseIndex:30}]));assert.throws(()=>validateRecords([{...row,planId:'bad'}]));
});
test('saved individual sets survive validation and partial sessions do not complete a plan',()=>{
 const plan={id:'11111111-1111-4111-8111-111111111111',day:'2026-10-04',exercises:[{exercise:'Squat',sets:2,reps:12}]};
 const row={id:'sets',kind:'workout',day:plan.day,exercise:'Squat',weight:20,sets:1,reps:12,notes:'',planId:plan.id,planExerciseIndex:0,setLogs:[{weight:20,reps:12}],sessionComplete:false};
 const [saved]=validateRecords([row]);assert.deepEqual(saved.setLogs,row.setLogs);assert.equal(saved.sessionComplete,false);assert.equal(comparePlan(plan,[saved])[0].actual,null);
 const [finished]=validateRecords([{...row,sets:2,setLogs:[...row.setLogs,{weight:22,reps:10}],sessionComplete:true}]);assert.equal(comparePlan(plan,[finished])[0].actual.id,row.id);
 for(const patch of [{setLogs:[{weight:-1,reps:12}]},{setLogs:[{weight:20,reps:0}]},{setLogs:Array(101).fill({weight:20,reps:12})},{sessionComplete:'true'},{setLogs:[]}])assert.throws(()=>validateRecords([{...row,...patch}]));
});
