// Push subscription credentials for the service worker's
// `pushsubscriptionchange` handler. Stored in IndexedDB because localStorage
// does not exist in service worker scope. Records are keyed per endpoint so
// multi-account setups report rotations to the right server.
//
// NOTE: public/push-handler.js duplicates this schema (service workers can't
// import app code). Keep DB_NAME/STORE_NAME/keyPath in sync between the two.

export interface PushCredentials {
  endpoint: string
  serverUrl: string
  token: string
}

const DB_NAME = 'collct-push-credentials'
const DB_VERSION = 1
const STORE_NAME = 'credentials'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'endpoint' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const pushCredentials = {
  async save(record: PushCredentials): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  async deleteForServer(serverUrl: string): Promise<void> {
    const db = await openDB()
    const all: PushCredentials[] = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const targets = all.filter(r => r.serverUrl === serverUrl)
    if (!targets.length) return
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      for (const t of targets) store.delete(t.endpoint)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
