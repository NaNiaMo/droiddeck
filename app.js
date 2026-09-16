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
  if (id === 'browser') return `<div class="browser-shell"><label class="browser-bar"><span>⌕</span><input id="browserInput" aria-label="Address" value="droiddeck://welcome"><span>⋮</span></label><div class="browser-page"><div class="mini-brand"><span class="brand-mark">D</span>DroidDeck</div><h3>Browser simulation</h3><p>This page imitates a lightweight browser. It does not navigate to external websites, so the sandbox stays self-contained.</p><button id="browserAction">Try a simulated search</button></div></div>`;
  if (id === 'weather') return `<div class="weather-app"><div class="weather-big-icon">☀</div><h3>21°</h3><p>Clear skies · Victoria</p><div class="forecast"><div>Now<span>☀</span>21°</div><div>12 PM<span>☀</span>23°</div><div>3 PM<span>◐</span>22°</div><div>6 PM<span>☁</span>18°</div></div></div>`;
  if (id === 'camera') return `<div class="files-drop"><div class="folder-art">◉</div><h3>Camera simulation</h3><p>Camera hardware is intentionally unavailable in this HTML demo.</p><button class="primary-button" id="cameraAction">Simulate capture</button></div>`;
  return `<div class="files-drop"><div class="folder-art">${id === 'messages' ? '◌' : '◇'}</div><h3>${id === 'messages' ? 'No conversations' : 'App simulation'}</h3><p>${id === 'messages' ? 'Messages would appear here in a full Android environment.' : 'This mock app is ready for a future interface.'}</p><button class="primary-button" id="genericAction">Create demo item</button></div>`;
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
  const list = state.apkFiles.map((file, index) => `<div class="file-card"><span>APK</span><span><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)} · metadata only</small></span><button data-remove-file="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button></div>`).join('');
  return `<div class="files-drop"><div class="folder-art">⌑</div><h3>Inspect an APK file</h3><p>Selecting a file records its name, size, and date. The APK is not uploaded, installed, unpacked, or executed.</p><label class="primary-button" for="apkInput">Choose APK</label><input class="file-input" id="apkInput" type="file" accept=".apk,application/vnd.android.package-archive"></div><div id="fileList">${list}</div><p class="privacy-note"><span>✓</span>Your selected file stays on your device. Only descriptive details are remembered locally.</p>`;
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
  $('#browserAction')?.addEventListener('click', () => showToast('Simulated search complete'));
  $('#cameraAction')?.addEventListener('click', () => showToast('Photo captured in the simulation'));
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
    if (!file.name.toLowerCase().endsWith('.apk')) return showToast('Please choose an .apk file');
    state.apkFiles.unshift({ name: file.name, size: file.size, date: Date.now() });
    state.apkFiles = state.apkFiles.slice(0, 8);
    localStorage.setItem('droiddeck-apks', JSON.stringify(state.apkFiles));
    $('#appBody').innerHTML = filesContent();
    bindFiles();
    showToast('APK details added — file not executed');
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
      execute(input) { if (!apps.some(app => app.id === input?.appId)) throw new Error('Unknown app'); openApp(input.appId); return { view: 'app', appId: input.appId }; }
    },
    {
      name: 'return_to_simulated_home', title: 'Return to Home', description: 'Close the current simulated view and return to the Android home screen.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() { goHome(); return { view: 'home' }; }
    }
  ];
  registrations.forEach(tool => { try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch {} });
}

renderApps();
applySettings();
updateQuickSettings();
updateRecent();
updateClock();
setInterval(updateClock, 30000);
registerWebMCP();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
