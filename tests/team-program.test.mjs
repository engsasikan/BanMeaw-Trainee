import test from 'node:test';import assert from 'node:assert/strict';
import {exerciseLine,groupPrograms,supersetGroups} from '../dist/team-program.mjs';
test('team program lines show sets, reps, the unit the trainer used, cardio targets and supersets',()=>{
 assert.equal(exerciseLine({exercise:'Lat Pulldown',sets:3,reps:12,weight:30,weightUnit:'lb'}),'Lat Pulldown · 3 เซ็ต × 12 ครั้ง · 30 lb');
 assert.equal(exerciseLine({exercise:'Plank',sets:3,reps:10,weight:null}),'Plank · 3 เซ็ต × 10 ครั้ง');
 assert.equal(exerciseLine({exercise:'Push-up',sets:4,reps:12,weight:0,weightUnit:'kg'}),'Push-up · 4 เซ็ต × 12 ครั้ง · น้ำหนักตัว');
 assert.equal(exerciseLine({exercise:'Row',sets:3,reps:10,weight:20,weightUnit:'kg',superset:'A'}),'Row · 3 เซ็ต × 10 ครั้ง · 20 kg · Super set A');
 assert.equal(exerciseLine({trainingType:'cardio',exercise:'เดินชัน',duration:12,speed:5.5,incline:4,distance:1}),'เดินชัน · 12 นาที · 5.5 กม./ชม. · ชัน 4% · 1 กม.');
});
test('plans group into one program per saved batch, each with a Monday–Sunday week',()=>{
 const squat=[{exercise:'Squat',sets:3,reps:10,weight:null}],row=[{exercise:'Row',sets:3,reps:12,weight:null}],run=[{trainingType:'cardio',exercise:'Run',duration:30}];
 const rows=[
  // November program: Mondays and Thursdays
  ...['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30'].map(day=>({batch:'nov',day,exercises:squat})),
  ...['2026-11-05','2026-11-12','2026-11-19','2026-11-26'].map(day=>({batch:'nov',day,exercises:row})),
  // December program: Saturdays only
  ...['2026-12-05','2026-12-12'].map(day=>({batch:'dec',day,exercises:run})),
  // An October program that has ended
  {batch:'oct',day:'2026-10-05',exercises:row},
 ];
 const programs=groupPrograms(rows,'2026-11-16');
 assert.deepEqual(programs.map(p=>[p.batch,p.status,p.first,p.last,p.days]),[
  ['nov','current','2026-11-02','2026-11-30',9],['dec','upcoming','2026-12-05','2026-12-12',2],['oct','ended','2026-10-05','2026-10-05',1]]);
 const nov=programs[0];
 assert.deepEqual(nov.week.map(d=>d&&d.exercises[0].exercise),['Squat',null,null,'Row',null,null,null],'Mon … Sun');
 assert.equal(nov.week[0].day,'2026-11-16','shows the next occurrence from today');
 assert.equal(nov.today.day,'2026-11-16');
 assert.equal(programs[1].week[5].exercises[0].exercise,'Run');
 assert.equal(programs[2].week[0].day,'2026-10-05','an ended program shows its last occurrence');
});
test('Super sets are named on the day card and a group needs at least two strength exercises',()=>{
 const day=[{exercise:'Lat',superset:'A'},{exercise:'Bench',superset:'A'},{exercise:'Squat'},{exercise:'Row',superset:'B'},{exercise:'Curl',superset:'B'},{exercise:'Lonely',superset:'C'},{trainingType:'cardio',exercise:'Run',duration:10,superset:'C'}];
 assert.deepEqual(supersetGroups(day),[{letter:'A',count:2},{letter:'B',count:2}]);
 assert.equal(exerciseLine({exercise:'Row',sets:3,reps:12,weight:null,superset:'B'},{withGroup:false}),'Row · 3 เซ็ต × 12 ครั้ง');
});
