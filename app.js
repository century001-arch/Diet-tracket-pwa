// ── Global state ──────────────────────────────────────────────────────────────
let selectedDate   = getTodayString();
let calendarYear   = new Date().getFullYear();
let calendarMonth  = new Date().getMonth();   // 0-indexed
let monthCalData   = {};                       // { "YYYY-MM-DD": totalCalories }

const views      = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const headerTitle = document.getElementById('header-title');

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
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW error:', err));
    }
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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
    if (!el) return;
    const today = getTodayString();
    el.textContent = selectedDate === today ? 'Today' : formatDateDisplay(selectedDate);
}

// ── Goals ──────────────────────────────────────────────────────────────────────

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

// ── Calendar ───────────────────────────────────────────────────────────────────

async function setupCalendar() {
    // Sync calendar display month with today on first load
    const today = new Date();
    calendarYear  = today.getFullYear();
    calendarMonth = today.getMonth();

    await refreshCalendar();

    document.getElementById('cal-prev').addEventListener('click', async () => {
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        await refreshCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', async () => {
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        await refreshCalendar();
    });
    document.getElementById('cal-today-btn').addEventListener('click', async () => {
        const today = new Date();
        calendarYear  = today.getFullYear();
        calendarMonth = today.getMonth();
        await selectDate(getTodayString());
    });
}

async function refreshCalendar() {
    // Load calorie totals for every day in the displayed month
    const ym = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const meals = await getMealsByMonth(ym);
    monthCalData = {};
    for (const m of meals) {
        monthCalData[m.date] = (monthCalData[m.date] || 0) + m.calories;
    }
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

    // Day-of-week headers (Mon-first)
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'cal-day-name';
        h.textContent = d;
        grid.appendChild(h);
    });

    // Empty leading cells
    const firstDow = new Date(calendarYear, calendarMonth, 1).getDay(); // 0=Sun
    const offset   = (firstDow + 6) % 7; // shift to Mon-start
    for (let i = 0; i < offset; i++) {
        const e = document.createElement('div');
        e.className = 'cal-empty';
        grid.appendChild(e);
    }

    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const today       = getTodayString();

    for (let d = 1; d <= daysInMonth; d++) {
        const mm  = String(calendarMonth + 1).padStart(2, '0');
        const dd  = String(d).padStart(2, '0');
        const dateStr = `${calendarYear}-${mm}-${dd}`;

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateStr === today)         cell.classList.add('today');
        if (dateStr === selectedDate)  cell.classList.add('selected');

        const numEl = document.createElement('span');
        numEl.className = 'cal-day-num';
        numEl.textContent = d;
        cell.appendChild(numEl);

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

    // Sync calendar display month if needed
    const parts = dateStr.split('-');
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
    if (y !== calendarYear || m !== calendarMonth) {
        calendarYear = y; calendarMonth = m;
        const ym = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        const meals = await getMealsByMonth(ym);
        monthCalData = {};
        for (const meal of meals) monthCalData[meal.date] = (monthCalData[meal.date] || 0) + meal.calories;
    }

    renderCalendar();
    const today = getTodayString();
    headerTitle.textContent = dateStr === today ? "Today's Overview" : formatDateDisplay(dateStr);
    await updateDashboard();
}

// ── Food Search (local DB + Open Food Facts fallback) ──────────────────────────

function setupFoodSearch() {
    const searchInput   = document.getElementById('food-search-input');
    const dropdown      = document.getElementById('food-search-results');
    const qtyInput      = document.getElementById('food-qty');
    const qtyMinus      = document.getElementById('qty-minus');
    const qtyPlus       = document.getElementById('qty-plus');
    const qtyUnit       = document.getElementById('qty-unit-label');
    const nutPreview    = document.getElementById('nutrition-preview');
    const addBtn        = document.getElementById('add-meal-btn');
    const onlineBtn     = document.getElementById('search-online-btn');

    let selectedFood = null;
    let debounce = null;

    // ── Search input ──
    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        selectedFood = null;
        qtyUnit.textContent = 'serving';
        nutPreview.classList.add('hidden');
        addBtn.disabled = true;
        debounce = setTimeout(() => {
            const q = searchInput.value.trim();
            if (q.length < 2) { hideDropdown(); return; }
            renderDropdown(searchFoods(q));
        }, 150);
    });

    searchInput.addEventListener('focus', () => {
        const q = searchInput.value.trim();
        if (q.length >= 2 && !selectedFood) renderDropdown(searchFoods(q));
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) hideDropdown();
    });

    // ── Dropdown ──
    function renderDropdown(foods) {
        dropdown.innerHTML = '';
        if (foods.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'food-no-result';
            msg.textContent = 'No results — try "Search Online" for packaged foods.';
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
        qtyUnit.textContent = food.s;
        addBtn.disabled = false;
        updateNutritionPreview();
        qtyInput.focus();
    }

    // ── Quantity controls ──
    qtyMinus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 1;
        qtyInput.value = Math.max(0.5, parseFloat((v - 0.5).toFixed(1)));
        updateNutritionPreview();
    });
    qtyPlus.addEventListener('click', () => {
        const v = parseFloat(qtyInput.value) || 1;
        qtyInput.value = Math.min(20, parseFloat((v + 0.5).toFixed(1)));
        updateNutritionPreview();
    });
    qtyInput.addEventListener('input', updateNutritionPreview);

    function updateNutritionPreview() {
        if (!selectedFood) { nutPreview.classList.add('hidden'); return; }
        const qty = Math.max(0.5, parseFloat(qtyInput.value) || 1);
        const cal = Math.round(selectedFood.c * qty);
        const p   = Math.round(selectedFood.p * qty);
        const cb  = Math.round(selectedFood.cb * qty);
        const f   = Math.round(selectedFood.f * qty);
        nutPreview.textContent = `${cal} cal  •  P: ${p}g  •  C: ${cb}g  •  F: ${f}g`;
        nutPreview.classList.remove('hidden');
    }

    // ── Add to Log ──
    addBtn.addEventListener('click', async () => {
        if (!selectedFood) return;
        const qty = Math.max(0.5, parseFloat(qtyInput.value) || 1);
        await saveMeal({
            date:     selectedDate,
            name:     qty === 1 ? selectedFood.n : `${selectedFood.n} ×${qty}`,
            calories: Math.round(selectedFood.c * qty),
            protein:  Math.round(selectedFood.p * qty),
            carbs:    Math.round(selectedFood.cb * qty),
            fats:     Math.round(selectedFood.f * qty),
            image:    null,
            status:   'database'
        });
        // Refresh month data so calendar dot updates immediately
        const ym = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        const allMeals = await getMealsByMonth(ym);
        monthCalData = {};
        for (const m of allMeals) monthCalData[m.date] = (monthCalData[m.date] || 0) + m.calories;

        resetSearch();
        navigateTo('view-dashboard');
    });

    function resetSearch() {
        selectedFood = null;
        searchInput.value = '';
        qtyInput.value = '1';
        qtyUnit.textContent = 'serving';
        nutPreview.classList.add('hidden');
        addBtn.disabled = true;
        hideDropdown();
    }

    // ── Online fallback (Open Food Facts — free, no key) ──
    onlineBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) { searchInput.focus(); return; }
        const orig = onlineBtn.textContent;
        onlineBtn.textContent = 'Searching…';
        onlineBtn.disabled = true;
        try {
            const results = await searchOpenFoodFacts(q);
            if (results.length === 0) {
                alert(`No online results for "${q}".\nTry a simpler search term.`);
            } else {
                renderDropdown(results);
            }
        } catch {
            alert('Online search failed. Check your internet connection.');
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

// ── Settings (goals only) ──────────────────────────────────────────────────────

function setupSettings() {
    const goalIds  = ['goal-calories', 'goal-protein', 'goal-carbs', 'goal-fats'];
    const goalKeys = ['goal_calories', 'goal_protein', 'goal_carbs', 'goal_fats'];

    Promise.all(goalKeys.map(k => getSetting(k))).then(vals => {
        vals.forEach((v, i) => { if (v) document.getElementById(goalIds[i]).value = v; });
    });

    document.getElementById('save-goals-btn').addEventListener('click', async () => {
        await Promise.all(goalIds.map((id, i) => {
            const val = parseInt(document.getElementById(id).value) || 0;
            return saveSetting(goalKeys[i], String(val));
        }));
        const gs = document.getElementById('goals-status');
        gs.textContent = 'Goals saved!';
        gs.style.color = '#34C759';
        setTimeout(() => { gs.textContent = ''; }, 2000);
    });
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

async function updateDashboard() {
    const [meals, goals] = await Promise.all([getMealsByDate(selectedDate), getGoals()]);
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    // Update date display chip in dashboard
    const chipEl = document.getElementById('dashboard-date-chip');
    if (chipEl) {
        const today = getTodayString();
        chipEl.textContent = selectedDate === today ? 'Today' : formatDateDisplay(selectedDate);
    }

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

    // Re-render calendar to keep selection in sync
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
        if (m.id !== undefined) {
            await deleteMeal(m.id);
            // Refresh month data
            const ym = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
            const allMeals = await getMealsByMonth(ym);
            monthCalData = {};
            for (const meal of allMeals) monthCalData[meal.date] = (monthCalData[meal.date] || 0) + meal.calories;
            await updateDashboard();
        }
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
