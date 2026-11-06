import test from 'node:test';
import assert from 'node:assert/strict';
import {exerciseHistory} from '../dist/exercise-history.mjs';
const row=(id,day,extra={})=>({id,day,kind:'workout',exercise:'Bench Press',weight:20,sets:3,reps:12,...extra});
test('history filters selected exercise, future dates, cardio and current edit without merging same-day records',()=>{
 const records=[row('b','2026-10-02'),row('a','2026-10-01'),row('c','2026-10-02'),row('future','2026-10-04'),row('edit','2026-10-03'),row('other','2026-10-01',{exercise:'Squat'}),row('cardio','2026-10-01',{trainingType:'cardio'})];
 assert.deepEqual(exerciseHistory(records,' bench   press ','2026-10-03','edit').map(r=>r.id),['a','b','c']);
 assert.equal(records[0].id,'b');
});
test('per-set history uses actual logs, preserves zero and missing values',()=>{
 const rows=exerciseHistory([row('a','2026-10-01',{setLogs:[{weight:25,reps:8},{weight:20,reps:12}]}),row('b','2026-10-02',{weight:0}),row('c','2026-10-03',{weight:null,reps:null})],'Bench Press','2026-10-03');
 assert.equal(rows[0].peakWeight,25);assert.equal(rows[0].peakReps,12);assert.deepEqual(rows[0].logs,[{weight:25,reps:8},{weight:20,reps:12}]);assert.equal(rows[1].peakWeight,0);assert.equal(rows[2].peakWeight,null);assert.equal(rows[2].peakReps,null);
});
