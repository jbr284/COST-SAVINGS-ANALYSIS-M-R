const CACHE_NAME = 'cost-savings-cache-v1.1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './JBFINANCELOGO.png',
  './icon-192x192.png',
  './icon-512x512.png'
];

// INSTALAÇÃO DO CACHE
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// ATIVAÇÃO E LIMPEZA DE CACHE ANTIGO
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Apagando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// INTERCEPTADOR DE REQUISIÇÕES (NETWORK FIRST)
self.addEventListener('fetch', event => {
  // Ignora requisições do Firebase/Firestore para não dar conflito com o banco de dados real
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebase')) {
    return;
  }

  // Estratégia: Tenta a rede primeiro (para ter sempre o código mais atual). 
  // Se falhar (offline), busca no cache.
  event.respondWith(
    fetch(event.request).then(response => {
      return caches.open(CACHE_NAME).then(cache => {
        // Atualiza o cache silenciosamente com a versão mais nova
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch(() => {
      // Se não tem internet, pega no cache
      return caches.match(event.request);
    })
  );
});
