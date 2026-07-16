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

self.addEventListener('push', function(event){
  event.waitUntil((async function(){
    let data = {};
    try { data = event.data ? event.data.json() : {}; }
    catch (e) { data = { title: 'Jarvis', body: event.data ? event.data.text() : '' }; }

    // Pas de notification si l'utilisateur regarde deja la discussion
    // (evite le doublon : le message arrive de toute facon par le rafraichissement de l'app)
    // ⚠️ NE PAS exiger client.focused : Safari/WebKit ne le rapporte pas de façon fiable
    // (souvent false même app au premier plan) → on se fie a visibilityState seul.
    // ⚠️ NE PAS se fier QU'A clients.matchAll : sur iOS le SW tourne dans un contexte
    // separe et ne voit pas toujours la fenetre ouverte -> on croise avec un "ping" recent
    // pose par la page elle-meme dans IndexedDB (voir index.html, pingVisible()).
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const dejaViaClients = list.some(function(c){ return c.visibilityState === 'visible'; });
    const lastVisibleAt = await getLastVisibleAt();
    const dejaViaPing = (Date.now() - lastVisibleAt) < 6000;
    if (dejaViaClients || dejaViaPing) return;

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
