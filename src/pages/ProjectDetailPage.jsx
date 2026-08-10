import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import ImageViewer from '../components/ImageViewer';
import TaskActionSheet from '../components/TaskActionSheet';
import TaskCompletionSheet from '../components/TaskCompletionSheet';
import HistoryTimeline from '../components/HistoryTimeline';
import TaskHistorySheet from '../components/TaskHistorySheet';
import { fileToDataUrl } from '../lib/storage';
import { HMM_PROJECT_ID, PROJECT_DESTINATION, getProjectName, sortByPriorityThenNewest } from '../lib/model';
import { deleteNoteData } from '../lib/taskTracking';

export default function ProjectDetailPage({ api }) {
  const { projectId } = useParams();
  const project = useMemo(() => api.data.projects.find((item) => item.id === projectId), [api.data.projects, projectId]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ name: '', description: '' });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [historyTask, setHistoryTask] = useState(null);
  const [projectView, setProjectView] = useState('current');
  const [newFormKey, setNewFormKey] = useState(0);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);

  useEffect(() => {
    if (!project) return;
    setSettingsDraft({ name: getProjectName(project), description: project.description || '' });
  }, [project?.id]);

  useEffect(() => {
    if (!projectId || projectId === HMM_PROJECT_ID) return;
    api.setData((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => {
        if (item.id !== projectId) return item;
        const now = Date.now();
        return { ...item, lastOpenedAt: now, lastInteractedAt: now, interactionCount: (item.interactionCount || 0) + 1 };
      }),
    }));
  }, [projectId]);

  if (projectId === HMM_PROJECT_ID) return <Navigate to="/hmm" replace />;
  if (!project) return <div className="stack"><p>Project not found.</p><Link to="/ta-da">Back to Projects</Link></div>;

  const currentItems = (api.data.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.projectId === projectId)
    .sort(sortByPriorityThenNewest);
  const editingNote = currentItems.find((note) => note.id === editingNoteId) || null;
  const selectedItem = currentItems.find((note) => note.id === selectedItemId) || null;
  const completedProjectTasks = (api.data.completedTasks || []).filter((task) => !task.deleted && task.projectId === projectId);

  const patchProject = (patch) => api.setData((prev) => ({
    ...prev,
    projects: prev.projects.map((item) => item.id === projectId ? { ...item, ...patch, updatedAt: Date.now() } : item),
  }));

  const saveProjectSettings = () => {
    const name = settingsDraft.name.trim();
    if (!name) return;
    patchProject({ name, title: name, description: settingsDraft.description.trim() });
    setSettingsOpen(false);
  };

  const setProjectStatus = (status) => {
    const label = status === 'archived' ? 'Archive' : 'Hide';
    if (!window.confirm(`${label} this project?`)) return;
    patchProject({ status, archived: status === 'archived', hidden: status === 'hidden' });
  };

  const addNote = (patch) => {
    const now = Date.now();
    const note = {
      id: crypto.randomUUID(),
      ...patch,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      sourceType: 'project-detail',
      sourceId: projectId,
    };
    api.setData((prev) => ({
      ...prev,
      notes: [note, ...(prev.notes || [])],
      projects: note.destination === PROJECT_DESTINATION ? prev.projects.map((item) => item.id === note.projectId
        ? { ...item, updatedAt: now, lastInteractedAt: now, interactionCount: (item.interactionCount || 0) + 1 }
        : item) : prev.projects,
    }));
    setNewFormKey((value) => value + 1);
    setNewNoteOpen(false);
    api.showNoteSavedConfirmation?.();
  };

  const saveNoteEdit = (patch) => {
    if (!editingNoteId) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((note) => note.id === editingNoteId ? { ...note, ...patch, updatedAt: now } : note),
      projects: patch.destination === PROJECT_DESTINATION
        ? prev.projects.map((item) => item.id === patch.projectId
          ? { ...item, updatedAt: now, lastInteractedAt: now, interactionCount: (item.interactionCount || 0) + 1 }
          : item)
        : prev.projects,
    }));
    setEditingNoteId(null);
    api.showNoteSavedConfirmation?.();
  };

  const deleteNote = (note) => {
    if (!window.confirm(`Delete “${note.text}”?`)) return;
    api.setData((prev) => deleteNoteData(prev, note));
    if (editingNoteId === note.id) setEditingNoteId(null);
    if (selectedItemId === note.id) setSelectedItemId(null);
  };

  const completeItem = (note) => {
    setCompletionTask(note);
    if (editingNoteId === note.id) setEditingNoteId(null);
    if (selectedItemId === note.id) setSelectedItemId(null);
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    patchProject({
      gallery: [...(project.gallery || []), { id: crypto.randomUUID(), name: file.name, createdAt: Date.now(), previewUrl: url, noteId: null, rotation: 0 }],
      lastInteractedAt: Date.now(),
    });
    event.target.value = '';
  };

  const rotateGalleryImage = (image) => {
    const rotation = ((Number(image.rotation) || 0) + 90) % 360;
    const updated = { ...image, rotation, updatedAt: Date.now() };
    patchProject({
      gallery: (project.gallery || []).map((item) => item.id === image.id ? updated : item),
      lastInteractedAt: Date.now(),
    });
    setSelectedGalleryImage(updated);
  };

  const deleteGalleryImage = (image) => {
    if (!window.confirm(`Delete ${image.name || 'this image'} from the gallery?`)) return;
    patchProject({
      gallery: (project.gallery || []).filter((item) => item.id !== image.id),
      lastInteractedAt: Date.now(),
    });
    setSelectedGalleryImage(null);
  };

  return (
    <div className="stack page-screen">
      <div className="page-title-row">
        <div>
          <Link to="/ta-da" className="back-link">Projects</Link>
          <h2>{getProjectName(project)}</h2>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={() => { setProjectView('current'); setNewNoteOpen(true); }}>+ Note</button>
          <button type="button" className="secondary-button" onClick={() => { setProjectView('current'); setSettingsOpen((value) => !value); }}>Edit</button>
        </div>
      </div>
      {project.description && <p className="project-description">{project.description}</p>}

      <div className="history-view-switch" role="tablist" aria-label="Project view">
        <button type="button" role="tab" aria-selected={projectView === 'current'} className={projectView === 'current' ? 'selected' : ''} onClick={() => setProjectView('current')}>Current</button>
        <button type="button" role="tab" aria-selected={projectView === 'history'} className={projectView === 'history' ? 'selected' : ''} onClick={() => setProjectView('history')}>History <span>{completedProjectTasks.length}</span></button>
      </div>

      {projectView === 'current' && (<>
        {settingsOpen && (
          <section className="edit-panel stack">
            <input value={settingsDraft.name} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Project title" />
            <textarea rows={3} value={settingsDraft.description} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" />
            <div className="actions">
              <button type="button" onClick={saveProjectSettings}>Save settings</button>
              <button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button type="button" className="secondary-button" onClick={() => setProjectStatus('hidden')}>Hide</button>
              <button type="button" className="danger-button" onClick={() => setProjectStatus('archived')}>Archive</button>
            </div>
          </section>
        )}

        {newNoteOpen && (
          <section className="stack edit-panel new-aha-panel">
            <div className="section-title-row"><h3>New Note</h3></div>
            <NoteEditForm
              key={`${projectId}-${newFormKey}`}
              api={api}
              initialNote={{ destination: PROJECT_DESTINATION, projectId, priority: 5 }}
              submitLabel="Save Note"
              onSave={addNote}
              onCancel={() => setNewNoteOpen(false)}
              autoFocus
            />
          </section>
        )}

        <section className="stack note-card-list unified-item-list">
          {!currentItems.length && <p className="empty-state">No current items.</p>}
          {currentItems.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={() => setSelectedItemId(note.id)}>
              {editingNoteId === note.id && (
                <div className="edit-panel">
                  <NoteEditForm
                    api={api}
                    initialNote={editingNote}
                    submitLabel="Save note"
                    onSave={saveNoteEdit}
                    onDelete={deleteNote}
                    onCancel={() => setEditingNoteId(null)}
                    autoScrollOnMount
                  />
                </div>
              )}
            </NoteCard>
          ))}
        </section>

        {selectedItem && (
          <TaskActionSheet
            api={api}
            task={selectedItem}
            projectName={getProjectName(project)}
            onClose={() => setSelectedItemId(null)}
            onEdit={() => setEditingNoteId(selectedItem.id)}
            onComplete={() => completeItem(selectedItem)}
            onDelete={deleteNote}
          />
        )}

        <details className="stack">
          <summary>Gallery</summary>
          <label className="gallery-upload-button">
            <span>Upload picture</span>
            <input className="gallery-upload-input" type="file" accept="image/*" onChange={upload} />
          </label>
          <div className="gallery">{[...(project.gallery || [])].sort((a, b) => a.createdAt - b.createdAt).map((img) => (
            <button type="button" className="img-card" key={img.id} onClick={() => setSelectedGalleryImage(img)} aria-label={`Open ${img.name || 'project photo'} in full-resolution viewer`}>
              <span className="img-card-frame">
                <img src={img.previewUrl} alt={img.name || 'Project gallery photo'} style={{ transform: `rotate(${Number(img.rotation) || 0}deg)` }} />
              </span>
              <small>{img.name || 'Project photo'}</small>
            </button>
          ))}</div>
        </details>

        {selectedGalleryImage && (
          <ImageViewer
            image={selectedGalleryImage}
            onClose={() => setSelectedGalleryImage(null)}
            onRotate={() => rotateGalleryImage(selectedGalleryImage)}
            onDelete={() => deleteGalleryImage(selectedGalleryImage)}
          />
        )}
      </>)}

      {projectView === 'history' && (
        <section className="stack project-history-section">
          <div className="section-title-row">
            <div>
              <h3>Progress timeline</h3>
              <p className="helper-text">Newest completed work first.</p>
            </div>
            <Link className="secondary-button button-link" to={`/reports?project=${projectId}`}>Report</Link>
          </div>
          <HistoryTimeline completedTasks={completedProjectTasks} onSelect={setHistoryTask} />
        </section>
      )}

      {completionTask && (
        <TaskCompletionSheet
          api={api}
          task={completionTask}
          projectName={getProjectName(project)}
          onClose={() => setCompletionTask(null)}
        />
      )}

      {historyTask && (
        <TaskHistorySheet
          api={api}
          completedTask={historyTask}
          projectName={getProjectName(project)}
          onClose={() => setHistoryTask(null)}
        />
      )}
    </div>
  );
}
