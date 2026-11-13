import { uid } from '@/lib/id';
import { dbDeleteImage, dbGetImage, dbPutImage } from './db';

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** Downscale an image file so stored references stay small and fast. */
export async function normaliseImage(file: Blob, maxEdge = 1600, quality = 0.86): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === 'image/jpeg') {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality),
  );
}

export async function storeImage(file: Blob): Promise<string> {
  const blob = await normaliseImage(file);
  const id = uid();
  await dbPutImage(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return id;
}

export async function storeImageBlobRaw(blob: Blob): Promise<string> {
  const id = uid();
  await dbPutImage(id, blob);
  urlCache.set(id, URL.createObjectURL(blob));
  return id;
}

export function getCachedImageUrl(id: string): string | undefined {
  return urlCache.get(id);
}

export async function getImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const p = (async () => {
    const blob = await dbGetImage(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  })();
  pending.set(id, p);
  const result = await p;
  pending.delete(id);
  return result;
}

export async function getImageBlob(id: string): Promise<Blob | undefined> {
  return dbGetImage(id);
}

export async function removeImage(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  await dbDeleteImage(id);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
