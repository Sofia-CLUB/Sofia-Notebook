const CACHE_NAME="sofia-notebook-v27";
const CORE=["./","./index.html","./style.css","./script.js","./sofia-logo.jpg","./icon-192.png","./icon-512.png","./manifest.webmanifest"];
const CDN="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js";
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);await cache.addAll(CORE);
  try{const r=await fetch(CDN);if(r.ok)await cache.put(CDN,r.clone())}catch(e){}
  self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==CACHE_NAME)await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);if(cached)return cached;
    try{const fresh=await fetch(event.request);const cache=await caches.open(CACHE_NAME);cache.put(event.request,fresh.clone());return fresh}
    catch(e){if(event.request.mode==="navigate")return await caches.match("./index.html");throw e}
  })());
});