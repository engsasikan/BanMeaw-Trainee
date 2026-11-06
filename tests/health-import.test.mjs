import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {createHealthAggregator, readHealthExport, isoDate} from '../dist/health-import.mjs';
import {healthDay, healthWorkout} from '../dist/health-data.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="th_TH">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2025-03-01 08:00:00 +0700" endDate="2025-03-01 08:10:00 +0700" value="3000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2025-03-01 18:00:00 +0700" endDate="2025-03-01 18:10:00 +0700" value="1000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" startDate="2025-03-01 08:00:00 +0700" endDate="2025-03-01 08:10:00 +0700" value="4200"/>
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Apple Watch" unit="kJ" startDate="2025-03-01 08:00:00 +0700" endDate="2025-03-01 09:00:00 +0700" value="418.4"/>
 <Record type="HKQuantityTypeIdentifierAppleExerciseTime" sourceName="Apple Watch" unit="min" startDate="2025-03-01 08:00:00 +0700" endDate="2025-03-01 08:01:00 +0700" value="35"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="kg" startDate="2025-03-01 07:00:00 +0700" endDate="2025-03-01 07:00:00 +0700" value="62.3"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="kg" startDate="2025-03-01 06:00:00 +0700" endDate="2025-03-01 06:00:00 +0700" value="63"/>
 <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2025-03-01 07:00:00 +0700" endDate="2025-03-01 07:00:00 +0700" value="58"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2025-03-01 23:00:00 +0700" endDate="2025-03-02 06:30:00 +0700" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2025-03-01 22:30:00 +0700" endDate="2025-03-01 23:00:00 +0700" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2025-03-01 07:00:00 +0700" endDate="2025-03-01 07:00:00 +0700" value="90">
  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="0"/>
 </Record>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32.5" durationUnit="min" totalDistance="4.1" totalDistanceUnit="km" totalEnergyBurned="280" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch" startDate="2025-03-01 06:00:00 +0700" endDate="2025-03-01 06:32:30 +0700"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="45" durationUnit="min" sourceName="Apple Watch" startDate="2025-03-02 18:00:00 +0700" endDate="2025-03-02 18:45:00 +0700">
  <MetadataEntry key="HKIndoorWorkout" value="1"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2025-03-02 18:00:00 +0700" endDate="2025-03-02 18:45:00 +0700" sum="310" unit="kcal"/>
 </Workout>
</HealthData>
`;

function parse(text) {
  const agg = createHealthAggregator();
  for (const line of text.split('\n')) agg.line(line);
  return agg.result();
}

test('export lines become daily totals without counting iPhone and Watch steps twice', () => {
  const {days} = parse(XML);
  assert.deepEqual(days.map(d => d.day), ['2025-03-01', '2025-03-02']);
  const d = days[0];
  assert.equal(d.steps, 4200);
  assert.equal(d.activeKcal, 100);
  assert.equal(d.exerciseMin, 35);
  assert.equal(d.weight, 62.3);
  assert.equal(d.restingHr, 58);
  assert.equal(days[1].sleepMin, 450);
  for (const day of days) assert.doesNotThrow(() => healthDay(day));
});

test('both old and new workout formats are read, and pass server validation', () => {
  const {workouts} = parse(XML);
  assert.equal(workouts.length, 2);
  assert.deepEqual(workouts[0], {activity: 'HKWorkoutActivityTypeRunning', start: '2025-03-01T06:00:00+07:00', day: '2025-03-01', durationMin: 32.5, distanceKm: 4.1, kcal: 280, source: 'Apple Watch'});
  assert.equal(workouts[1].kcal, 310);
  assert.equal(healthWorkout(workouts[1]).day, '2025-03-02');
  assert.equal(isoDate('bad'), null);
});

// A minimal zip holding apple_health_export/export.xml, the way the Health app shares it.
function zip(name, content) {
  const data = Buffer.from(content), packed = deflateRawSync(data), file = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(file.length, 28); central.writeUInt32LE(0, 42);
  const cdOffset = 30 + file.length + packed.length, cd = Buffer.concat([central, file]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, file, packed, cd, end]);
}

test('export.zip and export.xml are both read straight from the file', async () => {
  const progress = [];
  const fromZip = await readHealthExport(new File([zip('apple_health_export/export.xml', XML)], 'export.zip'), p => progress.push(p));
  assert.equal(fromZip.days.length, 2);
  assert.equal(fromZip.workouts.length, 2);
  assert.equal(progress.at(-1), 1);
  const fromXml = await readHealthExport(new File([XML], 'export.xml'));
  assert.deepEqual(fromXml, fromZip);
  await assert.rejects(readHealthExport(new File(['not a zip'], 'export.zip')), /export\.zip/);
});
