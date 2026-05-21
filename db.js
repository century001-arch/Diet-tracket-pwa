const DB_NAME = 'NutriSnapDB';
const DB_VERSION = 2;
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (e) => reject(e.target.error);
        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('meals')) {
                d.createObjectStore('meals', { keyPath: 'id', autoIncrement: true })
                 .createIndex('date', 'date', { unique: false });
            }
            if (!d.objectStoreNames.contains('settings')) {
                d.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!d.objectStoreNames.contains('workouts')) {
                d.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true })
                 .createIndex('date', 'date', { unique: false });
            }
        };
    });
}

function saveMeal(meal) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['meals'], 'readwrite');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('meals').put(meal).onsuccess = (e) => resolve(e.target.result);
    });
}

function deleteMeal(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['meals'], 'readwrite');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('meals').delete(id).onsuccess = () => resolve();
    });
}

function getMealsByDate(dateString) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['meals'], 'readonly');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('meals').index('date').getAll(dateString).onsuccess = (e) => resolve(e.target.result);
    });
}

function getMealsByMonth(yearMonth) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['meals'], 'readonly');
        tx.onerror = (e) => reject(e.target.error);
        const range = IDBKeyRange.bound(yearMonth + '-01', yearMonth + '-31');
        tx.objectStore('meals').index('date').getAll(range).onsuccess = (e) => resolve(e.target.result);
    });
}

function saveWorkout(workout) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['workouts'], 'readwrite');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('workouts').put(workout).onsuccess = (e) => resolve(e.target.result);
    });
}

function deleteWorkout(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['workouts'], 'readwrite');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('workouts').delete(id).onsuccess = () => resolve();
    });
}

function getWorkoutsByDate(dateString) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['workouts'], 'readonly');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('workouts').index('date').getAll(dateString).onsuccess = (e) => resolve(e.target.result);
    });
}

function getWorkoutsByMonth(yearMonth) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['workouts'], 'readonly');
        tx.onerror = (e) => reject(e.target.error);
        const range = IDBKeyRange.bound(yearMonth + '-01', yearMonth + '-31');
        tx.objectStore('workouts').index('date').getAll(range).onsuccess = (e) => resolve(e.target.result);
    });
}

function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['settings'], 'readwrite');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('settings').put({ key, value }).onsuccess = () => resolve();
    });
}

function getSetting(key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['settings'], 'readonly');
        tx.onerror = (e) => reject(e.target.error);
        tx.objectStore('settings').get(key).onsuccess = (e) => {
            resolve(e.target.result ? e.target.result.value : null);
        };
    });
}

function exportAllData() {
    return new Promise((resolve, reject) => {
        const out = { meals: [], workouts: [], settings: [] };
        const tx  = db.transaction(['meals', 'workouts', 'settings'], 'readonly');
        tx.onerror    = e => reject(e.target.error);
        tx.oncomplete = () => resolve(out);
        tx.objectStore('meals').getAll().onsuccess    = e => { out.meals    = e.target.result; };
        tx.objectStore('workouts').getAll().onsuccess = e => { out.workouts = e.target.result; };
        tx.objectStore('settings').getAll().onsuccess = e => { out.settings = e.target.result; };
    });
}

async function importAllData(backup) {
    const stores = ['meals', 'workouts', 'settings'];
    // Clear each store first
    await Promise.all(stores.map(name => new Promise((resolve, reject) => {
        const tx = db.transaction([name], 'readwrite');
        tx.onerror = e => reject(e.target.error);
        tx.oncomplete = () => resolve();
        tx.objectStore(name).clear();
    })));
    // Re-populate from backup
    return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        tx.onerror    = e => reject(e.target.error);
        tx.oncomplete = () => resolve();
        // Meals and workouts: strip id so IndexedDB assigns fresh auto-increment keys
        (backup.meals || []).forEach(m => {
            const { id, ...rest } = m;
            tx.objectStore('meals').add(rest);
        });
        (backup.workouts || []).forEach(w => {
            const { id, ...rest } = w;
            tx.objectStore('workouts').add(rest);
        });
        // Settings: key-based, put() acts as upsert
        (backup.settings || []).forEach(s => tx.objectStore('settings').put(s));
    });
}
