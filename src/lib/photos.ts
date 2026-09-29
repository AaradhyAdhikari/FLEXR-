"use client";

/**
 * Progress photos.
 *
 * These stay on the device, in the browser's own database — they are never
 * uploaded, never synced, and never leave with an export. Photos of your body
 * are the most personal thing the app holds, and keeping them local means
 * there's nothing to leak and no bucket to secure. The trade is honest and
 * stated in the app: a new phone starts with an empty gallery.
 */

export type Photo = {
  id: string;
  date: string; // yyyy-mm-dd, the day it belongs to
  blob: Blob;
  note?: string;
  added: string; // ISO timestamp
};

const DB = "flexr-photos";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexeddb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("date", "date");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Shrink to something sensible before storing — phone photos are huge. */
export async function shrink(file: Blob, maxSide = 1280, quality = 0.72): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  return out ?? file;
}

export async function addPhoto(date: string, file: Blob, note?: string): Promise<Photo> {
  const blob = await shrink(file);
  const photo: Photo = { id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date, blob, note, added: new Date().toISOString() };
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  await done(tx.objectStore(STORE).add(photo));
  db.close();
  return photo;
}

/** Every photo, newest first. */
export async function allPhotos(): Promise<Photo[]> {
  try {
    const db = await open();
    const tx = db.transaction(STORE, "readonly");
    const list = await done(tx.objectStore(STORE).getAll() as IDBRequest<Photo[]>);
    db.close();
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.added.localeCompare(a.added));
  } catch {
    return []; // private mode, or storage blocked
  }
}

export async function removePhoto(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  await done(tx.objectStore(STORE).delete(id));
  db.close();
}

/** Roughly how much space the gallery takes, for the note in the UI. */
export const totalBytes = (photos: Photo[]): number => photos.reduce((a, p) => a + (p.blob?.size ?? 0), 0);
