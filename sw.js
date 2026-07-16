self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(clients.claim()); });

self.addEventListener('push', function(event){
  event.waitUntil((async function(){
    let data = {};
    try { data = event.data ? event.data.json() : {}; }
    catch (e) { data = { title: 'Jarvis', body: event.data ? event.data.text() : '' }; }

    // Pas de notification si l'utilisateur regarde deja la discussion
    // (evite le doublon : le message arrive de toute facon par le rafraichissement de l'app)
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const dejaDansConversation = list.some(function(c){ return c.visibilityState === 'visible' && c.focused; });
    if (dejaDansConversation) return;

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
