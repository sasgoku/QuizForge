// =====================================================
// js/firebase.js — Firebase Initialization
// =====================================================
// IMPORTANT: Replace the placeholder values below with
// your actual Firebase project credentials.
// Get them from: Firebase Console → Project Settings → General
// =====================================================

const firebaseConfig = {  
  apiKey: "AIzaSyBNZ1Vt2iks_jARL1VQS8Em8zQyo8apK4I",
  authDomain: "quizforge-d1f34.firebaseapp.com",
  projectId: "quizforge-d1f34",
  storageBucket: "quizforge-d1f34.firebasestorage.app",
  messagingSenderId: "120187779640",
  appId: "1:120187779640:web:12ad321be5bb9fa7bd44cd"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Initialize Firestore database
const db = firebase.firestore();

// Export db so other scripts can use it
// (Since we're using compat SDK in plain HTML, `db` is a global variable)
