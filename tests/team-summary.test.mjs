import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traineeSnapshot,traineeCopyText} from '../dist/team-summary.mjs';
test('copy includes only selected-day meals and strength and cardio details',()=>{
 const snapshot=traineeSnapshot([{day:'2026-10-05',weight:90,height:190},{day:'2026-10-04',weight:75},{day:'2026-10-01',height:170}],[
 {day:'2026-10-04',meal:'Breakfast',time:'09:00',text:'Banana\nBread',workoutTiming:'Before training'},
 {day:'2026-10-03',meal:'Dinner',text:'EXCLUDED'},
 {day:'2026-10-04',kind:'workout',exercise:'Squat',weight:20,sets:3,reps:12,notes:'Slow'},
 {day:'2026-10-04',kind:'workout',exercise:'Walk',trainingType:'cardio',duration:30,distance:2,incline:0},
 {day:'2026-10-05',kind:'workout',exercise:'EXCLUDED'}],'2026-10-04');
 assert.equal(snapshot.weight,75);assert.equal(snapshot.height,170);assert.equal(snapshot.heightDay,'2026-10-01');
 assert.equal(snapshot.meals.length,1);assert.equal(snapshot.workouts.length,2);
 const text=traineeCopyText({display_name:'Student',member_code:'BM-123'},snapshot,'2026-10-04');
 for(const value of ['Student','BM-123','75','170','2026-10-01','Breakfast','09:00','  – Banana\n  – Bread','Before training','Squat','20 กก.','3 เซ็ต','12 ครั้ง/เซ็ต','Slow','Walk','30 นาที','2 กม.','ความชัน 0%'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes('EXCLUDED'));assert.ok(text.includes('• Breakfast'));assert.ok(text.includes('• Squat'));assert.ok(text.includes('• น้ำหนัก:'));assert.ok(text.includes('\n\nอาหาร\n\n'));
});
test('missing measurements do not prevent copying meals; empty sections are omitted',()=>{
 const snapshot=traineeSnapshot([],[],'2026-10-04');
 assert.equal(snapshot.weight,null);assert.equal(snapshot.height,null);
 const text=traineeCopyText({display_name:'Student'},snapshot,'2026-10-04');
 assert.ok(text.includes('ยังไม่มีข้อมูล'));assert.ok(!text.includes('undefined'));assert.ok(!text.includes('อาหาร'));assert.ok(!text.includes('ออกกำลังกาย'));
 snapshot.meals.push({meal:'Lunch',text:'Rice'});
 assert.ok(traineeCopyText({display_name:'Student'},snapshot,'2026-10-04').includes('Rice'));
});
