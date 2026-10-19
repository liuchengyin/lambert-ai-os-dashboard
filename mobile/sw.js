const CACHE='lambert-mobile-v4';
const FILES=['./','./index.html','./style.css','./store.js','./app.js','./task-model.js','./task-details.js','./task-details.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||!new URL(e.request.url).pathname.startsWith('/mobile/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return r}).catch(()=>caches.match(e.request).then(r=>r||Response.error())))});
