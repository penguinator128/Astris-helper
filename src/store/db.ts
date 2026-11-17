import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '@/types/project';
import type { Settings } from '@/types/settings';

interface FieldKitDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { byUpdated: number } };
  settings: { key: string; value: Settings & { key: string } };
  images: { key: string; value: { id: string; blob: Blob; createdAt: number } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<FieldKitDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FieldKitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FieldKitDB>('astris-field-kit', 1, {
      upgrade(db) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('byUpdated', 'updatedAt');
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('images', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export async function dbGetAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function dbPutProject(p: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', p);
}

export async function dbDeleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export async function dbGetSettings(): Promise<Settings | undefined> {
  const db = await getDB();
  const row = await db.get('settings', 'settings');
  if (!row) return undefined;
  const { key: _key, ...rest } = row;
  return rest as Settings;
}

export async function dbPutSettings(s: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { ...s, key: 'settings' });
}

export async function dbGetMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = await db.get('meta', key);
  return row?.value as T | undefined;
}

export async function dbPutMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

export async function dbPutImage(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('images', { id, blob, createdAt: Date.now() });
}

export async function dbGetImage(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const row = await db.get('images', id);
  return row?.blob;
}

export async function dbDeleteImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('images', id);
}

export async function dbGetAllImageIds(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys('images');
}

export async function dbClearAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([db.clear('projects'), db.clear('settings'), db.clear('images'), db.clear('meta')]);
}

/** Every meta row whose key starts with the prefix (used for backups). */
export async function dbListMeta<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
  const rows = await db.getAll('meta', range);
  return rows.map((r) => ({ key: r.key, value: r.value as T }));
}

export async function dbDeleteMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('meta', key);
}
