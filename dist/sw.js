const CACHE='banmeaw-offline-v1';
const OFFLINE='/offline.html';
// Cache only the public offline screen and icon. Account data and application code stay on the network.
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll([OFFLINE,'/cat-icon-192.png']);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('banmeaw-offline-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||request.mode!=='navigate'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{try{return await fetch(request);}catch{const cache=await caches.open(CACHE);return await cache.match(OFFLINE)||new Response('Connect to the internet to open BanMeaw.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
});
