const CACHE_NAME="sofia-notebook-v28";
const CORE=[
  "./",
  "./index.html",
  "./style.css?v=28",
  "./script.js?v=28",
  "./sofia-logo.jpg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest?v=28"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const url of CORE){
      try{
        const r=await fetch(url,{cache:"reload"});
        if(r.ok)await cache.put(url,r.clone());
      }catch(e){}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  try{
    const fresh=await fetch(request,{cache:"no-store"});
    if(fresh && fresh.ok){
      const cache=await caches.open(CACHE_NAME);
      cache.put(request,fresh.clone());
    }
    return fresh;
  }catch(e){
    return (await caches.match(request)) ||
           (request.mode==="navigate" ? await caches.match("./index.html") : Response.error());
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const fresh=await fetch(request);
  if(fresh && fresh.ok){
    const cache=await caches.open(CACHE_NAME);
    cache.put(request,fresh.clone());
  }
  return fresh;
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const isCore = sameOrigin && (
    event.request.mode==="navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/style.css") ||
    url.pathname.endsWith("/script.js") ||
    url.pathname.endsWith("/manifest.webmanifest")
  );
  event.respondWith(isCore ? networkFirst(event.request) : cacheFirst(event.request));
});
