import test from 'node:test';
import assert from 'node:assert/strict';
import {catMood, moodText} from '../dist/cat-mood.mjs';

const day = '2026-11-06';
const meal = {day, kind: 'meal', meal: 'มื้อเช้า', text: 'ข้าว'};
const lift = (sets = 3, exercise = 'Squat') => ({day, kind: 'workout', trainingType: 'strength', exercise, sets, reps: 8});
const cardio = (exercise, duration = 30) => ({day, kind: 'workout', trainingType: 'cardio', exercise, duration});
const mood = (extra) => catMood({day, today: day, hour: 15, ...extra});

test('nothing logged makes the cat cry, except sleepy on a morning', () => {
  assert.equal(mood({}), 'cry');
  assert.equal(mood({hour: 8}), 'sleepy');
  assert.equal(catMood({day: '2026-11-01', today: day, hour: 8}), 'cry');
  assert.equal(mood({health: {days: [{day, steps: 9000}]}}), 'cry');
});

test('logging without training is a happy free day', () => {
  assert.equal(mood({diary: [meal]}), 'free');
  assert.equal(mood({body: [{day, weight: 61}]}), 'free');
  assert.equal(mood({health: {days: [{day, weight: 61}]}}), 'free');
});

test('running only is the runner; heavy days are buff; anything else is trained', () => {
  assert.equal(mood({diary: [meal, cardio('วิ่งลู่')]}), 'runner');
  assert.equal(mood({health: {workouts: [{day, activity: 'Running', durationMin: 30}]}}), 'runner');
  assert.equal(mood({diary: [cardio('Treadmill walk'), cardio('ปั่นจักรยาน')]}), 'trained');
  assert.equal(mood({diary: [lift(3)]}), 'trained');
  assert.equal(mood({diary: [lift(4), lift(4, 'Bench'), lift(4, 'Row')]}), 'buff');
  assert.equal(mood({diary: [lift(), lift(), lift(), lift()]}), 'buff');
  assert.equal(mood({diary: [cardio('วิ่ง', 95)]}), 'buff');
  assert.equal(mood({health: {workouts: [{day, activity: 'TraditionalStrengthTraining', durationMin: 50}]}}), 'buff');
  assert.equal(mood({diary: [meal], health: {days: [{day, activeKcal: 800}], workouts: [{day, activity: 'Walking', durationMin: 20}]}}), 'buff');
});

test('every mood has words for today and for a past day', () => {
  for (const m of ['cry', 'free', 'runner', 'buff', 'trained']) {
    assert.ok(moodText(m, true));
    assert.ok(moodText(m, false));
  }
  assert.ok(moodText('sleepy', true));
});
