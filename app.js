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
    } catch (err) { console.error(err); }
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.error(err));
    }
}

function setupNavigation() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            views.forEach(v => v.id === target ? v.classList.remove('hidden') : v.classList.add('hidden'));

            if (target === 'view-dashboard') { headerTitle.textContent = "Today's Overview"; updateDashboard(); }
            if (target === 'view-log') headerTitle.textContent = "Log Your Meal";
            if (target === 'view-summary') { headerTitle.textContent = "Weekly Trends"; updateWeeklySummary(); }
            if (target === 'view-settings') headerTitle.textContent = "Configuration";
        });
    });
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setupCameraAndLogging() {
    const cameraInput = document.getElementById('camera-input');
    const imagePreview = document.getElementById('image-preview');
    const previewContainer = document.getElementById('image-preview-container');
    const manualFoodInput = document.getElementById('manual-food-name');
    const analyzeBtn = document.getElementById('analyze-btn');

    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH; canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                currentImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                imagePreview.src = currentImageBase64;
                previewContainer.classList.remove('hidden');
                analyzeBtn.textContent = "Analyze Food"; analyzeBtn.disabled = false;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    analyzeBtn.addEventListener('click', async () => {
        const apiKey = await getSetting('gemini_key');
        if (!apiKey) { alert('Please save your Google Gemini API Key in the Config tab first.'); return; }
        analyzeBtn.textContent = "Analyzing..."; analyzeBtn.disabled = true;

        try {
            const base64Data = currentImageBase64.split(',')[1];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: "You are a nutritionist app. Analyze the image. Return ONLY a valid JSON object matching this exact format without any markdown wrappers: {\"name\": \"Brief Food Name\", \"calories\": 0, \"protein\": 0, \"carbs\": 0, \"fats\": 0}." },
                            { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                        ]
                    }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const jsonString = data.candidates[0].content.parts[0].text;
            const aiResult = JSON.parse(jsonString);

            await saveMeal({
                date: getTodayString(), name: aiResult.name,
                calories: aiResult.calories, protein: aiResult.protein,
                carbs: aiResult.carbs, fats: aiResult.fats,
                image: currentImageBase64, status: 'analyzed'
            });

            currentImageBase64 = null; previewContainer.classList.add('hidden'); cameraInput.value = '';
            document.querySelector('[data-target="view-dashboard"]').click();
        } catch (error) {
            console.error(error); alert("AI processing failed. Check your Gemini key or connection.");
            analyzeBtn.textContent = "Analyze Food"; analyzeBtn.disabled = false;
        }
    });

    document.getElementById('manual-log-btn').addEventListener('click', async () => {
        const textValue = manualFoodInput.value.trim();
        if (!textValue) return;
        await saveMeal({ date: getTodayString(), name: textValue, calories: 0, protein: 0, carbs: 0, fats: 0, image: null, status: 'manual' });
        manualFoodInput.value = '';
        document.querySelector('[data-target="view-dashboard"]').click();
    });
}

function setupSettings() {
    const keyInput = document.getElementById('api-key-input');
    const statusMsg = document.getElementById('settings-status');
    getSetting('gemini_key').then(k => { if (k) keyInput.value = '••••••••••••••••••••'; });

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const key = keyInput.value.trim();
        if (key && !key.startsWith('••••')) await saveSetting('gemini_key', key);
        statusMsg.textContent = 'Key Saved Successfully!'; statusMsg.style.color = '#34C759';
    });
}

async function updateDashboard() {
    const meals = await getMealsByDate(getTodayString());
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    if (meals.length === 0) { container.innerHTML = `<p class="empty-state">No meals logged today.</p>`; } 
    else {
        container.innerHTML = '';
        meals.forEach(m => {
            c += m.calories; p += m.protein; cb += m.carbs; f += m.fats;
            const row = document.createElement('div'); row.className = 'card';
            row.style = 'padding:12px; display:flex; align-items:center; gap:15px; margin-bottom:10px;';
            row.innerHTML = `${m.image ? `<img src="${m.image}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">` : `<div style="width:50px;height:50px;background:#e5e5ea;border-radius:8px;display:flex;align-items:center;justify-content:center;">🍽️</div>`}
                <div style="flex:1;"><div style="font-weight:bold;">${m.name}</div><div style="font-size:0.8rem;color:#666;">P:${m.protein}g C:${m.carbs}g F:${m.fats}g</div></div>
                <div><span style="font-weight:bold;color:var(--primary);">${m.calories}</span> <small>cal</small></div>`;
            container.appendChild(row);
        });
    }
    document.getElementById('calories-consumed').textContent = c;
    const pct = Math.min((c / 2000) * 100, 100);
    document.getElementById('calorie-ring').style.background = `conic-gradient(var(--primary) ${pct}%, #E5E5EA ${pct}%)`;
    updateMacroRow('.protein-fill', p, 150); updateMacroRow('.carbs-fill', cb, 200); updateMacroRow('.fats-fill', f, 65);
}

function updateMacroRow(cls, cur, tgt) {
    const el = document.querySelector(cls); el.style.width = `${Math.min((cur / tgt) * 100, 100)}%`;
    el.closest('.macro-row').querySelector('.macro-value').textContent = `${cur}g`;
}

async function updateWeeklySummary() {
    let sc = 0, sp = 0, scb = 0, sf = 0, loggedDays = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const meals = await getMealsByDate(dStr);
        if (meals.length > 0) {
            loggedDays++; meals.forEach(m => { sc += m.calories; sp += m.protein; scb += m.carbs; sf += m.fats; });
        }
    }
    const div = loggedDays > 0 ? loggedDays : 1;
    const boxes = document.querySelectorAll('.stat-num');
    boxes[0].textContent = Math.round(sc / div); boxes[1].textContent = `${Math.round(sp / div)}g`;
    boxes[2].textContent = `${Math.round(scb / div)}g`; boxes[3].textContent = `${Math.round(sf / div)}g`;
}
        analyzeBtn.textContent = "Analyzing..."; analyzeBtn.disabled = true;

        try {
            const base64Data = currentImageBase64.split(',')[1];
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "gpt-4o",
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: "You are a nutritionist app. Analyze the image. Return ONLY JSON matching format: {\"name\": \"Food Name\", \"calories\": 0, \"protein\": 0, \"carbs\": 0, \"fats\": 0}." },
                        { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }] }
                    ],
                    max_tokens: 300
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const aiResult = JSON.parse(data.choices[0].message.content);

            await saveMeal({
                date: getTodayString(), name: aiResult.name,
                calories: aiResult.calories, protein: aiResult.protein,
                carbs: aiResult.carbs, fats: aiResult.fats,
                image: currentImageBase64, status: 'analyzed'
            });

            currentImageBase64 = null; previewContainer.classList.add('hidden'); cameraInput.value = '';
            document.querySelector('[data-target="view-dashboard"]').click();
        } catch (error) {
            console.error(error); alert("AI processing failed. Check key/connection.");
            analyzeBtn.textContent = "Analyze Food"; analyzeBtn.disabled = false;
        }
    });

    document.getElementById('manual-log-btn').addEventListener('click', async () => {
        const textValue = manualFoodInput.value.trim();
        if (!textValue) return;
        await saveMeal({ date: getTodayString(), name: textValue, calories: 0, protein: 0, carbs: 0, fats: 0, image: null, status: 'manual' });
        manualFoodInput.value = '';
        document.querySelector('[data-target="view-dashboard"]').click();
    });
}

function setupSettings() {
    const keyInput = document.getElementById('api-key-input');
    const statusMsg = document.getElementById('settings-status');
    getSetting('openai_key').then(k => { if (k) keyInput.value = '••••••••••••••••••••'; });

    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const key = keyInput.value.trim();
        if (key && !key.startsWith('••••')) await saveSetting('openai_key', key);
        statusMsg.textContent = 'Key Saved Successfully!'; statusMsg.style.color = '#34C759';
    });
}

async function updateDashboard() {
    const meals = await getMealsByDate(getTodayString());
    const container = document.getElementById('meals-list');
    let c = 0, p = 0, cb = 0, f = 0;

    if (meals.length === 0) { container.innerHTML = `<p class="empty-state">No meals logged today.</p>`; } 
    else {
        container.innerHTML = '';
        meals.forEach(m => {
            c += m.calories; p += m.protein; cb += m.carbs; f += m.fats;
            const row = document.createElement('div'); row.className = 'card';
            row.style = 'padding:12px; display:flex; align-items:center; gap:15px; margin-bottom:10px;';
            row.innerHTML = `${m.image ? `<img src="${m.image}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">` : `<div style="width:50px;height:50px;background:#e5e5ea;border-radius:8px;display:flex;align-items:center;justify-content:center;">🍽️</div>`}
                <div style="flex:1;"><div style="font-weight:bold;">${m.name}</div><div style="font-size:0.8rem;color:#666;">P:${m.protein}g C:${m.carbs}g F:${m.fats}g</div></div>
                <div><span style="font-weight:bold;color:var(--primary);">${m.calories}</span> <small>cal</small></div>`;
            container.appendChild(row);
        });
    }
    document.getElementById('calories-consumed').textContent = c;
    const pct = Math.min((c / 2000) * 100, 100);
    document.getElementById('calorie-ring').style.background = `conic-gradient(var(--primary) ${pct}%, #E5E5EA ${pct}%)`;
    updateMacroRow('.protein-fill', p, 150); updateMacroRow('.carbs-fill', cb, 200); updateMacroRow('.fats-fill', f, 65);
}

function updateMacroRow(cls, cur, tgt) {
    const el = document.querySelector(cls); el.style.width = `${Math.min((cur / tgt) * 100, 100)}%`;
    el.closest('.macro-row').querySelector('.macro-value').textContent = `${cur}g`;
}

async function updateWeeklySummary() {
    let sc = 0, sp = 0, scb = 0, sf = 0, loggedDays = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const meals = await getMealsByDate(dStr);
        if (meals.length > 0) {
            loggedDays++; meals.forEach(m => { sc += m.calories; sp += m.protein; scb += m.carbs; sf += m.fats; });
        }
    }
    const div = loggedDays > 0 ? loggedDays : 1;
    const boxes = document.querySelectorAll('.stat-num');
    boxes[0].textContent = Math.round(sc / div); boxes[1].textContent = `${Math.round(sp / div)}g`;
    boxes[2].textContent = `${Math.round(scb / div)}g`; boxes[3].textContent = `${Math.round(sf / div)}g`;
}
