import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  databaseURL: String(import.meta.env.VITE_FIREBASE_DATABASE_URL || '').trim(),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const requiredAuthKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const missingRequiredAuthKeys = requiredAuthKeys.filter((key) => !firebaseConfig[key]);
const missingOptionalKeys = missingKeys.filter((key) => !requiredAuthKeys.includes(key as (typeof requiredAuthKeys)[number]));
const isFirebaseConfigured = missingRequiredAuthKeys.length === 0;

if (missingRequiredAuthKeys.length > 0) {
  console.warn(
    `[Firebase] Missing required auth env keys: ${missingRequiredAuthKeys.join(', ')}. ` +
      'Set VITE_FIREBASE_* values in .env.'
  );
} else if (missingOptionalKeys.length > 0) {
  console.warn(
    `[Firebase] Missing optional env keys: ${missingOptionalKeys.join(', ')}. ` +
      'Auth is enabled, but set VITE_FIREBASE_* values in .env for full Firebase functionality.'
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { auth };
export const hasFirebaseAuth = isFirebaseConfigured;

export default app;
