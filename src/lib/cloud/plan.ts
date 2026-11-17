import type { Project } from '@/types/project';
import type { Library } from '@/store/library';

/** One stored row in the cloud table. */
export interface CloudRow {
  kind: 'project' | 'library';
  id: string;
  data: unknown;
  deleted: boolean;
  /** The edit time on the device that made it (ms). */
  updated_at: number;
}

export interface SyncBase {
  /** For each plan, the edit time both sides last agreed on. */
  projects: Record<string, number>;
}

export interface SyncPlan {
  /** Plans to save on this device as they are in the cloud. */
  apply: Project[];
  /** Copies to add on this device when both sides changed the same plan (nothing is overwritten). */
  copies: Project[];
  /** Plans deleted on another device and unchanged here. */
  removeLocal: string[];
  /** Plans to upload. */
  push: Project[];
  /** Deletions to upload. */
  pushDeletes: { id: string; at: number }[];
  base: SyncBase;
}

/** True for an untouched starter plan, which is not worth uploading or keeping beside real plans. */
export function isBlank(p: Project): boolean {
  return /^untitled project$/i.test(p.name.trim()) && !p.diagrams.length && !p.gear.length && !p.shots.length && !p.storyboard.length && !p.compositions.length && !p.palettes.length && !p.checklist.length;
}

/**
 * Decide what to do with every plan, given what this device has, what the cloud has,
 * and the versions both last agreed on. The rule is simple and never loses work:
 * if only one side changed, that side wins; if both changed, both are kept.
 */
export function planSync(local: Project[], remote: CloudRow[], base: SyncBase, localDeletes: { id: string; at: number }[], makeId: () => string): SyncPlan {
  const out: SyncPlan = { apply: [], copies: [], removeLocal: [], push: [], pushDeletes: [], base: { projects: { ...base.projects } } };
  const localById = new Map(local.map((p) => [p.id, p]));
  const remoteById = new Map(remote.filter((r) => r.kind === 'project').map((r) => [r.id, r]));
  const deleted = new Map(localDeletes.map((d) => [d.id, d.at]));

  for (const r of remoteById.values()) {
    const l = localById.get(r.id);
    const agreed = base.projects[r.id];
    const remoteChanged = agreed === undefined || r.updated_at > agreed;
    if (deleted.has(r.id)) {
      // Deleted here: send the delete unless someone edited it elsewhere since.
      if (!r.deleted && remoteChanged && agreed !== undefined) out.apply.push(r.data as Project);
      else if (!r.deleted) out.pushDeletes.push({ id: r.id, at: deleted.get(r.id)! });
      delete out.base.projects[r.id];
      continue;
    }
    if (!l) {
      if (!r.deleted) {
        out.apply.push(r.data as Project);
        out.base.projects[r.id] = r.updated_at;
      }
      continue;
    }
    const localChanged = agreed === undefined || l.updatedAt > agreed;
    if (r.deleted) {
      if (!localChanged) out.removeLocal.push(l.id);
      else out.push.push(l); // edited here after being deleted elsewhere: keep it
      if (!localChanged) delete out.base.projects[r.id];
      continue;
    }
    if (l.updatedAt === r.updated_at) {
      out.base.projects[r.id] = r.updated_at;
      continue;
    }
    if (remoteChanged && !localChanged) {
      out.apply.push(r.data as Project);
      out.base.projects[r.id] = r.updated_at;
    } else if (localChanged && !remoteChanged) {
      out.push.push(l);
    } else {
      // Both changed: keep this device's version, and add the other as a copy.
      const other = r.data as Project;
      out.copies.push({ ...other, id: makeId(), name: `${other.name} (from another device)`, updatedAt: Date.now() });
      out.push.push(l);
    }
  }
  for (const l of local) {
    if (remoteById.has(l.id) || deleted.has(l.id)) continue;
    // Pulls only bring rows changed since the last sync, so skip plans already up to date.
    const agreed = base.projects[l.id];
    if (agreed !== undefined && l.updatedAt <= agreed) continue;
    if (isBlank(l)) continue;
    out.push.push(l);
  }
  // Plans deleted here that never reached the cloud need nothing sent.
  return out;
}

/** Merge two libraries item by item: the newer edit of each rig, camera or lens wins; deletions are kept. */
export function mergeLibrary(a: Library, b: Library): Library {
  const merge = <T extends { id: string; updatedAt: number }>(x: T[], y: T[]): T[] => {
    const m = new Map<string, T>();
    for (const it of [...x, ...y]) {
      const prev = m.get(it.id);
      if (!prev || it.updatedAt > prev.updatedAt) m.set(it.id, it);
    }
    return [...m.values()].sort((p, q) => q.updatedAt - p.updatedAt);
  };
  return { rigs: merge(a.rigs, b.rigs), cameras: merge(a.cameras, b.cameras), lenses: merge(a.lenses, b.lenses) };
}

export function sameLibrary(a: Library, b: Library): boolean {
  const key = (l: Library) => JSON.stringify([l.rigs.map((r) => [r.id, r.updatedAt]), l.cameras.map((r) => [r.id, r.updatedAt]), l.lenses.map((r) => [r.id, r.updatedAt])]);
  return key(a) === key(b);
}
