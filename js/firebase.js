// =====================================================
// js/firebase.js — Firebase Initialization
// =====================================================
// IMPORTANT: Replace the placeholder values below with
// your actual Firebase project credentials.
// Get them from: Firebase Console → Project Settings → General
// =====================================================

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_AUTH_DOMAIN",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Initialize Firestore database
const db = firebase.firestore();

// Export db so other scripts can use it
// (Since we're using compat SDK in plain HTML, `db` is a global variable)
