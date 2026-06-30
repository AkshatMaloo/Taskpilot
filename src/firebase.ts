/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLs7i5mvUhBOCppmwjXDM4LsvRm51pqv4",
  authDomain: "gen-lang-client-0362676723.firebaseapp.com",
  projectId: "gen-lang-client-0362676723",
  storageBucket: "gen-lang-client-0362676723.firebasestorage.app",
  messagingSenderId: "1098025051999",
  appId: "1:1098025051999:web:aea4ff1e6d4c84ea93f8ea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID
export const db = getFirestore(app, "ai-studio-a825048b-baf7-415b-aa33-9866ce7c97a0");

// Initialize Authentication
export const auth = getAuth(app);

// Google Auth Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Trigger Google Sign-In with a Popup
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

/**
 * Trigger Anonymous Sign-In as a Demo Pilot fallback for sandboxed iframes
 */
export async function signInDemo(): Promise<User> {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Error signing in anonymously:", error);
    throw error;
  }
}

/**
 * Logout the currently active user
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
}

/**
 * Validate the Firestore connection as per skill guidelines
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client appears to be offline. Please verify config.");
    }
  }
}

testConnection();
