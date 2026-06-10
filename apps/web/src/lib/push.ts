import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging, isFirebaseConfigured } from './firebase';
import { apiClient } from './api';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function requestPushPermission(): Promise<boolean> {
  if (!isFirebaseConfigured() || !VAPID_KEY) return false;
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const messaging = getFirebaseMessaging();
    if (!messaging) return false;

    const swReg = await registerServiceWorker();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return false;

    await apiClient.patch('users/fcm-token', { json: { token } });
    return true;
  } catch {
    return false;
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const sw = reg.installing ?? reg.waiting ?? reg.active;
  sw?.postMessage({ type: 'FIREBASE_CONFIG', config });
  return reg;
}
