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
  setDoc,
  writeBatch
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

  const [projectsSnap, notesSnap, suggestionsSnap, gallerySnap] = await Promise.all([
    getDocs(collection(db, `users/${uid}/projects`)),
    getDocs(collection(db, `users/${uid}/notes`)),
    getDocs(collection(db, `users/${uid}/suggestions`)),
    getDocs(collection(db, `users/${uid}/galleryImages`)),
  ]);

  const projectIds = new Set((data.projects ?? []).map((project) => project.id));
  const captureIds = new Set((data.captures ?? []).map((capture) => capture.id));
  const suggestionIds = new Set((data.suggestions ?? []).map((suggestion) => suggestion.id));
  const galleryImages = (data.projects ?? []).flatMap((project) => (project.gallery ?? []).map((image) => ({ ...image, id: image.id ?? crypto.randomUUID(), projectId: project.id })));
  const galleryImageIds = new Set(galleryImages.map((image) => image.id));

  const batch = writeBatch(db);
  for (const project of data.projects ?? []) {
    batch.set(doc(db, `users/${uid}/projects/${project.id}`), project);
  }
  for (const capture of data.captures ?? []) {
    batch.set(doc(db, `users/${uid}/notes/${capture.id}`), capture);
  }
  for (const suggestion of data.suggestions ?? []) {
    batch.set(doc(db, `users/${uid}/suggestions/${suggestion.id}`), suggestion);
  }
  for (const image of galleryImages) {
    batch.set(doc(db, `users/${uid}/galleryImages/${image.id}`), image);
  }

  for (const snapshot of projectsSnap.docs) {
    if (!projectIds.has(snapshot.id)) batch.delete(snapshot.ref);
  }
  for (const snapshot of notesSnap.docs) {
    if (!captureIds.has(snapshot.id)) batch.delete(snapshot.ref);
  }
  for (const snapshot of suggestionsSnap.docs) {
    if (!suggestionIds.has(snapshot.id)) batch.delete(snapshot.ref);
  }
  for (const snapshot of gallerySnap.docs) {
    if (!galleryImageIds.has(snapshot.id)) batch.delete(snapshot.ref);
  }

  await batch.commit();
}
