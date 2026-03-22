const CACHE_NAME = 'inventaris-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// Install event - caching static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                // Return cached version or fetch from network
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Update cache with fresh version
                        if (networkResponse && networkResponse.status === 200) {
                            const clone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, clone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed, return cached or offline fallback
                        return cached || new Response('Offline mode - data tersimpan lokal');
                    });

                return cached || fetchPromise;
            })
    );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-inventory') {
        event.waitUntil(syncInventoryData());
    }
});

async function syncInventoryData() {
    // Sync pending data with Google Sheets
    const pendingData = await getPendingDataFromIndexedDB();
    // Send to server...
    console.log('Syncing pending data:', pendingData);
}

// Push notification handler
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: self.location.origin
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Inventaris Update', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});