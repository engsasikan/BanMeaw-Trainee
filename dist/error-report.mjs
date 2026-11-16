// Sends errors that happen in the browser to the server log (/api/client-errors), so problems people hit on their
// phones can be found later. Loaded before the app so errors while it starts are caught too.
// It sends what helps find the bug (message, file and line, page, app version, member id), never form contents.
const MAX_PER_PAGE=10;
const seen=new Set();let queue=[],timer=null,sentCount=0;
const appVersion=()=>document.querySelector('script[src*="/app.js"]')?.getAttribute('src')?.match(/v=(\d+)/)?.[1]??'';
const currentView=()=>document.querySelector('[data-view][aria-pressed="true"]')?.dataset.view??'';
// Errors that are not ours or say nothing: browser extensions, cross-origin scripts, a harmless resize warning,
// cancelled requests and lost connections.
export function ignored({message='',source=''}){
 return /^Script error\.?$/i.test(message)||/ResizeObserver loop/i.test(message)||/AbortError|The user aborted/i.test(message)
  // A lost connection is expected in a gym and handled by the app (offline saving); it is not a bug.
  ||/Failed to fetch|Load failed|NetworkError when attempting/i.test(message)
  ||/^(chrome|moz|safari(-web)?)-extension:/i.test(source)||/^(chrome|moz|safari(-web)?)-extension:/i.test(message);
}
export function report(details){
 if(ignored(details)||sentCount+queue.length>=MAX_PER_PAGE)return;
 const key=details.kind+'|'+details.message+'|'+(details.source??'')+'|'+(details.line??'');
 if(seen.has(key))return;seen.add(key);
 queue.push({...details,path:location.pathname,view:currentView(),app:appVersion(),member:globalThis.__banmeawMember??'',userAgent:navigator.userAgent,at:new Date().toISOString()});
 clearTimeout(timer);timer=setTimeout(send,2000);
}
function send(){
 const reports=queue.splice(0);if(!reports.length)return;sentCount+=reports.length;
 try{fetch('/api/client-errors',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({reports})}).catch(()=>{});}catch{}
}
// Script errors, and our own scripts or styles that failed to load (seen only in the capture phase).
if(typeof window!=='undefined'){
addEventListener('error',event=>{
 const target=event.target;
 if(target&&target!==window&&(target.tagName==='SCRIPT'||target.tagName==='LINK')){
  const url=target.src||target.href||'';
  if(url.startsWith(location.origin))report({kind:'resource',message:'โหลดไฟล์ไม่สำเร็จ: '+url.replace(location.origin,'').split('?')[0],source:url});
  return;
 }
 report({kind:'error',message:String(event.message||event.error?.message||'error'),stack:String(event.error?.stack??''),source:event.filename||'',line:event.lineno,column:event.colno});
},true);
addEventListener('unhandledrejection',event=>{
 const reason=event.reason;
 report({kind:'rejection',message:String(reason?.message??reason??'rejection'),stack:String(reason?.stack??'')});
});
// Leaving the page: send whatever is still waiting.
addEventListener('pagehide',send);
}
