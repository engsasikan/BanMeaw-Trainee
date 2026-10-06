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
  ]) assert.equal(motionFor(name), motion, name);
});

test('look-alike names get no demonstration', () => {
  for (const name of ['Leg Curl', 'Lying Leg Curl', 'Barbell Upright Row', 'Rowing Machine', 'Leg Extension', 'Plank', '', null])
    assert.equal(motionFor(name), null, String(name));
});

test('search forgives common misspellings', async () => {
  const {searchExercises} = await import('../dist/exercise-picker.mjs');
  for (const [query, name] of [['bend over row', 'Barbell Bent Over Row'], ['bentover row', 'Barbell Bent Over Row'], ['dumbell curl', 'Dumbbell Biceps Curl'], ['pushup', 'Push-up']])
    assert.ok(searchExercises(query).some(x => x.name === name), query);
});
