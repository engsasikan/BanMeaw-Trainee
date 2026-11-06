import test from 'node:test';
import assert from 'node:assert/strict';
import {motionFor} from '../dist/exercise-motion.mjs';

test('seated cable rows retain seated posture, cable equipment and grip variation',()=>{
 for(const [name,id] of [
  ['Cable Decline Seated Wide-grip Row','declineSeatedCableRow'],
  ['Cable Seated Wide-grip Row','wideSeatedCableRow'],
  ['Seated Cable Row','seatedCableRow'],
  ['Cable Seated Row','seatedCableRow'],
  ['Dumbbell Row','row'],['Barbell Bent Over Row','row'],['Barbell Upright Row','uprightRow']
 ])assert.equal(motionFor(name),id,name);
});

test('exercise names map to demonstrations', () => {
  for (const [name, motion] of [
    ['Barbell Squat', 'squat'], ['Goblet Squat', 'squat'], ['สควอต', 'squat'],
    ['Barbell Bench Press', 'bench'], ['Incline Dumbbell Press', 'bench'], ['Chest Press Machine', 'seatedChestPress'],
    ['Dumbbell Row', 'row'], ['Seated Cable Row', 'seatedCableRow'], ['Barbell Bent Over Row', 'row'],
    ['Dumbbell Biceps Curl', 'curl'], ['Hammer Curl', 'curl'],
    ['Crunch', 'crunch'], ['3/4 Sit-up', 'crunch'], ['Cable Crunch', 'crunch'],
    ['Dumbbell Shoulder Press', 'shoulderPress'], ['Overhead Press', 'shoulderPress'], ['Lateral Raise', 'lateralRaise'],
    ['Triceps Pushdown', 'pushdown'], ['Overhead Triceps Extension', 'overheadExtension'],
    ['Deadlift', 'deadlift'], ['Romanian Deadlift', 'deadlift'], ['Lunge', 'lunge'], ['Bulgarian Split Squat', 'lunge'],
    ['Push-up', 'pushup'], ['Pull-up', 'pullup'], ['Lat Pulldown', 'pulldown'], ['Assisted Pull-up', 'pullup'],
    ['Kettlebell Swing', 'kettlebellSwing'], ['Weighted Lunge With Swing', 'lunge'],
    ['Hamstring Stretch', 'hamstringStretch'], ['All Fours Squad Stretch', 'quadStretch'], ['Calf Stretch With Hands Against Wall', 'calfStretch'],
    ['Chest And Front Of Shoulder Stretch', 'chestStretch'], ['Rear Deltoid Stretch', 'shoulderStretch'], ['Overhead Triceps Stretch', 'tricepsStretch'],
    ['Standing Lateral Stretch', 'sideStretch'], ['Neck Side Stretch', 'neckStretch'],
    ['Assisted Lying Glutes Stretch', 'kneeToChest'], ['Assisted Lying Gluteus And Piriformis Stretch', 'lyingFigure4'],
    ['Seated Glute Stretch', 'seatedFigure4'], ['Seated Piriformis Stretch', 'seatedFigure4'], ['Chair Leg Extended Stretch', 'seatedHamstring'],
    ['Exercise Ball Seated Hamstring Stretch', 'seatedHamstring'], ['Iron Cross Stretch', 'ironCross'], ['Rocking Frog Stretch', 'rockingFrog'],
    ['World Greatest Stretch', 'worldGreatest'], ['Circles Knee Stretch', 'kneeCircles'], ['Roller Back Stretch', 'rollerBack'], ['Roller Hip Stretch', 'kneeToChest'],
  ]) assert.equal(motionFor(name), motion, name);
});

test('look-alikes get the right demonstration, and every library exercise has one', async () => {
  for (const [name, motion] of [['Leg Curl', 'lyingLegCurl'], ['Barbell Upright Row', 'uprightRow'], ['Rowing Machine', 'rowingErg'], ['Leg Extension', 'legExtension'],
    ['Plank', 'plank'], ['Dips', 'dip'], ['Calf Raise', 'calfRaise'], ['Calf Stretch With Hands Against Wall', 'calfStretch'], ['Lateral Raise', 'lateralRaise'],
    ['Dumbbell Cross Body Hammer Curl', 'curl'], ['Cable High Pulley Overhead Tricep Extension', 'overheadExtension'], ['Walking Lunge', 'lunge'],
    ['Dumbbell Bicep Curl On Exercise Ball With Leg Raised', 'curl'], ['Band Jack Knife Sit-up', 'vUp'], ['Hanging Leg Raise', 'hangingLegRaise'],
    ['Barbell Glute Bridge', 'bridge'], ['Farmers Walk', 'farmerWalk'], ['Burpee', 'burpee'], ['Balance Board', 'squat']])
    assert.equal(motionFor(name), motion, name);
  for (const name of ['', null, 'my own made-up move']) assert.equal(motionFor(name), null, String(name));
  const {LIBRARY} = await import('../dist/exercise-library.mjs');
  const {MOTION_IDS}=await import('../src/body3d.mjs');
  const ids=new Set(MOTION_IDS);
  for (const [name] of LIBRARY) { const m = motionFor(name); assert.ok(m && ids.has(m), `${name}: ${m}`); }
});

test('search forgives common misspellings', async () => {
  const {searchExercises} = await import('../dist/exercise-picker.mjs');
  for (const [query, name] of [['bend over row', 'Barbell Bent Over Row'], ['bentover row', 'Barbell Bent Over Row'], ['dumbell curl', 'Dumbbell Biceps Curl'], ['pushup', 'Push-up']])
    assert.ok(searchExercises(query).some(x => x.name === name), query);
});

test('names from the supplied workout screenshots can be selected', async () => {
  const {searchExercises, SHOW_LIMIT} = await import('../dist/exercise-picker.mjs');
  const {musclesFor} = await import('../dist/exercise-muscles.mjs');
  for (const [query, name] of [
    ['knee push up','Knee Push-up'], ['matchine fly','Machine Fly'],
    ['lat pull down','Lat Pulldown'], ['Staggered Push Up','Staggered Push Up'],
    ['DB Floor Squeeze Press','Dumbbell Floor Squeeze Press'],
    ['Dumbbell Floor Pullover','Dumbbell Floor Pullover'],
    ['DUMBBELL REVERSE FLY','Dumbbell Reverse Fly'], ['LATERAL RAISE','Lateral Raise'],
    ['OVERHEAD EXTENSION STANDING','Overhead Extension Standing'],
    ['DUMBBELL CURL','Dumbbell Curl'], ['Dumbbell Thruster','Dumbbell Thruster'],
    ['DB Plank Row + Push-up','DB Plank Row + Push-up'],
    ['dumbbell plank row push up','DB Plank Row + Push-up'],
    ['FRONT RAISE','Front Raise'], ['Bendover Reverse Fly','Bendover Reverse Fly'],
    ['bent over reverse fly','Bendover Reverse Fly'],
    ['Weighted Crunch','Weighted Crunch'], ['SIDE PLANK CRUNCH','Side Plank Crunch'],
    ['FLUTTER KICK','Flutter Kick'], ['Chest Stretching','Chest Stretching']
  ]) {
    assert.ok(searchExercises(query).slice(0,SHOW_LIMIT).some(x=>x.name===name),query);
    assert.ok(musclesFor(name)?.primary.length,name);
  }
});
