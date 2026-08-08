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
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
const DEBUG_DATA_FLOW = typeof window !== 'undefined' && window.localStorage?.getItem('mp_debug_data_flow') === '1';

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

function debugDataCounts(label: string, data: any) {
  if (!DEBUG_DATA_FLOW) return;
  const payload = data || {};
  // eslint-disable-next-line no-console
  console.log(`[data-flow] ${label}`, {
    projects: Array.isArray(payload.projects) ? payload.projects.length : 0,
    captures: Array.isArray(payload.captures) ? payload.captures.length : 0,
    notes: Array.isArray(payload.notes) ? payload.notes.length : 0,
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions.length : 0,
    tasks: Array.isArray(payload.tasks) ? payload.tasks.length : 0,
    completedTasks: Array.isArray(payload.completedTasks) ? payload.completedTasks.length : 0,
    taskSessions: Array.isArray(payload.taskSessions) ? payload.taskSessions.length : 0,
    activeTask: payload.activeTask?.taskNoteId ?? null,
    checklists: Array.isArray(payload.checklists) ? payload.checklists.length : 0,
    questions: Array.isArray(payload.questions) ? payload.questions.length : 0,
    destructiveResetAt: payload.meta?.destructiveResetAt ?? null,
    lastSelectedProjectId: payload.settings?.lastSelectedProjectId ?? null,
    lastDestination: payload.settings?.lastDestination ?? null,
  });
}



const USER_CANONICAL_FIELDS = [
  'meta',
  'settings',
  'aiInstructions',
  'notes',
  'completedTasks',
  'tasks',
  'checklists',
  'questions',
  'badIdeaLog',
  'inboxActionLog',
  'questionFeedbackLog',
  'questionLearningSettings',
];

function pickCanonicalUserPayload(data: any = {}) {
  return USER_CANONICAL_FIELDS.reduce((acc: Record<string, any>, key) => {
    if (key in data) acc[key] = data[key];
    return acc;
  }, {});
}
const NOTE_COLLECTION_GROUPS = [
  'notes',
  'captures',
  'rawNotes',
  'raw_notes',
  'ahaNotes',
  'hmmNotes',
  'projectNotes',
  'archivedNotes',
  'importantNotes',
  'inboxNotes',
  'analysisNotes',
  'processedNotes',
  'aiAnalysisNotes',
  'suggestions',
  'tasks',
  'checklists',
  'questions',
  'analysisResults',
  'analysisResultGroups',
  'aiImportBatches',
  'aiExportBatches',
  'importedJsonGroups',
  'processedNoteGroups',
  'inboxGroups',
  'suggestionGroups',
  'rawNoteArchives',
  'legacyReviewGroups',
  'processorGroups',
  'groupedAnalysisOutputs',
  'analysis_results',
  'ai_import_batches',
  'ai_export_batches',
  'noteGroups',
  'reviewGroups',
];

const NOTE_FIELDS_TO_DELETE = [
  'notes',
  'rawNotes',
  'captures',
  'ahaNotes',
  'hmmNotes',
  'projectNotes',
  'archivedNotes',
  'importantNotes',
  'inboxNotes',
  'analysisNotes',
  'processedNotes',
  'aiAnalysisNotes',
  'suggestions',
  'tasks',
  'checklists',
  'questions',
  'completedTasks',
  'analysisResults',
  'analysisResultGroups',
  'aiImportBatches',
  'aiExportBatches',
  'importedJsonGroups',
  'processedNoteGroups',
  'inboxGroups',
  'suggestionGroups',
  'rawNoteArchives',
  'legacyReviewGroups',
  'processorGroups',
  'groupedAnalysisOutputs',
  'badIdeaLog',
  'inboxActionLog',
  'questionFeedbackLog',
];

const PROJECT_NOTE_FIELDS_TO_DELETE = [
  'notes',
  'rawNotes',
  'captures',
  'ahaNotes',
  'hmmNotes',
  'projectNotes',
  'archivedNotes',
  'importantNotes',
  'inboxNotes',
  'analysisNotes',
  'processedNotes',
  'aiAnalysisNotes',
  'suggestions',
  'tasks',
  'checklists',
  'questions',
  'completedTasks',
  'analysisResults',
  'analysisResultGroups',
  'aiImportBatches',
  'aiExportBatches',
  'importedJsonGroups',
  'processedNoteGroups',
  'inboxGroups',
  'suggestionGroups',
  'rawNoteArchives',
  'legacyReviewGroups',
  'processorGroups',
  'groupedAnalysisOutputs',
];

const GALLERY_NOTE_FIELDS_TO_DELETE = ['noteId', 'sourceNoteId', 'sourceCaptureId', 'sourceSuggestionId'];
const WRITE_BATCH_LIMIT = 350;

function buildDeleteFieldPatch(fields: string[], extra: Record<string, any> = {}) {
  const patch = { ...extra };
  fields.forEach((field) => {
    patch[field] = deleteField();
  });
  return patch;
}

function getUserIdFromPath(path: string) {
  const parts = path.split('/');
  if (parts[0] !== 'users' || parts.length < 2) return null;
  return parts[1];
}

function sanitizeProjectForCloud(project: any = {}) {
  const cleaned = { ...project };
  PROJECT_NOTE_FIELDS_TO_DELETE.forEach((field) => {
    if (field in cleaned) delete cleaned[field];
  });
  return cleaned;
}

async function applyBatchWrites(
  refs: any[],
  applyWrite: (batch: any, ref: any) => void
) {
  if (!refs.length) return 0;
  let writes = 0;
  for (let index = 0; index < refs.length; index += WRITE_BATCH_LIMIT) {
    const slice = refs.slice(index, index + WRITE_BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((ref) => applyWrite(batch, ref));
    await batch.commit();
    writes += slice.length;
  }
  return writes;
}

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

  const [userSnap, projectsSnap, notesSnap, suggestionsSnap, gallerySnap, taskSessionsSnap, activeTaskSnap] = await Promise.all([
    getDoc(doc(db, `users/${uid}`)),
    getDocs(collection(db, `users/${uid}/projects`)),
    getDocs(collection(db, `users/${uid}/notes`)),
    getDocs(collection(db, `users/${uid}/suggestions`)),
    getDocs(collection(db, `users/${uid}/galleryImages`)),
    getDocs(collection(db, `users/${uid}/taskSessions`)),
    getDoc(doc(db, `users/${uid}/runtime/activeTask`)),
  ]);

  const projects = projectsSnap.docs.map((d) => sanitizeProjectForCloud(d.data()));
  const captures = notesSnap.docs.map((d) => d.data());
  const suggestions = suggestionsSnap.docs.map((d) => d.data());
  const galleryImages = gallerySnap.docs.map((d) => d.data());
  const taskSessions = taskSessionsSnap.docs.map((d) => d.data());
  const activeTask = activeTaskSnap.exists() ? activeTaskSnap.data() : null;

  const galleryByProject = new Map();
  for (const image of galleryImages) {
    if (!image.projectId) continue;
    const current = galleryByProject.get(image.projectId) ?? [];
    current.push(image);
    galleryByProject.set(image.projectId, current);
  }

  const userCanonical = userSnap.exists() ? pickCanonicalUserPayload(userSnap.data()) : {};

  const loaded = {
    ...userCanonical,
    projects: projects.map((project) => ({
      ...project,
      gallery: galleryByProject.get(project.id) ?? (Array.isArray(project.gallery) ? project.gallery : []),
    })),
    captures,
    suggestions,
    taskSessions,
    activeTask,
  };
  debugDataCounts('firebase.loadUserData:loaded', loaded);
  return loaded;
}

export async function saveUserData(uid: string, data: any) {
  if (!db) throw new Error('Firebase is not configured.');
  debugDataCounts('firebase.saveUserData:payload', data);

  const [projectsSnap, notesSnap, suggestionsSnap, gallerySnap, taskSessionsSnap] = await Promise.all([
    getDocs(collection(db, `users/${uid}/projects`)),
    getDocs(collection(db, `users/${uid}/notes`)),
    getDocs(collection(db, `users/${uid}/suggestions`)),
    getDocs(collection(db, `users/${uid}/galleryImages`)),
    getDocs(collection(db, `users/${uid}/taskSessions`)),
  ]);

  const projectIds = new Set((data.projects ?? []).map((project) => project.id));
  const captureIds = new Set((data.captures ?? []).map((capture) => capture.id));
  const suggestionIds = new Set((data.suggestions ?? []).map((suggestion) => suggestion.id));
  const galleryImages = (data.projects ?? []).flatMap((project) => (project.gallery ?? []).map((image) => ({ ...image, id: image.id ?? crypto.randomUUID(), projectId: project.id })));
  const galleryImageIds = new Set(galleryImages.map((image) => image.id));
  const taskSessionIds = new Set((data.taskSessions ?? []).map((session) => session.id));

  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}`), pickCanonicalUserPayload(data), { merge: true });
  for (const project of data.projects ?? []) {
    batch.set(doc(db, `users/${uid}/projects/${project.id}`), sanitizeProjectForCloud(project));
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
  for (const session of data.taskSessions ?? []) {
    batch.set(doc(db, `users/${uid}/taskSessions/${session.id}`), session);
  }
  const activeTaskRef = doc(db, `users/${uid}/runtime/activeTask`);
  if (data.activeTask?.taskNoteId) batch.set(activeTaskRef, data.activeTask);
  else batch.delete(activeTaskRef);

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
  for (const snapshot of taskSessionsSnap.docs) {
    if (!taskSessionIds.has(snapshot.id)) batch.delete(snapshot.ref);
  }

  await batch.commit();
}

export async function deleteAllAppDataForUser(uid: string, cleanResetData: any) {
  if (!db) throw new Error('Firebase is not configured.');
  if (DEBUG_DATA_FLOW) console.log('[data-flow] deleteAllAppDataForUser:start', { uid });

  const [projectsSnap, notesSnap, suggestionsSnap, gallerySnap, taskSessionsSnap, activeTaskSnap] = await Promise.all([
    getDocs(collection(db, `users/${uid}/projects`)),
    getDocs(collection(db, `users/${uid}/notes`)),
    getDocs(collection(db, `users/${uid}/suggestions`)),
    getDocs(collection(db, `users/${uid}/galleryImages`)),
    getDocs(collection(db, `users/${uid}/taskSessions`)),
    getDoc(doc(db, `users/${uid}/runtime/activeTask`)),
  ]);

  const refsToDelete = [
    ...projectsSnap.docs.map((snapshot) => snapshot.ref),
    ...notesSnap.docs.map((snapshot) => snapshot.ref),
    ...suggestionsSnap.docs.map((snapshot) => snapshot.ref),
    ...gallerySnap.docs.map((snapshot) => snapshot.ref),
    ...taskSessionsSnap.docs.map((snapshot) => snapshot.ref),
    ...(activeTaskSnap.exists() ? [activeTaskSnap.ref] : []),
  ];

  await applyBatchWrites(refsToDelete, (batch, ref) => {
    batch.delete(ref);
  });

  const resetPayload = pickCanonicalUserPayload(cleanResetData);
  const userRef = doc(db, `users/${uid}`);
  await writeBatch(db).set(userRef, resetPayload, { merge: true }).commit();
  debugDataCounts('firebase.deleteAllAppDataForUser:reset-payload', resetPayload);
  if (DEBUG_DATA_FLOW) console.log('[data-flow] deleteAllAppDataForUser:end', { uid });

  return {
    deletedProjects: projectsSnap.size,
    deletedNotes: notesSnap.size,
    deletedSuggestions: suggestionsSnap.size,
    deletedGalleryImages: gallerySnap.size,
    deletedTaskSessions: taskSessionsSnap.size,
    deletedActiveTask: activeTaskSnap.exists() ? 1 : 0,
    deletedDocs: refsToDelete.length,
  };
}

export async function deleteAllNoteDataForAllUsers() {
  if (!db) throw new Error('Firebase is not configured.');

  const now = Date.now();
  const touchedUserIds = new Set<string>();
  const collectionGroupsDeleted: Record<string, number> = {};
  const cleanupErrors: string[] = [];
  let deletedDocs = 0;
  let patchedUserDocs = 0;
  let patchedProjectDocs = 0;
  let patchedGalleryDocs = 0;

  const uniqueGroups = [...new Set(NOTE_COLLECTION_GROUPS)];
  for (const groupName of uniqueGroups) {
    try {
      const snap = await getDocs(collectionGroup(db, groupName));
      collectionGroupsDeleted[groupName] = snap.size;
      if (!snap.empty) {
        snap.docs.forEach((docSnap) => {
          const uid = getUserIdFromPath(docSnap.ref.path);
          if (uid) touchedUserIds.add(uid);
        });
        deletedDocs += await applyBatchWrites(snap.docs.map((docSnap) => docSnap.ref), (batch, ref) => {
          batch.delete(ref);
        });
      }
    } catch (error) {
      collectionGroupsDeleted[groupName] = -1;
      cleanupErrors.push(`Failed to clean collection group "${groupName}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.docs.forEach((docSnap) => touchedUserIds.add(docSnap.id));
    if (!usersSnap.empty) {
      const userPatch = buildDeleteFieldPatch(NOTE_FIELDS_TO_DELETE);
      patchedUserDocs = await applyBatchWrites(usersSnap.docs.map((docSnap) => docSnap.ref), (batch, ref) => {
        batch.set(ref, userPatch, { merge: true });
      });
    }
  } catch (error) {
    cleanupErrors.push(`Failed to patch "users" documents: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const projectsSnap = await getDocs(collectionGroup(db, 'projects'));
    projectsSnap.docs.forEach((docSnap) => {
      const uid = getUserIdFromPath(docSnap.ref.path);
      if (uid) touchedUserIds.add(uid);
    });
    if (!projectsSnap.empty) {
      const projectPatch = buildDeleteFieldPatch(PROJECT_NOTE_FIELDS_TO_DELETE, { tasksDone: 0, updatedAt: now });
      patchedProjectDocs = await applyBatchWrites(projectsSnap.docs.map((docSnap) => docSnap.ref), (batch, ref) => {
        batch.set(ref, projectPatch, { merge: true });
      });
    }
  } catch (error) {
    cleanupErrors.push(`Failed to patch "projects" documents: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const gallerySnap = await getDocs(collectionGroup(db, 'galleryImages'));
    if (!gallerySnap.empty) {
      const galleryPatch = buildDeleteFieldPatch(GALLERY_NOTE_FIELDS_TO_DELETE);
      patchedGalleryDocs = await applyBatchWrites(gallerySnap.docs.map((docSnap) => docSnap.ref), (batch, ref) => {
        batch.set(ref, galleryPatch, { merge: true });
      });
    }
  } catch (error) {
    cleanupErrors.push(`Failed to patch "galleryImages" note references: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    touchedUsers: touchedUserIds.size,
    deletedDocs,
    patchedUserDocs,
    patchedProjectDocs,
    patchedGalleryDocs,
    collectionGroupsDeleted,
    cleanupErrors,
  };
}
