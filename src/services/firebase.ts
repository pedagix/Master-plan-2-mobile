import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (error) {
    console.warn('Firestore offline persistence unavailable. Falling back to in-memory cache.', error);
    db = getFirestore(app);
  }
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();

export { auth, db };

export function signInWithGoogle() {
  if (!auth) return Promise.reject(new Error('Firebase is not configured.'));
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

export function listenToAuthState(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loadUserData(uid: string) {
  if (!db) throw new Error('Firebase is not configured.');

  const [projectsSnap, notesSnap, suggestionsSnap, gallerySnap] = await Promise.all([
    getDocs(collection(db, `users/${uid}/projects`)),
    getDocs(collection(db, `users/${uid}/notes`)),
    getDocs(collection(db, `users/${uid}/suggestions`)),
    getDocs(collection(db, `users/${uid}/galleryImages`)),
  ]);

  const projects = projectsSnap.docs.map((d) => d.data());
  const captures = notesSnap.docs.map((d) => d.data());
  const suggestions = suggestionsSnap.docs.map((d) => d.data());
  const galleryImages = gallerySnap.docs.map((d) => d.data());

  const galleryByProject = new Map();
  for (const image of galleryImages) {
    if (!image.projectId) continue;
    const current = galleryByProject.get(image.projectId) ?? [];
    current.push(image);
    galleryByProject.set(image.projectId, current);
  }

  return {
    projects: projects.map((project) => ({
      ...project,
      notes: Array.isArray(project.notes) ? project.notes : [],
      gallery: galleryByProject.get(project.id) ?? (Array.isArray(project.gallery) ? project.gallery : []),
    })),
    captures,
    suggestions,
  };
}

export async function saveUserData(uid: string, data: any) {
  if (!db) throw new Error('Firebase is not configured.');

  const batchWrites = [];
  for (const project of data.projects ?? []) {
    batchWrites.push(setDoc(doc(db, `users/${uid}/projects/${project.id}`), project));
    for (const image of project.gallery ?? []) {
      const imageId = image.id ?? crypto.randomUUID();
      batchWrites.push(setDoc(doc(db, `users/${uid}/galleryImages/${imageId}`), { ...image, id: imageId, projectId: project.id }));
    }
  }

  for (const capture of data.captures ?? []) {
    batchWrites.push(setDoc(doc(db, `users/${uid}/notes/${capture.id}`), capture));
  }

  for (const suggestion of data.suggestions ?? []) {
    batchWrites.push(setDoc(doc(db, `users/${uid}/suggestions/${suggestion.id}`), suggestion));
  }

  await Promise.all(batchWrites);
}
