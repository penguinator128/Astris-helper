import type { Project, ProjectExport } from '@/types/project';
import { createEmptyProject, flushProjects, useProjects } from '@/store/projects';
import { blobToDataUrl, dataUrlToBlob, getImageBlob } from '@/store/images';
import { dbDeleteImage, dbGetAllImageIds, dbPutImage } from '@/store/db';
import { uid } from './id';

export interface BackupFile {
  format: 'astris-field-kit-backup';
  version: 1;
  exportedAt: string;
  projects: Project[];
  images: Record<string, string>;
}

export function imageIdsOf(p: Project): string[] {
  const ids = new Set<string>();
  for (const c of p.compositions) if (c.backgroundImageId) ids.add(c.backgroundImageId);
  for (const f of p.storyboard) if (f.imageId) ids.add(f.imageId);
  return Array.from(ids);
}

async function collectImages(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    const blob = await getImageBlob(id);
    if (blob) out[id] = await blobToDataUrl(blob);
  }
  return out;
}

export async function exportProject(p: Project): Promise<ProjectExport> {
  await flushProjects();
  return { format: 'astris-field-kit', version: 1, exportedAt: new Date().toISOString(), project: p, images: await collectImages(imageIdsOf(p)) };
}

export async function exportAll(projects: Project[]): Promise<BackupFile> {
  await flushProjects();
  const ids = Array.from(new Set(projects.flatMap(imageIdsOf)));
  return { format: 'astris-field-kit-backup', version: 1, exportedAt: new Date().toISOString(), projects, images: await collectImages(ids) };
}

/** Fill in any fields missing from an older or hand-edited project file. */
export function normaliseProject(raw: Partial<Project>): Project {
  const base = createEmptyProject(typeof raw.name === 'string' ? raw.name : 'Imported project');
  const p: Project = { ...base, ...raw, camera: { ...base.camera, ...(raw.camera ?? {}) }, callSheet: { ...base.callSheet, ...(raw.callSheet ?? {}) }, slate: { ...base.slate, ...(raw.slate ?? {}) } } as Project;
  for (const key of ['shots', 'storyboard', 'diagrams', 'compositions', 'palettes', 'colourScript', 'plans', 'checklist', 'awards', 'gear', 'connections'] as const) {
    if (!Array.isArray(p[key])) (p as unknown as Record<string, unknown>)[key] = [];
  }
  if (typeof p.id !== 'string' || !p.id) p.id = uid();
  return p;
}

export interface ImportResult {
  imported: string[];
}

/** Import a single-project file or a full backup. Existing projects with the same id are kept; the import arrives as a copy. */
export async function importFile(text: string): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const obj = data as { format?: string; project?: Partial<Project>; projects?: Partial<Project>[]; images?: Record<string, string> };
  let projects: Partial<Project>[];
  if (obj && obj.format === 'astris-field-kit' && obj.project) projects = [obj.project];
  else if (obj && obj.format === 'astris-field-kit-backup' && Array.isArray(obj.projects)) projects = obj.projects;
  else throw new Error('This is not an Astris Field Kit export.');
  const images: Record<string, string> = obj.images ?? {};
  for (const [id, dataUrl] of Object.entries(images)) {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) await dbPutImage(id, await dataUrlToBlob(dataUrl));
  }
  const store = useProjects.getState();
  const imported: string[] = [];
  for (const raw of projects) {
    const p = normaliseProject(raw);
    if (store.projects[p.id]) {
      p.id = uid();
      p.name = `${p.name} (imported)`;
    }
    store.importProject(p);
    imported.push(p.name);
  }
  return { imported };
}

/** Remove stored images that no project references any more. Run once after start-up. */
export async function collectUnusedImages(): Promise<number> {
  const { projects } = useProjects.getState();
  const used = new Set(Object.values(projects).flatMap(imageIdsOf));
  const all = await dbGetAllImageIds();
  let removed = 0;
  for (const id of all) {
    if (!used.has(id)) {
      await dbDeleteImage(id);
      removed++;
    }
  }
  return removed;
}
