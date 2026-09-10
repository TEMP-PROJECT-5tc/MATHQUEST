// firebase.js - Inicialización de Firebase con CDN oficial de Google (Compatible con GitHub Pages y Vite)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDM5t9pE01V2NLffizh8mD-nw5WR47yNYI",
  authDomain: "mathquest-66689.firebaseapp.com",
  projectId: "mathquest-66689",
  storageBucket: "mathquest-66689.firebasestorage.app",
  messagingSenderId: "837717330602",
  appId: "1:837717330602:web:951a202cf96d5ce0f95ed3",
  measurementId: "G-WTTSP5340Z"
};

// Inicializar Firebase
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // Entorno seguro si Analytics no está soportado en iframe/offline
}
export { analytics };

// Auth & Proveedor de Google
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Base de Datos Firestore
export const db = getFirestore(app);

// Re-exportar utilidades
export {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc
};

console.log("Firebase de MATHQUEST iniciado con éxito:", firebaseConfig.projectId);
