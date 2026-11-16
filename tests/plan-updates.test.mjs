import test from 'node:test';import assert from 'node:assert/strict';
import {planSnapshot,planChanges,changeSummary} from '../dist/plan-updates.mjs';
const plan=(id,day,exercise,created_by='coach',team_name='Girl Gym')=>({id,day,exercises:[{exercise,sets:3,reps:10}],created_by,team_name});
test('trainer plans added, changed or cancelled since the last look are found; own plans and past days are not',()=>{
 const today='2026-11-16';
 const before=planSnapshot([plan('a','2026-11-16','Squat'),plan('b','2026-11-18','Row'),plan('c','2026-11-20','Lunge'),plan('mine','2026-11-17','Plank','me','โปรแกรมส่วนตัว'),plan('old','2026-11-10','Row')],'me',today);
 assert.deepEqual(Object.keys(before),['a','b','c'],'own and past plans are not tracked');
 const now=planSnapshot([plan('a','2026-11-16','Squat'),plan('b','2026-11-18','Deadlift'),plan('d','2026-11-23','Push-up',undefined,'Boy Gym')],'me',today);
 const changes=planChanges(before,now,today);
 assert.deepEqual([changes.added.map(p=>p.day),changes.changed.map(p=>p.day),changes.removed.map(p=>p.day)],[['2026-11-23'],['2026-11-18'],['2026-11-20']]);
 assert.deepEqual(changeSummary(changes),['Boy Gym: เพิ่ม 1 วัน','Girl Gym: แก้ 1 วัน · ยกเลิก 1 วัน']);
 assert.deepEqual(planChanges(null,now,today),{added:[],changed:[],removed:[]},'the first look only records');
 // A day that has simply passed is not a cancellation.
 assert.deepEqual(planChanges(before,planSnapshot([plan('b','2026-11-18','Row'),plan('c','2026-11-20','Lunge')],'me','2026-11-17'),'2026-11-17').removed,[]);
});
