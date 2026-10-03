import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mealForTime,validateRecords,mergeRecords} from '../dist/store.mjs';
const meal={id:'test-meal',day:'2026-10-03',meal:'มื้อเช้า',time:'08:00',text:'ข้าว 1 จาน'};
test('meal time boundaries and invalid times',()=>{
 for(const time of ['08:00','11:59'])assert.equal(mealForTime(time),'มื้อเช้า');
 for(const time of ['12:00','15:59'])assert.equal(mealForTime(time),'มื้อกลางวัน');
 for(const time of ['16:00','23:59'])assert.equal(mealForTime(time),'มื้อเย็น');
 assert.equal(mealForTime(''),null);assert.equal(mealForTime('24:00'),null);
});
test('legacy records stay unchanged while workout timing survives import validation',()=>{
 assert.deepEqual(validateRecords([meal]),[meal]);
 for(const workoutTiming of ['pre-workout','post-workout']){
  const row={...meal,workoutTiming};assert.deepEqual(validateRecords([row]),[row]);assert.deepEqual(mergeRecords([],[row]),[row]);
 }
 assert.throws(()=>validateRecords([{...meal,workoutTiming:'invalid'}]));
});
