// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
// Si luego usas Firestore o Auth, los importarás aquí:
// import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

console.log("Firebase de MATHQUEST iniciado con éxito");