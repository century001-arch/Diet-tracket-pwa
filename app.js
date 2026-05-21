// ── Global state ──────────────────────────────────────────────────────────────
let selectedDate   = getTodayString();
let calendarYear   = new Date().getFullYear();
let calendarMonth  = new Date().getMonth();
let monthCalData   = {};

const views       = document.querySelectorAll('.view');
const navButtons  = document.querySelectorAll('.nav-btn');
const headerTitle = document.getElementById('header-title');

// In-memory cache so repeat searches don't burn the daily quota
const searchCache = new Map();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        registerServiceWorker();
        setupNavigation();
        await setupCalendar();
        setupFoodSearch();
        setupSettings();
    } catch (err) { console.error('App init error:', err); }
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(e => console.error('SW:', e));
    }
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

// ── Navigation ─────────────────────────────────────────────────────────────────

function navigateTo(target) {
    const backBtn = document.getElementById('back-btn');
    navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === target));
    views.forEach(v => v.id === target ? v.classList.remove('hidden') : v.classList.add('hidden'));
    backBtn.classList.toggle('hidden', target === 'view-dashboard');

    if (target === 'view-dashboard') {
        headerTitle.textContent = selectedDate === getTodayString() ? "Today's Overview" : formatDateDisplay(selectedDate);
        updateDashboard();
    } else if (target === 'view-log') {
        headerTitle.textContent = "Log Your Meal";
        updateLogDateLabel();
    } else if (target === 'view-summary') {
        headerTitle.textContent = "Weekly Trends";
        updateWeeklySummary();
    } else if (target === 'view-settings') {
        headerTitle.textContent = "Goals";
    }
}

function setupNavigation() {
    navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-target'))));
    document.getElementById('back-btn').addEventListener('click', () => navigateTo('view-dashboard'));
}

function updateLogDateLabel() {
    const el = document.getElementById('log-date-label');
    if (el) el.textContent = selectedDate === getTodayString() ? 'Today' : formatDateDisplay(selectedDate);
}

// ── Goals ──────────────────────────────────────────────────────────────────────

async function getGoals() {
    const [cals, protein, carbs, fats] = await Promise.all([
        getSetting('goal_calories'), getSetting('goal_protein'),
        getSetting('goal_carbs'), getSetting('goal_fats')
    ]);
    return {
        calories: parseInt(cals)  || 2000,
        protein:  parseInt(protein) || 150,
        carbs:    parseInt(carbs)   || 200,
        fats:     parseInt(fats)    || 65
    };
}

// ── Calendar ───────────────────────────────────────────────────────────────────

async function setupCalendar() {
    const today = new Date();
    calendarYear  = today.getFullYear();
    calendarMonth = today.getMonth();
    await refreshCalendar();

    document.getElementById('cal-prev').addEventListener('click', async () => {
        if (--calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        await refreshCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', async () => {
        if (++calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        await refreshCalendar();
    });
    document.getElementById('cal-today-btn').addEventListener('click', async () => {
        const t = new Date();
        calendarYear = t.getFullYear(); calendarMonth = t.getMonth();
        await selectDate(getTodayString());
    });
}

async function refreshCalendar() {
    const ym    = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;
    const meals = await getMealsByMonth(ym);
    monthCalData = {};
    for (const m of meals) monthCalData[m.date] = (monthCalData[m.date] || 0) + m.calories;
    renderCalendar();
    await updateDashboard();
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function renderCalendar() {
    const grid  = document.getElementById('cal-grid');
    const label = document.getElementById('cal-month-label');
    label.textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
    grid.innerHTML = '';

    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'cal-day-name'; h.textContent = d; grid.appendChild(h);
    });

    const firstDow = new Date(calendarYear, calendarMonth, 1).getDay();
    for (let i = 0; i < (firstDow + 6) % 7; i++) {
        const e = document.createElement('div'); e.className = 'cal-empty'; grid.appendChild(e);
    }

    const days  = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today = getTodayString();

    for (let d = 1; d <= days; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateStr === today)        cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');

        const num = document.createElement('span'); num.className = 'cal-day-num'; num.textContent = d;
        cell.appendChild(num);

        const cals = monthCalData[dateStr];
        if (cals) {
            const calEl = document.createElement('span');
            calEl.className = 'cal-day-cal';
            calEl.textContent = cals >= 1000 ? `${(cals/1000).toFixed(1)}k` : cals;
            cell.appendChild(calEl);
            cell.classList.add('has-data');
        }
        cell.addEventListener('click', () => selectDate(dateStr));
        grid.appendChild(cell);
    }
}

async function selectDate(dateStr) {
    selectedDate = dateStr;
    const parts = dateStr.split('-');
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
    if (y !== calendarYear || m !== calendarMonth) {
        calendarYear = y; calendarMonth = m;
        const ym    = `${y}-${String(m+1).padStart(2,'0')}`;
        const meals = await getMealsByMonth(ym);
        monthCalData = {};
        for (const meal of meals) monthCalData[meal.date] = (monthCalData[meal.date] || 0) + meal.calories;
    }
    renderCalendar();
    headerTitle.textContent = dateStr === getTodayString() ? "Today's Overview" : formatDateDisplay(dateStr);
    await updateDashboard();
}

// ── USDA FoodData Central search ───────────────────────────────────────────────

async function searchUSDA(query) {
    if (!query || query.length < 2) return [];

    const key = query.toLowerCase().trim();
    if (searchCache.has(key)) return searchCache.get(key);

    const apiKey = await getSetting('usda_key') || 'DEMO_KEY';
    const types  = encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS)');
    const url    = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=${types}&pageSize=12&api_key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (res.status === 429) throw new Error('Daily search limit reached (50/day with default key).\nAdd a free personal key in the Goals tab.');
    if (!res.ok) throw new Error(`USDA search error: ${res.status}`);

    const data = await res.json();
    const results = (data.foods || [])
        .map(food => {
            const n = extractNutrients(food.foodNutrients || []);
            if (!n.c) return null;
            return { n: food.description.slice(0, 80), ...n, liquid: isLiquid(food.description) };
        })
        .filter(Boolean)
        .slice(0, 10);

    searchCache.set(key, results);
    return results;
}

function extractNutrients(foodNutrients) {
    let c = 0, p = 0, cb = 0, f = 0;
    for (const n of foodNutrients) {
        const nm  = (n.nutrientName || '').toLowerCase();
        const val = Number(n.value) || 0;
        if (!c  && (n.nutrientId === 1008 || n.nutrientId === 2047 || (nm === 'energy' && (n.unitName || '').toUpperCase() === 'KCAL'))) c  = val;
        if (!p  && (n.nutrientId === 1003 || nm === 'protein'))                    p  = val;
        if (!cb && (n.nutrientId === 1005 || nm.startsWith('carbohydrate')))       cb = val;
        if (!f  && (n.nutrientId === 1004 || nm.includes('total lipid')))          f  = val;
    }
    return { c: Math.round(c), p: Math.round(p), cb: Math.round(cb), f: Math.round(f) };
}

function isLiquid(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return ['juice', 'milk', 'water', 'beverage', 'drink', 'tea', 'coffee', 'beer', 'wine',
            'broth', 'soup', 'shake', 'smoothie', 'latte', 'espresso', 'cider', 'soda',
            'cola', 'lassi', 'buttermilk', 'coke', 'rum', 'whiskey', 'vodka'].some(w => lower.includes(w));
}

// ── Open Food Facts fallback ───────────────────────────────────────────────────

async function searchOpenFoodFacts(query) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=12&fields=product_name,nutriments,serving_size`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return (data.products || [])
        .filter(p => p.product_name && p.nutriments &&
            (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal_serving']))
        .map(p => {
            const n = p.nutriments, srv = n['energy-kcal_serving'] != null;
            return {
                n:  p.product_name.replace(/,\s*$/, '').slice(0, 70),
                c:  Math.round(srv ? (n['energy-kcal_serving'] || 0)    : (n['energy-kcal_100g'] || 0)),
                p:  Math.round(srv ? (n['proteins_serving'] || 0)        : (n['proteins_100g'] || 0)),
                cb: Math.round(srv ? (n['carbohydrates_serving'] || 0)   : (n['carbohydrates_100g'] || 0)),
                f:  Math.round(srv ? (n['fat_serving'] || 0)             : (n['fat_100g'] || 0)),
                s:  p.serving_size ? p.serving_size.slice(0, 30) : (srv ? '1 serving' : '100g'),
                liquid: false,
                offUnit: srv ? (p.serving_size || 'per serving') : 'per 100g'
            };
        })
        .filter(f => f.c > 0)
        .slice(0, 8);
}

// ── Food Search UI ─────────────────────────────────────────────────────────────

function setupFoodSearch() {
    const searchInput = document.getElementById('food-search-input');
    const dropdown    = document.getElementById('food-search-results');
    const qtyInput    = document.getElementById('food-qty');
    const qtyMinus    = document.getElementById('qty-minus');
    const qtyPlus     = document.getElementById('qty-plus');
    const qtyUnitEl   = document.getElementById('qty-unit-label');
    const nutPreview  = document.getElementById('nutrition-preview');
    const addBtn      = document.getElementById('add-meal-btn');
    const onlineBtn   = document.getElementById('search-online-btn');

    let selectedFood = null;
    let currentUnit  = 'g'; // 'g' or 'ml'
    let debounce     = null;

    // ── Search input ──
    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        resetFoodSelection();
        const q = searchInput.value.trim();
        if (q.length < 2) { hideDropdown(); return; }
        showLoadingDropdown();
        debounce = setTimeout(async () => {
            try {
                const results = await searchUSDA(q);
                renderDropdown(results, 'usda');
            } catch (err) {
                showErrorDropdown(err.message);
            }
        }, 700);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2 && !selectedFood) searchInput.dispatchEvent(new Event('input'));
    });

    document.addEventListener('click', e => { if (!e.target.closest('.search-wrapper')) hideDropdown(); });

    // ── Dropdown rendering ──
    function showLoadingDropdown() {
        dropdown.innerHTML = '<div class="food-no-result">Searching USDA database…</div>';
        dropdown.classList.remove('hidden');
    }

    function showErrorDropdown(msg) {
        dropdown.innerHTML = `<div class="food-no-result food-error">${msg}</div>`;
        dropdown.classList.remove('hidden');
    }

    function renderDropdown(foods, source) {
        dropdown.innerHTML = '';
        if (!foods || foods.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'food-no-result';
            msg.textContent = 'No results — try "Search Online" for packaged/branded foods.';
            dropdown.appendChild(msg);
        } else {
            const src = document.createElement('div');
            src.className = 'food-source-label';
            src.textContent = source === 'usda' ? 'USDA FoodData Central • per 100g' : 'Open Food Facts';
            dropdown.appendChild(src);

            foods.forEach(food => {
                const item = document.createElement('div');
                item.className = 'food-result-item';

                const nameEl = document.createElement('span');
                nameEl.className = 'food-result-name';
                nameEl.textContent = food.n;

                const rightEl = document.createElement('span');
                rightEl.className = 'food-result-right';
                const unit = food.offUnit || (food.liquid ? 'per 100ml' : 'per 100g');
                rightEl.innerHTML = `<b>${food.c}</b> cal<br><small>${unit}</small>`;

                item.appendChild(nameEl); item.appendChild(rightEl);
                item.addEventListener('mousedown', e => { e.preventDefault(); selectFood(food); });
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.remove('hidden');
    }

    function hideDropdown() { dropdown.classList.add('hidden'); }

    // ── Food selection ──
    function selectFood(food) {
        selectedFood = food;
        searchInput.value = food.n;
        hideDropdown();

        // Set unit based on food type
        currentUnit = food.liquid ? 'ml' : 'g';
        qtyInput.value = food.liquid ? '250' : '100';
        qtyUnitEl.textContent = currentUnit;

        addBtn.disabled = false;
        updateNutritionPreview();
    }

    function resetFoodSelection() {
        selectedFood  = null;
        currentUnit   = 'g';
        qtyUnitEl.textContent = 'g';
        nutPreview.classList.add('hidden');
        addBtn.disabled = true;
    }

    // ── Quantity controls ──
    const step = () => currentUnit === 'ml' ? 50 : 25;

    qtyMinus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 100;
        qtyInput.value = Math.max(step(), v - step());
        updateNutritionPreview();
    });
    qtyPlus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 100;
        qtyInput.value = Math.min(2000, v + step());
        updateNutritionPreview();
    });
    qtyInput.addEventListener('input', updateNutritionPreview);

    function updateNutritionPreview() {
        if (!selectedFood) { nutPreview.classList.add('hidden'); return; }
        const qty  = Math.max(1, parseFloat(qtyInput.value) || 100);
        const unit = currentUnit;
        // USDA values are per 100g; Open Food Facts per-serving foods already have absolute values
        const mult = selectedFood.offUnit ? 1 : qty / 100;
        const cal  = Math.round(selectedFood.c  * mult);
        const p    = Math.round(selectedFood.p  * mult);
        const cb   = Math.round(selectedFood.cb * mult);
        const f    = Math.round(selectedFood.f  * mult);
        nutPreview.textContent = `${qty}${unit}: ${cal} cal  •  P: ${p}g  •  C: ${cb}g  •  F: ${f}g`;
        nutPreview.classList.remove('hidden');
    }

    // ── Add to Log ──
    addBtn.addEventListener('click', async () => {
        if (!selectedFood) return;
        const qty  = Math.max(1, parseFloat(qtyInput.value) || 100);
        const unit = currentUnit;
        const mult = selectedFood.offUnit ? 1 : qty / 100;

        await saveMeal({
            date:     selectedDate,
            name:     `${selectedFood.n} (${qty}${unit})`,
            calories: Math.round(selectedFood.c  * mult),
            protein:  Math.round(selectedFood.p  * mult),
            carbs:    Math.round(selectedFood.cb * mult),
            fats:     Math.round(selectedFood.f  * mult),
            image:    null,
            status:   'usda'
        });

        // Refresh calendar month data
        const ym    = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;
        const meals = await getMealsByMonth(ym);
        monthCalData = {};
        for (const m of meals) monthCalData[m.date] = (monthCalData[m.date] || 0) + m.calories;

        resetFoodSelection();
        searchInput.value = '';
        qtyInput.value = '100';
        hideDropdown();
        navigateTo('view-dashboard');
    });

    // ── Open Food Facts fallback ──
    onlineBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) { searchInput.focus(); return; }
        const orig = onlineBtn.textContent;
        onlineBtn.textContent = 'Searching…';
        onlineBtn.disabled = true;
        try {
            const results = await searchOpenFoodFacts(q);
            if (results.length === 0) alert(`No results found for "${q}". Try simpler terms.`);
            else renderDropdown(results, 'off');
        } catch {
            alert('Online search failed. Check your internet connection.');
        } finally {
            onlineBtn.textContent = orig;
            onlineBtn.disabled = false;
        }
    });
}

// ── Settings (goals + optional USDA key) ──────────────────────────────────────

function setupSettings() {
    const goalIds  = ['goal-calories','goal-protein','goal-carbs','goal-fats'];
    const goalKeys = ['goal_calories','goal_protein','goal_carbs','goal_fats'];

    Promise.all(goalKeys.map(k => getSetting(k))).then(vals => {
        vals.forEach((v, i) => { if (v) document.getElementById(goalIds[i]).value = v; });
    });

    document.getElementById('save-goals-btn').addEventListener('click', async () => {
        await Promise.all(goalIds.map((id, i) =>
            saveSetting(goalKeys[i], String(parseInt(document.getElementById(id).value) || 0))
        ));
        const gs = document.getElementById('goals-status');
        gs.textContent = 'Goals saved!';
        gs.style.color = '#34C759';
        setTimeout(() => { gs.textContent = ''; }, 2000);
    });

    // Optional USDA key
    const usdaInput = document.getElementById('usda-key-input');
    getSetting('usda_key').then(k => { if (k) usdaInput.value = k; });

    document.getElementById('save-usda-btn').addEventListener('click', async () => {
        const key = usdaInput.value.trim();
        await saveSetting('usda_key', key);
        const st = document.getElementById('usda-key-status');
        st.textContent = key ? 'Key saved — unlimited searches unlocked!' : 'Key cleared (using DEMO_KEY)';
        st.style.color = '#34C759';
        searchCache.clear(); // force fresh searches with new key
        setTimeout(() => { st.textContent = ''; }, 3000);
    });
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

async function updateDashboard() {
    const [meals, goals] = await Promise.all([getMealsByDate(selectedDate), getGoals()]);
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    const chipEl = document.getElementById('dashboard-date-chip');
    if (chipEl) chipEl.textContent = selectedDate === getTodayString() ? 'Today' : formatDateDisplay(selectedDate);

    container.innerHTML = '';
    if (meals.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No meals logged for this day. Tap Log to add one!';
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
        `conic-gradient(var(--primary) ${pct}%, #1a1a3a ${pct}%)`;
    updateMacroRow('.protein-fill', p,  goals.protein);
    updateMacroRow('.carbs-fill',   cb, goals.carbs);
    updateMacroRow('.fats-fill',    f,  goals.fats);
    renderCalendar();
}

function createMealCard(m) {
    const row = document.createElement('div');
    row.className = 'card meal-card';

    const thumb = document.createElement('div');
    thumb.className = 'meal-thumb meal-thumb-placeholder';
    thumb.textContent = '🍽️';

    const info = document.createElement('div');
    info.className = 'meal-info';
    const name = document.createElement('div');
    name.className = 'meal-name'; name.textContent = m.name;
    const macros = document.createElement('div');
    macros.className = 'meal-macros';
    macros.textContent = `P: ${m.protein}g  C: ${m.carbs}g  F: ${m.fats}g`;
    info.appendChild(name); info.appendChild(macros);

    const calDiv = document.createElement('div'); calDiv.className = 'meal-cals';
    const calNum = document.createElement('div'); calNum.className = 'meal-cal-num'; calNum.textContent = m.calories;
    const calLbl = document.createElement('div'); calLbl.className = 'meal-cal-label'; calLbl.textContent = 'cal';
    calDiv.appendChild(calNum); calDiv.appendChild(calLbl);

    const del = document.createElement('button');
    del.className = 'delete-btn'; del.textContent = '✕'; del.title = 'Delete';
    del.addEventListener('click', async () => {
        if (m.id !== undefined) {
            await deleteMeal(m.id);
            const ym    = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;
            const meals = await getMealsByMonth(ym);
            monthCalData = {};
            for (const meal of meals) monthCalData[meal.date] = (monthCalData[meal.date] || 0) + meal.calories;
            await updateDashboard();
        }
    });

    row.appendChild(thumb); row.appendChild(info); row.appendChild(calDiv); row.appendChild(del);
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
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const meals = await getMealsByDate(ds);
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
