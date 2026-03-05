import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { messaging, db } from './firebase';

// VAPID key is typically stored in environment variables. 
// For production, you should get a real key from Firebase console -> Project Settings -> Cloud Messaging.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'YOUR_PUBLIC_VAPID_KEY_HERE';

export const requestNotificationPermission = async (userId) => {
    try {
        if (!messaging) {
            console.warn("Messaging not supported or initialized.");
            return false;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log("Notification permission granted.");

            // Get the FCM token
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (currentToken) {
                console.log("FCM Token retrieved.");
                // Save token to user profile in Firestore
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    fcmToken: currentToken,
                    notificationsEnabled: true
                });
                return true;
            } else {
                console.log("No registration token available. Request permission to generate one.");
                return false;
            }
        } else {
            console.log("Unable to get permission to notify.");
            return false;
        }
    } catch (error) {
        console.error("Error retrieving notification token or permission:", error);
        return false;
    }
};

export const disableNotifications = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            fcmToken: null,
            notificationsEnabled: false
        });
        return true;
    } catch (error) {
        console.error("Error disabling notifications:", error);
        return false;
    }
}

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            console.log("New foreground message:", payload);
            resolve(payload);
        });
    });
