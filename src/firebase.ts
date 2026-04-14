import { initializeApp } from "firebase/app";
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function handleFirestoreError(error: any) {
  console.error("Firestore error:", error);
  return error?.message || "Ocorreu um erro ao acessar o Firestore.";
}

// ⭐️ Adicione isto:
export type OperationType = "create" | "read" | "update" | "delete";
// ou (se preferir):
// export enum OperationType { CREATE = "create", READ = "read", UPDATE = "update", DELETE = "delete" }

export { auth, db };
export default firebaseConfig;
