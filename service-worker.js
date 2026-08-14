const CACHE_NAME="sofia-notebook-v30";
const CORE=[
  "./",
  "./index.html",
  "./style.css?v=30",
  "./script.js?v=30",
  "./controls-v30.js?v=30",
  "./sofia-logo.jpg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest?v=30"
];
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  for(const url of CORE){
    try{const r=await fetch(url,{cache:"reload"});if(r.ok)await cache.put(url,r.clone())}catch(e){}
  }
  self.skipWaiting();
})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==CACHE_NAME)await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const u=new URL(event.request.url);
  const core=event.request.mode==="navigate" ||
    /\/(index\.html|style\.css|script\.js|controls-v30\.js|manifest\.webmanifest)$/.test(u.pathname);
  event.respondWith((async()=>{
    if(core){
      try{
        const r=await fetch(event.request,{cache:"no-store"});
        if(r.ok)(await caches.open(CACHE_NAME)).put(event.request,r.clone());
        return r;
      }catch(e){return (await caches.match(event.request)) || (await caches.match("./index.html"));}
    }
    const c=await caches.match(event.request);if(c)return c;
    try{
      const r=await fetch(event.request);
      if(r.ok)(await caches.open(CACHE_NAME)).put(event.request,r.clone());
      return r;
    }catch(e){return Response.error();}
  })());
});