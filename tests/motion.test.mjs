import test from 'node:test';
import assert from 'node:assert/strict';
import {cheerFor} from '../dist/motion.mjs';

test('cheers name the saved workout or meal', () => {
  assert.match(cheerFor([{id: 'a', kind: 'workout', exercise: 'Squat'}]), /^บันทึก Squat แล้ว · /);
  assert.match(cheerFor([{id: 'a', kind: 'workout', exercise: 'A'}, {id: 'b', kind: 'workout', exercise: 'B'}]), /^บันทึก 2 ท่าแล้ว · /);
  assert.match(cheerFor([{id: 'a', meal: 'มื้อเช้า', text: 'ข้าว'}]), /^บันทึกมื้อเช้าแล้ว · /);
});

test('no cheer for nothing new or for a bulk import', () => {
  assert.equal(cheerFor([]), null);
  assert.equal(cheerFor(Array.from({length: 5}, (_, i) => ({id: String(i), meal: 'มื้อเช้า'}))), null);
});
