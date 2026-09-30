// ═══════════════════════════════════════════════════
// AUTO VERSION — ប្តូររាល់ពេល Deploy
// ═══════════════════════════════════════════════════
const BUILD_VERSION = '20260930-011'; // ← ប្ដូររាល់ពេល Deploy

const CACHE_NAME = `case-manager-${BUILD_VERSION}`;
const RUNTIME_CACHE = `case-manager-runtime-${BUILD_VERSION}`;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// ═══════════════════════════════════════════════════
// INSTALL — Cache assets & skipWaiting
// ═══════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('🔧 SW Installing...', BUILD_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => {
      console.log('✅ SW Installed');
      return self.skipWaiting();
    })
  );
});

// ═══════════════════════════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('🔄 SW Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map((k) => {
            console.log('🗑️ Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    }).then(() => {
      console.log('✅ SW Activated');
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════════════════════════
// FETCH — Network First for HTML, Cache First for assets
// ═══════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' || 
                 url.pathname.endsWith('.html') || 
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');
  
  // ⭐ HTML → Network First (បង្ហាញកូដថ្មីភ្លាមៗ)
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, copy).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then(cached => 
            cached || caches.match('./index.html')
          );
        })
    );
    return;
  }
  
  // ⭐ CSS, JS, Images, Fonts → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Update in background
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(event.request, response.clone()).catch(() => {});
            });
          }
        }).catch(() => {});
        return cached;
      }
      
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(event.request, copy).catch(() => {});
        });
        
        return response;
      }).catch(() => {
        return new Response('គ្មានការតភ្ជាប់អ៊ីនធឺណិត', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

// ═══════════════════════════════════════════════════
// MESSAGE — Skip waiting
// ═══════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('⚡ Skip Waiting');
    self.skipWaiting();
  }
});

console.log('✅ SW Loaded:', BUILD_VERSION);
