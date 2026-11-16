import test from 'node:test';import assert from 'node:assert/strict';
import {cleanReports,handleClientErrors} from '../src/client-errors.mjs';
import {ignored} from '../dist/error-report.mjs';
test('browser error reports are trimmed, stripped of query strings and written one JSON line each',async()=>{
 const lines=[];
 const reports=[{kind:'error',message:'x is not defined',stack:'at render (app.js:10)',source:'https://site/app.js?v=146',line:10.7,column:3,path:'/?google=success',view:'workout',app:'146',member:'u1',userAgent:'iPhone',at:'2026-11-16T09:00:00Z',records:[{text:'secret meal'}]},{message:''},{kind:'weird',message:'y'.repeat(900)}];
 const response=await handleClientErrors(new Request('https://site/api/client-errors',{method:'POST',body:JSON.stringify({reports})}),line=>lines.push(JSON.parse(line)));
 assert.equal(response.status,204);
 assert.equal(lines.length,2,'empty messages are dropped');
 assert.deepEqual([lines[0].type,lines[0].source,lines[0].path,lines[0].line,lines[0].records],['client-error','https://site/app.js','/',10,undefined]);
 assert.deepEqual([lines[1].kind,lines[1].message.length],['error',500]);
 assert.equal(cleanReports({reports:Array(9).fill({message:'a'})}).length,5,'at most five per request');
 assert.equal((await handleClientErrors(new Request('https://site/api/client-errors',{method:'POST',body:'not json'}),()=>{})).status,400);
 assert.equal((await handleClientErrors(new Request('https://site/api/client-errors'),()=>{})).status,405);
});
test('noise is not reported: extensions, opaque script errors, lost connections',()=>{
 for(const message of ['Script error.','ResizeObserver loop limit exceeded','Failed to fetch','Load failed','AbortError: The user aborted a request.'])assert.equal(ignored({message}),true,message);
 assert.equal(ignored({message:'boom',source:'chrome-extension://abc/x.js'}),true);
 assert.equal(ignored({message:"Cannot read properties of null (reading 'value')",source:'https://site/app.js'}),false);
});
