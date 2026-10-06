import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {predictGirths} from '../src/girth-model.mjs';

test('predicted girths follow sex, size and body fat', () => {
  const woman = predictGirths({sex: 'female', height: 160, weight: 55}), heavier = predictGirths({sex: 'female', height: 160, weight: 80});
  const man = predictGirths({sex: 'male', height: 160, weight: 55});
  assert.ok(woman.hip > woman.waist && woman.hip > 85 && woman.hip < 100, 'typical woman: hips wider than waist');
  for (const k of ['chest', 'waist', 'hip', 'thigh', 'calf', 'arm']) assert.ok(heavier[k] > woman[k], k + ' grows with weight');
  assert.ok(woman.hip - woman.waist > man.hip - man.waist, 'women carry relatively more at the hips');
  assert.ok(predictGirths({sex: 'male', height: 175, weight: 80, body_fat: 30}).waist > predictGirths({sex: 'male', height: 175, weight: 80, body_fat: 15}).waist, 'more fat, wider waist (men)');
  assert.ok(predictGirths({sex: 'female', height: 160, weight: 70, body_fat: 42}).waist > predictGirths({sex: 'female', height: 160, weight: 70, body_fat: 30}).waist, 'more fat, wider waist (women)');
  assert.deepEqual(predictGirths({sex: 'female', weight: 60}), {}, 'needs height and weight');
});

test('the 3D body is fitted to the predicted girths when none were measured', async () => {
  globalThis.fetch = async url => new Response(await readFile(new URL('../dist/models/body-' + (String(url).includes('female') ? 'female' : 'male') + '.bin', import.meta.url)));
  const {loadModel, shapeBody} = await import('../src/body3d.mjs');
  const r = {sex: 'female', height: 158, weight: 78.8, body_fat: 42}, want = predictGirths(r), got = shapeBody(await loadModel('female'), r).girths;
  for (const k of ['chest', 'waist', 'hip', 'thigh']) assert.ok(Math.abs(got[k] - want[k]) < 2, `${k}: body ${got[k]} vs data ${want[k]}`);
  const measured = shapeBody(await loadModel('female'), {...r, waist: 90}).girths;
  assert.ok(Math.abs(measured.waist - 90) < 2, 'an entered tape measurement still wins');
});
