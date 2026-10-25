/* Service worker: guarda as telas para abrir rápido e recebe notificações do Firebase. */
var VERSAO = 'giraosol-1.0.0';
var ARQUIVOS = ['./', 'index.html', 'config.js?v=1.0.0', 'css/app.css?v=1.0.0', 'js/nucleo.js?v=1.0.0', 'js/conta.js?v=1.0.0', 'js/agenda.js?v=1.0.0', 'js/pacientes.js?v=1.0.0',
  'js/presenca.js?v=1.0.0', 'js/financeiro.js?v=1.0.0', 'js/pagar.js?v=1.0.0', 'js/admin.js?v=1.0.0', 'icones/icone-192.png', 'icones/icone-512.png', 'icones/logo.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // API e fontes vão direto à rede
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(VERSAO).then(function (cc) { cc.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});

/* Notificações (Firebase Cloud Messaging) */
try {
  importScripts('config.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  var fb = (self.GIRAOSOL_CONFIG || {}).firebase;
  if (fb && fb.apiKey) { firebase.initializeApp(fb); firebase.messaging(); }
} catch (e) { /* sem notificações */ }
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var link = (e.notification.data && (e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.notification && e.notification.data.FCM_MSG.notification.click_action)) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (cs) { for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) return cs[i].focus(); return self.clients.openWindow(link); }));
});
