import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toKg,fromKg,formatWeight} from '../dist/weight-units.mjs';
test('pounds convert to canonical kg and back without changing the lifted load',()=>{
 assert.equal(toKg(100,'lb'),45.359237);
 assert.equal(fromKg(toKg(100,'lb'),'lb'),100);
 assert.equal(toKg(20,'kg'),20);
 assert.equal(formatWeight(45.359237,'lb'),'100 lb / 45.36 kg');
});
test('empty and bodyweight values remain distinct',()=>{
 assert.equal(toKg('','lb'),null);
 assert.equal(fromKg(null,'lb'),'');
 assert.equal(toKg(0,'lb'),0);
 assert.equal(formatWeight(0,'lb'),'น้ำหนักตัว');
});

test('display both units for kilogram and pound entries',()=>{
 assert.equal(formatWeight(25,'kg'),'25 kg / 55.12 lb');
 assert.equal(formatWeight(toKg(25,'lb'),'kg'),'11.34 kg / 25 lb');
 assert.equal(formatWeight(null,'kg'),'ไม่ระบุ');
});
