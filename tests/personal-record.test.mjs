import test from 'node:test';
import assert from 'node:assert/strict';
import {personalRecord, recordText} from '../dist/personal-record.mjs';

const lift = (id, day, weight, reps, extra = {}) => ({id, day, kind: 'workout', trainingType: 'strength', exercise: 'Squat', weight, sets: 3, reps, ...extra});

test('a heavier lift than ever before is a record', () => {
  const records = [lift('a', '2026-11-01', 50, 8), lift('b', '2026-11-03', 55, 5)];
  const row = lift('c', '2026-11-05', 60, 3);
  assert.deepEqual(personalRecord([...records, row], row), {kind: 'weight', label: 'น้ำหนักมากที่สุด', value: 60, before: 55, unit: 'kg'});
  assert.equal(recordText(row, personalRecord([...records, row], row), 'kg'), '🏆 สถิติใหม่! Squat · น้ำหนักมากที่สุด 60 kg (เดิม 55 kg)');
});

test('first try, a tie and a lighter lift are not records', () => {
  const first = lift('a', '2026-11-01', 50, 8);
  assert.equal(personalRecord([first], first), null);
  const tie = lift('b', '2026-11-02', 50, 8);
  assert.equal(personalRecord([first, tie], tie), null);
  const lighter = lift('c', '2026-11-03', 40, 8);
  assert.equal(personalRecord([first, lighter], lighter), null);
});

test('more reps at the top weight is a record; names match loosely; later days are ignored', () => {
  const records = [lift('a', '2026-11-01', 50, 5), lift('later', '2026-11-09', 80, 1)];
  const row = lift('b', '2026-11-02', 50, 7, {exercise: '  squat '});
  assert.equal(personalRecord([...records, row], row).kind, 'reps-at-weight');
});

test('set logs count their best set', () => {
  const records = [lift('a', '2026-11-01', 50, 5)];
  const row = lift('b', '2026-11-02', null, null, {setLogs: [{weight: 45, reps: 10}, {weight: 52.5, reps: 4}]});
  assert.equal(personalRecord([...records, row], row).value, 52.5);
});

test('bodyweight moves count reps; cardio counts distance then time', () => {
  const push = (id, day, reps) => ({id, day, kind: 'workout', exercise: 'Push-up', weight: 0, reps, sets: 3});
  const p = push('b', '2026-11-02', 20);
  assert.equal(personalRecord([push('a', '2026-11-01', 15), p], p).kind, 'reps');
  const run = (id, day, distance, duration) => ({id, day, kind: 'workout', trainingType: 'cardio', exercise: 'Run', distance, duration});
  const r = run('b', '2026-11-02', 4, 20);
  assert.equal(personalRecord([run('a', '2026-11-01', 5, 30), r], r), null);
  const longer = run('c', '2026-11-03', 5, 35);
  assert.equal(personalRecord([run('a', '2026-11-01', 5, 30), longer], longer).kind, 'duration');
});

test('meals and other exercises never count', () => {
  const meal = {id: 'm', day: '2026-11-01', meal: 'มื้อเช้า', text: 'ข้าว'};
  assert.equal(personalRecord([meal], meal), null);
  const bench = lift('b', '2026-11-02', 100, 1, {exercise: 'Bench press'});
  assert.equal(personalRecord([lift('a', '2026-11-01', 50, 5), bench], bench), null);
});
