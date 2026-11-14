import test from 'node:test';
import assert from 'node:assert/strict';
import {gifFor, GIF_IDS} from '../dist/exercise-media.mjs';
import {mediaKey} from '../dist/exercise-media-key.mjs';
import {LIBRARY} from '../dist/exercise-library.mjs';

test('library names find their ExerciseDB GIF regardless of case and punctuation', () => {
 assert.equal(mediaKey('3/4 Sit-up'), mediaKey('3/4 sit-up (male)'));
 assert.match(gifFor('3/4 Sit-up'), /^https:\/\/static\.exercisedb\.dev\/media\/[A-Za-z0-9]+\.gif$/);
});

test('names without a match, Thai names and empty input get no GIF', () => {
 assert.equal(gifFor('วิ่ง'), null);
 assert.equal(gifFor(''), null);
 assert.equal(gifFor(undefined), null);
 assert.equal(gifFor('Not A Real Exercise Name'), null);
});

test('every mapped key belongs to a library exercise', () => {
 const keys = new Set(LIBRARY.map(([name]) => mediaKey(name)));
 for (const key of Object.keys(GIF_IDS)) assert.ok(keys.has(key), key);
 assert.ok(Object.keys(GIF_IDS).length > 900);
});
