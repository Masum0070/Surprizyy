const DB_NAME = "surprizyy-draft-media";
const STORE_NAME = "files";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Unable to store photos."));
  });
}

export async function savePendingMedia(media) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    media.forEach((item) => store.put(item));
    transaction.oncomplete = resolve;
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to store photos."));
  });
  database.close();
}

export async function getPendingMedia() {
  const database = await openDatabase();
  const media = await new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () =>
      reject(request.error || new Error("Unable to read stored photos."));
  });
  database.close();
  return media;
}

export async function clearPendingMedia() {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () =>
      reject(transaction.error || new Error("Unable to clear stored photos."));
  });
  database.close();
}
