import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleNutrition,handleOwnNutrition} from '../src/nutrition.mjs';
const team={id:'team',owner_id:'owner',owner_role:'trainer'};
const req=(method='GET',body)=>new Request('https://app.test/api/nutrition',{method,body:body===undefined?undefined:JSON.stringify(body)});
test('nutrition targets deny unrelated, invited and trainee writers',async()=>{
 const sql=async()=>[{team_role:'trainee'}];
 for(const [id,mine] of [['other',{status:'active',team_role:'trainee'}],['coach',{status:'invited',team_role:'trainer'}]])assert.equal((await handleNutrition(req(),sql,{sub:id},team,mine,'student')).status,403);
 assert.equal((await handleNutrition(req('PUT',{calories:2000,protein:120}),sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,403);
 assert.equal((await handleNutrition(req(),sql,{sub:'student'},team,{status:'active',team_role:'trainee'},'student')).status,200);
});
test('nutrition validates before writes and saves only for authorized active trainee',async()=>{
 const writes=[],sql=async(strings,...values)=>{const q=strings.join('?');if(q.includes('SELECT team_role'))return [{team_role:'trainee'}];writes.push({q,values});return [{calories:2000,protein:120}];};
 for(const body of [null,{}, {calories:0,protein:120},{calories:2000,protein:-1},{calories:'2000',protein:120},{calories:20001,protein:120},{calories:2000,protein:1001},{calories:2000,protein:120,carbs:-5},{calories:2000,protein:120,carbs:'200'}])assert.equal((await handleNutrition(req('PUT',body),sql,{sub:'owner'},team,null,'student')).status,400);
 assert.equal(writes.length,0);
 const result=await handleNutrition(req('PUT',{calories:2000,protein:120}),sql,{sub:'coach'},team,{status:'active',team_role:'trainer'},'student');assert.equal(result.status,200);assert.equal((await result.json()).goal.protein,120);assert.deepEqual(writes[0].values,['team','student',2000,120,null,'coach']);
 assert.equal((await handleNutrition(req('PUT',{calories:2000,protein:120}),async()=>[{team_role:'trainer'}],{sub:'owner'},team,null,'student')).status,403);
});
test('own nutrition query is account-bound and requires current active trainee membership',async()=>{
 const queries=[];const sql=async(s,...v)=>{queries.push({query:s.join('?'),values:v});return s.join('?').includes('nutrition_goal FROM members')?[{nutrition_goal:{calories:1800,protein:100,carbs:null}}]:[];};
 const response=await handleOwnNutrition(req(),sql,{sub:'student'});assert.equal(response.status,200);
 assert.deepEqual(queries[0].values,['student','student','student']);assert.match(queries[0].query,/tm.status='active'/);
 assert.deepEqual(await response.json(),{goals:[],own:{calories:1800,protein:100,carbs:null}},'the own goal comes with the trainer goals');
 assert.equal((await handleOwnNutrition(req('DELETE'),sql,{sub:'student'})).status,405);
});

test('active trainers may set their own targets but may not prescribe to other trainers',async()=>{
 const sql=async strings=>strings.join('').includes('SELECT team_role')?[{team_role:'trainer'}]:[{calories:2100,protein:130}];
 const body={calories:2100,protein:130};assert.equal((await handleNutrition(req('PUT',body),sql,{sub:'coach'},team,{status:'active',team_role:'trainer'},'coach')).status,200);
 assert.equal((await handleNutrition(req('PUT',body),sql,{sub:'coach'},team,{status:'active',team_role:'trainer'},'other-coach')).status,403);
});
test('members without a trainer goal can set, change and clear their own; carbs are optional',async()=>{
 const writes=[];const sql=async(s,...v)=>{writes.push({query:s.join('?'),values:v});return [];};
 assert.equal((await handleOwnNutrition(req('PUT',{calories:1800,protein:110,carbs:200}),sql,{sub:'pim'})).status,200);
 assert.deepEqual(JSON.parse(writes[0].values[0]),{calories:1800,protein:110,carbs:200});assert.equal(writes[0].values[1],'pim');
 assert.equal((await handleOwnNutrition(req('PUT',{calories:1800,protein:110}),sql,{sub:'pim'})).status,200);
 assert.deepEqual(JSON.parse(writes[1].values[0]),{calories:1800,protein:110,carbs:null});
 assert.equal((await handleOwnNutrition(req('PUT',{calories:0,protein:110}),sql,{sub:'pim'})).status,400);
 assert.equal((await handleOwnNutrition(req('PUT',{clear:true}),sql,{sub:'pim'})).status,200);
 assert.equal(writes.at(-1).values[0],null);
});
