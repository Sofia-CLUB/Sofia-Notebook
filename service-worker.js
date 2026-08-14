const CACHE_NAME = "sofia-notebook-v34";

const CORE = [
  "./",
  "./index.html",

  "./style.css",
  "./script.js",

  "./controls-v32.js",

  "./teacher-tools-v34.css",
  "./teacher-tools-v34.js",

  "./sofia-logo.jpg",
  "./icon-192.png",
  "./icon-512.png",

  "./manifest.webmanifest"
];

/* Встановлення */
self.addEventListener("install", event => {
  event.waitUntil((async () => {

    const cache = await caches.open(CACHE_NAME);

    for (const url of CORE) {
      try {
        const response = await fetch(url, {
          cache: "no-store"
        });

        if (response.ok) {
          await cache.put(url, response.clone());
        }

      } catch (error) {
        console.log("Не вдалося кешувати:", url);
      }
    }

    self.skipWaiting();

  })());
});


/* Активація */
self.addEventListener("activate", event => {
  event.waitUntil((async () => {

    const keys = await caches.keys();

    for (const key of keys) {
      if (key !== CACHE_NAME) {
        await caches.delete(key);
      }
    }

    await self.clients.claim();

  })());
});


/* Запити */
self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  const importantFile =
    event.request.mode === "navigate" ||
    /\/(index\.html|style\.css|script\.js|controls-v32\.js|teacher-tools-v34\.js|teacher-tools-v34\.css|manifest\.webmanifest)$/.test(url.pathname);


  event.respondWith((async () => {

    /* Для важливих файлів — спочатку інтернет */
    if (importantFile) {

      try {

        const response = await fetch(event.request, {
          cache: "no-store"
        });

        if (response.ok) {

          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            event.request,
            response.clone()
          );

        }

        return response;

      } catch (error) {

        return (
          await caches.match(event.request)
        ) || (
          await caches.match("./index.html")
        );

      }

    }


    /* Інші файли */
    const cached = await caches.match(event.request);

    if (cached) {
      return cached;
    }


    try {

      const response = await fetch(event.request);

      if (response.ok) {

        const cache = await caches.open(CACHE_NAME);

        await cache.put(
          event.request,
          response.clone()
        );

      }

      return response;

    } catch (error) {

      return Response.error();

    }

  })());

});
