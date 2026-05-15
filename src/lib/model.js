export const STATUSES = ['active', 'paused', 'hidden', 'archived'];

export const seedData = {
  projects: [
    { id: 'p1', title: 'Master Plan Product', description: 'Shape v1 private system.', status: 'active', notes: [], gallery: [] },
    { id: 'p2', title: 'Health Reboot', description: 'Daily routines and food plan.', status: 'active', notes: [], gallery: [] },
    { id: 'p3', title: 'Backlog Ideas', description: 'Parking lot for ideas.', status: 'hidden', notes: [], gallery: [] }
  ],
  captures: [],
  suggestions: [
    { id: 's1', text: 'Draft weekly review template', state: 'new', projectId: null },
    { id: 's2', text: 'Break Health Reboot into checklists', state: 'important', projectId: 'p2' }
  ]
};
