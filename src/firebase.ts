// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";

// Configuração do Firebase com variáveis de ambiente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth
const auth = getAuth(app);

// Função de logout
export function logout() {
  return signOut(auth);
}

// Outras exports necessárias? Adicione aqui.

export default firebaseConfig;
