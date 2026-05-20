const DB_NAME = 'NutriSnapDB';
const DB_VERSION = 1;
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
