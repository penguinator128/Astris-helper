import type { Project } from '@/types/project';
import { dbDeleteMeta, dbListMeta, dbPutMeta } from './db';

/** Copies of a plan kept on this device, so an upgrade, a delete or a mistake can be undone. */
export interface Backup {
  key: string;
  projectId: string;
  name: string;
  at: number;
  reason: string;
  project: Project;
}

const PREFIX = 'backup:';
const KEEP = 8;

export async function backupProject(p: Project, reason: string): Promise<void> {
  try {
    const at = Date.now();
    const key = `${PREFIX}${p.id}:${at}`;
    await dbPutMeta(key, { key, projectId: p.id, name: p.name, at, reason, project: structuredClone(p) } satisfies Backup);
    const mine = (await listBackups()).filter((b) => b.projectId === p.id);
    for (const old of mine.slice(KEEP)) await dbDeleteMeta(old.key);
  } catch {
    // A failed backup must never block saving the plan itself.
  }
}

/** Newest first. */
export async function listBackups(): Promise<Backup[]> {
  const rows = await dbListMeta<Backup>(PREFIX);
  return rows.map((r) => r.value).sort((a, b) => b.at - a.at);
}

export async function deleteBackup(key: string): Promise<void> {
  await dbDeleteMeta(key);
}

export async function lastBackupAt(projectId: string): Promise<number> {
  return (await listBackups()).find((b) => b.projectId === projectId)?.at ?? 0;
}
