// firebase.js - Inicialización de Firebase v12 con CDN oficial de Google (Compatible con Vite y GitHub Pages)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup, 
  signInWithRedirect,
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  PhoneAuthProvider
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  increment,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Configuración de producción de Firebase para MathQuest
const firebaseConfig = {
  apiKey: "AIzaSyDM5t9pE01V2NLffizh8mD-nw5WR47yNYI",
  authDomain: "mathquest-66689.firebaseapp.com",
  projectId: "mathquest-66689",
  storageBucket: "mathquest-66689.firebasestorage.app",
  messagingSenderId: "837717330602",
  appId: "1:837717330602:web:951a202cf96d5ce0f95ed3",
  measurementId: "G-WTTSP5340Z"
};

// 1. Inicialización de la App de Firebase (Singleton)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2. Google Analytics (con captura segura de errores en entornos offline/iframes)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Ignorar analytics si no está disponible en iframe o modo local
}
export { analytics };

// 3. Firebase Authentication
export const auth = getAuth(app);

// Proveedor de Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Proveedor de Apple
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// 4. Cloud Firestore
export const db = getFirestore(app);

// 5. Re-exportación de utilidades modulares de Auth y Firestore
export {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  PhoneAuthProvider,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  increment,
  runTransaction,
  serverTimestamp
};

console.log("Firebase de MATHQUEST iniciado con éxito en proyecto:", firebaseConfig.projectId);
