let currentImageBase64 = null;
const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const headerTitle = document.getElementById('header-title');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        registerServiceWorker();
        setupNavigation();
        setupCameraAndLogging();
        setupSettings();
        updateDashboard();
    } catch (err) { console.error('App init error:', err); }
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW error:', err));
    }
}

function navigateTo(target) {
    const backBtn = document.getElementById('back-btn');
    navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === target));
    views.forEach(v => v.id === target ? v.classList.remove('hidden') : v.classList.add('hidden'));
    backBtn.classList.toggle('hidden', target === 'view-dashboard');

    if (target === 'view-dashboard') { headerTitle.textContent = "Today's Overview"; updateDashboard(); }
    else if (target === 'view-log')      headerTitle.textContent = "Log Your Meal";
    else if (target === 'view-summary')  { headerTitle.textContent = "Weekly Trends"; updateWeeklySummary(); }
    else if (target === 'view-settings') headerTitle.textContent = "Configuration";
}

function setupNavigation() {
    navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-target'))));
    document.getElementById('back-btn').addEventListener('click', () => navigateTo('view-dashboard'));
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getGoals() {
    const [cals, protein, carbs, fats] = await Promise.all([
        getSetting('goal_calories'), getSetting('goal_protein'),
        getSetting('goal_carbs'), getSetting('goal_fats')
    ]);
    return {
        calories: parseInt(cals) || 2000,
        protein:  parseInt(protein) || 150,
        carbs:    parseInt(carbs) || 200,
        fats:     parseInt(fats) || 65
    };
}

async function callGemini(apiKey, prompt, imageBase64 = null) {
    const parts = [{ text: prompt }];
    if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return JSON.parse(data.candidates[0].content.parts[0].text);
}

function sanitizeMeal(raw, fallbackName) {
    return {
        name:     String(raw.name || fallbackName).slice(0, 120),
        calories: Math.max(0, Math.round(Number(raw.calories) || 0)),
        protein:  Math.max(0, Math.round(Number(raw.protein)  || 0)),
        carbs:    Math.max(0, Math.round(Number(raw.carbs)    || 0)),
        fats:     Math.max(0, Math.round(Number(raw.fats)     || 0))
    };
}

function setupCameraAndLogging() {
    const cameraInput       = document.getElementById('camera-input');
    const imagePreview      = document.getElementById('image-preview');
    const previewContainer  = document.getElementById('image-preview-container');
    const manualFoodInput   = document.getElementById('manual-food-name');
    const analyzeBtn        = document.getElementById('analyze-btn');
    const manualLogBtn      = document.getElementById('manual-log-btn');

    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 600;
                const scale = Math.min(MAX_W / img.width, 1);
                canvas.width  = img.width  * scale;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                currentImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                imagePreview.src = currentImageBase64;
                previewContainer.classList.remove('hidden');
                analyzeBtn.textContent = 'Analyze Food';
                analyzeBtn.disabled = false;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    analyzeBtn.addEventListener('click', async () => {
        const apiKey = await getSetting('gemini_key');
        if (!apiKey) {
            alert('Please save your free Google Gemini API key in the Config tab first.\n\nGet one free at: aistudio.google.com');
            return;
        }
        analyzeBtn.textContent = 'Analyzing…';
        analyzeBtn.disabled = true;
        try {
            const base64Data = currentImageBase64.split(',')[1];
            const prompt = 'You are a nutritionist. Analyze this food image and estimate nutritional content. Return ONLY valid JSON: {"name":"Food Name","calories":0,"protein":0,"carbs":0,"fats":0}. All numeric values must be integers in grams or kcal.';
            const raw = await callGemini(apiKey, prompt, base64Data);
            await saveMeal({ date: getTodayString(), ...sanitizeMeal(raw, 'Unknown Food'), image: currentImageBase64, status: 'analyzed' });
            currentImageBase64 = null;
            previewContainer.classList.add('hidden');
            cameraInput.value = '';
            navigateTo('view-dashboard');
        } catch (err) {
            console.error('Analysis error:', err);
            alert(`AI analysis failed: ${err.message}\n\nCheck your Gemini API key in Config.`);
            analyzeBtn.textContent = 'Analyze Food';
            analyzeBtn.disabled = false;
        }
    });

    manualLogBtn.addEventListener('click', async () => {
        const text = manualFoodInput.value.trim();
        if (!text) return;

        const apiKey = await getSetting('gemini_key');
        if (apiKey) {
            const orig = manualLogBtn.textContent;
            manualLogBtn.textContent = 'Estimating…';
            manualLogBtn.disabled = true;
            try {
                const prompt = `You are a nutritionist. Estimate the nutritional content of this meal: "${text.replace(/"/g, '')}". Use typical serving sizes. Return ONLY valid JSON: {"name":"Food Name","calories":0,"protein":0,"carbs":0,"fats":0}. All numeric values must be integers.`;
                const raw = await callGemini(apiKey, prompt);
                await saveMeal({ date: getTodayString(), ...sanitizeMeal(raw, text), image: null, status: 'estimated' });
            } catch (err) {
                console.error('Manual entry error:', err);
                await saveMeal({ date: getTodayString(), name: text.slice(0, 120), calories: 0, protein: 0, carbs: 0, fats: 0, image: null, status: 'manual' });
            } finally {
                manualLogBtn.textContent = orig;
                manualLogBtn.disabled = false;
            }
        } else {
            await saveMeal({ date: getTodayString(), name: text.slice(0, 120), calories: 0, protein: 0, carbs: 0, fats: 0, image: null, status: 'manual' });
        }
        manualFoodInput.value = '';
        navigateTo('view-dashboard');
    });
}

function setupSettings() {
    const keyInput  = document.getElementById('api-key-input');
    const statusMsg = document.getElementById('settings-status');
    const goalIds   = ['goal-calories', 'goal-protein', 'goal-carbs', 'goal-fats'];
    const goalKeys  = ['goal_calories', 'goal_protein', 'goal_carbs', 'goal_fats'];

    getSetting('gemini_key').then(k => { if (k) keyInput.value = '••••••••••••••••••••'; });

    Promise.all(goalKeys.map(k => getSetting(k))).then(vals => {
        vals.forEach((v, i) => { if (v) document.getElementById(goalIds[i]).value = v; });
    });

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const key = keyInput.value.trim();
        if (key && !key.startsWith('••••')) {
            await saveSetting('gemini_key', key);
            statusMsg.textContent = 'API key saved!';
            statusMsg.style.color = '#34C759';
        }
    });

    document.getElementById('save-goals-btn').addEventListener('click', async () => {
        await Promise.all(goalIds.map((id, i) => {
            const val = parseInt(document.getElementById(id).value) || 0;
            return saveSetting(goalKeys[i], String(val));
        }));
        const gs = document.getElementById('goals-status');
        gs.textContent = 'Goals saved!';
        gs.style.color = '#34C759';
    });
}

async function updateDashboard() {
    const [meals, goals] = await Promise.all([getMealsByDate(getTodayString()), getGoals()]);
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    container.innerHTML = '';
    if (meals.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No meals logged today. Tap + to add one!';
        container.appendChild(empty);
    } else {
        meals.forEach(m => {
            c += m.calories; p += m.protein; cb += m.carbs; f += m.fats;
            container.appendChild(createMealCard(m));
        });
    }

    document.getElementById('calories-consumed').textContent = c;
    const pct = Math.min((c / goals.calories) * 100, 100);
    document.getElementById('calorie-ring').style.background =
        `conic-gradient(var(--primary) ${pct}%, #E5E5EA ${pct}%)`;
    updateMacroRow('.protein-fill', p,  goals.protein);
    updateMacroRow('.carbs-fill',   cb, goals.carbs);
    updateMacroRow('.fats-fill',    f,  goals.fats);
}

function createMealCard(m) {
    const row = document.createElement('div');
    row.className = 'card meal-card';

    const thumb = document.createElement('div');
    thumb.className = 'meal-thumb';
    if (m.image) {
        const img = document.createElement('img');
        img.src = m.image;
        img.alt = '';
        thumb.appendChild(img);
    } else {
        thumb.classList.add('meal-thumb-placeholder');
        thumb.textContent = '🍽️';
    }

    const info = document.createElement('div');
    info.className = 'meal-info';

    const name = document.createElement('div');
    name.className = 'meal-name';
    name.textContent = m.name;

    const macros = document.createElement('div');
    macros.className = 'meal-macros';
    macros.textContent = `P: ${m.protein}g  C: ${m.carbs}g  F: ${m.fats}g`;

    info.appendChild(name);
    info.appendChild(macros);

    const calDiv = document.createElement('div');
    calDiv.className = 'meal-cals';
    const calNum = document.createElement('div');
    calNum.className = 'meal-cal-num';
    calNum.textContent = m.calories;
    const calLabel = document.createElement('div');
    calLabel.className = 'meal-cal-label';
    calLabel.textContent = 'cal';
    calDiv.appendChild(calNum);
    calDiv.appendChild(calLabel);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', async () => {
        if (m.id !== undefined) { await deleteMeal(m.id); updateDashboard(); }
    });

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(calDiv);
    row.appendChild(del);
    return row;
}

function updateMacroRow(cls, cur, tgt) {
    const el = document.querySelector(cls);
    if (!el) return;
    el.style.width = `${Math.min((cur / (tgt || 1)) * 100, 100)}%`;
    el.closest('.macro-row').querySelector('.macro-value').textContent = `${cur}g`;
}

async function updateWeeklySummary() {
    let sc = 0, sp = 0, scb = 0, sf = 0, loggedDays = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const meals = await getMealsByDate(dStr);
        if (meals.length > 0) {
            loggedDays++;
            meals.forEach(m => { sc += m.calories; sp += m.protein; scb += m.carbs; sf += m.fats; });
        }
    }
    const div = loggedDays || 1;
    document.getElementById('avg-cals').textContent    = Math.round(sc  / div);
    document.getElementById('avg-protein').textContent = `${Math.round(sp  / div)}g`;
    document.getElementById('avg-carbs').textContent   = `${Math.round(scb / div)}g`;
    document.getElementById('avg-fats').textContent    = `${Math.round(sf  / div)}g`;
}
