import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)"
};

const requiredFirebaseEnv = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
] as const;

const firebaseEnvVarNameByKey: Record<(typeof requiredFirebaseEnv)[number], string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID'
};

export const missingFirebaseEnvVars = requiredFirebaseEnv.filter((key) => !firebaseConfig[key]);
export const missingFirebaseEnvNames = missingFirebaseEnvVars.map(
  (key) => firebaseEnvVarNameByKey[key]
);
export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

if (!isFirebaseConfigured) {
  console.error(
    `[Firebase] Missing required env vars: ${missingFirebaseEnvNames.join(', ')}`
  );
}

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const authInstance = app ? getAuth(app) : null;
const dbInstance = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;
const googleProviderInstance = app ? new GoogleAuthProvider() : null;

export const auth = authInstance as ReturnType<typeof getAuth>;
export const db = dbInstance as ReturnType<typeof getFirestore>;
export const googleProvider = googleProviderInstance as GoogleAuthProvider;

// Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Helpers
const syncUserDoc = async (user: User) => {
  if (!isFirebaseConfigured) return;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    const adminEmails = [
      import.meta.env.VITE_ADMIN_EMAIL,
      "admin@teste.com"
    ];
    const isAdmin = adminEmails.includes(user.email);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0],
      photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`,
      role: isAdmin ? 'admin' : 'user',
      createdAt: new Date().toISOString()
    });
  }
};

export const signInWithGoogle = async () => {
  if (!isFirebaseConfigured || !authInstance || !googleProviderInstance) {
    throw new Error(`Firebase não configurado. Defina: ${missingFirebaseEnvNames.join(', ')}`);
  }
  try {
    const result = await signInWithPopup(authInstance, googleProviderInstance);
    await syncUserDoc(result.user);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  if (!isFirebaseConfigured || !authInstance) {
    throw new Error(`Firebase não configurado. Defina: ${missingFirebaseEnvNames.join(', ')}`);
  }
  try {
    const result = await signInWithEmailAndPassword(authInstance, email, pass);
    await syncUserDoc(result.user);
    return result.user;
  } catch (error: any) {
    // If user doesn't exist, try to create it for the requested test accounts
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
      if (email === 'admin@teste.com' || email === 'usuario@teste.com') {
        try {
          const result = await createUserWithEmailAndPassword(authInstance, email, pass);
          await syncUserDoc(result.user);
          return result.user;
        } catch (createError) {
          throw createError;
        }
      }
    }
    throw error;
  }
};

export const logout = () => {
  if (!authInstance) return Promise.resolve();
  return signOut(authInstance);
};

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
if (isFirebaseConfigured) {
  testConnection();
}
