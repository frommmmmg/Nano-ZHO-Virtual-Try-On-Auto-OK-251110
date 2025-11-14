import type { GeneratedContent } from '../types';

const DB_NAME = 'NanoBananaryHistory';
const DB_VERSION = 1;
const STORE_NAME = 'generations';

let db: IDBDatabase;

function getDb(): Promise<IDBDatabase> {
    if (db) {
        return Promise.resolve(db);
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB.');
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                tempDb.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

interface StoredGeneration {
    id?: number;
    text: string | null;
    imageUrl: string | null;
    secondaryImageUrl?: string | null;
    videoBlob?: Blob | null;
    timestamp: number;
    originalFilename?: string;
}

export async function addGeneration(item: Partial<Omit<StoredGeneration, 'id' | 'timestamp'>>): Promise<number> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add({ ...item, timestamp: Date.now() });

        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => {
            console.error('Failed to add item to DB', request.error);
            reject('Error adding item to DB.');
        };
    });
}

export async function getAllGenerations(): Promise<GeneratedContent[]> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const results: StoredGeneration[] = request.result;
            results.sort((a, b) => b.timestamp - a.timestamp); // Newest first

            const content: GeneratedContent[] = results.map(item => ({
                id: item.id,
                imageUrl: item.imageUrl ?? null,
                secondaryImageUrl: item.secondaryImageUrl ?? null,
                text: item.text ?? null,
                videoUrl: item.videoBlob ? URL.createObjectURL(item.videoBlob) : undefined,
                originalFilename: item.originalFilename,
            }));
            resolve(content);
        };

        request.onerror = () => {
            console.error('Failed to get items from DB', request.error);
            reject('Error fetching items from DB.');
        };
    });
}

export async function clearAllHistory(): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear DB', request.error);
            reject('Error clearing history from DB.');
        };
    });
}