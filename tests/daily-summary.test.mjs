import test from 'node:test';
import assert from 'node:assert/strict';
import {dailySummary} from '../dist/daily-summary.mjs';
test('daily overview follows selected date and never uses future body weights',()=>{
 const records=[{day:'2026-10-19',kind:'workout',exercise:'Squat'},{day:'2026-10-19',meal:'เย็น',time:'18:00'},{day:'2026-10-19',meal:'เช้า',time:'08:00'},{day:'2026-10-20',kind:'workout'}];
 const body=[{day:'2026-10-20',weight:81},{day:'2026-10-18',weight:80}];const s=dailySummary(records,body,'2026-10-19');
 assert.equal(s.workouts.length,1);assert.deepEqual(s.meals.map(r=>r.time),['08:00','18:00']);assert.equal(s.weight.weight,80);assert.equal(s.weight.day,'2026-10-18');
 assert.deepEqual(dailySummary(records,body,'2026-10-01'),{workouts:[],meals:[],weight:null});
});
test('weight on selected date takes priority over earlier weight',()=>{
 assert.equal(dailySummary([],[{day:'2026-10-18',weight:80},{day:'2026-10-19',weight:79}], '2026-10-19').weight.weight,79);
});
