// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuração principal do Firebase (do seu projeto SunControl)
const firebaseConfig = {
    apiKey: "AIzaSyA0UFqsNRUGVwDpYcwduab8WaxoVrMxiBA",
    authDomain: "suncontrol-d2d94.firebaseapp.com",
    projectId: "suncontrol-d2d94",
    storageBucket: "suncontrol-d2d94.appspot.com",
    messagingSenderId: "434845455719",
    appId: "1:434845455719:web:06cb665d1274c973f4cbc2"
};

// Inicializa e exporta os serviços do Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
