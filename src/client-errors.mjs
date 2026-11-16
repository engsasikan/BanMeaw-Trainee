// Errors that happened in people's browsers, sent by dist/error-report.mjs. They are written to the Worker log
// (Cloudflare dashboard → Workers → banmeaw-trainee → Logs) as one JSON line each, and are not stored anywhere else.
// Only what helps find the bug is kept: no form contents, no query strings.
const text=(value,max)=>typeof value==='string'?value.slice(0,max):undefined;
const number=value=>Number.isFinite(value)?Math.trunc(value):undefined;
export function cleanReports(body){
 const reports=Array.isArray(body?.reports)?body.reports.slice(0,5):[];
 return reports.filter(r=>r&&typeof r==='object'&&typeof r.message==='string'&&r.message.trim()).map(r=>({
  kind:['error','rejection','resource'].includes(r.kind)?r.kind:'error',
  message:text(r.message,500),
  stack:text(r.stack,2000),
  source:text(r.source,300)?.split('?')[0],
  line:number(r.line),column:number(r.column),
  path:text(r.path,200)?.split('?')[0],
  view:text(r.view,40),
  app:text(r.app,20),
  member:text(r.member,100),
  userAgent:text(r.userAgent,300),
  at:text(r.at,40),
 }));
}
export async function handleClientErrors(request,log=console.error){
 if(request.method!=='POST')return new Response(null,{status:405});
 let body;
 try{const raw=await request.text();if(raw.length>12000)return new Response(null,{status:413});body=JSON.parse(raw);}
 catch{return new Response(null,{status:400});}
 for(const report of cleanReports(body))log(JSON.stringify({type:'client-error',...report}));
 return new Response(null,{status:204});
}
