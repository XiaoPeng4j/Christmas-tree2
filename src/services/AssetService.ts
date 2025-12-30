
import { PhotoData } from '../types';
import { PRELOADED_MEMORIES } from '../data/memories';

const DB_NAME = 'ChristmasTreeAssetsDB';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';

interface AssetRecord {
  id: string;
  text: string;
  type: 'local' | 'remote';
  url: string; // Remote URL or empty if local (blob used instead)
  blob?: Blob; // Binary data for local uploads
  timestamp: number;
}

export const assetService = {
  db: null as IDBDatabase | null,

  async init() {
    if (this.db) return;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('AssetService DB Error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        }
      };
    });
  },

  /**
   * Reads the "Assets Folder" content.
   * Also syncs hardcoded memories to ensure code changes apply.
   */
  async getAssets(): Promise<PhotoData[]> {
    await this.init();
    
    // Always sync preloaded memories first to handle code updates (e.g. changing image path)
    await this.syncPreloaded();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: AssetRecord[] = request.result;
        resolve(this.processRecords(records));
      };
      request.onerror = () => reject(request.error);
    });
  },

  processRecords(records: AssetRecord[]): PhotoData[] {
      // Convert stored records to usable PhotoData
      const photos: PhotoData[] = records.map(r => {
        let url = r.url;
        // Create a dynamic URL for the blob stored in DB
        if (r.type === 'local' && r.blob) {
          url = URL.createObjectURL(r.blob);
        }
        return {
          id: r.id,
          url: url,
          text: r.text
        };
      });
      
      // Sort by timestamp to maintain timeline
      photos.sort((a, b) => {
            const ra = records.find(r => r.id === a.id);
            const rb = records.find(r => r.id === b.id);
            return (ra?.timestamp || 0) - (rb?.timestamp || 0);
      });
      return photos;
  },

  /**
   * Saves a new asset into the persistent store.
   * Accepts either a File object (local upload) or a string (URL).
   */
  async saveAsset(source: File | string, text: string): Promise<PhotoData> {
    const res = await this.saveAssets([{ source, text }]);
    return res[0];
  },

  /**
   * Batch save assets
   */
  async saveAssets(items: { source: File | string, text: string }[]): Promise<PhotoData[]> {
    await this.init();
    return new Promise((resolve, reject) => {
       const tx = this.db!.transaction(STORE_ASSETS, 'readwrite');
       const store = tx.objectStore(STORE_ASSETS);
       const results: PhotoData[] = [];

       items.forEach((item, index) => {
           const id = `mem_${Date.now()}_${index}_${Math.random().toString(36).substr(2,5)}`;
           const isFile = item.source instanceof File;
           
           const record: AssetRecord = {
             id,
             text: item.text,
             type: isFile ? 'local' : 'remote',
             url: isFile ? '' : (item.source as string), 
             blob: isFile ? (item.source as File) : undefined,
             timestamp: Date.now() + index
           };
           
           store.add(record);
           
           results.push({
               id,
               text: item.text,
               url: isFile ? URL.createObjectURL(item.source as File) : (item.source as string)
           });
       });

       tx.oncomplete = () => {
         resolve(results);
       };
       tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Upserts the hardcoded memories into the DB.
   * This ensures that if you change memories.ts, the DB updates.
   */
  async syncPreloaded() {
    return new Promise<void>((resolve, reject) => {
       const tx = this.db!.transaction(STORE_ASSETS, 'readwrite');
       const store = tx.objectStore(STORE_ASSETS);
       
       PRELOADED_MEMORIES.forEach((pm, index) => {
         const record: AssetRecord = {
           id: pm.id,
           text: pm.text,
           type: 'remote',
           url: pm.url,
           timestamp: index // Keep them at the start
         };
         store.put(record); // put() updates if key exists, adds if not
       });

       tx.oncomplete = () => resolve();
       tx.onerror = () => reject(tx.error);
    });
  }
};
