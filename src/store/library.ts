import { create } from 'zustand';
import type { CameraBodySpec, Connection, GearItem, LensSpec } from '@/types/project';
import { uid } from '@/lib/id';
import { dbGetMeta, dbPutMeta } from './db';

/** A camera with everything on it, saved to reuse in any plan. */
export interface SavedRig {
  id: string;
  name: string;
  updatedAt: number;
  deleted?: boolean;
  camera: GearItem;
  parts: GearItem[];
  /** Connections between the camera and its parts only. */
  connections: Connection[];
  thumbnail?: string;
}

export interface SavedCamera {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  body: CameraBodySpec;
}

export interface SavedLens {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  lens: LensSpec;
}

export interface Library {
  rigs: SavedRig[];
  cameras: SavedCamera[];
  lenses: SavedLens[];
}

const KEY = 'library';
const empty = (): Library => ({ rigs: [], cameras: [], lenses: [] });

interface LibraryStore extends Library {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Replace the whole library (used by sync). */
  setAll: (l: Library) => void;
  saveRig: (r: Omit<SavedRig, 'id' | 'updatedAt'> & { id?: string }) => SavedRig;
  renameRig: (id: string, name: string) => void;
  deleteRig: (id: string) => void;
  saveCamera: (b: CameraBodySpec) => void;
  saveLens: (l: LensSpec) => void;
  deleteCamera: (id: string) => void;
  deleteLens: (id: string) => void;
}

function persist(s: Library) {
  void dbPutMeta(KEY, { rigs: s.rigs, cameras: s.cameras, lenses: s.lenses });
}

const lensKey = (l: LensSpec) => `${l.manufacturer}|${l.model}|${l.mount}`.toLowerCase();

export const useLibrary = create<LibraryStore>((set, get) => {
  const commit = (patch: Partial<Library>) => {
    set(patch);
    const s = get();
    persist(s);
  };
  return {
    ...empty(),
    hydrated: false,
    hydrate: async () => {
      const stored = await dbGetMeta<Library>(KEY);
      set({ ...empty(), ...(stored ?? {}), hydrated: true });
    },
    setAll: (l) => commit({ rigs: l.rigs, cameras: l.cameras, lenses: l.lenses }),
    saveRig: (r) => {
      const now = Date.now();
      const rig: SavedRig = { ...r, id: r.id ?? uid(), updatedAt: now };
      const others = get().rigs.filter((x) => x.id !== rig.id);
      commit({ rigs: [rig, ...others] });
      return rig;
    },
    renameRig: (id, name) => commit({ rigs: get().rigs.map((r) => (r.id === id ? { ...r, name: name.trim() || r.name, updatedAt: Date.now() } : r)) }),
    // Deletes leave a marker so other devices learn about them when syncing.
    deleteRig: (id) => commit({ rigs: get().rigs.map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: Date.now() } : r)) }),
    saveCamera: (b) => {
      const existing = get().cameras.find((c) => c.body.id === b.id);
      const item: SavedCamera = { id: existing?.id ?? uid(), body: b, updatedAt: Date.now() };
      commit({ cameras: [item, ...get().cameras.filter((c) => c.id !== item.id)] });
    },
    saveLens: (l) => {
      const existing = get().lenses.find((x) => !x.deleted && lensKey(x.lens) === lensKey(l));
      const item: SavedLens = { id: existing?.id ?? uid(), lens: l, updatedAt: Date.now() };
      commit({ lenses: [item, ...get().lenses.filter((x) => x.id !== item.id)] });
    },
    deleteCamera: (id) => commit({ cameras: get().cameras.map((c) => (c.id === id ? { ...c, deleted: true, updatedAt: Date.now() } : c)) }),
    deleteLens: (id) => commit({ lenses: get().lenses.map((c) => (c.id === id ? { ...c, deleted: true, updatedAt: Date.now() } : c)) }),
  };
});

export const liveRigs = (l: Library) => l.rigs.filter((r) => !r.deleted);
export const liveCameras = (l: Library) => l.cameras.filter((r) => !r.deleted);
export const liveLenses = (l: Library) => l.lenses.filter((r) => !r.deleted);
