let currentImageBase64 = null;
const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const headerTitle = document.getElementById('header-title');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        registerServiceWorker();
        setupNavigation();
        setupFoodSearch();
        setupCamera();
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

// ── FOOD SEARCH (local database — no API or internet required) ────────────────

function setupFoodSearch() {
    const searchInput   = document.getElementById('food-search-input');
    const dropdown      = document.getElementById('food-search-results');
    const confirmPanel  = document.getElementById('food-confirm-panel');
    const confirmName   = document.getElementById('confirm-food-name');
    const confirmCal    = document.getElementById('confirm-food-cal');
    const confirmMacros = document.getElementById('confirm-food-macros');
    const confirmSrv    = document.getElementById('confirm-srv-label');
    const qtyInput      = document.getElementById('confirm-qty');
    const qtyMinus      = document.getElementById('qty-minus');
    const qtyPlus       = document.getElementById('qty-plus');
    const addBtn        = document.getElementById('confirm-add-btn');
    const cancelBtn     = document.getElementById('confirm-cancel-btn');
    const onlineBtn     = document.getElementById('search-online-btn');

    let selectedFood = null;
    let debounce = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            const q = searchInput.value.trim();
            if (q.length < 2) { hideDropdown(); return; }
            renderDropdown(searchFoods(q));
        }, 150);
    });

    searchInput.addEventListener('focus', () => {
        const q = searchInput.value.trim();
        if (q.length >= 2) renderDropdown(searchFoods(q));
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) hideDropdown();
    });

    function renderDropdown(foods) {
        dropdown.innerHTML = '';
        if (foods.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'food-no-result';
            msg.textContent = 'No results — try "Search Online" below for packaged or rare foods.';
            dropdown.appendChild(msg);
        } else {
            foods.forEach(food => {
                const item = document.createElement('div');
                item.className = 'food-result-item';
                const nameEl = document.createElement('span');
                nameEl.className = 'food-result-name';
                nameEl.textContent = food.n;
                const rightEl = document.createElement('span');
                rightEl.className = 'food-result-right';
                rightEl.innerHTML = `<b>${food.c}</b> cal<br><small>${food.s}</small>`;
                item.appendChild(nameEl);
                item.appendChild(rightEl);
                item.addEventListener('mousedown', e => { e.preventDefault(); selectFood(food); });
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.remove('hidden');
    }

    function hideDropdown() { dropdown.classList.add('hidden'); }

    function selectFood(food) {
        selectedFood = food;
        searchInput.value = food.n;
        hideDropdown();
        confirmName.textContent = food.n;
        confirmCal.textContent = `${food.c} cal per serving`;
        confirmMacros.textContent = `Protein: ${food.p}g  •  Carbs: ${food.cb}g  •  Fat: ${food.f}g`;
        confirmSrv.textContent = food.s;
        qtyInput.value = '1';
        confirmPanel.classList.remove('hidden');
        confirmPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    qtyMinus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 1;
        qtyInput.value = Math.max(0.5, parseFloat((v - 0.5).toFixed(1)));
    });
    qtyPlus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 1;
        qtyInput.value = Math.min(20, parseFloat((v + 0.5).toFixed(1)));
    });

    addBtn.addEventListener('click', async () => {
        if (!selectedFood) return;
        const qty = Math.max(0.5, parseFloat(qtyInput.value) || 1);
        await saveMeal({
            date:     getTodayString(),
            name:     qty === 1 ? selectedFood.n : `${selectedFood.n} ×${qty}`,
            calories: Math.round(selectedFood.c * qty),
            protein:  Math.round(selectedFood.p * qty),
            carbs:    Math.round(selectedFood.cb * qty),
            fats:     Math.round(selectedFood.f * qty),
            image:    null,
            status:   'database'
        });
        resetSearch();
        navigateTo('view-dashboard');
    });

    cancelBtn.addEventListener('click', resetSearch);

    function resetSearch() {
        selectedFood = null;
        searchInput.value = '';
        confirmPanel.classList.add('hidden');
        hideDropdown();
    }

    // Online fallback — Open Food Facts (completely free, no API key)
    onlineBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) { searchInput.focus(); return; }
        const orig = onlineBtn.textContent;
        onlineBtn.textContent = 'Searching…';
        onlineBtn.disabled = true;
        try {
            const results = await searchOpenFoodFacts(q);
            if (results.length === 0) {
                alert(`No online results found for "${q}".\nTry a simpler search term.`);
            } else {
                renderDropdown(results);
            }
        } catch {
            alert('Online search failed. Check your internet connection and try again.');
        } finally {
            onlineBtn.textContent = orig;
            onlineBtn.disabled = false;
        }
    });
}

async function searchOpenFoodFacts(query) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=12&fields=product_name,nutriments,serving_size`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return (data.products || [])
        .filter(p => p.product_name && p.nutriments &&
            (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal_serving']))
        .map(p => {
            const n = p.nutriments;
            const srv = n['energy-kcal_serving'] != null;
            return {
                n:  p.product_name.replace(/,\s*$/, '').slice(0, 70),
                c:  Math.round(srv ? (n['energy-kcal_serving'] || 0) : (n['energy-kcal_100g'] || 0)),
                p:  Math.round(srv ? (n['proteins_serving'] || 0) : (n['proteins_100g'] || 0)),
                cb: Math.round(srv ? (n['carbohydrates_serving'] || 0) : (n['carbohydrates_100g'] || 0)),
                f:  Math.round(srv ? (n['fat_serving'] || 0) : (n['fat_100g'] || 0)),
                s:  p.serving_size ? p.serving_size.slice(0, 30) : (srv ? '1 serving' : '100g')
            };
        })
        .filter(f => f.c > 0)
        .slice(0, 8);
}

// ── CAMERA & AI PHOTO ANALYSIS (Gemini — optional, free) ─────────────────────

function setupCamera() {
    const cameraInput      = document.getElementById('camera-input');
    const imagePreview     = document.getElementById('image-preview');
    const previewContainer = document.getElementById('image-preview-container');
    const analyzeBtn       = document.getElementById('analyze-btn');

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
                analyzeBtn.textContent = 'Analyze with AI';
                analyzeBtn.disabled = false;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    analyzeBtn.addEventListener('click', async () => {
        const apiKey = await getSetting('gemini_key');
        if (!apiKey) {
            alert('AI photo analysis requires a free Gemini API key.\n\nGo to Config tab → enter your key → Save Key.\nGet a free key at: aistudio.google.com\n\n(Text search in the section above works without any API key.)');
            return;
        }
        analyzeBtn.textContent = 'Analyzing…';
        analyzeBtn.disabled = true;
        try {
            const base64Data = currentImageBase64.split(',')[1];
            const prompt = 'You are a nutritionist. Analyze this food image and estimate nutritional content. Return ONLY valid JSON: {"name":"Food Name","calories":0,"protein":0,"carbs":0,"fats":0}. All numeric values must be integers in grams or kcal.';
            const raw = await callGemini(apiKey, prompt, base64Data);
            await saveMeal({ date: getTodayString(), ...sanitizeMeal(raw, 'Unknown Food'), image: currentImageBase64, status: 'ai-analyzed' });
            currentImageBase64 = null;
            previewContainer.classList.add('hidden');
            cameraInput.value = '';
            navigateTo('view-dashboard');
        } catch (err) {
            console.error('AI analysis error:', err);
            alert(`AI analysis failed: ${err.message}\n\nTip: Use "Test Key" in Config to verify your API key.`);
            analyzeBtn.textContent = 'Analyze with AI';
            analyzeBtn.disabled = false;
        }
    });
}

// ── GEMINI (used only for AI photo analysis) ──────────────────────────────────

async function callGemini(apiKey, prompt, imageBase64 = null) {
    const parts = [{ text: prompt }];
    if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
    const body = JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' }
    });
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    let lastError;
    for (const model of models) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
        );
        const data = await res.json();
        if (data.error) {
            lastError = new Error(data.error.message);
            if (data.error.code === 404 || (data.error.status || '').includes('NOT_FOUND')) continue;
            throw lastError;
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from Gemini. Try again.');
        return JSON.parse(text);
    }
    throw lastError;
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

// ── SETTINGS ──────────────────────────────────────────────────────────────────

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

    document.getElementById('test-key-btn').addEventListener('click', async () => {
        const stored = await getSetting('gemini_key');
        const typed  = keyInput.value.trim();
        const key = (typed && !typed.startsWith('••••')) ? typed : stored;
        if (!key) { statusMsg.textContent = 'Enter and save your API key first.'; statusMsg.style.color = '#FF4060'; return; }
        statusMsg.textContent = 'Testing connection…';
        statusMsg.style.color = 'var(--muted)';
        try {
            const result = await callGemini(key, 'Return ONLY this exact JSON: {"name":"test","calories":100,"protein":5,"carbs":10,"fats":3}');
            if (result && result.calories !== undefined) {
                statusMsg.textContent = '✓ API key works! AI photo analysis is ready.';
                statusMsg.style.color = '#34C759';
            } else {
                throw new Error('Unexpected response format.');
            }
        } catch (err) {
            statusMsg.textContent = `✗ Failed: ${err.message}`;
            statusMsg.style.color = '#FF4060';
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

// ── DASHBOARD ──────────────────────────────────────────────────────────────────

async function updateDashboard() {
    const [meals, goals] = await Promise.all([getMealsByDate(getTodayString()), getGoals()]);
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    container.innerHTML = '';
    if (meals.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No meals logged today. Tap Log to add one!';
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
