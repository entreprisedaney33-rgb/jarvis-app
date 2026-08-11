self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(clients.claim()); });

function getLastVisibleAt(){
  return new Promise(function(resolve){
    try {
      var open = indexedDB.open('jarvis', 1);
      open.onupgradeneeded = function(){ try { open.result.createObjectStore('kv'); } catch(e){} };
      open.onsuccess = function(){
        try {
          var tx = open.result.transaction('kv','readonly');
          var req = tx.objectStore('kv').get('lastVisibleAt');
          req.onsuccess = function(){ resolve(req.result || 0); };
          req.onerror = function(){ resolve(0); };
        } catch(e){ resolve(0); }
      };
      open.onerror = function(){ resolve(0); };
    } catch(e){ resolve(0); }
  });
}

// Badge icone -- volet Service Worker (2026-08-11). Le volet page (updateAppBadgeTotal,
// index.html) existait deja depuis le 10/08 mais ne peut agir QUE app ouverte au premier
// plan -- exactement l'inverse du besoin ("je reçois des notifications mais pas le petit 1"
// sur l'icone, app fermee). Seul le Service Worker tourne encore a ce moment-la. Compteur
// persiste dans IndexedDB (meme base "jarvis"/"kv" que lastVisibleAt) pour survivre entre
// reveils du SW ; remis a 0 par la page elle-meme des qu'elle redevient visible (pingVisible).
function getBadgeCount(){
  return new Promise(function(resolve){
    try {
      var open = indexedDB.open('jarvis', 1);
      open.onupgradeneeded = function(){ try { open.result.createObjectStore('kv'); } catch(e){} };
      open.onsuccess = function(){
        try {
          var tx = open.result.transaction('kv','readonly');
          var req = tx.objectStore('kv').get('badgeCount');
          req.onsuccess = function(){ resolve(req.result || 0); };
          req.onerror = function(){ resolve(0); };
        } catch(e){ resolve(0); }
      };
      open.onerror = function(){ resolve(0); };
    } catch(e){ resolve(0); }
  });
}
function setBadgeCount(n){
  return new Promise(function(resolve){
    try {
      var open = indexedDB.open('jarvis', 1);
      open.onupgradeneeded = function(){ try { open.result.createObjectStore('kv'); } catch(e){} };
      open.onsuccess = function(){
        try {
          var tx = open.result.transaction('kv','readwrite');
          tx.objectStore('kv').put(n, 'badgeCount');
          tx.oncomplete = function(){ resolve(); };
          tx.onerror = function(){ resolve(); };
        } catch(e){ resolve(); }
      };
      open.onerror = function(){ resolve(); };
    } catch(e){ resolve(); }
  });
}

self.addEventListener('push', function(event){
  event.waitUntil((async function(){
    let data = {};
    try { data = event.data ? event.data.json() : {}; }
    catch (e) { data = { title: 'Jarvis', body: event.data ? event.data.text() : '' }; }

    // Previent toute page deja ouverte pour qu'elle aille chercher le nouveau contenu
    // tout de suite (remplace le besoin d'interroger le serveur en boucle : la page ne
    // verifie plus que quand on la previent qu'il y a du nouveau).
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { try { c.postMessage({ type: 'jarvis-push-refresh' }); } catch(e){} }

    // Pas de notification si l'utilisateur regarde deja la discussion
    // (evite le doublon : le message vient d'etre pousse a la page ci-dessus)
    // ⚠️ NE PAS exiger client.focused : Safari/WebKit ne le rapporte pas de façon fiable
    // (souvent false même app au premier plan) → on se fie a visibilityState seul.
    // ⚠️ NE PAS se fier QU'A clients.matchAll : sur iOS le SW tourne dans un contexte
    // separe et ne voit pas toujours la fenetre ouverte -> on croise avec un "ping" recent
    // pose par la page elle-meme dans IndexedDB (voir index.html, pingVisible()).
    const dejaViaClients = list.some(function(c){ return c.visibilityState === 'visible'; });
    const lastVisibleAt = await getLastVisibleAt();
    const dejaViaPing = (Date.now() - lastVisibleAt) < 6000;
    if (dejaViaClients || dejaViaPing) return;

    // Badge icone : incremente le compteur persiste et l'applique -- seulement ici, dans
    // le meme cas ou la notification elle-meme s'affiche (app deja ouverte = rien a faire,
    // le badge sera remis a jour par la page via updateAppBadgeTotal/pingVisible).
    if ('setAppBadge' in self.registration) {
      try {
        const n = (await getBadgeCount()) + 1;
        await setBadgeCount(n);
        await self.registration.setAppBadge(n);
      } catch (e) {}
    }

    const title = data.title || 'Jarvis';
    const options = {
      body: data.body || '',
      icon: './icon-512.png',
      badge: './icon-512.png',
      tag: 'jarvis-notif',
      renotify: true
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
