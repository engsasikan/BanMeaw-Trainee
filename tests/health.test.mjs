import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {healthDay, healthWorkout, readings, activityName} from '../dist/health-data.mjs';
import {handleHealth, handleHealthIngest} from '../src/health.mjs';

test('Shortcut values are read whatever shape they come in', () => {
  assert.deepEqual(readings('1,234').map(r => r.n), [1234]);
  assert.deepEqual(readings('120\n80.5').map(r => r.n), [120, 80.5]);
  const day = healthDay({day: '2026-11-06', steps: ['4,000', 2500], activeKcal: '320 kcal', exerciseMin: '0.5 hr', distanceKm: '3200 m', restingHr: [60, 64], sleepMin: '7 hr', weight: '150 lb'});
  assert.deepEqual(day, {day: '2026-11-06', steps: 6500, activeKcal: 320, exerciseMin: 30, distanceKm: 3.2, restingHr: 62, sleepMin: 420, weight: 68.04});
});

test('a missing day means today in Thailand; bad days and empty payloads are refused', () => {
  assert.equal(healthDay({steps: 10}, '2026-11-06').day, '2026-11-06');
  assert.throws(() => healthDay({day: '6/11/2026', steps: 10}));
  assert.throws(() => healthDay({day: '2026-02-30', steps: 10}));
  assert.throws(() => healthDay({day: '2026-11-06'}));
  assert.equal(healthDay({steps: 10, weight: 5000}).weight, null);
});

test('workouts get a stable id and a Thai name', () => {
  const w = healthWorkout({activity: 'HKWorkoutActivityTypeRunning', start: '2026-11-05T23:30:00Z', durationMin: '32.5', distanceKm: '4.1 km', kcal: 280});
  assert.equal(w.day, '2026-11-06');
  assert.equal(w.id, '2026-11-05T23:30:00.000Z|Running');
  assert.equal(activityName(w.activity), 'วิ่ง');
  assert.equal(activityName('PaddleSports'), 'Paddle Sports');
  assert.throws(() => healthWorkout({activity: 'Running', start: 'yesterday'}));
});

async function database() {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = new PGlite();
  const schema = await readFile('db/001_initial.sql', 'utf8');
  const health = schema.slice(schema.indexOf('-- Apple Health'));
  await db.exec("CREATE TABLE members (id text PRIMARY KEY); INSERT INTO members VALUES ('a'),('b');" + health);
  const sql = async (strings, ...values) => {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) query += '$' + (i + 1) + strings[i + 1];
    return (await db.query(query, values)).rows;
  };
  return {db, sql};
}
const call = (handler, sql, method, path, body, user, headers = {}) => handler(new Request('https://app.test' + path, {method, headers: {'Content-Type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body)}), sql, user);

test('a Shortcut with the member key saves that member only, and a revoked key stops working', async () => {
  const {db, sql} = await database();
  try {
    const {key} = await (await call(handleHealth, sql, 'POST', '/api/health/key', undefined, {sub: 'a'})).json();
    assert.match(key, /^bmh_/);
    const sent = await call(handleHealthIngest, sql, 'POST', '/api/health/ingest', {day: '2026-11-06', steps: '8,123', activeKcal: 410}, null, {Authorization: 'Bearer ' + key});
    assert.equal(sent.status, 200);
    // A later send that only has weight keeps the steps already there.
    await call(handleHealthIngest, sql, 'POST', '/api/health/ingest', {day: '2026-11-06', weight: 61.4}, null, {'X-BanMeaw-Key': key});
    const mine = await (await call(handleHealth, sql, 'GET', '/api/health?from=2026-11-01&to=2026-11-30', undefined, {sub: 'a'})).json();
    assert.deepEqual(mine.days, [{day: '2026-11-06', steps: 8123, activeKcal: 410, exerciseMin: null, distanceKm: null, restingHr: null, sleepMin: null, weight: 61.4}]);
    assert.ok(mine.key.lastUsedAt);
    assert.deepEqual((await (await call(handleHealth, sql, 'GET', '/api/health', undefined, {sub: 'b'})).json()).days, []);
    assert.equal((await call(handleHealthIngest, sql, 'POST', '/api/health/ingest', {steps: 1}, null, {Authorization: 'Bearer bmh_wrongwrongwrongwrongwrong'})).status, 401);
    assert.equal((await call(handleHealthIngest, sql, 'POST', '/api/health/ingest', {steps: 1}, null)).status, 401);
    await call(handleHealth, sql, 'DELETE', '/api/health/key', undefined, {sub: 'a'});
    assert.equal((await call(handleHealthIngest, sql, 'POST', '/api/health/ingest', {steps: 1}, null, {Authorization: 'Bearer ' + key})).status, 401);
  } finally { await db.close(); }
});

test('importing history twice does not double it, and delete removes everything', async () => {
  const {db, sql} = await database();
  try {
    const history = {days: [{day: '2025-01-01', steps: 5000, exerciseMin: 20}], workouts: [{activity: 'TraditionalStrengthTraining', start: '2025-01-01T11:00:00Z', durationMin: 45, kcal: 250}]};
    for (let i = 0; i < 2; i++) assert.equal((await call(handleHealth, sql, 'POST', '/api/health/import', history, {sub: 'a'})).status, 200);
    const data = await (await call(handleHealth, sql, 'GET', '/api/health', undefined, {sub: 'a'})).json();
    assert.equal(data.days.length, 1);
    assert.equal(data.workouts.length, 1);
    assert.equal(data.workouts[0].day, '2025-01-01');
    assert.equal((await call(handleHealth, sql, 'POST', '/api/health/import', {days: [{day: 'nope', steps: 1}]}, {sub: 'a'})).status, 400);
    await call(handleHealth, sql, 'DELETE', '/api/health', undefined, {sub: 'a'});
    const after = await (await call(handleHealth, sql, 'GET', '/api/health', undefined, {sub: 'a'})).json();
    assert.deepEqual([after.days.length, after.workouts.length, after.key], [0, 0, null]);
  } finally { await db.close(); }
});
