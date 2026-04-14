// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase (usando variáveis de ambiente)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login com Google
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

// Login com Email/Senha
export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Handler de erro para Firestore
export function handleFirestoreError(error: any) {
  console.error("Firestore error:", error);
  return error?.message || "Ocorreu um erro ao acessar o Firestore.";
}

// Tipo OperationType
export type OperationType = "create" | "read" | "update" | "delete";

// Exporta auth e db para uso em outros arquivos
export { auth, db };

// Exporte default, se necessário
export default firebaseConfig;
