import test from 'node:test';import assert from 'node:assert/strict';
import {frequentMeals,previousDayCopies} from '../dist/meal-shortcuts.mjs';
const meal=(day,mealType,text,extra={})=>({id:day+mealType+text,day,meal:mealType,time:'08:00',text,...extra});
test('foods noted at least twice show up, most often first, with their usual meal and latest numbers',()=>{
 const records=[
  meal('2026-11-10','มื้อเช้า','ข้าวต้มไก่',{kcal:300}),meal('2026-11-12','มื้อเช้า','ข้าวต้มไก่ ',{kcal:320,protein:25}),meal('2026-11-14','มื้อกลางวัน','ข้าวต้มไก่'),
  meal('2026-11-11','มื้อกลางวัน','สลัดอกไก่'),meal('2026-11-13','มื้อกลางวัน','สลัดอกไก่',{kcal:350}),
  meal('2026-11-13','ของว่าง','กล้วย'),
  meal('2026-08-01','มื้อเย็น','ส้มตำ'),meal('2026-08-02','มื้อเย็น','ส้มตำ'),
  {id:'w',day:'2026-11-13',kind:'workout',exercise:'Squat'},
 ];
 const frequent=frequentMeals(records,'2026-11-16');
 assert.deepEqual(frequent.map(f=>[f.text,f.count,f.meal]),[['ข้าวต้มไก่',3,'มื้อเช้า'],['สลัดอกไก่',2,'มื้อกลางวัน']],'once only and older than 60 days are left out');
 assert.equal(frequent[0].kcal,undefined,'numbers come from the latest time, which had none');
 assert.equal(frequent[1].kcal,350);
});
test("copying the day before skips meals already noted today and keeps type, time, food and numbers",()=>{
 const records=[meal('2026-11-15','มื้อเช้า','ข้าวต้มไก่',{kcal:320,protein:25}),{...meal('2026-11-15','มื้อกลางวัน','สลัดอกไก่'),time:'12:30'},meal('2026-11-16','มื้อเช้า','ข้าวต้มไก่')];
 let n=0;const copies=previousDayCopies(records,'2026-11-16',()=>'new-'+(++n));
 assert.deepEqual(copies,[{id:'new-1',day:'2026-11-16',meal:'มื้อกลางวัน',time:'12:30',text:'สลัดอกไก่'}]);
 assert.deepEqual(previousDayCopies(records,'2026-11-18'),[],'nothing on the day before');
});
