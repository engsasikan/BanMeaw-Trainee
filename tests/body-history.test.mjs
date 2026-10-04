import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveBodyRecords} from '../dist/body-data.mjs';
test('InBody values persist across weigh-ins until a new measurement replaces them',()=>{
 const records=[{id:'new',day:'2026-10-04',weight:80,body_fat:28},{id:'weight',day:'2026-10-03',weight:81,muscle:null},{id:'inbody',day:'2026-10-02',weight:82,muscle:30,body_fat:29,mus_ra:3}];
 const result=resolveBodyRecords(records);
 assert.equal(result[0].muscle,30);assert.equal(result[0].body_fat,28);assert.equal(result[0].mus_ra,3);
 assert.equal(result[1].weight,81);assert.equal(result[1].body_fat,29);
 assert.equal(result[2].body_fat,29);assert.equal(records[1].muscle,null);
});
test('zero is a replacement value and future records do not fill older history',()=>{
 const result=resolveBodyRecords([{id:'old',day:'2026-10-01',weight:80},{id:'new',day:'2026-10-02',muscle_control:0,muscle:31}]);
 assert.equal(result[0].muscle,undefined);assert.equal(result[1].muscle_control,0);assert.equal(result[1].weight,80);
});
