import test from 'node:test';import assert from 'node:assert/strict';
import {exerciseLine} from '../dist/team-program.mjs';
test('team program lines show sets, reps, the unit the trainer used, cardio targets and supersets',()=>{
 assert.equal(exerciseLine({exercise:'Lat Pulldown',sets:3,reps:12,weight:30,weightUnit:'lb'}),'Lat Pulldown · 3 เซ็ต × 12 ครั้ง · 30 lb');
 assert.equal(exerciseLine({exercise:'Plank',sets:3,reps:10,weight:null}),'Plank · 3 เซ็ต × 10 ครั้ง');
 assert.equal(exerciseLine({exercise:'Push-up',sets:4,reps:12,weight:0,weightUnit:'kg'}),'Push-up · 4 เซ็ต × 12 ครั้ง · น้ำหนักตัว');
 assert.equal(exerciseLine({exercise:'Row',sets:3,reps:10,weight:20,weightUnit:'kg',superset:'A'}),'Row · 3 เซ็ต × 10 ครั้ง · 20 kg · Super set A');
 assert.equal(exerciseLine({trainingType:'cardio',exercise:'เดินชัน',duration:12,speed:5.5,incline:4,distance:1}),'เดินชัน · 12 นาที · 5.5 กม./ชม. · ชัน 4% · 1 กม.');
});
