import { create } from 'zustand';
import { uid } from '@/lib/id';
import type { CallSheet, CameraSetup, Project, SlateState } from '@/types/project';
import { dbDeleteProject, dbGetAllProjects, dbGetMeta, dbPutMeta, dbPutProject } from './db';
import { useSettings } from './settings';
import { backupProject, lastBackupAt } from './backups';

const CURRENT_KEY = 'currentProjectId';
/** Bump when the stored shape changes. Plans saved by an older version are backed up before they are upgraded. */
export const SCHEMA_VERSION = 3;
const DAY = 24 * 60 * 60 * 1000;

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
    schema: SCHEMA_VERSION,
  };
}

/** Bring a stored or imported project up to the current shape. */
export function migrateProject(p: Project): Project {
  const base = createEmptyProject(p.name);
  const out = { ...base, ...p, camera: { ...base.camera, ...p.camera }, callSheet: { ...base.callSheet, ...p.callSheet }, slate: { ...base.slate, ...p.slate } } as Project;
  for (const key of ['shots', 'storyboard', 'diagrams', 'compositions', 'palettes', 'colourScript', 'plans', 'checklist', 'awards', 'gear', 'connections'] as const) {
    if (!Array.isArray(out[key])) (out as unknown as Record<string, unknown>)[key] = [];
  }
  out.schema = SCHEMA_VERSION;
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
  /** Save plans from the cloud as they are (edit times kept) and drop ones deleted elsewhere. */
  applyCloud: (upserts: Project[], removes: string[]) => Promise<void>;
}

/** Plans deleted on this device that the cloud has not heard about yet. */
export const DELETES_KEY = 'sync-deletes';
async function recordDelete(id: string) {
  const list = (await dbGetMeta<{ id: string; at: number }[]>(DELETES_KEY)) ?? [];
  await dbPutMeta(DELETES_KEY, [...list.filter((d) => d.id !== id), { id, at: Date.now() }]);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, Project>();
/**
 * Save at once, then at most every 200 ms while edits keep coming (dragging, typing),
 * always ending with the latest version. A single edit is never left waiting.
 */
function schedulePersist(p: Project) {
  if (timers.has(p.id)) {
    pending.set(p.id, p);
    return;
  }
  void dbPutProject(p);
  const tick = () => {
    const next = pending.get(p.id);
    if (next) {
      pending.delete(p.id);
      void dbPutProject(next);
      timers.set(p.id, setTimeout(tick, 200));
    } else timers.delete(p.id);
  };
  timers.set(p.id, setTimeout(tick, 200));
}

export const useProjects = create<ProjectsStore>((set, get) => ({
  projects: {},
  currentId: null,
  hydrated: false,

  hydrate: async () => {
    const list = await dbGetAllProjects();
    const map: Record<string, Project> = {};
    // Ask the browser not to clear our storage under pressure.
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist();
    } catch {
      /* not supported */
    }
    for (const p of list) {
      const old = (p.schema ?? 1) < SCHEMA_VERSION;
      // Keep the original before upgrading it, and a daily copy of every plan.
      if (old) await backupProject(p, `Before upgrading from version ${p.schema ?? 1}`);
      else if (Date.now() - (await lastBackupAt(p.id)) > DAY) await backupProject(p, 'Daily copy');
      map[p.id] = migrateProject(p);
      if (old) await dbPutProject(map[p.id]);
    }
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
    void backupProject(projects[id], 'Before delete');
    void recordDelete(id);
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
    // Never overwrite a plan you already have: an import with the same id comes in as a copy.
    const clash = !!get().projects[p.id];
    const incoming: Project = { ...migrateProject(p), ...(clash ? { id: uid(), name: `${p.name} (imported)` } : {}), updatedAt: Date.now() };
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

  applyCloud: async (upserts, removes) => {
    const projects = { ...get().projects };
    for (const raw of upserts) {
      const p = migrateProject(raw);
      // Keep a copy of what this device had before it is replaced.
      if (projects[p.id] && projects[p.id].updatedAt !== p.updatedAt) await backupProject(projects[p.id], 'Before update from another device');
      projects[p.id] = p;
      await dbPutProject(p);
    }
    for (const id of removes) {
      if (!projects[id]) continue;
      await backupProject(projects[id], 'Deleted on another device');
      delete projects[id];
      await dbDeleteProject(id);
    }
    if (!Object.keys(projects).length) {
      const p = createEmptyProject('Untitled project');
      projects[p.id] = p;
      await dbPutProject(p);
    }
    let currentId = get().currentId;
    if (!currentId || !projects[currentId]) currentId = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
    set({ projects, currentId });
    await dbPutMeta(CURRENT_KEY, currentId);
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
    schema: SCHEMA_VERSION,
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
    pending.delete(id);
    const p = projects[id];
    if (p) await dbPutProject(p);
  }
}
