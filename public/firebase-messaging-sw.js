// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Since this is a service worker, it cannot access Vite's import.meta.env seamlessly.
// We must either hardcode the config (safest for generic SWs) or use a URL parameter 
// injection technique. For simplicity, we initialize with minimal config here.
// You should update this with your actual production config string to work properly.

const firebaseConfig = {
    apiKey: "REPLACE_WITH_ACTUAL_API_KEY",
    authDomain: "REPLACE_WITH_ACTUAL_AUTH_DOMAIN",
    projectId: "REPLACE_WITH_ACTUAL_PROJECT_ID",
    storageBucket: "REPLACE_WITH_ACTUAL_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_WITH_ACTUAL_MESSAGING_SENDER_ID",
    appId: "REPLACE_WITH_ACTUAL_APP_ID"
};

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
try {
    firebase.initializeApp(firebaseConfig);

    // Retrieve an instance of Firebase Messaging so that it can handle background
    // messages.
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        // Customize notification here
        const notificationTitle = payload.notification?.title || 'Hazina Update';
        const notificationOptions = {
            body: payload.notification?.body || 'You have a new message.',
            icon: '/pwa-192x192.png',
            badge: '/mask-icon.svg',
            data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (e) {
    console.log("Failed to initialize Firebase SW targeting backgrounds", e);
}
