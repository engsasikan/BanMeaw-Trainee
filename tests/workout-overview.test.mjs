import {test} from 'node:test';
import assert from 'node:assert/strict';
import {targetText,estimateMinutes,mainMuscles,workoutBlocks,workoutStats,estimateKcal} from '../dist/workout-overview.mjs';
test('overview describes targets, estimates time and groups Super sets',()=>{
 assert.equal(targetText({exercise:'Squat',sets:3,reps:12,weight:20}),'3 เซ็ต × 12 ครั้ง · 20 kg');
 assert.equal(targetText({exercise:'Plank',sets:1,seconds:30,weight:null}),'30 วิ');
 assert.equal(targetText({trainingType:'cardio',exercise:'Walk',duration:20,incline:12}),'20 นาที · ชัน 12%');
 // 3 sets × 36 s work + 3 × 60 s rest + 30 s moving on = 318 s ≈ 5 min
 assert.equal(estimateMinutes([{exercise:'Squat',sets:3,reps:12}]),5);
 assert.equal(estimateMinutes([{trainingType:'cardio',exercise:'Walk',duration:20}]),21);
 assert.deepEqual(mainMuscles([{exercise:'Squat'},{exercise:'Lunge'},{exercise:'Dumbbell Curl'}],1),['ต้นขาหน้า']);
 const plan={id:'p'},item=target=>({plan,target});
 const blocks=workoutBlocks([item({exercise:'A',sets:3,superset:'A'}),item({exercise:'B',sets:2,superset:'A'}),item({exercise:'C',sets:3}),item({exercise:'D',sets:3,superset:'B'})]);
 assert.deepEqual(blocks.map(b=>[b.superset,b.rounds,b.entries.map(e=>e.index)]),[['A',3,[0,1]],[null,3,[2]],[null,3,[3]]]);
});
test('finish summary adds up sets, reps, holds, cardio and lifted kilograms',()=>{
 const stats=workoutStats([
  {target:{exercise:'Squat'},record:{setLogs:[{weight:20,reps:10},{weight:10,weightUnit:'lb',reps:10}]}},
  {target:{exercise:'Plank'},record:{setLogs:[{seconds:30},{seconds:45}]}},
  {target:{trainingType:'cardio',exercise:'Walk'},record:{trainingType:'cardio',duration:15}},
  {target:{exercise:'Row'},record:null},
 ]);
 assert.deepEqual(stats,{exercises:4,logged:3,sets:4,reps:20,holdSeconds:75,cardioMinutes:15,volumeKg:245});
 assert.deepEqual(estimateKcal(600),{kcal:50,fromWeight:false},'no body weight: the rough figure');
 // 60 kg, 40 minutes in the gym of which 20 are walking at 5 km/h on a 12% incline.
 // Walking MET = (0.1×83.3 + 1.8×83.3×0.12 + 3.5)/3.5 ≈ 8.52 → 170 kcal; 20 min weights at MET 3.5 → 70 kcal.
 assert.deepEqual(estimateKcal(2400,{weightKg:60,cardio:[{duration:20,speed:5,incline:12}]}),{kcal:240,fromWeight:true});
 assert.deepEqual(estimateKcal(1800,{weightKg:80}),{kcal:140,fromWeight:true},'30 min of weights at MET 3.5');
});
test('standard warm-up and cool-down follow what the main work trains',async()=>{
 const {standardRoutine,workoutFocus}=await import('../dist/workout-overview.mjs');
 assert.equal(workoutFocus([{exercise:'Squat'},{exercise:'Lunge'}]),'lower');
 assert.equal(workoutFocus([{exercise:'Bench Press'},{exercise:'Dumbbell Curl'}]),'upper');
 assert.equal(workoutFocus([{trainingType:'cardio',exercise:'Walk',duration:20}]),'general');
 const routine=standardRoutine([{exercise:'Squat'},{exercise:'Calf Stretch',phase:'cooldown'}]);
 assert.equal(routine.focus,'lower');
 assert.ok(routine.warmup.every(x=>x.phase==='warmup'&&x.standard&&x.seconds>0));
 assert.ok(routine.cooldown.every(x=>x.phase==='cooldown'&&x.standard));
});
test('treadmill METs follow the ACSM walking and running equations',async()=>{
 const {cardioMet}=await import('../dist/workout-overview.mjs');
 assert.equal(Math.round(cardioMet({speed:5,incline:0})*10)/10,3.4);
 assert.equal(Math.round(cardioMet({speed:10,incline:0})*10)/10,10.5);
 assert.equal(cardioMet({}),5,'no speed: moderate cardio');
});
