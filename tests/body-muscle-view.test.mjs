import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadModel,muscleOnlyRecord,shapeBody} from '../src/body3d.mjs';
test('muscle mesh ignores total weight, fat and tape girths while retaining segment muscle changes',async()=>{
 globalThis.fetch=async url=>{const sex=String(url).includes('body-female')?'female':'male';return new Response(await readFile(new URL('../dist/models/body-'+sex+'.bin',import.meta.url)));};
 for(const sex of ['female','male']){
  const model=await loadModel(sex),base={sex,height:165,weight:60,body_fat:18,muscle:25,musp_la:100,musp_ra:100,musp_trunk:100,musp_ll:100,musp_rl:100};
  const fat={...base,weight:95,body_fat:45,visceral:20,fat_la:150,fat_ra:150,fat_trunk:180,waist:120,hip:130,arm:42,thigh:75};
  const a=shapeBody(model,muscleOnlyRecord(base),true),b=shapeBody(model,muscleOnlyRecord(fat),true);
  assert.deepEqual(a.pos,b.pos,sex+' muscle geometry must not be inflated by fat');
  assert.notDeepEqual(shapeBody(model,base).pos,shapeBody(model,fat).pos,sex+' shape geometry must still reflect body measurements');
  assert.notDeepEqual(a.pos,shapeBody(model,muscleOnlyRecord({...base,musp_la:125}),true).pos,sex+' segment muscle data must still affect geometry');
  assert.equal(a.H,1.65);assert.ok(a.pos.every(Number.isFinite));
 }
});
test('the muscle view is the person without fat: their muscle sets the size, the level is not capped',async()=>{
 const {macros}=await import('../src/body3d.mjs');
 const r={sex:'female',height:158,weight:78.8,body_fat:42,muscle:25.6},lean=muscleOnlyRecord(r);
 assert.ok(lean.weight>50&&lean.weight<60,'fat-free mass from muscle, plus minimal fat: '+lean.weight);
 assert.equal(lean.body_fat,14);
 const level=macros(lean).muscle;assert.ok(level>0.6&&level<1,'above-average muscle without hitting the cap: '+level);
 assert.ok(macros(muscleOnlyRecord({...r,muscle:20})).muscle<level,'less muscle, lower level');
 assert.ok(muscleOnlyRecord({...r,muscle:20}).weight<lean.weight,'less muscle, smaller fat-free body');
});

 test('composition shows arm fat even when the torso is much thicker', async()=>{
  const {compositionFatOverlay}=await import('../src/body3d.mjs');
  const thickness=[],segments=[];
  for(let seg=0;seg<5;seg++) for(let i=0;i<100;i++){segments.push(seg);thickness.push((seg===0?0.08:0.008)+i*(seg===0?0.002:0.0003));}
  segments.push(5,1);thickness.push(0.2,0);
  const mask=compositionFatOverlay(thickness,segments,{sex:'female',body_fat:42});
  for(let seg=0;seg<5;seg++) assert.ok(mask.some((v,i)=>segments[i]===seg&&v>0.7),'fat visible on segment '+seg);
  assert.equal(mask[500],0,'head excluded');assert.equal(mask[501],0,'excluded skin stays clear');
  const low=compositionFatOverlay(thickness,segments,{sex:'female',body_fat:22});
  assert.ok(mask.reduce((a,b)=>a+b,0)>low.reduce((a,b)=>a+b,0));
 });
