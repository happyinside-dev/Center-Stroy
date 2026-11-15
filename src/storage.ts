const DB_NAME = 'centr-stroy-images';
let database: Promise<IDBDatabase> | undefined;
function db() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Браузер не разрешил сохранить фотографию.'));
  });
  return database;
}
export async function saveImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Выберите JPG, PNG или WebP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Фотография должна быть меньше 12 МБ.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Не удалось обработать фотографию.')), 'image/webp', .88));
  const key = crypto.randomUUID();
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('images', 'readwrite'); tx.objectStore('images').put(blob, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Не хватило места для фотографии.'));
  });
  return 'idb:' + key;
}
export async function readImage(key: string): Promise<Blob | null> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction('images').objectStore('images').get(key.slice(4));
    req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
  });
}
export async function clearImages() { const database = await db(); return new Promise<void>((resolve, reject) => { const tx = database.transaction('images', 'readwrite'); tx.objectStore('images').clear(); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
