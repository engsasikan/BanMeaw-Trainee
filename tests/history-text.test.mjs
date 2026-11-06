import {test} from 'node:test';
import assert from 'node:assert/strict';
import {averageWeight,dailyWeights,historyText} from '../dist/history-text.mjs';
test('averages each measured day equally and excludes missing or out-of-range days',()=>{
 const body=[{day:'2026-10-20',weight:70},{day:'2026-10-20',weight:72},{day:'2026-10-21',weight:73},{day:'2026-10-22',weight:99},{day:'2026-10-01',weight:80},{day:'2026-10-19',waist:80}];
 assert.deepEqual(averageWeight(body,'2026-10-21',7),{start:'2026-10-15',end:'2026-10-21',count:2,value:72});
 assert.equal(dailyWeights(body).find(r=>r.day==='2026-10-20').weight,71);
 assert.equal(averageWeight([],'2026-10-21').value,null);
});
test('AI text includes raw measurements, set logs, cardio units, notes and only the selected period',()=>{
 const text=historyText({body:[{day:'2026-10-20',sex:'male',weight:70,waist:80,bowelStatus:'passed',note:'เช้า'},{day:'2026-10-22',weight:90}],records:[{id:'a',kind:'workout',day:'2026-10-20',exercise:'Squat',weight:0,sets:1,reps:10,setLogs:[{weight:0,reps:10}],notes:'test'},{id:'b',kind:'workout',day:'2026-10-21',exercise:'Run',trainingType:'cardio',duration:30,speed:6},{id:'c',day:'2026-10-20',text:'meal'},{id:'d',kind:'workout',day:'2026-10-01',exercise:'OLD'}]},{start:'2026-10-20',end:'2026-10-21'});
 assert.match(text,/"waist":/);assert.match(text,/"setLogs":/);assert.match(text,/"weightMeaning":"bodyweight"/);assert.match(text,/"speedUnit":"km\/h"/);assert.match(text,/เช้า/);assert.doesNotMatch(text,/OLD|2026-10-22|"meal"/);
});
