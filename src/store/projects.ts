import { create } from 'zustand';
import { uid } from '@/lib/id';
import type { CallSheet, CameraSetup, Project, SlateState } from '@/types/project';
import { dbDeleteProject, dbGetAllProjects, dbGetMeta, dbPutMeta, dbPutProject } from './db';
import { useSettings } from './settings';

const CURRENT_KEY = 'currentProjectId';

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function emptyCallSheet(): CallSheet {
  return {
    isoDate: todayIso(),
    callTime: '07:00',
    locationName: '',
    locationAddress: '',
    parking: '',
    people: [],
    schedule: [],
    notes: '',
    weatherNote: '',
  };
}

export function emptySlate(production: string): SlateState {
  return {
    production,
    roll: 'A001',
    scene: '1',
    shot: 'A',
    take: 1,
    director: '',
    camera: '',
    fps: 24,
    flash: true,
    mirrored: false,
    sound: true,
  };
}

export function defaultCamera(): CameraSetup {
  const s = useSettings.getState();
  return {
    sensorId: s.defaultSensorId,
    focalLength: s.defaultFocalLength,
    aperture: s.defaultAperture,
    fps: 24,
    shutterAngle: 180,
    iso: 800,
  };
}

export function createEmptyProject(name: string): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    camera: defaultCamera(),
    shots: [],
    storyboard: [],
    storyboardAspect: '16:9',
    diagrams: [],
    compositions: [],
    palettes: [],
    colourScript: [],
    plans: [],
    callSheet: emptyCallSheet(),
    checklist: [],
    awards: [],
    slate: emptySlate(name),
    gear: [],
    connections: [],
  };
}

/** Bring a stored or imported project up to the current shape. */
export function migrateProject(p: Project): Project {
  const base = createEmptyProject(p.name);
  const out = { ...base, ...p, camera: { ...base.camera, ...p.camera }, callSheet: { ...base.callSheet, ...p.callSheet }, slate: { ...base.slate, ...p.slate } } as Project;
  for (const key of ['shots', 'storyboard', 'diagrams', 'compositions', 'palettes', 'colourScript', 'plans', 'checklist', 'awards', 'gear', 'connections'] as const) {
    if (!Array.isArray(out[key])) (out as unknown as Record<string, unknown>)[key] = [];
  }
  return out;
}

interface ProjectsStore {
  projects: Record<string, Project>;
  currentId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  select: (id: string) => void;
  create: (name: string) => Project;
  duplicate: (id: string) => Project | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  importProject: (p: Project) => void;
  /** Mutate the current project immutably. The mutator returns a partial patch. */
  patch: (id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void;
  patchCurrent: (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function schedulePersist(p: Project) {
  const t = timers.get(p.id);
  if (t) clearTimeout(t);
  timers.set(
    p.id,
    setTimeout(() => {
      timers.delete(p.id);
      void dbPutProject(p);
    }, 200),
  );
}

export const useProjects = create<ProjectsStore>((set, get) => ({
  projects: {},
  currentId: null,
  hydrated: false,

  hydrate: async () => {
    const list = await dbGetAllProjects();
    const map: Record<string, Project> = {};
    for (const p of list) map[p.id] = migrateProject(p);
    let currentId = (await dbGetMeta<string>(CURRENT_KEY)) ?? null;
    if (list.length === 0) {
      const p = createEmptyProject('Untitled project');
      map[p.id] = p;
      currentId = p.id;
      await dbPutProject(p);
    }
    if (!currentId || !map[currentId]) {
      currentId = list.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? Object.keys(map)[0];
    }
    await dbPutMeta(CURRENT_KEY, currentId);
    set({ projects: map, currentId, hydrated: true });
  },

  select: (id) => {
    if (!get().projects[id]) return;
    set({ currentId: id });
    void dbPutMeta(CURRENT_KEY, id);
  },

  create: (name) => {
    const p = createEmptyProject(name.trim() || 'Untitled project');
    set((s) => ({ projects: { ...s.projects, [p.id]: p }, currentId: p.id }));
    void dbPutProject(p);
    void dbPutMeta(CURRENT_KEY, p.id);
    return p;
  },

  duplicate: (id) => {
    const src = get().projects[id];
    if (!src) return null;
    const now = Date.now();
    const copy: Project = { ...structuredClone(src), id: uid(), name: `${src.name} copy`, createdAt: now, updatedAt: now };
    set((s) => ({ projects: { ...s.projects, [copy.id]: copy }, currentId: copy.id }));
    void dbPutProject(copy);
    void dbPutMeta(CURRENT_KEY, copy.id);
    return copy;
  },

  rename: (id, name) => {
    get().patch(id, { name: name.trim() || 'Untitled project' });
  },

  remove: (id) => {
    const { projects, currentId } = get();
    if (!projects[id]) return;
    const rest = { ...projects };
    delete rest[id];
    let next = currentId === id ? null : currentId;
    if (Object.keys(rest).length === 0) {
      const p = createEmptyProject('Untitled project');
      rest[p.id] = p;
      next = p.id;
      void dbPutProject(p);
    }
    if (!next) {
      next = Object.values(rest).sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
    }
    set({ projects: rest, currentId: next });
    void dbDeleteProject(id);
    void dbPutMeta(CURRENT_KEY, next);
  },

  importProject: (p) => {
    const incoming: Project = { ...migrateProject(p), updatedAt: Date.now() };
    set((s) => ({ projects: { ...s.projects, [incoming.id]: incoming }, currentId: incoming.id }));
    void dbPutProject(incoming);
    void dbPutMeta(CURRENT_KEY, incoming.id);
  },

  patch: (id, patch) => {
    const prev = get().projects[id];
    if (!prev) return;
    const delta = typeof patch === 'function' ? patch(prev) : patch;
    const next: Project = { ...prev, ...delta, updatedAt: Date.now() };
    set((s) => ({ projects: { ...s.projects, [id]: next } }));
    schedulePersist(next);
  },

  patchCurrent: (patch) => {
    const id = get().currentId;
    if (id) get().patch(id, patch);
  },
}));

const FALLBACK = createEmptyProjectSafe();
function createEmptyProjectSafe(): Project {
  const now = 0;
  return {
    id: '__none__',
    name: 'Untitled project',
    createdAt: now,
    updatedAt: now,
    camera: { sensorId: 'canon-r50v', focalLength: 35, aperture: 2.8, fps: 24, shutterAngle: 180, iso: 800 },
    shots: [],
    storyboard: [],
    storyboardAspect: '16:9',
    diagrams: [],
    compositions: [],
    palettes: [],
    colourScript: [],
    plans: [],
    callSheet: emptyCallSheet(),
    checklist: [],
    awards: [],
    slate: emptySlate('Untitled project'),
    gear: [],
    connections: [],
  };
}

/** The current project, always defined (falls back to an empty project pre-hydration). */
export function useProject(): Project {
  return useProjects((s) => (s.currentId ? s.projects[s.currentId] : undefined) ?? FALLBACK);
}

export function usePatchProject() {
  return useProjects((s) => s.patchCurrent);
}

/** Flush any pending debounced writes (used before export / unload). */
export async function flushProjects(): Promise<void> {
  const { projects } = useProjects.getState();
  const ids = Array.from(timers.keys());
  for (const id of ids) {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    const p = projects[id];
    if (p) await dbPutProject(p);
  }
}
