import test from 'node:test';
import assert from 'node:assert/strict';
import {loggedDays, streak, streakText} from '../dist/streak.mjs';

test('logged days come from diary rows and weigh-ins only', () => {
  const days = loggedDays([{day: '2026-11-01'}, {day: '2026-11-02', kind: 'workout'}], [{day: '2026-11-03', weight: 60}, {day: '2026-11-04', weight: null}]);
  assert.deepEqual([...days].sort(), ['2026-11-01', '2026-11-02', '2026-11-03']);
});

test('streak counts back from today, or from yesterday while today is still open', () => {
  const days = new Set(['2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepEqual(streak(days, '2026-11-05'), {current: 3, best: 3, todayDone: true});
  assert.deepEqual(streak(days, '2026-11-06'), {current: 3, best: 3, todayDone: false});
  assert.deepEqual(streak(days, '2026-11-07'), {current: 0, best: 3, todayDone: false});
});

test('streak crosses month ends and best ignores future days', () => {
  const days = new Set(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  assert.deepEqual(streak(days, '2026-11-01'), {current: 3, best: 3, todayDone: true});
});

test('streak text', () => {
  assert.equal(streakText({current: 0, best: 0, todayDone: false}).title, 'เริ่มสถิติใหม่วันนี้');
  assert.equal(streakText({current: 5, best: 5, todayDone: true}).note, 'สถิติดีที่สุดของคุณ!');
  assert.equal(streakText({current: 2, best: 9, todayDone: false}).note, 'บันทึกวันนี้เพื่อต่อสถิติ');
});

test('week dots run Monday to Sunday around today', async () => {
  const {weekDots} = await import('../dist/streak.mjs');
  const dots = weekDots(new Set(['2026-11-02', '2026-11-04']), '2026-11-04');
  assert.deepEqual(dots.map(d => d.day), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(dots.map(d => d.done), [true, false, true, false, false, false, false]);
  assert.equal(dots[2].isToday, true);
  assert.equal(dots[3].future, true);
  assert.equal(weekDots(new Set(), '2026-11-08')[0].day, '2026-11-02');
});

test('Apple Health workouts and weigh-ins count as logged days; steps alone do not', () => {
  const days = loggedDays([], [], {days: [{day: '2026-11-01', steps: 9000}, {day: '2026-11-02', weight: 61}], workouts: [{day: '2026-11-03'}]});
  assert.deepEqual([...days].sort(), ['2026-11-02', '2026-11-03']);
});
