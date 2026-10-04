import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {initInstall} from '../dist/install.mjs';
function setup({installed=false,ios=false}={}){
 const elements=Object.fromEntries(['install-dialog','install','install-app','install-status','install-native','install-title','install-guides','install-android','install-ios','close-dialog'].map(id=>[id,{open:false,hidden:false,textContent:'',showModal(){this.open=true;},close(){this.open=false;}}]));
 const win=new EventTarget(),mode={matches:installed,addEventListener(){}};win.matchMedia=()=>mode;win.isSecureContext=true;
 const registrations=[],nav={userAgent:ios?'iPhone':'Android Chrome',serviceWorker:{register:async(...args)=>{registrations.push(args);}}};initInstall({win,doc:{getElementById:id=>elements[id]},nav});return {win,elements,registrations};
}
test('Android install event is prompted only after clicking and used only once',async()=>{
 const {win,elements,registrations}=setup();let prompts=0;const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{prompts++;},userChoice:Promise.resolve({outcome:'dismissed'})});
 win.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(prompts,0);await elements.install.onclick();assert.equal(prompts,1);assert.equal(elements['install-dialog'].open,true);await elements['install-app'].onclick();assert.equal(prompts,1);assert.deepEqual(registrations[0],['/sw.js',{scope:'/',updateViaCache:'none'}]);
});
test('accepted prompt is not reported as installed until the installed event; installed apps do not prompt again',async()=>{
 const {win,elements}=setup();win.dispatchEvent(Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})}));await elements.install.onclick();assert.match(elements['install-status'].textContent,/รอไอคอน/);win.dispatchEvent(new Event('appinstalled'));assert.equal(elements.install.textContent,'แอปติดตั้งแล้ว');assert.equal(elements['install-native'].hidden,true);await elements.install.onclick();assert.equal(elements['install-guides'].hidden,true);
});
test('no native prompt, iPhone, already installed and rejected prompts retain a usable guide',async()=>{
 const android=setup();await android.elements.install.onclick();assert.equal(android.elements['install-android'].open,true);assert.equal(android.elements['install-native'].hidden,true);
 const ios=setup({ios:true});await ios.elements.install.onclick();assert.equal(ios.elements['install-ios'].open,true);assert.equal(ios.elements['install-android'].open,false);
 const app=setup({installed:true});await app.elements.install.onclick();assert.equal(app.elements['install-guides'].hidden,true);
 android.win.dispatchEvent(Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:async()=>{throw Error('unavailable');}}));await android.elements.install.onclick();assert.equal(android.elements.install.disabled,false);assert.match(android.elements['install-status'].textContent,/เมนูเบราว์เซอร์/);
});
test('manifest links installable scope and icons with correct actual dimensions',async()=>{
 const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.prefer_related_applications,false);
 for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===size+'x'+size);assert.ok(icon);const png=await readFile('dist'+icon.src);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
test('service worker never handles APIs or stores authenticated pages and serves a public screen offline',async()=>{
 const handlers={},cached=[],removed=[],fallback=new Response('offline');let requested=false,offline=false;
 const context={URL,Response,self:{location:{origin:'https://app.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({addAll:async paths=>cached.push(...paths),match:async()=>fallback}),keys:async()=>['other-app','banmeaw-offline-v0','banmeaw-offline-v1'],delete:async key=>removed.push(key)},fetch:async()=>{requested=true;if(offline)throw Error('no network');return new Response('fresh');}};
 vm.runInNewContext(await readFile('dist/sw.js','utf8'),context);let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.deepEqual(cached,['/offline.html','/cat-icon-192.png']);handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(removed,['banmeaw-offline-v0']);
 let result;for(const request of [{url:'https://app.test/api/me',method:'GET',mode:'navigate'},{url:'https://app.test/api/entries',method:'PUT',mode:'cors'},{url:'https://else.test/',method:'GET',mode:'navigate'},{url:'https://app.test/app.js',method:'GET',mode:'cors'}])handlers.fetch({request,respondWith:()=>{throw Error('must not intercept');}});assert.equal(requested,false);
 const navigation={request:{url:'https://app.test/',method:'GET',mode:'navigate'},respondWith:p=>result=p};handlers.fetch(navigation);assert.equal(await (await result).text(),'fresh');offline=true;handlers.fetch(navigation);assert.equal(await result,fallback);
});
