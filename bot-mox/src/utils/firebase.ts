import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyB8z0FzW3-1Q0ZzZzZzZzZzZzZzZzZzZzZ",
  authDomain: "botfarm-d69b7.firebaseapp.com",
  databaseURL: "https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "botfarm-d69b7",
  storageBucket: "botfarm-d69b7.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

export default app;