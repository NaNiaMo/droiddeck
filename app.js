const apps = [
    { id: 'browser', name: 'Browser', icon: '◉', color: '#c3e9ff', home: true },
    { id: 'notes', name: 'Notes', icon: '✎', color: '#ffd66e', home: true },
    { id: 'calculator', name: 'Calculator', icon: '÷', color: '#ffc9a9', home: true },
    { id: 'files', name: 'Files', icon: '⌑', color: '#b8f26c', home: true },
    { id: 'weather', name: 'Weather', icon: '☀', color: '#a6d9ff' },
    { id: 'settings', name: 'Settings', icon: '⚙', color: '#d5dce0' },
    { id: 'camera', name: 'Camera', icon: '●', color: '#e9d8ff' },
    { id: 'messages', name: 'Messages', icon: '◌', color: '#bdf0cb' }
];

const state = {
    view: 'home',
    currentApp: null,
    recentApp: null,
    shadeOpen: false,
    settings: JSON.parse(localStorage.getItem('droiddeck-settings') || '{"wifi":true,"bluetooth":true,"quiet":false,"dark":true,"wallpaper":0}'),
    apkFiles: JSON.parse(localStorage.getItem('droiddeck-apks') || '[]'),
    browserHistory: [],
    browserIndex: -1
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const views = { home: $('#homeView'), drawer: $('#drawerView'), app: $('#appView'), overview: $('#overviewView') };
let toastTimer;

// --- Initialization & Rendering ---

function init() {
    renderApps();
    applySettings();
    updateQuickSettings();
    updateRecent();
    updateClock();
    initParticles();
    setInterval(updateClock, 30000);
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
}

function iconButton(app) {
    const button = document.createElement('button');
    button.className = 'app-icon-button';
    button.dataset.app = app.id;
    button.setAttribute('aria-label', `Open ${app.name}`);
    button.innerHTML = `<span class="app-icon" style="background:${app.color}">${app.icon}</span><label>${app.name}</label>`;
    button.addEventListener('click', () => openApp(app.id));
    return button;
}

function renderApps(filter = '') {
    const home = $('#homeApps');
    const drawer = $('#drawerApps');
    
    // Home screen only shows 'home: true' apps
    home.replaceChildren(...apps.filter(app => app.home).map(iconButton));
    
    // Drawer shows all apps, filtered
    const matches = apps.filter(app => app.name.toLowerCase().includes(filter.toLowerCase()));
    drawer.replaceChildren(...matches.map(iconButton));
    
    if (!matches.length) drawer.innerHTML = '<p class="empty-search">No matching apps</p>';
}

function setView(name) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    views[name].classList.add('active');
    state.view = name;
    if (name !== 'drawer') $('#appSearch').value = '';
}

function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
}

function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $$('.time, .shade-time').forEach(el => el.textContent = time);
    $('#shadeDate').textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// --- App Logic ---

function openApp(id) {
    const app = apps.find(item => item.id === id);
    if (!app) return;
    
    state.currentApp = id;
    state.recentApp = id;
    
    $('#appTitle').textContent = app.name;
    $('#appKicker').textContent = id === 'files' ? 'SANDBOX' : 'APP';
    
    // Clear previous app content
    $('#appBody').innerHTML = '';
    
    // Render specific app content
    $('#appBody').appendChild(createAppContent(id));
    
    bindAppActions(id);
    setView('app');
    updateRecent();
}

function createAppContent(id) {
    const container = document.createElement('div');
    
    if (id === 'settings') {
        container.innerHTML = settingsContent();
    } else if (id === 'notes') {
        container.innerHTML = `<div class="notes-area"><textarea id="notesInput" aria-label="Notes" placeholder="Write a note…">${escapeHtml(localStorage.getItem('droiddeck-notes') || '')}</textarea><div class="notes-status" id="notesStatus">Saved locally</div></div>`;
    } else if (id === 'calculator') {
        const template = $('#calculatorTemplate');
        container.appendChild(template.content.cloneNode(true));
    } else if (id === 'files') {
        container.innerHTML = filesContent();
    } else if (id === 'browser') {
        container.innerHTML = `<div class="browser-shell">
            <div class="browser-nav">
                <button id="browserBack" disabled>←</button>
                <button id="browserForward" disabled>→</button>
            </div>
            <label class="browser-bar"><span>⌕</span><input id="browserInput" aria-label="Address" value="droiddeck://welcome"><span>⋮</span></label>
            <div class="browser-page" id="browserPage"></div>
        </div>`;
        setTimeout(() => loadBrowserPage('welcome'), 0);
    } else if (id === 'weather') {
        container.innerHTML = `<div class="weather-app"><div class="weather-big-icon">☀</div><h3>21°</h3><p>Clear skies · Victoria</p><div class="forecast"><div>Now<span>☀</span>21°</div><div>12 PM<span>☀</span>23°</div><div>3 PM<span>◐</span>22°</div><div>6 PM<span>☁</span>18°</div></div></div>`;
    } else if (id === 'camera') {
        container.innerHTML = `<div class="camera-container">
            <video id="cameraVideo" class="camera-video" autoplay playsinline muted></video>
            <div class="camera-flash" id="cameraFlash"></div>
            <div class="camera-controls">
                <button class="shutter-btn" id="shutterBtn"></button>
            </div>
            <p style="position:absolute; top:10px; left:10px; color:white; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px; font-size:0.8rem;">Simulated Cam</p>
        </div>`;
        setTimeout(initCamera, 0);
    } else {
        container.innerHTML = `<div class="files-drop"><div class="folder-art">${id === 'messages' ? '◌' : '◇'}</div><h3>${id === 'messages' ? 'No conversations' : 'App simulation'}</h3><p>${id === 'messages' ? 'Messages would appear here in a full Android environment.' : 'This mock app is ready for a future interface.'}</p><button class="primary-button" id="genericAction">Create demo item</button></div>`;
    }
    
    return container;
}

function settingsContent() {
    const s = state.settings;
    return `<p class="app-section-title">Connections</p><div class="settings-list">
        ${settingRow('wifi','⌁','Internet','DroidDeck Wi‑Fi',s.wifi)}
        ${settingRow('bluetooth','ᛒ','Connected devices',s.bluetooth ? 'Bluetooth on' : 'Bluetooth off',s.bluetooth)}
    </div>
    <p class="app-section-title" style="margin-top:24px">Device</p>
    <div class="settings-list">
        ${settingRow('quiet','◐','Do Not Disturb',s.quiet ? 'On' : 'Off',s.quiet)}
        ${settingRow('dark','◑','Dark theme',s.dark ? 'On' : 'Off',s.dark)}
    </div>
    <p class="app-section-title" style="margin-top:24px">Wallpaper</p>
    <div class="wallpaper-options">
        ${[0,1,2].map(i => `<button class="wallpaper-choice ${s.wallpaper === i ? 'active' : ''}" data-wallpaper="${i}" aria-label="Wallpaper ${i+1}"></button>`).join('')}
    </div>
    <p class="app-section-title">About</p>
    <div class="settings-list">
        <div class="setting-row">
            <span>i</span>
            <div>
                <strong>DroidDeck HTML</strong>
                <small>Simulator build 2.0 · Enhanced Edition</small>
            </div>
        </div>
    </div>`;
}

function settingRow(key, icon, title, subtitle, on) {
    return `<button class="setting-row" data-toggle="${key}"><span>${icon}</span><span><strong>${title}</strong><small>${subtitle}</small></span><i class="switch ${on ? 'on' : ''}"></i></button>`;
}

function filesContent() {
    const list = state.apkFiles.map((file, index) => 
        `<div class="file-card">
            <span>APK</span>
            <span>
                <strong>${escapeHtml(file.name)}</strong>
                <small>${formatBytes(file.size)} · ${file.type || 'Unknown'} · ${new Date(file.date).toLocaleDateString()}</small>
            </span>
            <button data-remove-file="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
        </div>`
    ).join('');
    
    return `<div class="files-drop">
        <div class="folder-art">⌑</div>
        <h3>Inspect an APK/ZIP file</h3>
        <p>Selecting a file reads its header locally. No data is uploaded.</p>
        <label class="primary-button" for="apkInput">Choose File</label>
        <input class="file-input" id="apkInput" type="file" accept=".apk,.zip,application/zip,application/vnd.android.package-archive">
    </div>
    <div id="fileList">${list}</div>
    <p class="privacy-note"><span>✓</span>Your selected file stays on your device. Only descriptive details are remembered locally.</p>`;
}

// --- Event Binding ---

function bindAppActions(id) {
    if (id === 'settings') {
        $$('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleSetting(button.dataset.toggle, true)));
        $$('[data-wallpaper]').forEach(button => button.addEventListener('click', () => setWallpaper(Number(button.dataset.wallpaper), true)));
    }
    if (id === 'notes') {
        const input = $('#notesInput');
        input.addEventListener('input', () => {
            localStorage.setItem('droiddeck-notes', input.value);
            $('#notesStatus').textContent = 'Saved just now';
        });
    }
    if (id === 'calculator') bindCalculator();
    if (id === 'files') bindFiles();
    if (id === 'browser') bindBrowser();
    if (id === 'camera') {
        $('#shutterBtn')?.addEventListener('click', triggerCameraFlash);
    }
    $('#genericAction')?.addEventListener('click', () => showToast('Demo item created'));
}

// --- Feature Implementations ---

function toggleSetting(key, rerender = false) {
    state.settings[key] = !state.settings[key];
    persistSettings();
    applySettings();
    if (rerender && state.currentApp === 'settings') openApp('settings');
    updateQuickSettings();
}

function setWallpaper(index, rerender = false) {
    state.settings.wallpaper = index;
    persistSettings();
    applySettings();
    if (rerender && state.currentApp === 'settings') openApp('settings');
}

function persistSettings() { 
    localStorage.setItem('droiddeck-settings', JSON.stringify(state.settings)); 
}

function applySettings() {
    document.body.classList.toggle('light-ui', !state.settings.dark);
    $('#quietIcon').hidden = !state.settings.quiet;
    
    const palettes = [
        ['#26413f','#101316','#603f83'],
        ['#715238','#1c1611','#114b5f'],
        ['#2f385c','#111328','#b14f73']
    ];
    const palette = palettes[state.settings.wallpaper] || palettes[0];
    palette.forEach((color, index) => document.documentElement.style.setProperty(`--wall-${index+1}`, color));
}

function updateQuickSettings() {
    $$('[data-setting]').forEach(button => button.classList.toggle('active', Boolean(state.settings[button.dataset.setting])));
}

// Calculator Logic
function bindCalculator() {
    const display = $('#calcDisplay');
    let currentInput = '0';
    let previousInput = '';
    let operator = null;
    let shouldResetScreen = false;

    function updateDisplay() {
        display.textContent = currentInput;
    }

    $$('[data-calc]').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.calc;
            
            if (!isNaN(value) || value === '.') {
                if (currentInput === '0' || shouldResetScreen) {
                    currentInput = value === '.' ? '0.' : value;
                    shouldResetScreen = false;
                } else {
                    if (value === '.' && currentInput.includes('.')) return;
                    currentInput += value;
                }
            } else if (value === 'clear') {
                currentInput = '0';
                previousInput = '';
                operator = null;
            } else if (value === 'sign') {
                currentInput = String(parseFloat(currentInput) * -1);
            } else if (value === 'percent') {
                currentInput = String(parseFloat(currentInput) / 100);
            } else if (['+', '-', '*', '/'].includes(value)) {
                if (operator !== null) calculate();
                previousInput = currentInput;
                operator = value;
                shouldResetScreen = true;
            } else if (value === '=') {
                if (operator === null || shouldResetScreen) return;
                calculate();
                operator = null;
                shouldResetScreen = true;
            }
            updateDisplay();
        });
    });

    function calculate() {
        const prev = parseFloat(previousInput);
        const current = parseFloat(currentInput);
        if (isNaN(prev) || isNaN(current)) return;
        
        let result;
        switch (operator) {
            case '+': result = prev + current; break;
            case '-': result = prev - current; break;
            case '*': result = prev * current; break;
            case '/': result = current === 0 ? 'Error' : prev / current; break;
        }
        
        currentInput = String(result);
    }
}

// File Inspector Logic
function bindFiles() {
    $('#apkInput')?.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Read first 4 bytes to identify magic number
        const buffer = await file.slice(0, 4).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let type = 'Unknown';
        
        // ZIP/APK Magic Number: PK (0x50 0x4B)
        if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
            type = 'ZIP/APK Archive';
        }
        
        const fileData = { 
            name: file.name, 
            size: file.size, 
            date: Date.now(),
            type: type
        };
        
        state.apkFiles.unshift(fileData);
        state.apkFiles = state.apkFiles.slice(0, 8);
        localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
        
        $('#appBody').innerHTML = filesContent();
        bindFiles();
        showToast('File inspected successfully');
    });
    
    $$('[data-remove-file]').forEach(button => button.addEventListener('click', () => {
        state.apkFiles.splice(Number(button.dataset.removeFile), 1);
        localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
        $('#appBody').innerHTML = filesContent();
        bindFiles();
    }));
}

// Browser Simulation Logic
function bindBrowser() {
    const input = $('#browserInput');
    const page = $('#browserPage');
    const backBtn = $('#browserBack');
    const fwdBtn = $('#browserForward');
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            loadBrowserPage(input.value);
        }
    });
    
    backBtn.addEventListener('click', () => {
        if (state.browserIndex > 0) {
            state.browserIndex--;
            loadBrowserPage(state.browserHistory[state.browserIndex], false);
        }
    });
    
    fwdBtn.addEventListener('click', () => {
        if (state.browserIndex < state.browserHistory.length - 1) {
            state.browserIndex++;
            loadBrowserPage(state.browserHistory[state.browserIndex], false);
        }
    });
}

function loadBrowserPage(url, addToHistory = true) {
    const page = $('#browserPage');
    const input = $('#browserInput');
    const backBtn = $('#browserBack');
    const fwdBtn = $('#browserForward');
    
    if (addToHistory) {
        // Remove forward history if we branch out
        state.browserHistory = state.browserHistory.slice(0, state.browserIndex + 1);
        state.browserHistory.push(url);
        state.browserIndex++;
    }
    
    input.value = url;
    backBtn.disabled = state.browserIndex <= 0;
    fwdBtn.disabled = state.browserIndex >= state.browserHistory.length - 1;
    
    // Simulate content
    if (url.includes('welcome')) {
        page.innerHTML = `<div class="mini-brand"><span class="brand-mark">D</span>DroidDeck</div>
        <h3>Welcome to the Web</h3>
        <p>This is a simulated browser environment. Try searching for "cats" or "news".</p>
        <button class="primary-button" onclick="loadBrowserPage('search:cats')">Search Cats</button>`;
    } else if (url.includes('cats')) {
        page.innerHTML = `<h3>Search Results: Cats</h3>
        <div style="display:grid; gap:10px; margin-top:20px;">
            <div style="background:#ddd; height:100px; border-radius:8px;"></div>
            <p><strong>The Internet's Favorite Animal</strong><br>Cats are small, carnivorous mammals...</p>
            <div style="background:#ddd; height:100px; border-radius:8px;"></div>
        </div>`;
    } else {
        page.innerHTML = `<h3>404 Not Found</h3><p>Could not load ${url}</p>`;
    }
}

// Camera Logic
async function initCamera() {
    const video = $('#cameraVideo');
    if (!video) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
    } catch (err) {
        console.log("Camera access denied or unavailable");
        video.style.background = "#333";
    }
}

function triggerCameraFlash() {
    const flash = $('#cameraFlash');
    if (flash) {
        flash.style.opacity = 1;
        setTimeout(() => flash.style.opacity = 0, 100);
        showToast('Photo captured');
    }
}

// --- Navigation & System ---

function updateRecent() {
    const app = apps.find(item => item.id === state.recentApp);
    $('#recentCard').hidden = !app;
    $('#emptyRecents').hidden = Boolean(app);
    if (app) {
        $('#recentIcon').textContent = app.icon;
        $('#recentName').textContent = app.name;
        $('#recentCard').onclick = () => openApp(app.id);
    }
}

function goHome() {
    closeShade();
    setView('home');
}

function goBack() {
    if (state.shadeOpen) return closeShade();
    if (state.view === 'app') return setView('home'); // Simplified for simulator
    if (state.view !== 'home') return setView('home');
    showToast('Already at Home');
}

function openShade() {
    state.shadeOpen = true;
    $('#notificationShade').classList.add('open');
    $('#notificationShade').setAttribute('aria-hidden', 'false');
    updateQuickSettings();
}

function closeShade() {
    state.shadeOpen = false;
    $('#notificationShade').classList.remove('open');
    $('#notificationShade').setAttribute('aria-hidden', 'true');
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B','KB','MB','GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

// --- Particle Wallpaper System ---
function initParticles() {
    const canvas = $('#particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    
    function resize() {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
    }
    
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 2 + 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }
        draw() {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    function init() {
        resize();
        for(let i=0; i<30; i++) particles.push(new Particle());
        animate();
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', resize);
    init();
}

// --- Global Event Listeners ---

$('#searchPill').addEventListener('click', () => { setView('drawer'); setTimeout(() => $('#appSearch').focus(), 250); });
$('#closeDrawer').addEventListener('click', goHome);
$('#appSearch').addEventListener('input', event => renderApps(event.target.value));
$('#appBack').addEventListener('click', goBack);
$('#appMenu').addEventListener('click', () => showToast('No additional options'));
$('#navBack').addEventListener('click', goBack);
$('#navHome').addEventListener('click', goHome);
$('#navOverview').addEventListener('click', () => { closeShade(); updateRecent(); setView('overview'); });
$('#clearRecents').addEventListener('click', () => { state.recentApp = null; updateRecent(); });
$('#shadeButton').addEventListener('click', openShade);
$('#shadeClose').addEventListener('click', closeShade);
$('#shadeSettings').addEventListener('click', () => { closeShade(); openApp('settings'); });
$('#quickSettings').addEventListener('click', event => {
    const button = event.target.closest('[data-setting]');
    if (button) toggleSetting(button.dataset.setting);
});
$('#brightness').addEventListener('input', event => document.documentElement.style.setProperty('--brightness', event.target.value / 100));

// Touch Gestures
let touchStartY = null;
$('#screen').addEventListener('touchstart', event => { touchStartY = event.touches[0].clientY; }, { passive: true });
$('#screen').addEventListener('touchend', event => {
    if (touchStartY == null) return;
    const delta = event.changedTouches[0].clientY - touchStartY;
    const startedHigh = touchStartY < 120;
    
    if (startedHigh && delta > 70) openShade();
    else if (!state.shadeOpen && state.view === 'home' && delta < -70) setView('drawer');
    else if (state.shadeOpen && delta < -60) closeShade();
    touchStartY = null;
}, { passive: true });

// Keyboard Shortcuts
document.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea')) return;
    if (event.key.toLowerCase() === 'h') goHome();
    if (event.key.toLowerCase() === 'b') goBack();
    if (event.key.toLowerCase() === 'a') setView('drawer');
    if (event.key === 'Escape') goBack();
});

// Start
init();
const apps = [
  { id: 'browser', name: 'Browser', icon: '◉', color: '#c3e9ff', home: true },
  { id: 'notes', name: 'Notes', icon: '✎', color: '#ffd66e', home: true },
  { id: 'calculator', name: 'Calculator', icon: '÷', color: '#ffc9a9', home: true },
  { id: 'files', name: 'Files', icon: '⌑', color: '#b8f26c', home: true },
  { id: 'weather', name: 'Weather', icon: '☀', color: '#a6d9ff' },
  { id: 'settings', name: 'Settings', icon: '⚙', color: '#d5dce0' },
  { id: 'camera', name: 'Camera', icon: '●', color: '#e9d8ff' },
  { id: 'messages', name: 'Messages', icon: '◌', color: '#bdf0cb' }
];

const state = {
  view: 'home',
  currentApp: null,
  recentApp: null,
  shadeOpen: false,
  settings: JSON.parse(localStorage.getItem('droiddeck-settings') || '{"wifi":true,"bluetooth":true,"quiet":false,"dark":true,"wallpaper":0}'),
  apkFiles: JSON.parse(localStorage.getItem('droiddeck-apks') || '[]')
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const views = { home: $('#homeView'), drawer: $('#drawerView'), app: $('#appView'), overview: $('#overviewView') };
let toastTimer;
let activeStream = null;

function iconButton(app) {
  const button = document.createElement('button');
  button.className = 'app-icon-button';
  button.dataset.app = app.id;
  button.setAttribute('aria-label', `Open ${app.name}`);
  button.innerHTML = `<span class="app-icon" style="background:${app.color}">${app.icon}</span><label>${app.name}</label>`;
  button.addEventListener('click', () => openApp(app.id));
  return button;
}

function renderApps(filter = '') {
  const home = $('#homeApps');
  const drawer = $('#drawerApps');
  home.replaceChildren(...apps.filter(app => app.home).map(iconButton));
  const matches = apps.filter(app => app.name.toLowerCase().includes(filter.toLowerCase()));
  drawer.replaceChildren(...matches.map(iconButton));
  if (!matches.length) drawer.innerHTML = '<p class="empty-search">No matching apps</p>';
}

function setView(name) {
  if (name !== 'app' || state.currentApp !== 'camera') {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
  }
  Object.values(views).forEach(view => view.classList.remove('active'));
  views[name].classList.add('active');
  state.view = name;
  if (name !== 'drawer') $('#appSearch').value = '';
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $$('.time, .shade-time').forEach(el => el.textContent = time);
  $('#shadeDate').textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function openApp(id) {
  const app = apps.find(item => item.id === id);
  if (!app) return;
  state.currentApp = id;
  state.recentApp = id;
  $('#appTitle').textContent = app.name;
  $('#appKicker').textContent = id === 'files' ? 'SANDBOX' : 'APP';
  $('#appBody').innerHTML = appContent(id);
  bindAppActions(id);
  setView('app');
  updateRecent();
}

function appContent(id) {
  if (id === 'settings') return settingsContent();
  if (id === 'notes') return `<div class="notes-area"><textarea id="notesInput" aria-label="Notes" placeholder="Write a note…">${escapeHtml(localStorage.getItem('droiddeck-notes') || '')}</textarea><div class="notes-status" id="notesStatus">Saved locally</div></div>`;
  if (id === 'calculator') return $('#calculatorTemplate').innerHTML;
  if (id === 'files') return filesContent();
  
  if (id === 'browser') return `
    <div class="browser-shell" style="height: 100%; display: flex; flex-direction: column; gap: 10px;">
      <form id="browserForm" class="browser-bar" style="margin: 0; padding-right: 8px;">
        <span>⌕</span>
        <input id="browserInput" type="url" aria-label="Address" placeholder="Enter URL (https://...)" value="https://en.wikipedia.org/wiki/Main_Page" required style="flex:1;min-width:0;border:0;outline:0;color:inherit;background:transparent;">
        <button type="submit" style="background:transparent;border:none;color:inherit;cursor:pointer;font-size:1.2rem;padding:0 8px;">➔</button>
      </form>
      <iframe id="browserFrame" src="https://en.wikipedia.org/wiki/Main_Page" class="browser-page" style="flex:1; width:100%; border:none; padding:0; background:#fff; border-radius: 22px;"></iframe>
    </div>`;
    
  if (id === 'weather') return `
    <div class="weather-app" id="weatherAppContent" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
      <div class="weather-big-icon" style="animation: pulse 1.5s infinite; font-size:5rem;">⏳</div>
      <p style="color:#a3abaf;">Fetching local weather...</p>
    </div>`;
    
  if (id === 'camera') return `
    <div style="display:flex;flex-direction:column;height:100%;position:relative;background:#000;border-radius:22px;overflow:hidden;margin:-18px;">
      <video id="cameraFeed" autoplay playsinline style="flex:1;object-fit:cover;width:100%;height:100%;"></video>
      <button id="captureBtn" style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;border:4px solid white;background:rgba(255,255,255,0.3);cursor:pointer;"></button>
    </div>`;
    
  if (id === 'messages') {
    const history = JSON.parse(localStorage.getItem('droiddeck-msgs') || '[]');
    const msgsHtml = history.map(m => `
      <div style="align-self:${m.self ? 'flex-end' : 'flex-start'};background:${m.self ? 'var(--lime)' : '#2a3033'};color:${m.self ? '#111' : 'white'};padding:10px 14px;border-radius:${m.self ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};max-width:80%;word-wrap:break-word;">
        ${escapeHtml(m.text)}
      </div>`).join('');
    
    return `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div id="chatWindow" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-bottom:16px;">
        <div style="align-self:flex-start;background:#2a3033;padding:10px 14px;border-radius:18px 18px 18px 4px;max-width:80%;">Hello! I am a simulated contact. Try sending a message!</div>
        ${msgsHtml}
      </div>
      <form id="msgForm" style="display:flex;gap:10px;margin-top:auto;">
        <input id="msgInput" type="text" placeholder="Type a message..." style="flex:1;border-radius:20px;border:none;padding:12px 16px;background:#191e21;color:white;outline:none;" required autocomplete="off">
        <button type="submit" class="primary-button" style="padding:0;width:44px;border-radius:50%;">→</button>
      </form>
    </div>`;
  }
  
  return `<div class="files-drop"><div class="folder-art">◇</div><h3>App simulation</h3><p>This mock app is ready for a future interface.</p><button class="primary-button" id="genericAction">Create demo item</button></div>`;
}

function settingsContent() {
  const s = state.settings;
  return `<p class="app-section-title">Connections</p><div class="settings-list">
    ${settingRow('wifi','⌁','Internet','DroidDeck Wi‑Fi',s.wifi)}
    ${settingRow('bluetooth','ᛒ','Connected devices',s.bluetooth ? 'Bluetooth on' : 'Bluetooth off',s.bluetooth)}
  </div><p class="app-section-title" style="margin-top:24px">Device</p><div class="settings-list">
    ${settingRow('quiet','◐','Do Not Disturb',s.quiet ? 'On' : 'Off',s.quiet)}
    ${settingRow('dark','◑','Dark theme',s.dark ? 'On' : 'Off',s.dark)}
  </div><p class="app-section-title" style="margin-top:24px">Wallpaper</p><div class="wallpaper-options">
    ${[0,1,2].map(i => `<button class="wallpaper-choice ${s.wallpaper === i ? 'active' : ''}" data-wallpaper="${i}" aria-label="Wallpaper ${i+1}"></button>`).join('')}
  </div><p class="app-section-title">About</p><div class="settings-list"><div class="setting-row"><span>i</span><div><strong>DroidDeck HTML</strong><small>Simulator build 1.0 · No Android runtime</small></div></div></div>`;
}

function settingRow(key, icon, title, subtitle, on) {
  return `<button class="setting-row" data-toggle="${key}"><span>${icon}</span><span><strong>${title}</strong><small>${subtitle}</small></span><i class="switch ${on ? 'on' : ''}"></i></button>`;
}

function filesContent() {
  const list = state.apkFiles.map((file, index) => {
    let thumb = file.isImage && file.dataUrl 
      ? `<img src="${file.dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;display:block;" alt="thumb">` 
      : 'APK';
    let typeDesc = file.isImage ? 'local image' : 'metadata only';
    
    return `<div class="file-card">
      <span style="${file.isImage ? 'padding:0;' : ''}">${thumb}</span>
      <span><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)} · ${typeDesc}</small></span>
      <button data-remove-file="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
    </div>`;
  }).join('');

  return `<div class="files-drop"><div class="folder-art">⌑</div><h3>Inspect Files</h3><p>Files are stored locally in your browser storage.</p><label class="primary-button" for="apkInput">Choose File</label><input class="file-input" id="apkInput" type="file" accept="*/*"></div><div id="fileList">${list}</div><p class="privacy-note"><span>✓</span>Your files stay on your device locally.</p>`;
}

function bindAppActions(id) {
  if (id === 'settings') {
    $$('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleSetting(button.dataset.toggle, true)));
    $$('[data-wallpaper]').forEach(button => button.addEventListener('click', () => setWallpaper(Number(button.dataset.wallpaper), true)));
  }
  if (id === 'notes') {
    const input = $('#notesInput');
    input.addEventListener('input', () => {
      localStorage.setItem('droiddeck-notes', input.value);
      $('#notesStatus').textContent = 'Saved just now';
    });
  }
  if (id === 'calculator') bindCalculator();
  if (id === 'files') bindFiles();
  
  if (id === 'browser') {
    $('#browserForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      let url = $('#browserInput').value;
      if (!url.startsWith('http')) url = 'https://' + url;
      $('#browserInput').value = url;
      $('#browserFrame').src = url;
    });
  }

  if (id === 'weather') {
    const renderWeather = (temp, desc, code, loc) => {
      const icon = code < 3 ? '☀' : code < 50 ? '☁' : code < 70 ? '🌧' : code < 80 ? '❄' : '🌩';
      $('#weatherAppContent').innerHTML = `
        <div class="weather-big-icon" style="font-size:5rem;">${icon}</div>
        <h3 style="font-size:4.5rem;margin:3px 0;letter-spacing:-.09em;font-weight:500;">${Math.round(temp)}°</h3>
        <p style="color:#a3abaf;">${desc} · ${loc}</p>
        <button class="primary-button" style="margin-top:20px;" onclick="openApp('weather')">Refresh</button>
      `;
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          renderWeather(data.current_weather.temperature, 'Current conditions', data.current_weather.weathercode, 'Local Area');
        } catch(e) {
          renderWeather(21, 'API Error (Fallback)', 0, 'Victoria');
        }
      }, () => {
         renderWeather(21, 'Location Denied (Fallback)', 0, 'Victoria');
      });
    } else {
      renderWeather(21, 'No Geo (Fallback)', 0, 'Victoria');
    }
  }

  if (id === 'camera') {
    const video = $('#cameraFeed');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        activeStream = stream;
        video.srcObject = stream;
      })
      .catch(e => {
        $('#appBody').innerHTML = '<div class="files-drop"><div class="folder-art">⚠</div><h3>Camera Error</h3><p>Could not access camera hardware.</p></div>';
      });

    $('#captureBtn')?.addEventListener('click', () => {
      if (!video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const name = `IMG_${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`;
      const size = Math.round((dataUrl.length * 3) / 4);
      
      state.apkFiles.unshift({ name, size, date: Date.now(), isImage: true, dataUrl });
      state.apkFiles = state.apkFiles.slice(0, 10); // Keep last 10 
      localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
      
      showToast('Photo saved to Files!');
      video.style.opacity = '0';
      setTimeout(() => video.style.opacity = '1', 150);
    });
  }

  if (id === 'messages') {
    const form = $('#msgForm');
    const input = $('#msgInput');
    const chatWindow = $('#chatWindow');
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;

    const addMsg = (text, self) => {
      const msg = document.createElement('div');
      msg.textContent = text;
      msg.style.cssText = `padding:10px 14px;max-width:80%;word-wrap:break-word;margin-bottom:2px;` +
        (self ? `align-self:flex-end;background:var(--lime);color:#111;border-radius:18px 18px 4px 18px;` 
              : `align-self:flex-start;background:#2a3033;border-radius:18px 18px 18px 4px;`);
      chatWindow.appendChild(msg);
      chatWindow.scrollTop = chatWindow.scrollHeight;
      
      const history = JSON.parse(localStorage.getItem('droiddeck-msgs') || '[]');
      history.push({ text, self });
      if(history.length > 50) history.shift();
      localStorage.setItem('droiddeck-msgs', JSON.stringify(history));
    };

    form?.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if(!text) return;
      addMsg(text, true);
      input.value = '';
      
      setTimeout(() => {
        const replies = ["That's interesting!", "Tell me more.", "I'm a local simulation, but I hear you.", "Haha, good one!", "Agreed.", "What do you mean by that?"];
        addMsg(replies[Math.floor(Math.random() * replies.length)], false);
        if (state.currentApp !== 'messages') showToast('New message received');
      }, 800 + Math.random() * 1000);
    });
  }

  $('#genericAction')?.addEventListener('click', () => showToast('Demo item created'));
}

function toggleSetting(key, rerender = false) {
  state.settings[key] = !state.settings[key];
  persistSettings();
  applySettings();
  if (rerender && state.currentApp === 'settings') openApp('settings');
  updateQuickSettings();
}

function setWallpaper(index, rerender = false) {
  state.settings.wallpaper = index;
  persistSettings();
  applySettings();
  if (rerender && state.currentApp === 'settings') openApp('settings');
}

function persistSettings() { localStorage.setItem('droiddeck-settings', JSON.stringify(state.settings)); }

function applySettings() {
  document.body.classList.toggle('light-ui', !state.settings.dark);
  $('#quietIcon').hidden = !state.settings.quiet;
  const palettes = [
    ['#26413f','#101316','#603f83'],
    ['#715238','#1c1611','#114b5f'],
    ['#2f385c','#111328','#b14f73']
  ];
  const palette = palettes[state.settings.wallpaper] || palettes[0];
  palette.forEach((color, index) => document.documentElement.style.setProperty(`--wall-${index+1}`, color));
}

function updateQuickSettings() {
  $$('[data-setting]').forEach(button => button.classList.toggle('active', Boolean(state.settings[button.dataset.setting])));
}

function bindFiles() {
  $('#apkInput')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        state.apkFiles.unshift({ name: file.name, size: file.size, date: Date.now(), isImage: true, dataUrl: e.target.result });
        state.apkFiles = state.apkFiles.slice(0, 10);
        localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
        $('#appBody').innerHTML = filesContent();
        bindFiles();
        showToast('Image saved locally');
      };
      reader.readAsDataURL(file);
    } else {
      state.apkFiles.unshift({ name: file.name, size: file.size, date: Date.now() });
      state.apkFiles = state.apkFiles.slice(0, 10);
      localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
      $('#appBody').innerHTML = filesContent();
      bindFiles();
      showToast('File details added');
    }
  });
  $$('[data-remove-file]').forEach(button => button.addEventListener('click', () => {
    state.apkFiles.splice(Number(button.dataset.removeFile), 1);
    localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
    $('#appBody').innerHTML = filesContent();
    bindFiles();
  }));
}

function bindCalculator() {
  const display = $('#calcDisplay');
  let expression = '';
  $$('[data-calc]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.calc;
    if (value === 'clear') expression = '';
    else if (value === 'sign' && expression) expression = expression.startsWith('-') ? expression.slice(1) : `-${expression}`;
    else if (value === 'percent' && expression) expression = String(Number(expression) / 100);
    else if (value === '=') {
      try {
        if (!/^[\d+\-*/.() ]+$/.test(expression)) throw new Error('Invalid');
        expression = String(Function(`"use strict"; return (${expression})`)());
      } catch { expression = 'Error'; }
    } else expression = expression === 'Error' ? value : expression + value;
    display.textContent = expression || '0';
  }));
}

function updateRecent() {
  const app = apps.find(item => item.id === state.recentApp);
  $('#recentCard').hidden = !app;
  $('#emptyRecents').hidden = Boolean(app);
  if (app) {
    $('#recentIcon').textContent = app.icon;
    $('#recentName').textContent = app.name;
    $('#recentCard').onclick = () => openApp(app.id);
  }
}

function goHome() {
  closeShade();
  setView('home');
}

function goBack() {
  if (state.shadeOpen) return closeShade();
  if (state.view === 'app') return setView('drawer');
  if (state.view !== 'home') return setView('home');
  showToast('Already at Home');
}

function openShade() {
  state.shadeOpen = true;
  $('#notificationShade').classList.add('open');
  $('#notificationShade').setAttribute('aria-hidden', 'false');
  updateQuickSettings();
}

function closeShade() {
  state.shadeOpen = false;
  $('#notificationShade').classList.remove('open');
  $('#notificationShade').setAttribute('aria-hidden', 'true');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

$('#searchPill').addEventListener('click', () => { setView('drawer'); setTimeout(() => $('#appSearch').focus(), 250); });
$('#closeDrawer').addEventListener('click', goHome);
$('#appSearch').addEventListener('input', event => renderApps(event.target.value));
$('#appBack').addEventListener('click', goBack);
$('#appMenu').addEventListener('click', () => showToast('No additional options'));
$('#navBack').addEventListener('click', goBack);
$('#navHome').addEventListener('click', goHome);
$('#navOverview').addEventListener('click', () => { closeShade(); updateRecent(); setView('overview'); });
$('#clearRecents').addEventListener('click', () => { state.recentApp = null; updateRecent(); });
$('#shadeButton').addEventListener('click', openShade);
$('#shadeClose').addEventListener('click', closeShade);
$('#shadeSettings').addEventListener('click', () => { closeShade(); openApp('settings'); });
$('#quickSettings').addEventListener('click', event => {
  const button = event.target.closest('[data-setting]');
  if (button) toggleSetting(button.dataset.setting);
});
$('#brightness').addEventListener('input', event => document.documentElement.style.setProperty('--brightness', event.target.value / 100));
$$('[data-open-app]').forEach(button => button.addEventListener('click', () => openApp(button.dataset.openApp)));

let touchStartY = null;
$('#screen').addEventListener('touchstart', event => { touchStartY = event.touches[0].clientY; }, { passive: true });
$('#screen').addEventListener('touchend', event => {
  if (touchStartY == null) return;
  const delta = event.changedTouches[0].clientY - touchStartY;
  const startedHigh = touchStartY < 120;
  if (startedHigh && delta > 70) openShade();
  else if (!state.shadeOpen && state.view === 'home' && delta < -70) setView('drawer');
  else if (state.shadeOpen && delta < -60) closeShade();
  touchStartY = null;
}, { passive: true });

document.addEventListener('keydown', event => {
  if (event.target.matches('input,textarea')) return;
  if (event.key.toLowerCase() === 'h') goHome();
  if (event.key.toLowerCase() === 'b') goBack();
  if (event.key.toLowerCase() === 'a') setView('drawer');
  if (event.key === 'Escape') goBack();
});

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const registrations = [
    {
      name: 'open_simulated_app', title: 'Open simulated app', description: 'Open one of the visible simulated Android apps by its stable app id.',
      inputSchema: { type: 'object', properties: { appId: { type: 'string', enum: apps.map(app => app.id) } }, required: ['appId'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) { 
        if (!apps.some(app => app.id === input?.appId)) return { content: [{ type: 'text', text: 'App not found' }] };
        openApp(input.appId);
        return { content: [{ type: 'text', text: `Opened ${input.appId}` }] };
      }
    }
  ];
  registrations.forEach(def => context.registerTool(def));
}
registerWebMCP();
if (id === 'camera') {
    showToast('FU');

    const video = $('#cameraFeed');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        activeStream = stream;
        video.srcObject = stream;
      })
      .catch(e => {
        $('#appBody').innerHTML = '<div class="files-drop"><div class="folder-art">⚠</div><h3>Camera Error</h3><p>Could not access camera hardware.</p></div>';
      });

    $('#captureBtn')?.addEventListener('click', () => {
      showToast('FU');

      if (!video.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const name = `IMG_${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`;
      const size = Math.round((dataUrl.length * 3) / 4);
      
      state.apkFiles.unshift({ name, size, date: Date.now(), isImage: true, dataUrl });
      state.apkFiles = state.apkFiles.slice(0, 10);
      localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
      
      video.style.opacity = '0';
      setTimeout(() => video.style.opacity = '1', 150);
    });
  }
