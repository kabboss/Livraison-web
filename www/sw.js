// Service Worker optimisé pour SEND 2.0
const CACHE_VERSION = 'v2';
const CACHE_NAME = `send-2.0-cache-${CACHE_VERSION}`;
const API_CACHE_NAME = `send-2.0-api-cache-${CACHE_VERSION}`;

// Fichiers à mettre en cache
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/client.html',
  '/expediteur.html',
  '/suivi.html',
  '/Connection.html',
  '/img/ChatGPT Image 30 avr. 2025, 20_34_02.png',
  '/img/moto.png',
  '/img/Monument des martyrs.jpg',
  '/img/ib.jpg',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Stratégie de cache
const CACHE_STRATEGY = {
  STATIC: 'networkFirst',
  API: 'staleWhileRevalidate',
  IMAGES: 'cacheFirst'
};

// État global du mode livreur
let deliveryModeActive = false;
let deliveryModeChecked = false;

// Installation et mise en cache
self.addEventListener('install', (event) => {
  console.log('[SW] Installation en cours');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des ressources statiques');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Nettoyage du cache lors de l'activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
          console.log(`[SW] Suppression ancien cache: ${key}`);
          return caches.delete(key);
        }
      })
    ))
    .then(() => {
      // Demander l'état du mode livreur dès l'activation
      return syncDeliveryModeStatus();
    })
    .then(() => self.clients.claim())
  );
});

// Gestion des requêtes réseau
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorer les requêtes non-GET et les extensions
  if (event.request.method !== 'GET') return;
  
  // Stratégie pour les API
  if (url.pathname.startsWith('/.netlify/functions')) {
    return handleApiRequest(event);
  }
  
  // Stratégie pour les images
  if (url.pathname.startsWith('/img/')) {
    return handleImageRequest(event);
  }
  
  // Stratégie par défaut pour les ressources statiques
  return handleStaticRequest(event);
});

// Gestion des messages
self.addEventListener('message', (event) => {
  const { type, enabled, clientId } = event.data;
  
  switch (type) {
    case 'DELIVERY_MODE_UPDATE':
      handleDeliveryModeUpdate(enabled, clientId);
      break;
      
    case 'DELIVERY_MODE_REQUEST':
      respondToDeliveryModeRequest(event);
      break;
      
    case 'SYNC_REQUEST':
      syncWithClient(event);
      break;
  }
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('[SW] Notification push reçue');
  
  event.waitUntil(
    verifyDeliveryModeActive().then(isActive => {
      if (!isActive) {
        console.log('[SW] Mode livreur inactif - Notification ignorée');
        return;
      }
      
      const data = event.data.json();
      return showOrderNotification(data);
    })
  );
});

// Gestion des clics sur notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    verifyDeliveryModeActive().then(isActive => {
      if (!isActive) return;
      
      const url = event.notification.data?.url || '/Connection.html';
      return clients.openWindow(url);
    })
  );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-orders') {
    console.log('[SW] Synchronisation des commandes');
    event.waitUntil(
      verifyDeliveryModeActive().then(isActive => {
        if (!isActive) return;
        return checkNewOrders();
      })
    );
  }
});

// --- Fonctions utilitaires ---

async function handleApiRequest(event) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Essayez d'abord le réseau
    const response = await fetch(event.request);
    
    // Mettez à jour le cache
    cache.put(event.request, response.clone());
    return response;
  } catch (error) {
    // Fallback au cache si hors ligne
    const cached = await cache.match(event.request);
    return cached || Response.error();
  }
}

async function handleImageRequest(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  
  if (cached) return cached;
  
  try {
    const response = await fetch(event.request);
    cache.put(event.request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function handleStaticRequest(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  
  // Renvoyer le cache si disponible
  if (cached) return cached;
  
  // Sinon essayer le réseau
  try {
    const response = await fetch(event.request);
    cache.put(event.request, response.clone());
    return response;
  } catch {
    // Fallback pour la page d'accueil en cas d'échec
    if (event.request.mode === 'navigate') {
      return cache.match('/');
    }
    return Response.error();
  }
}

async function syncDeliveryModeStatus() {
  const clients = await self.clients.matchAll();
  if (clients.length === 0) return false;
  
  return new Promise(resolve => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = ({ data }) => {
      deliveryModeActive = data.enabled;
      deliveryModeChecked = true;
      resolve(data.enabled);
    };
    
    clients[0].postMessage({
      type: 'DELIVERY_MODE_REQUEST'
    }, [channel.port2]);
  });
}

function handleDeliveryModeUpdate(enabled, clientId) {
  deliveryModeActive = enabled;
  deliveryModeChecked = true;
  
  // Propager le changement à tous les clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      if (client.id !== clientId) {
        client.postMessage({
          type: 'DELIVERY_MODE_UPDATE',
          enabled
        });
      }
    });
  });
  
  // Annuler les notifications si désactivé
  if (!enabled) {
    self.registration.getNotifications({ tag: 'new-order' })
      .then(notifications => {
        notifications.forEach(n => n.close());
      });
  }
}

function respondToDeliveryModeRequest(event) {
  if (event.ports && event.ports.length > 0) {
    event.ports[0].postMessage({
      type: 'DELIVERY_MODE_RESPONSE',
      enabled: deliveryModeActive
    });
  }
}

async function verifyDeliveryModeActive() {
  if (!deliveryModeChecked) {
    await syncDeliveryModeStatus();
  }
  return deliveryModeActive;
}

async function showOrderNotification(data) {
  const options = {
    body: data.message || 'Nouvelle commande disponible',
    icon: '/img/ChatGPT Image 30 avr. 2025, 20_34_02.png',
    badge: '/img/moto.png',
    tag: 'new-order',
    data: {
      url: '/Connection.html',
      orderId: data.orderId
    },
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'Voir',
        icon: '/img/moto.png'
      },
      {
        action: 'later',
        title: 'Plus tard',
        icon: '/img/moto.png'
      }
    ]
  };
  
  await self.registration.showNotification(data.title || 'Nouvelle commande', options);
}

async function checkNewOrders() {
  try {
    const response = await fetch('/.netlify/functions/check-new-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastCheckTime: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      })
    });
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    if (data.hasNewOrders) {
      return showOrderNotification({
        title: `Nouvelle${data.newOrdersCount > 1 ? 's' : ''} commande${data.newOrdersCount > 1 ? 's' : ''}`,
        message: `${data.newOrdersCount} commande${data.newOrdersCount > 1 ? 's' : ''} disponible${data.newOrdersCount > 1 ? 's' : ''}`,
        orderId: data.orderIds?.[0]
      });
    }
  } catch (error) {
    console.error('[SW] Erreur vérification commandes:', error);
  }
}

function syncWithClient(event) {
  if (event.ports && event.ports.length > 0) {
    event.ports[0].postMessage({
      type: 'SYNC_RESPONSE',
      deliveryModeActive,
      cacheStatus: 'ready'
    });
  }
}

console.log('[SW] Service Worker initialisé');