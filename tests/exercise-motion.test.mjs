import test from 'node:test';
import assert from 'node:assert/strict';
import {motionFor} from '../dist/exercise-motion.mjs';

test('exercise names map to demonstrations', () => {
  for (const [name, motion] of [
    ['Barbell Squat', 'squat'], ['Goblet Squat', 'squat'], ['สควอต', 'squat'],
    ['Barbell Bench Press', 'bench'], ['Incline Dumbbell Press', 'bench'], ['Chest Press Machine', 'bench'],
    ['Dumbbell Row', 'row'], ['Seated Cable Row', 'row'], ['Barbell Bent Over Row', 'row'],
    ['Dumbbell Biceps Curl', 'curl'], ['Hammer Curl', 'curl'],
    ['Crunch', 'crunch'], ['3/4 Sit-up', 'crunch'], ['Cable Crunch', 'crunch'],
    ['Dumbbell Shoulder Press', 'shoulderPress'], ['Overhead Press', 'shoulderPress'], ['Lateral Raise', 'lateralRaise'],
    ['Triceps Pushdown', 'pushdown'], ['Overhead Triceps Extension', 'overheadExtension'],
    ['Deadlift', 'deadlift'], ['Romanian Deadlift', 'deadlift'], ['Lunge', 'lunge'], ['Bulgarian Split Squat', 'lunge'],
    ['Push-up', 'pushup'], ['Pull-up', 'pullup'], ['Lat Pulldown', 'pullup'], ['Assisted Pull-up', 'pullup'],
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
  for (const [name, motion] of [['Leg Curl', 'lyingLegCurl'], ['Barbell Upright Row', 'uprightRow'], ['Rowing Machine', 'row'], ['Leg Extension', 'legExtension'],
    ['Plank', 'plank'], ['Dips', 'dip'], ['Calf Raise', 'calfRaise'], ['Calf Stretch With Hands Against Wall', 'calfStretch'], ['Lateral Raise', 'lateralRaise'],
    ['Dumbbell Cross Body Hammer Curl', 'curl'], ['Cable High Pulley Overhead Tricep Extension', 'overheadExtension'], ['Walking Lunge', 'lunge'],
    ['Dumbbell Bicep Curl On Exercise Ball With Leg Raised', 'curl'], ['Band Jack Knife Sit-up', 'vUp'], ['Hanging Leg Raise', 'hangingLegRaise'],
    ['Barbell Glute Bridge', 'bridge'], ['Farmers Walk', 'farmerWalk'], ['Burpee', 'jumpingJack'], ['Balance Board', 'squat']])
    assert.equal(motionFor(name), motion, name);
  for (const name of ['', null, 'my own made-up move']) assert.equal(motionFor(name), null, String(name));
  const {LIBRARY} = await import('../dist/exercise-library.mjs');
  const {readFile} = await import('node:fs/promises');
  const ids = new Set([...(await readFile(new URL('../src/body3d.mjs', import.meta.url), 'utf8')).matchAll(/^  (\w+): \{anchor:/gm)].map(m => m[1]));
  for (const [name] of LIBRARY) { const m = motionFor(name); assert.ok(m && ids.has(m), `${name}: ${m}`); }
});

test('search forgives common misspellings', async () => {
  const {searchExercises} = await import('../dist/exercise-picker.mjs');
  for (const [query, name] of [['bend over row', 'Barbell Bent Over Row'], ['bentover row', 'Barbell Bent Over Row'], ['dumbell curl', 'Dumbbell Biceps Curl'], ['pushup', 'Push-up']])
    assert.ok(searchExercises(query).some(x => x.name === name), query);
});
