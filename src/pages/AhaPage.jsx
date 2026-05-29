import { useState } from 'react';
import NoteEditForm from '../components/NoteEditForm';
import { HMM_DESTINATION, PROJECT_DESTINATION } from '../lib/model';

export default function AhaPage({ api }) {
  const [formKey, setFormKey] = useState(0);
  const saveNote = (patch) => {
    const now = Date.now();
    const note = {
      id: crypto.randomUUID(),
      ...patch,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      sourceType: 'aha',
      sourceId: null,
    };

    api.setData((prev) => ({
      ...prev,
      notes: [note, ...(prev.notes || [])],
      projects: note.destination === PROJECT_DESTINATION
        ? prev.projects.map((project) => project.id === note.projectId
          ? { ...project, updatedAt: now, lastInteractedAt: now, interactionCount: (project.interactionCount || 0) + 1 }
          : project)
        : prev.projects,
      settings: {
        ...prev.settings,
        lastDestination: note.destination === HMM_DESTINATION ? HMM_DESTINATION : note.projectId,
        lastSelectedProjectId: note.projectId || prev.settings.lastSelectedProjectId,
      },
    }));

    setFormKey((value) => value + 1);
    api.showNoteSavedConfirmation?.();
  };

  return (
    <div className="stack page-screen">
      <NoteEditForm
        key={formKey}
        api={api}
        initialNote={{ destination: HMM_DESTINATION, priority: 5, important: false, isTodo: false }}
        submitLabel="Save Note"
        onSave={saveNote}
        autoFocus
      />
    </div>
  );
}
