import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInBodyCsv} from '../dist/inbody-csv.mjs';
import {validateBody} from '../dist/body-data.mjs';

const header='วันที่,อุปกรณ์ที่ใช้ในการวัด,มวลไขมันของแขนขวา(kg),มวลน้ำหนักไม่รวมไขมันของแขนขวา(kg),น้ำหนัก(kg),รอบเอว(cm)';

test('Thai InBody export uses the measurement date and maps only compatible units',()=>{
 const rows=parseInBodyCsv('\uFEFF'+header+'\r\n20261102082041,"InBody, ""home""",1.2,3.12,70.1,-\r\n20261109100100,InBody,1.3,3.2,71,');
 assert.deepEqual(rows,[
  {day:'2026-11-02',time:'08:20',values:{mus_ra:3.12,weight:70.1}},
  {day:'2026-11-09',time:'10:01',values:{mus_ra:3.2,weight:71}},
 ]);
 assert.equal(validateBody({id:'test',sex:'male',day:rows[0].day,...rows[0].values}).fat_ra,null);
});

test('invalid measurements are rejected before the form is filled',()=>{
 assert.throws(()=>parseInBodyCsv(header+'\n20260230082041,InBody,1,3,70,-'),/วันที่วัด/);
 assert.throws(()=>parseInBodyCsv(header+'\n20261102082041,InBody,1,3,700,-'),/น้ำหนัก/);
 assert.throws(()=>parseInBodyCsv(header+'\n20261102082041,"InBody,1,3,70,-'),/รูปแบบ CSV/);
});
