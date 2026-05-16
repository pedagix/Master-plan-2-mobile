import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

function requireDb() {
  if (!db) throw new Error('Firestore is not initialized.');
  return db;
}

async function readCollection(uid, key) {
  const snap = await getDocs(collection(requireDb(), 'users', uid, key));
  return snap.docs.map((d) => d.data());
}

export async function loadUserData(uid) {
  const [projects, captures, suggestions] = await Promise.all([
    readCollection(uid, 'projects'),
    readCollection(uid, 'notes'),
    readCollection(uid, 'suggestions'),
  ]);
  return {
    projects,
    captures,
    suggestions,
  };
}

export async function saveUserData(uid, data) {
  const database = requireDb();
  const writeFullCollection = async (key, items) => {
    const colRef = collection(database, 'users', uid, key);
    const existing = await getDocs(colRef);
    const batch = writeBatch(database);
    existing.docs.forEach((d) => batch.delete(d.ref));
    items.forEach((item) => {
      const id = item.id || crypto.randomUUID();
      batch.set(doc(database, 'users', uid, key, id), { ...item, id });
    });
    await batch.commit();
  };

  await Promise.all([
    writeFullCollection('projects', data.projects || []),
    writeFullCollection('notes', data.captures || []),
    writeFullCollection('suggestions', data.suggestions || []),
  ]);

  const gallery = (data.projects || []).flatMap((p) =>
    (p.gallery || []).map((g) => ({ ...g, projectId: p.id }))
  );
  await writeFullCollection('galleryImages', gallery);
}

export async function importLocalToFirebase(uid, localData) {
  await saveUserData(uid, localData);
}
