// ── Global state ───────────────────────────────────────────────────────────────
let selectedDate      = getTodayString();
let calendarMode      = 'week';
let calendarWeekStart = getWeekStart(new Date());
let calendarYear      = new Date().getFullYear();
let calendarMonth     = new Date().getMonth();
let weekDayData       = {};
let monthCalData      = {};
let monthWorkoutData  = {};
let calGoal           = 2000;

const views       = document.querySelectorAll('.view');
const navButtons  = document.querySelectorAll('.nav-btn');
const headerTitle = document.getElementById('header-title');
const searchCache = new Map();

// ── Exercise database (MET values) ─────────────────────────────────────────────
const EXERCISE_DB = {
    'Chest': [
        { name: 'Bench Press', met: 5.5 },
        { name: 'Incline Bench Press', met: 5.0 },
        { name: 'Decline Bench Press', met: 5.0 },
        { name: 'Push-ups', met: 3.8 },
        { name: 'Chest Fly (Dumbbell)', met: 4.0 },
        { name: 'Cable Crossover', met: 4.0 },
        { name: 'Chest Dips', met: 4.5 },
    ],
    'Back': [
        { name: 'Deadlift', met: 6.0 },
        { name: 'Pull-ups / Chin-ups', met: 5.5 },
        { name: 'Bent-over Barbell Row', met: 5.0 },
        { name: 'Lat Pulldown', met: 4.5 },
        { name: 'Seated Cable Row', met: 4.5 },
        { name: 'T-bar Row', met: 5.0 },
        { name: 'Single-arm Dumbbell Row', met: 4.5 },
    ],
    'Shoulders': [
        { name: 'Overhead Barbell Press', met: 5.0 },
        { name: 'Dumbbell Shoulder Press', met: 4.5 },
        { name: 'Lateral Raise', met: 3.5 },
        { name: 'Front Raise', met: 3.5 },
        { name: 'Reverse Fly', met: 3.5 },
        { name: 'Arnold Press', met: 4.5 },
        { name: 'Shrugs', met: 3.0 },
        { name: 'Upright Row', met: 4.0 },
    ],
    'Biceps': [
        { name: 'Barbell Curl', met: 4.0 },
        { name: 'Dumbbell Curl', met: 3.5 },
        { name: 'Hammer Curl', met: 3.5 },
        { name: 'Preacher Curl', met: 3.5 },
        { name: 'Cable Curl', met: 3.5 },
        { name: 'Concentration Curl', met: 3.5 },
    ],
    'Triceps': [
        { name: 'Tricep Dips', met: 4.5 },
        { name: 'Skull Crushers', met: 4.0 },
        { name: 'Tricep Pushdown (Cable)', met: 3.5 },
        { name: 'Overhead Tricep Extension', met: 3.5 },
        { name: 'Close-grip Bench Press', met: 5.0 },
        { name: 'Diamond Push-ups', met: 3.8 },
    ],
    'Legs': [
        { name: 'Squats (Barbell)', met: 5.5 },
        { name: 'Leg Press', met: 5.0 },
        { name: 'Lunges', met: 4.5 },
        { name: 'Romanian Deadlift', met: 5.5 },
        { name: 'Leg Curl (Machine)', met: 4.0 },
        { name: 'Leg Extension (Machine)', met: 4.0 },
        { name: 'Calf Raises', met: 3.5 },
        { name: 'Hack Squats', met: 5.0 },
        { name: 'Bulgarian Split Squat', met: 5.0 },
        { name: 'Sumo Deadlift', met: 5.5 },
    ],
    'Abs / Core': [
        { name: 'Crunches', met: 3.5 },
        { name: 'Plank', met: 3.5 },
        { name: 'Russian Twist', met: 4.0 },
        { name: 'Leg Raises', met: 4.0 },
        { name: 'Mountain Climbers', met: 5.0 },
        { name: 'Bicycle Crunch', met: 4.0 },
        { name: 'V-ups', met: 4.0 },
        { name: 'Ab Wheel Rollout', met: 4.5 },
        { name: 'Cable Crunch', met: 4.0 },
        { name: 'Hanging Knee Raises', met: 4.0 },
    ],
    'Cardio': [
        { name: 'Running (moderate pace)', met: 9.8 },
        { name: 'Running (fast pace)', met: 12.5 },
        { name: 'Cycling (moderate)', met: 7.5 },
        { name: 'Jump Rope', met: 11.0 },
        { name: 'Burpees', met: 8.0 },
        { name: 'Jumping Jacks', met: 7.0 },
        { name: 'Stair Climbing', met: 8.0 },
        { name: 'Rowing Machine', met: 7.0 },
        { name: 'Elliptical', met: 5.5 },
        { name: 'Swimming', met: 7.0 },
        { name: 'Walking (brisk)', met: 4.3 },
        { name: 'HIIT', met: 10.0 },
    ],
    'Full Body': [
        { name: 'Kettlebell Swing', met: 6.5 },
        { name: 'Clean and Press', met: 6.5 },
        { name: 'Turkish Get-up', met: 5.0 },
        { name: 'Thrusters', met: 7.0 },
        { name: 'Battle Ropes', met: 8.0 },
        { name: 'Medicine Ball Slam', met: 7.0 },
        { name: 'Box Jumps', met: 7.0 },
    ],
};

const CATEGORY_EMOJI = {
    'Chest': '💪', 'Back': '🏋️', 'Shoulders': '💫',
    'Biceps': '💪', 'Triceps': '⚡', 'Legs': '🦵',
    'Abs / Core': '🎯', 'Cardio': '🏃', 'Full Body': '🔥'
};

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        registerServiceWorker();
        setupNavigation();
        await setupCalendar();
        await updateDashboard();
        setupFoodSearch();
        setupExerciseLog();
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

function dateToString(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDates(weekStart) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return dateToString(d);
    });
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
        headerTitle.textContent = "Log";
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
    const today = getTodayString();
    const label = selectedDate === today ? 'Today' : formatDateDisplay(selectedDate);
    const el1 = document.getElementById('log-date-label');
    const el2 = document.getElementById('ex-log-date-label');
    if (el1) el1.textContent = label;
    if (el2) el2.textContent = label;
}

// ── Goals ──────────────────────────────────────────────────────────────────────

async function getGoals() {
    const [cals, protein, carbs, fats, exCals, bodyWeight] = await Promise.all([
        getSetting('goal_calories'), getSetting('goal_protein'),
        getSetting('goal_carbs'), getSetting('goal_fats'),
        getSetting('goal_ex_calories'), getSetting('goal_body_weight')
    ]);
    return {
        calories:   parseInt(cals)         || 2000,
        protein:    parseInt(protein)      || 150,
        carbs:      parseInt(carbs)        || 200,
        fats:       parseInt(fats)         || 65,
        exCalories: parseInt(exCals)       || 300,
        bodyWeight: parseFloat(bodyWeight) || 70
    };
}

// ── Exercise calorie calculation (MET-based) ───────────────────────────────────

function calcExerciseCalories(met, sets, reps, bodyWeightKg) {
    // ~4s active per rep + 90s rest per set
    const secondsPerSet = reps * 4 + 90;
    const totalHours = (sets * secondsPerSet) / 3600;
    return Math.max(1, Math.round(met * bodyWeightKg * totalHours));
}

// ── Calendar: day goal ring SVG ────────────────────────────────────────────────

function makeDayRing(cals, burned, goalCals, goalBurn, size) {
    const s = size || 26;
    const cx = s / 2, cy = s / 2, r = s / 2 - 3, strokeW = 3;
    const circ = 2 * Math.PI * r;
    const nutPct  = goalCals > 0 ? Math.min(cals / goalCals, 1) : 0;
    const burnPct = goalBurn > 0 ? Math.min(burned / goalBurn, 1) : 0;
    const nutDash  = (nutPct * circ).toFixed(1);

    let nutColor = 'rgba(255,255,255,0.08)';
    if (nutPct >= 0.8 && nutPct <= 1.15) nutColor = '#34C759';
    else if (nutPct > 0.4)               nutColor = '#FF9F0A';
    else if (nutPct > 0)                 nutColor = '#FF6B6B';

    const innerR = r - strokeW - 1;
    const burnDash = (burnPct * 2 * Math.PI * innerR).toFixed(1);
    const burnCirc = (2 * Math.PI * innerR).toFixed(1);

    const burnArc = burned > 0
        ? `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#FF0099" stroke-width="2"
               stroke-dasharray="${burnDash} ${burnCirc}"
               stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`
        : '';

    if (cals === 0 && burned === 0) {
        return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${strokeW}"/>
        </svg>`;
    }

    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="${strokeW}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${nutColor}" stroke-width="${strokeW}"
            stroke-dasharray="${nutDash} ${circ.toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        ${burnArc}
    </svg>`;
}

// ── Calendar ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

async function setupCalendar() {
    const goals = await getGoals();
    calGoal = goals.calories;

    document.getElementById('cal-prev').addEventListener('click', async () => {
        if (calendarMode === 'week') {
            calendarWeekStart.setDate(calendarWeekStart.getDate() - 7);
            await refreshWeekStrip();
        } else {
            if (--calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
            await refreshCalendarMonth();
        }
    });

    document.getElementById('cal-next').addEventListener('click', async () => {
        if (calendarMode === 'week') {
            calendarWeekStart.setDate(calendarWeekStart.getDate() + 7);
            await refreshWeekStrip();
        } else {
            if (++calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
            await refreshCalendarMonth();
        }
    });

    document.getElementById('cal-today-btn').addEventListener('click', async () => {
        calendarWeekStart = getWeekStart(new Date());
        calendarYear  = new Date().getFullYear();
        calendarMonth = new Date().getMonth();
        await selectDate(getTodayString());
    });

    document.getElementById('cal-expand-btn').addEventListener('click', async () => {
        calendarMode = calendarMode === 'week' ? 'month' : 'week';
        const icon  = document.getElementById('cal-expand-icon');
        const strip = document.getElementById('cal-week-strip');
        const grid  = document.getElementById('cal-grid');

        if (calendarMode === 'month') {
            strip.classList.add('hidden');
            grid.classList.remove('hidden');
            icon.innerHTML = '<polyline points="18 15 12 9 6 15"/>';
            const parts = selectedDate.split('-');
            calendarYear  = parseInt(parts[0]);
            calendarMonth = parseInt(parts[1]) - 1;
            await refreshCalendarMonth();
        } else {
            grid.classList.add('hidden');
            strip.classList.remove('hidden');
            icon.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
            calendarWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'));
            await refreshWeekStrip();
        }
    });

    await refreshWeekStrip();
}

async function refreshWeekStrip() {
    const dates   = getWeekDates(calendarWeekStart);
    const allData = await Promise.all(dates.map(d => Promise.all([
        getMealsByDate(d), getWorkoutsByDate(d)
    ])));
    weekDayData = {};
    dates.forEach((d, i) => {
        const [meals, workouts] = allData[i];
        weekDayData[d] = {
            cals:         meals.reduce((s, m) => s + m.calories, 0),
            burned:       workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0),
            workoutCount: workouts.length
        };
    });
    updateWeekLabel(dates);
    renderWeekStrip(dates);
}

function updateWeekLabel(dates) {
    const first = new Date(dates[0] + 'T00:00:00');
    const last  = new Date(dates[6] + 'T00:00:00');
    const label = first.getMonth() === last.getMonth()
        ? `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0,3)} ${first.getFullYear()}`
        : `${first.getDate()} ${MONTH_NAMES[first.getMonth()].slice(0,3)} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()].slice(0,3)}`;
    document.getElementById('cal-month-label').textContent = label;
}

function renderWeekStrip(dates) {
    const strip    = document.getElementById('cal-week-strip');
    const today    = getTodayString();
    const dayNames = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    strip.innerHTML = '';
    (dates || getWeekDates(calendarWeekStart)).forEach((dateStr, i) => {
        const d    = new Date(dateStr + 'T00:00:00');
        const data = weekDayData[dateStr] || { cals: 0, burned: 0, workoutCount: 0 };

        const cell = document.createElement('button');
        cell.className = 'cal-week-day';
        if (dateStr === today)        cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');
        if (data.cals > 0 || data.burned > 0) cell.classList.add('has-data');

        const nameEl = document.createElement('div');
        nameEl.className = 'cal-week-name'; nameEl.textContent = dayNames[i];

        const numEl = document.createElement('div');
        numEl.className = 'cal-week-num'; numEl.textContent = d.getDate();

        const ringEl = document.createElement('div');
        ringEl.className = 'cal-week-ring';
        ringEl.innerHTML = makeDayRing(data.cals, data.burned, calGoal, 300, 26);

        cell.appendChild(nameEl);
        cell.appendChild(numEl);
        cell.appendChild(ringEl);

        if (data.cals > 0) {
            const calEl = document.createElement('div');
            calEl.className = 'cal-week-cals';
            calEl.textContent = data.cals >= 1000 ? `${(data.cals/1000).toFixed(1)}k` : data.cals;
            cell.appendChild(calEl);
        }

        cell.addEventListener('click', () => selectDate(dateStr));
        strip.appendChild(cell);
    });
}

async function refreshCalendarMonth() {
    const ym = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;
    const [meals, workouts] = await Promise.all([getMealsByMonth(ym), getWorkoutsByMonth(ym)]);
    monthCalData = {};
    monthWorkoutData = {};
    for (const m of meals) monthCalData[m.date] = (monthCalData[m.date] || 0) + m.calories;
    for (const w of workouts) {
        if (!monthWorkoutData[w.date]) monthWorkoutData[w.date] = { count: 0, burned: 0 };
        monthWorkoutData[w.date].count++;
        monthWorkoutData[w.date].burned += (w.caloriesBurned || 0);
    }
    document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
    renderCalendar();
}

function renderCalendar() {
    const grid  = document.getElementById('cal-grid');
    const today = getTodayString();
    grid.innerHTML = '';

    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'cal-day-name'; h.textContent = d; grid.appendChild(h);
    });

    const firstDow = new Date(calendarYear, calendarMonth, 1).getDay();
    for (let i = 0; i < (firstDow + 6) % 7; i++) {
        const e = document.createElement('div'); e.className = 'cal-empty'; grid.appendChild(e);
    }

    const days = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateStr === today)        cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');

        const cals     = monthCalData[dateStr] || 0;
        const workData = monthWorkoutData[dateStr] || { count: 0, burned: 0 };
        if (cals > 0 || workData.burned > 0) cell.classList.add('has-data');

        const num = document.createElement('span');
        num.className = 'cal-day-num'; num.textContent = d;
        cell.appendChild(num);

        const ringEl = document.createElement('div');
        ringEl.className = 'cal-day-ring';
        ringEl.innerHTML = makeDayRing(cals, workData.burned, calGoal, 300, 24);
        cell.appendChild(ringEl);

        if (cals) {
            const calEl = document.createElement('span');
            calEl.className = 'cal-day-cal';
            calEl.textContent = cals >= 1000 ? `${(cals/1000).toFixed(1)}k` : cals;
            cell.appendChild(calEl);
        }

        cell.addEventListener('click', () => selectDate(dateStr));
        grid.appendChild(cell);
    }
}

async function selectDate(dateStr) {
    selectedDate = dateStr;

    if (calendarMode === 'week') {
        const currentDates = getWeekDates(calendarWeekStart);
        if (!currentDates.includes(dateStr)) {
            calendarWeekStart = getWeekStart(new Date(dateStr + 'T00:00:00'));
            await refreshWeekStrip();
        } else {
            renderWeekStrip(currentDates);
        }
    } else {
        const parts = dateStr.split('-');
        const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
        if (y !== calendarYear || m !== calendarMonth) {
            calendarYear = y; calendarMonth = m;
            await refreshCalendarMonth();
        } else {
            renderCalendar();
        }
    }

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
        .filter(Boolean).slice(0, 10);

    searchCache.set(key, results);
    return results;
}

function extractNutrients(foodNutrients) {
    let c = 0, p = 0, cb = 0, f = 0;
    for (const n of foodNutrients) {
        const nm  = (n.nutrientName || '').toLowerCase();
        const val = Number(n.value) || 0;
        if (!c  && (n.nutrientId === 1008 || n.nutrientId === 2047 || (nm === 'energy' && (n.unitName || '').toUpperCase() === 'KCAL'))) c  = val;
        if (!p  && (n.nutrientId === 1003 || nm === 'protein'))             p  = val;
        if (!cb && (n.nutrientId === 1005 || nm.startsWith('carbohydrate'))) cb = val;
        if (!f  && (n.nutrientId === 1004 || nm.includes('total lipid')))   f  = val;
    }
    return { c: Math.round(c), p: Math.round(p), cb: Math.round(cb), f: Math.round(f) };
}

function isLiquid(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return ['juice','milk','water','beverage','drink','tea','coffee','beer','wine',
            'broth','soup','shake','smoothie','latte','espresso','cider','soda',
            'cola','lassi','buttermilk','coke','rum','whiskey','vodka'].some(w => lower.includes(w));
}

async function searchOpenFoodFacts(query) {
    const url  = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=12&fields=product_name,nutriments,serving_size`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return (data.products || [])
        .filter(p => p.product_name && p.nutriments &&
            (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal_serving']))
        .map(p => {
            const n = p.nutriments, srv = n['energy-kcal_serving'] != null;
            return {
                n:  p.product_name.replace(/,\s*$/, '').slice(0, 70),
                c:  Math.round(srv ? (n['energy-kcal_serving'] || 0)  : (n['energy-kcal_100g'] || 0)),
                p:  Math.round(srv ? (n['proteins_serving'] || 0)      : (n['proteins_100g'] || 0)),
                cb: Math.round(srv ? (n['carbohydrates_serving'] || 0) : (n['carbohydrates_100g'] || 0)),
                f:  Math.round(srv ? (n['fat_serving'] || 0)           : (n['fat_100g'] || 0)),
                liquid: false,
                offUnit: srv ? (p.serving_size || 'per serving') : 'per 100g'
            };
        })
        .filter(f => f.c > 0).slice(0, 8);
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
    let currentUnit  = 'g';
    let debounce     = null;

    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        resetFoodSelection();
        const q = searchInput.value.trim();
        if (q.length < 2) { hideDropdown(); return; }
        showLoadingDropdown();
        debounce = setTimeout(async () => {
            try {
                renderDropdown(await searchUSDA(q), 'usda');
            } catch (err) {
                showErrorDropdown(err.message);
            }
        }, 700);
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2 && !selectedFood) searchInput.dispatchEvent(new Event('input'));
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrapper')) hideDropdown(); });

    function showLoadingDropdown() {
        dropdown.innerHTML = '<div class="food-no-result">Searching USDA database…</div>';
        dropdown.classList.remove('hidden');
    }
    function showErrorDropdown(msg) {
        dropdown.innerHTML = `<div class="food-no-result food-error">${msg.replace(/\n/g,'<br>')}</div>`;
        dropdown.classList.remove('hidden');
    }
    function renderDropdown(foods, source) {
        dropdown.innerHTML = '';
        if (!foods || foods.length === 0) {
            dropdown.innerHTML = '<div class="food-no-result">No results — try "Search Online" for packaged/branded foods.</div>';
        } else {
            const src = document.createElement('div');
            src.className = 'food-source-label';
            src.textContent = source === 'usda' ? 'USDA FoodData Central • per 100g' : 'Open Food Facts';
            dropdown.appendChild(src);
            foods.forEach(food => {
                const item = document.createElement('div');
                item.className = 'food-result-item';
                const nameEl = document.createElement('span');
                nameEl.className = 'food-result-name'; nameEl.textContent = food.n;
                const rightEl = document.createElement('span');
                rightEl.className = 'food-result-right';
                rightEl.innerHTML = `<b>${food.c}</b> cal<br><small>${food.offUnit || (food.liquid ? 'per 100ml' : 'per 100g')}</small>`;
                item.appendChild(nameEl); item.appendChild(rightEl);
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
        currentUnit = food.liquid ? 'ml' : 'g';
        qtyInput.value = food.liquid ? '250' : '100';
        qtyUnitEl.textContent = currentUnit;
        addBtn.disabled = false;
        updateNutritionPreview();
    }
    function resetFoodSelection() {
        selectedFood = null; currentUnit = 'g';
        qtyUnitEl.textContent = 'g';
        nutPreview.classList.add('hidden');
        addBtn.disabled = true;
    }

    const step = () => currentUnit === 'ml' ? 50 : 25;
    qtyMinus.addEventListener('click', () => {
        qtyInput.value = Math.max(step(), (parseFloat(qtyInput.value) || 100) - step());
        updateNutritionPreview();
    });
    qtyPlus.addEventListener('click', () => {
        qtyInput.value = Math.min(2000, (parseFloat(qtyInput.value) || 100) + step());
        updateNutritionPreview();
    });
    qtyInput.addEventListener('input', updateNutritionPreview);

    function updateNutritionPreview() {
        if (!selectedFood) { nutPreview.classList.add('hidden'); return; }
        const qty  = Math.max(1, parseFloat(qtyInput.value) || 100);
        const mult = selectedFood.offUnit ? 1 : qty / 100;
        nutPreview.textContent = `${qty}${currentUnit}: ${Math.round(selectedFood.c*mult)} cal  •  P: ${Math.round(selectedFood.p*mult)}g  •  C: ${Math.round(selectedFood.cb*mult)}g  •  F: ${Math.round(selectedFood.f*mult)}g`;
        nutPreview.classList.remove('hidden');
    }

    addBtn.addEventListener('click', async () => {
        if (!selectedFood) return;
        const qty  = Math.max(1, parseFloat(qtyInput.value) || 100);
        const mult = selectedFood.offUnit ? 1 : qty / 100;
        await saveMeal({
            date:     selectedDate,
            name:     `${selectedFood.n} (${qty}${currentUnit})`,
            calories: Math.round(selectedFood.c  * mult),
            protein:  Math.round(selectedFood.p  * mult),
            carbs:    Math.round(selectedFood.cb * mult),
            fats:     Math.round(selectedFood.f  * mult),
            image:    null
        });
        resetFoodSelection();
        searchInput.value = '';
        qtyInput.value = '100';
        hideDropdown();
        navigateTo('view-dashboard');
    });

    onlineBtn.addEventListener('click', async () => {
        const q = searchInput.value.trim();
        if (!q) { searchInput.focus(); return; }
        const orig = onlineBtn.textContent;
        onlineBtn.textContent = 'Searching…'; onlineBtn.disabled = true;
        try {
            const results = await searchOpenFoodFacts(q);
            if (results.length === 0) alert(`No results for "${q}". Try simpler terms.`);
            else renderDropdown(results, 'off');
        } catch { alert('Online search failed. Check your connection.'); }
        finally { onlineBtn.textContent = orig; onlineBtn.disabled = false; }
    });
}

// ── Exercise Log UI ────────────────────────────────────────────────────────────

function setupExerciseLog() {
    const catSel  = document.getElementById('ex-category');
    const nameSel = document.getElementById('ex-name');
    const setsInp = document.getElementById('ex-sets');
    const repsInp = document.getElementById('ex-reps');
    const preview = document.getElementById('ex-cal-preview');
    const calVal  = document.getElementById('ex-cal-value');
    const addBtn  = document.getElementById('add-exercise-btn');

    let selectedMET = 0;
    let bodyWeight  = 70;

    getGoals().then(g => { bodyWeight = g.bodyWeight; });

    catSel.addEventListener('change', () => {
        const cat = catSel.value;
        nameSel.innerHTML = '<option value="">Select exercise…</option>';
        if (cat && EXERCISE_DB[cat]) {
            EXERCISE_DB[cat].forEach(ex => {
                const opt = document.createElement('option');
                opt.value = ex.met; opt.textContent = ex.name;
                nameSel.appendChild(opt);
            });
            nameSel.disabled = false;
        } else {
            nameSel.disabled = true;
        }
        selectedMET = 0;
        addBtn.disabled = true;
        preview.classList.add('hidden');
    });

    nameSel.addEventListener('change', () => {
        selectedMET = parseFloat(nameSel.value) || 0;
        updateExCalPreview();
        addBtn.disabled = !selectedMET;
    });

    document.getElementById('sets-minus').addEventListener('click', () => {
        setsInp.value = Math.max(1, parseInt(setsInp.value) - 1); updateExCalPreview();
    });
    document.getElementById('sets-plus').addEventListener('click', () => {
        setsInp.value = Math.min(20, parseInt(setsInp.value) + 1); updateExCalPreview();
    });
    document.getElementById('reps-minus').addEventListener('click', () => {
        repsInp.value = Math.max(1, parseInt(repsInp.value) - 1); updateExCalPreview();
    });
    document.getElementById('reps-plus').addEventListener('click', () => {
        repsInp.value = Math.min(200, parseInt(repsInp.value) + 1); updateExCalPreview();
    });
    setsInp.addEventListener('input', updateExCalPreview);
    repsInp.addEventListener('input', updateExCalPreview);

    function updateExCalPreview() {
        if (!selectedMET) { preview.classList.add('hidden'); return; }
        const burned = calcExerciseCalories(selectedMET, parseInt(setsInp.value)||3, parseInt(repsInp.value)||10, bodyWeight);
        calVal.textContent = burned;
        preview.classList.remove('hidden');
    }

    addBtn.addEventListener('click', async () => {
        if (!selectedMET) return;
        const sets   = parseInt(setsInp.value) || 3;
        const reps   = parseInt(repsInp.value) || 10;
        const burned = calcExerciseCalories(selectedMET, sets, reps, bodyWeight);
        const exName = nameSel.options[nameSel.selectedIndex].textContent;

        await saveWorkout({
            date:           selectedDate,
            exercise:       exName,
            category:       catSel.value,
            sets, reps,
            caloriesBurned: burned
        });

        catSel.value = '';
        nameSel.innerHTML = '<option value="">Select category first…</option>';
        nameSel.disabled = true;
        setsInp.value = '3'; repsInp.value = '10';
        selectedMET = 0; addBtn.disabled = true;
        preview.classList.add('hidden');

        navigateTo('view-dashboard');
    });
}

// ── Settings ───────────────────────────────────────────────────────────────────

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
        calGoal = parseInt(document.getElementById('goal-calories').value) || 2000;
        const gs = document.getElementById('goals-status');
        gs.textContent = 'Goals saved!'; gs.style.color = '#34C759';
        setTimeout(() => { gs.textContent = ''; }, 2000);
    });

    const usdaInput = document.getElementById('usda-key-input');
    getSetting('usda_key').then(k => { if (k) usdaInput.value = k; });
    document.getElementById('save-usda-btn').addEventListener('click', async () => {
        const key = usdaInput.value.trim();
        await saveSetting('usda_key', key);
        const st = document.getElementById('usda-key-status');
        st.textContent = key ? 'Key saved — unlimited searches unlocked!' : 'Key cleared (using DEMO_KEY)';
        st.style.color = '#34C759';
        searchCache.clear();
        setTimeout(() => { st.textContent = ''; }, 3000);
    });

    Promise.all([getSetting('goal_ex_calories'), getSetting('goal_body_weight')]).then(([ec, bw]) => {
        if (ec) document.getElementById('goal-ex-calories').value = ec;
        if (bw) document.getElementById('goal-body-weight').value = bw;
    });
    document.getElementById('save-ex-goals-btn').addEventListener('click', async () => {
        await Promise.all([
            saveSetting('goal_ex_calories', document.getElementById('goal-ex-calories').value),
            saveSetting('goal_body_weight', document.getElementById('goal-body-weight').value)
        ]);
        const st = document.getElementById('ex-goals-status');
        st.textContent = 'Exercise goals saved!'; st.style.color = '#34C759';
        setTimeout(() => { st.textContent = ''; }, 2000);
    });
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

async function updateDashboard() {
    const [meals, workouts, goals] = await Promise.all([
        getMealsByDate(selectedDate),
        getWorkoutsByDate(selectedDate),
        getGoals()
    ]);

    calGoal = goals.calories;

    let c = 0, p = 0, cb = 0, f = 0;
    meals.forEach(m => { c += m.calories; p += m.protein; cb += m.carbs; f += m.fats; });
    let totalBurned = 0;
    workouts.forEach(w => { totalBurned += (w.caloriesBurned || 0); });

    // Update in-memory caches so calendar re-renders correctly
    if (calendarMode === 'week') {
        weekDayData[selectedDate] = { cals: c, burned: totalBurned, workoutCount: workouts.length };
    } else {
        monthCalData[selectedDate] = c;
        monthWorkoutData[selectedDate] = { count: workouts.length, burned: totalBurned };
    }

    // Date chip
    const chipEl = document.getElementById('dashboard-date-chip');
    if (chipEl) chipEl.textContent = selectedDate === getTodayString() ? 'Today' : formatDateDisplay(selectedDate);

    // Calorie ring + macros
    document.getElementById('calories-consumed').textContent = c;
    const pct = Math.min((c / goals.calories) * 100, 100);
    document.getElementById('calorie-ring').style.background =
        `conic-gradient(var(--primary) ${pct}%, #1a1a3a ${pct}%)`;
    updateMacroRow('.protein-fill', p,  goals.protein);
    updateMacroRow('.carbs-fill',   cb, goals.carbs);
    updateMacroRow('.fats-fill',    f,  goals.fats);

    // Meals list
    const container = document.getElementById('meals-list');
    container.innerHTML = '';
    if (meals.length === 0) {
        container.innerHTML = '<p class="empty-state">No meals logged. Tap Log to add one!</p>';
    } else {
        meals.forEach(m => container.appendChild(createMealCard(m)));
    }

    // Workout tile
    document.getElementById('workout-count').textContent       = workouts.length;
    document.getElementById('workout-cals-burned').textContent = totalBurned;
    const wList = document.getElementById('workouts-list');
    wList.innerHTML = '';
    if (workouts.length === 0) {
        wList.innerHTML = '<p class="empty-state-sm">No workouts logged. Tap Log to add one!</p>';
    } else {
        workouts.forEach(w => wList.appendChild(createWorkoutItem(w)));
    }

    // Re-render calendar
    if (calendarMode === 'week') {
        renderWeekStrip(getWeekDates(calendarWeekStart));
    } else {
        renderCalendar();
    }
}

function createMealCard(m) {
    const row   = document.createElement('div'); row.className = 'card meal-card';
    const thumb = document.createElement('div');
    thumb.className = 'meal-thumb meal-thumb-placeholder'; thumb.textContent = '🍽️';

    const info   = document.createElement('div'); info.className = 'meal-info';
    const name   = document.createElement('div'); name.className = 'meal-name'; name.textContent = m.name;
    const macros = document.createElement('div'); macros.className = 'meal-macros';
    macros.textContent = `P: ${m.protein}g  C: ${m.carbs}g  F: ${m.fats}g`;
    info.appendChild(name); info.appendChild(macros);

    const calDiv = document.createElement('div'); calDiv.className = 'meal-cals';
    const calNum = document.createElement('div'); calNum.className = 'meal-cal-num'; calNum.textContent = m.calories;
    const calLbl = document.createElement('div'); calLbl.className = 'meal-cal-label'; calLbl.textContent = 'cal';
    calDiv.appendChild(calNum); calDiv.appendChild(calLbl);

    const del = document.createElement('button');
    del.className = 'delete-btn'; del.textContent = '✕'; del.title = 'Delete';
    del.addEventListener('click', async () => {
        if (m.id !== undefined) { await deleteMeal(m.id); await updateDashboard(); }
    });

    row.appendChild(thumb); row.appendChild(info); row.appendChild(calDiv); row.appendChild(del);
    return row;
}

function createWorkoutItem(w) {
    const row  = document.createElement('div'); row.className = 'workout-item';
    const icon = document.createElement('div'); icon.className = 'workout-item-icon';
    icon.textContent = CATEGORY_EMOJI[w.category] || '🏋️';

    const info   = document.createElement('div'); info.className = 'workout-item-info';
    const name   = document.createElement('div'); name.className = 'workout-item-name'; name.textContent = w.exercise;
    const detail = document.createElement('div'); detail.className = 'workout-item-detail';
    detail.textContent = `${w.sets} sets × ${w.reps} reps  •  ${w.category}`;
    info.appendChild(name); info.appendChild(detail);

    const calDiv = document.createElement('div'); calDiv.className = 'workout-item-cals';
    const calNum = document.createElement('div'); calNum.className = 'workout-item-cal-num'; calNum.textContent = w.caloriesBurned;
    const calLbl = document.createElement('div'); calLbl.className = 'workout-item-cal-label'; calLbl.textContent = 'cal';
    calDiv.appendChild(calNum); calDiv.appendChild(calLbl);

    const del = document.createElement('button');
    del.className = 'delete-btn'; del.textContent = '✕'; del.title = 'Delete';
    del.addEventListener('click', async () => {
        if (w.id !== undefined) { await deleteWorkout(w.id); await updateDashboard(); }
    });

    row.appendChild(icon); row.appendChild(info); row.appendChild(calDiv); row.appendChild(del);
    return row;
}

function updateMacroRow(cls, cur, tgt) {
    const el = document.querySelector(cls);
    if (!el) return;
    el.style.width = `${Math.min((cur / (tgt || 1)) * 100, 100)}%`;
    el.closest('.macro-row').querySelector('.macro-value').textContent = `${cur}g`;
}

// ── Weekly Summary ─────────────────────────────────────────────────────────────

async function updateWeeklySummary() {
    let sc = 0, sp = 0, scb = 0, sf = 0, nutritionDays = 0;
    let totalBurned = 0, workoutDays = 0, totalExercises = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = dateToString(d);
        const [meals, workouts] = await Promise.all([getMealsByDate(ds), getWorkoutsByDate(ds)]);
        if (meals.length > 0) {
            nutritionDays++;
            meals.forEach(m => { sc += m.calories; sp += m.protein; scb += m.carbs; sf += m.fats; });
        }
        if (workouts.length > 0) {
            workoutDays++;
            totalExercises += workouts.length;
            workouts.forEach(w => { totalBurned += (w.caloriesBurned || 0); });
        }
    }

    const nd = nutritionDays || 1;
    document.getElementById('avg-cals').textContent    = Math.round(sc  / nd);
    document.getElementById('avg-protein').textContent = `${Math.round(sp  / nd)}g`;
    document.getElementById('avg-carbs').textContent   = `${Math.round(scb / nd)}g`;
    document.getElementById('avg-fats').textContent    = `${Math.round(sf  / nd)}g`;

    const wd = workoutDays || 1;
    document.getElementById('avg-ex-cals').textContent  = Math.round(totalBurned / wd);
    document.getElementById('avg-ex-days').textContent  = workoutDays;
    document.getElementById('avg-ex-count').textContent = (workoutDays > 0 ? Math.round(totalExercises / workoutDays) : 0);
    document.getElementById('avg-net-cals').textContent = Math.round(sc / nd) - Math.round(totalBurned / wd);
}
