import test from 'node:test';import assert from 'node:assert/strict';
import {validateRecords} from '../dist/store.mjs';
import {mealNumbers,dayTotals,progress} from '../dist/meal-nutrition.mjs';
import {traineeCopyText} from '../dist/team-summary.mjs';
const meal=(extra={})=>({id:crypto.randomUUID(),day:'2026-11-16',meal:'มื้อเช้า',time:'08:00',text:'ข้าวต้มไก่',...extra});
test('meals keep optional kcal and protein; bad numbers are refused',()=>{
 const [kept]=validateRecords([meal({kcal:450,protein:32.5,carbs:61.5})]);
 assert.deepEqual([kept.kcal,kept.protein,kept.carbs],[450,32.5,61.5]);
 assert.equal('kcal' in validateRecords([meal()])[0],false,'meals without numbers stay as they were');
 for(const bad of [{kcal:-1},{kcal:12.5},{kcal:20000},{protein:-2},{protein:30.25},{protein:'30'},{carbs:-1},{carbs:2001},{carbs:10.25}])assert.throws(()=>validateRecords([meal(bad)]),JSON.stringify(bad));
});
test('day totals count meals with numbers and say how many have none; progress caps the bar but not the text',()=>{
 const meals=[meal({kcal:450,protein:30,carbs:55}),meal({kcal:700}),meal({protein:12.3}),meal({carbs:20.5}),meal()];
 assert.deepEqual(dayTotals(meals),{kcal:1150,protein:42.3,carbs:75.5,missing:1,meals:5});
 assert.equal(mealNumbers(meals[0]),'450 kcal · โปรตีน 30 g · คาร์บ 55 g');
 assert.equal(mealNumbers(meals[4]),'');
 assert.deepEqual(progress(1150,1800),{ratio:1150/1800,percent:64,over:false});
 assert.deepEqual(progress(2100,1800),{ratio:1,percent:117,over:true});
 assert.equal(progress(500,null),null);
});
test('the daily summary sent to the trainer lists each meal\'s numbers and the day total',()=>{
 const text=traineeCopyText({display_name:'Pim',member_code:'BM-1'},{weight:null,height:null,meals:[meal({kcal:450,protein:30}),meal({meal:'มื้อกลางวัน',time:'12:30',text:'สลัดอกไก่'})],workouts:[]},'2026-11-16');
 assert.match(text,/– 450 kcal · โปรตีน 30 g/);
 assert.match(text,/รวมที่จดไว้: 450 kcal · โปรตีน 30 g · คาร์บ 0 g/);
});
