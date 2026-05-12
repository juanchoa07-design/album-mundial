// ─── FIREBASE ────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyANpLiPz5yJl1JViEJNVv8dLypTFBZwFGU",
  authDomain:        "album-app-b39b4.firebaseapp.com",
  databaseURL:       "https://album-app-b39b4-default-rtdb.firebaseio.com",
  projectId:         "album-app-b39b4",
  storageBucket:     "album-app-b39b4.firebasestorage.app",
  messagingSenderId: "847811547361",
  appId:             "1:847811547361:web:7762eea1c2eff2682c67a0"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.database();
let currentUser = null;
let viewerUid = null;
let myCollected = {};

function updateAuthUI(user) {
  updateSidebarAuth(user);
  const bar = document.getElementById('auth-bar');
  bar.innerHTML = '';

  // Conectar botones del modal
  const modalClose = document.getElementById('auth-modal-close');
  const modalLogin = document.getElementById('login-btn-modal');
  const overlay    = document.getElementById('auth-overlay');
  if (modalClose) modalClose.onclick = () => overlay.classList.add('hidden');
  if (modalLogin) modalLogin.onclick = signIn;
  if (overlay)    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.add('hidden'); };

  if (!user) {
    const btn = document.createElement('button');
    btn.className = 'auth-bar-login-btn';
    btn.innerHTML = '☁️ Sincronizar álbum';
    btn.addEventListener('click', () => overlay.classList.remove('hidden'));
    bar.appendChild(btn);
  } else {
    overlay.classList.add('hidden');
    if (user.photoURL) {
      const img = document.createElement('img');
      img.className = 'user-photo';
      img.src = user.photoURL;
      img.alt = '';
      bar.appendChild(img);
    }
    const nameEl = document.createElement('span');
    nameEl.className = 'user-name';
    nameEl.textContent = (user.displayName || 'Usuario').split(' ')[0];
    bar.appendChild(nameEl);
    const syncEl = document.createElement('span');
    syncEl.className = 'sync-ok';
    syncEl.textContent = '✓ Sincronizado';
    bar.appendChild(syncEl);
    const shareBtn = document.createElement('button');
    shareBtn.className = 'share-btn';
    shareBtn.textContent = '🔗 Compartir';
    shareBtn.addEventListener('click', () => {
      const url = location.origin + location.pathname + '?uid=' + user.uid;
      navigator.clipboard.writeText(url).then(() => showToast('✅ Link copiado. Mandáselo a tu amigo.'));
    });
    bar.appendChild(shareBtn);
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.textContent = 'Cerrar sesión';
    logoutBtn.addEventListener('click', signOut);
    bar.appendChild(logoutBtn);
  }
}

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => {
    if (e.code !== 'auth/popup-closed-by-user')
      showToast('No se pudo iniciar sesión. Intentá de nuevo.');
  });
}

function signOut() {
  if (confirm('¿Cerrar sesión?\nTu progreso quedará guardado en la nube.'))
    auth.signOut();
}

async function loadFromFirestore(uid) {
  try {
    const snap = await db.ref('users/' + uid).get();
    const local = { ...collected };
    const remote = snap.exists() ? (snap.val().collected || {}) : {};

    const merged = { ...remote };
    let newCount = 0;
    for (const [id, val] of Object.entries(local)) {
      if (val && !merged[id]) { merged[id] = true; newCount++; }
    }

    collected = merged;
    await db.ref('users/' + uid).set({ collected: merged });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ collected })); } catch(e) {}

    if (!snap.exists()) {
      const total = Object.values(merged).filter(Boolean).length;
      if (total > 0) showToast(`✅ Se importaron ${total} figuritas a tu cuenta`);
    } else if (newCount > 0) {
      showToast(`✅ Se agregaron ${newCount} figuritas nuevas a tu cuenta`);
    }
    if (currentUser?.displayName)
      db.ref('users/' + uid + '/displayName').set(currentUser.displayName).catch(() => {});
  } catch(e) {
    console.error('Database:', e);
  }
}

async function loadViewerMode(uid) {
  const banner = document.getElementById('viewer-banner');
  const nameEl = document.getElementById('viewer-name');
  banner.classList.remove('hidden');
  document.getElementById('viewer-back-btn').addEventListener('click', () => {
    location.href = location.origin + location.pathname;
  });
  nameEl.textContent = '⏳ Cargando álbum...';
  try {
    const snap = await db.ref('users/' + uid).get();
    if (!snap.exists()) { nameEl.textContent = '❌ Álbum no encontrado'; return; }
    const data = snap.val();
    collected = data.collected || {};
    nameEl.textContent = data.displayName ? `📋 Faltantes de ${data.displayName}` : '📋 Álbum compartido';
    currentFilter = 'incomplete';
    document.querySelectorAll('.filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.filter === 'incomplete')
    );
    render();
    updateStats();
  } catch(e) {
    nameEl.textContent = '❌ No se pudo cargar el álbum';
    console.error(e);
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0d2137;border:1px solid rgba(74,222,128,0.5);color:#4ade80;padding:10px 18px;border-radius:10px;font-size:0.82rem;z-index:9999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── DATA ────────────────────────────────────────────────────────────────────

function mkStickers(teamId) {
  const s = [];
  s.push({ id: teamId + '-1',  num: 1,  label: 'Escudo' });
  for (let i = 1; i <= 11; i++)
    s.push({ id: teamId + '-' + (i + 1), num: i + 1, label: 'Jug.' + i });
  s.push({ id: teamId + '-13', num: 13, label: 'Equipo' });
  for (let i = 12; i <= 18; i++)
    s.push({ id: teamId + '-' + (i + 2), num: i + 2, label: 'Jug.' + i });
  return s;
}

const FWC_LABELS = [
  'Logo','Mascota','Trofeo','Balón','Álbum','CDMX','Guadalajara','Monterrey',
  'Los Ángeles','San Francisco','Dallas','Seattle',
  'New York','Houston','Boston','Miami',
  'Atlanta','Kansas City','Vancouver','Toronto'
];

const SECTIONS = [
  { id:'intro', name:'⭐ Introducción', teams:[
    { id:'fwc', name:'Especiales FWC', flag:'🌍',
      stickers: FWC_LABELS.map((_,i) => ({ id:'FWC'+String(i).padStart(2,'0'), num:String(i).padStart(2,'0'), label:'' })) }
  ]},
  { id:'grupoA', name:'Grupo A', teams:[
    { id:'mex', name:'México',        flag:'🇲🇽', stickers:mkStickers('mex') },
    { id:'rsa', name:'Sudáfrica',     flag:'🇿🇦', stickers:mkStickers('rsa') },
    { id:'kor', name:'Corea del Sur', flag:'🇰🇷', stickers:mkStickers('kor') },
    { id:'cze', name:'Rep. Checa',    flag:'🇨🇿', stickers:mkStickers('cze') },
  ]},
  { id:'grupoB', name:'Grupo B', teams:[
    { id:'can', name:'Canadá',            flag:'🇨🇦', stickers:mkStickers('can') },
    { id:'qat', name:'Catar',             flag:'🇶🇦', stickers:mkStickers('qat') },
    { id:'sui', name:'Suiza',             flag:'🇨🇭', stickers:mkStickers('sui') },
    { id:'bih', name:'Bosnia y Herz.',    flag:'🇧🇦', stickers:mkStickers('bih') },
  ]},
  { id:'grupoC', name:'Grupo C', teams:[
    { id:'bra', name:'Brasil',    flag:'🇧🇷', stickers:mkStickers('bra') },
    { id:'mar', name:'Marruecos', flag:'🇲🇦', stickers:mkStickers('mar') },
    { id:'hai', name:'Haití',     flag:'🇭🇹', stickers:mkStickers('hai') },
    { id:'sco', name:'Escocia',   flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', stickers:mkStickers('sco') },
  ]},
  { id:'grupoD', name:'Grupo D', teams:[
    { id:'usa', name:'Estados Unidos', flag:'🇺🇸', stickers:mkStickers('usa') },
    { id:'par', name:'Paraguay',       flag:'🇵🇾', stickers:mkStickers('par') },
    { id:'aus', name:'Australia',      flag:'🇦🇺', stickers:mkStickers('aus') },
    { id:'tur', name:'Turquía',        flag:'🇹🇷', stickers:mkStickers('tur') },
  ]},
  { id:'grupoE', name:'Grupo E', teams:[
    { id:'ger', name:'Alemania',       flag:'🇩🇪', stickers:mkStickers('ger') },
    { id:'cur', name:'Curazao',        flag:'🇨🇼', stickers:mkStickers('cur') },
    { id:'civ', name:'Costa de Marfil',flag:'🇨🇮', stickers:mkStickers('civ') },
    { id:'ecu', name:'Ecuador',        flag:'🇪🇨', stickers:mkStickers('ecu') },
  ]},
  { id:'grupoF', name:'Grupo F', teams:[
    { id:'ned', name:'Países Bajos', flag:'🇳🇱', stickers:mkStickers('ned') },
    { id:'jpn', name:'Japón',        flag:'🇯🇵', stickers:mkStickers('jpn') },
    { id:'tun', name:'Túnez',        flag:'🇹🇳', stickers:mkStickers('tun') },
    { id:'swe', name:'Suecia',       flag:'🇸🇪', stickers:mkStickers('swe') },
  ]},
  { id:'grupoG', name:'Grupo G', teams:[
    { id:'bel', name:'Bélgica',       flag:'🇧🇪', stickers:mkStickers('bel') },
    { id:'egy', name:'Egipto',        flag:'🇪🇬', stickers:mkStickers('egy') },
    { id:'irn', name:'Irán',          flag:'🇮🇷', stickers:mkStickers('irn') },
    { id:'nzl', name:'Nueva Zelanda', flag:'🇳🇿', stickers:mkStickers('nzl') },
  ]},
  { id:'grupoH', name:'Grupo H', teams:[
    { id:'esp', name:'España',        flag:'🇪🇸', stickers:mkStickers('esp') },
    { id:'cpv', name:'Cabo Verde',    flag:'🇨🇻', stickers:mkStickers('cpv') },
    { id:'ksa', name:'Arabia Saudita',flag:'🇸🇦', stickers:mkStickers('ksa') },
    { id:'uru', name:'Uruguay',       flag:'🇺🇾', stickers:mkStickers('uru') },
  ]},
  { id:'grupoI', name:'Grupo I', teams:[
    { id:'fra', name:'Francia', flag:'🇫🇷', stickers:mkStickers('fra') },
    { id:'irq', name:'Irak',    flag:'🇮🇶', stickers:mkStickers('irq') },
    { id:'sen', name:'Senegal', flag:'🇸🇳', stickers:mkStickers('sen') },
    { id:'nor', name:'Noruega', flag:'🇳🇴', stickers:mkStickers('nor') },
  ]},
  { id:'grupoJ', name:'Grupo J', teams:[
    { id:'arg', name:'Argentina', flag:'🇦🇷', stickers:mkStickers('arg') },
    { id:'alg', name:'Argelia',   flag:'🇩🇿', stickers:mkStickers('alg') },
    { id:'aut', name:'Austria',   flag:'🇦🇹', stickers:mkStickers('aut') },
    { id:'jor', name:'Jordania',  flag:'🇯🇴', stickers:mkStickers('jor') },
  ]},
  { id:'grupoK', name:'Grupo K', teams:[
    { id:'por', name:'Portugal',  flag:'🇵🇹', stickers:mkStickers('por') },
    { id:'cod', name:'RD Congo',  flag:'🇨🇩', stickers:mkStickers('cod') },
    { id:'uzb', name:'Uzbekistán',flag:'🇺🇿', stickers:mkStickers('uzb') },
    { id:'col', name:'Colombia',  flag:'🇨🇴', stickers:mkStickers('col') },
  ]},
  { id:'grupoL', name:'Grupo L', teams:[
    { id:'eng', name:'Inglaterra', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', stickers:mkStickers('eng') },
    { id:'cro', name:'Croacia',    flag:'🇭🇷', stickers:mkStickers('cro') },
    { id:'gha', name:'Ghana',      flag:'🇬🇭', stickers:mkStickers('gha') },
    { id:'pan', name:'Panamá',     flag:'🇵🇦', stickers:mkStickers('pan') },
  ]},
];

const stickerMap = {};
for (const sec of SECTIONS)
  for (const team of sec.teams)
    for (const st of team.stickers)
      stickerMap[st.id] = { sec, team };

const ALL_IDS = Object.keys(stickerMap);

// ─── STATE ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'album-mundial-2026-v3';
let collected = {};
let openTeams = new Set();
let currentFilter = 'all';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) collected = JSON.parse(raw).collected || {};
  } catch(e) { collected = {}; }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ collected })); } catch(e) {}
  if (currentUser) {
    db.ref('users/' + currentUser.uid).set({ collected }).catch(e => console.error('Save:', e));
  }
}

// ─── STATS ───────────────────────────────────────────────────────────────────

function updateStats() {
  const total = ALL_IDS.length;
  const got = ALL_IDS.filter(id => collected[id]).length;
  const miss = total - got;
  document.querySelector('#si-collected .stat-number').textContent = got;
  document.querySelector('#si-missing .stat-number').textContent = miss;
  document.querySelector('#si-total .stat-number').textContent = total;
  document.getElementById('progress-fill').style.width = (total ? (got/total*100).toFixed(1) : 0) + '%';
}

function teamStats(team) {
  const total = team.stickers.length;
  const done = team.stickers.filter(s => collected[s.id]).length;
  return { total, done, pct: total ? Math.round(done/total*100) : 0 };
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function buildTeamCard(sec, team) {
  const { total, done, pct } = teamStats(team);
  const isOpen = openTeams.has(team.id);
  const complete = done === total;
  const completeInFaltan = complete && currentFilter === 'incomplete';

  const card = document.createElement('div');
  card.className = 'team-card' + (isOpen ? ' open' : '') + (completeInFaltan ? ' complete-in-faltan' : '');
  card.dataset.teamId = team.id;
  if (complete) card.dataset.complete = 'true';

  const toggle = document.createElement('div');
  toggle.className = 'team-toggle';
  toggle.innerHTML = `
    <span class="team-flag">${team.flag}</span>
    <div class="team-info">
      <div class="team-name">${team.name}</div>
      <div class="team-progress-text">${done}/${total} figuritas</div>
    </div>
    <div class="team-mini-bar-wrap">
      <div class="team-mini-bar"><div class="team-mini-fill" style="width:${pct}%"></div></div>
      <div class="team-pct">${pct}%</div>
    </div>
    ${completeInFaltan ? '<span class="team-complete-badge">✓ Lista</span>' : ''}
    <span class="team-chevron">▼</span>
  `;
  toggle.addEventListener('click', () => toggleTeam(team.id));
  card.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'stickers-panel';

  const selBtns = document.createElement('div');
  selBtns.className = 'select-btns';
  selBtns.innerHTML = `
    <button class="mini-btn">✓ Marcar todas</button>
    <button class="mini-btn">✗ Desmarcar</button>
  `;
  selBtns.children[0].addEventListener('click', e => { e.stopPropagation(); markAll(team.id, true); });
  selBtns.children[1].addEventListener('click', e => { e.stopPropagation(); markAll(team.id, false); });
  panel.appendChild(selBtns);

  const grid = document.createElement('div');
  grid.className = 'stickers-grid';
  grid.dataset.gridTeam = team.id;
  const stickersToShow = (currentFilter === 'incomplete' && !complete)
    ? team.stickers.filter(st => !collected[st.id])
    : team.stickers;
  for (const st of stickersToShow) {
    const btn = document.createElement('button');
    btn.className = 'sticker-btn ' + (collected[st.id] ? 'collected' : 'missing');
    btn.dataset.stickerId = st.id;
    btn.innerHTML = `<span class="sticker-num">${st.num}</span><span class="sticker-label">${st.label}</span>`;
    btn.addEventListener('click', () => toggleSticker(st.id));
    grid.appendChild(btn);
  }
  panel.appendChild(grid);
  card.appendChild(panel);
  return card;
}

function render() {
  const container = document.getElementById('app-body');
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  container.innerHTML = '';
  let any = false;

  for (const sec of SECTIONS) {
    let teams = sec.teams;
    if (q) teams = teams.filter(t => t.name.toLowerCase().includes(q));
    if (currentFilter === 'incomplete') {
      const inc  = teams.filter(t => teamStats(t).done < teamStats(t).total);
      const comp = teams.filter(t => teamStats(t).done === teamStats(t).total);
      teams = [...inc, ...comp];
    }
    if (currentFilter === 'complete') teams = teams.filter(t => { const {done,total} = teamStats(t); return done === total; });
    if (!teams.length) continue;
    any = true;

    const secEl = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = sec.name;
    secEl.appendChild(title);
    for (const team of teams) secEl.appendChild(buildTeamCard(sec, team));
    container.appendChild(secEl);
  }

  if (!any) container.innerHTML = '<div class="empty-msg">No se encontraron equipos.</div>';
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

function toggleTeam(teamId) {
  openTeams.has(teamId) ? openTeams.delete(teamId) : openTeams.add(teamId);
  const card = document.querySelector(`[data-team-id="${teamId}"]`);
  if (card) card.classList.toggle('open', openTeams.has(teamId));
}

function patchTeamCard(teamId) {
  const card = document.querySelector(`[data-team-id="${teamId}"]`);
  if (!card) return;
  const info = stickerMap[Object.keys(stickerMap).find(id => stickerMap[id].team.id === teamId)];
  if (!info) return;
  const { total, done, pct } = teamStats(info.team);
  card.querySelector('.team-progress-text').textContent = `${done}/${total} figuritas`;
  card.querySelector('.team-mini-fill').style.width = pct + '%';
  card.querySelector('.team-pct').textContent = pct + '%';
  if (done === total) card.dataset.complete = 'true';
  else delete card.dataset.complete;
}

function toggleSticker(id) {
  if (viewerUid) return;
  collected[id] = !collected[id];
  saveState();
  updateStats();
  if (currentFilter === 'incomplete') {
    render();
    return;
  }
  const btn = document.querySelector(`[data-sticker-id="${id}"]`);
  if (btn) btn.className = 'sticker-btn ' + (collected[id] ? 'collected' : 'missing');
  patchTeamCard(stickerMap[id].team.id);
}

function markAll(teamId, state) {
  if (viewerUid) return;
  const info = Object.values(stickerMap).find(v => v.team.id === teamId);
  if (!info) return;
  for (const st of info.team.stickers) collected[st.id] = state;
  saveState();
  const grid = document.querySelector(`[data-grid-team="${teamId}"]`);
  if (grid) grid.querySelectorAll('.sticker-btn').forEach(btn => {
    btn.className = 'sticker-btn ' + (collected[btn.dataset.stickerId] ? 'collected' : 'missing');
  });
  patchTeamCard(teamId);
  updateStats();
  if (currentFilter !== 'all') render();
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function updateSidebarAuth(user) {
  const el = document.getElementById('sidebar-auth');
  if (!el) return;
  el.innerHTML = '';
  if (!user) {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.innerHTML = '<span class="sidebar-icon">☁️</span> Sincronizar álbum';
    btn.addEventListener('click', () => {
      closeSidebar();
      document.getElementById('auth-overlay').classList.remove('hidden');
    });
    el.appendChild(btn);
  } else {
    const row = document.createElement('div');
    row.className = 'sidebar-user-row';
    if (user.photoURL) {
      const img = document.createElement('img');
      img.className = 'sidebar-user-photo'; img.src = user.photoURL; img.alt = '';
      row.appendChild(img);
    }
    const info = document.createElement('div');
    info.style.minWidth = '0';
    info.innerHTML = `<div class="sidebar-user-name">${(user.displayName || 'Usuario').split(' ')[0]}</div>
                      <div class="sidebar-sync">✓ Sincronizado</div>`;
    row.appendChild(info);
    el.appendChild(row);
    const shareBtn = document.createElement('button');
    shareBtn.className = 'sidebar-item';
    shareBtn.innerHTML = '<span class="sidebar-icon">🔗</span> Compartir mi álbum';
    shareBtn.addEventListener('click', () => {
      const url = location.origin + location.pathname + '?uid=' + user.uid;
      navigator.clipboard.writeText(url).then(() => { closeSidebar(); showToast('✅ Link copiado. Mandáselo a tu amigo.'); });
    });
    el.appendChild(shareBtn);
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'sidebar-item danger';
    logoutBtn.innerHTML = '<span class="sidebar-icon">🚪</span> Cerrar sesión';
    logoutBtn.addEventListener('click', () => { closeSidebar(); signOut(); });
    el.appendChild(logoutBtn);
  }
}

document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

document.querySelectorAll('[data-sidebar-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    setFilter(btn.dataset.sidebarFilter);
    closeSidebar();
  });
});

document.getElementById('sidebar-import').addEventListener('click', () => {
  closeSidebar();
  document.getElementById('import-overlay').classList.remove('hidden');
});
document.getElementById('sidebar-copy').addEventListener('click', () => {
  closeSidebar();
  document.getElementById('copy-btn').click();
});
document.getElementById('sidebar-reset').addEventListener('click', () => {
  closeSidebar();
  document.getElementById('reset-btn').click();
});

// ─── FILTROS ─────────────────────────────────────────────────────────────────

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === f)
  );
  document.querySelectorAll('[data-sidebar-filter]').forEach(b =>
    b.classList.toggle('active', b.dataset.sidebarFilter === f)
  );
  render();
}

document.getElementById('search-input').addEventListener('input', render);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

document.getElementById('copy-btn').addEventListener('click', () => {
  const lines = [];
  const total = ALL_IDS.filter(id => !collected[id]).length;
  lines.push(`🏆 Me faltan ${total} figuritas - Álbum Mundial 2026`);
  lines.push('');
  for (const sec of SECTIONS) {
    for (const team of sec.teams) {
      const missing = team.stickers.filter(st => !collected[st.id]);
      if (!missing.length) continue;
      const nums = missing.map(st => st.num).join(' · ');
      lines.push(`${team.flag} *${team.name}:* ${nums}`);
    }
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ ¡Copiado!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = '📋 Copiar lista de faltantes para WhatsApp';
      btn.classList.remove('copied');
    }, 2500);
  }).catch(() => alert('No se pudo copiar. Intentá de nuevo.'));
});

function normName(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseAndImport(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const teamByName = {};
  for (const sec of SECTIONS)
    for (const team of sec.teams)
      teamByName[normName(team.name)] = team;

  const missingByTeam = {};
  for (const line of lines) {
    const lineNorm = normName(line);
    let matched = null;
    for (const [name, team] of Object.entries(teamByName)) {
      if (lineNorm.includes(name)) { matched = team; break; }
    }
    if (!matched) continue;
    const nums = line.match(/\d+/g) || [];
    missingByTeam[matched.id] = new Set(nums.map(String));
  }

  if (!Object.keys(missingByTeam).length) return 0;

  for (const sec of SECTIONS) {
    for (const team of sec.teams) {
      if (team.id in missingByTeam) {
        const missingNums = missingByTeam[team.id];
        for (const st of team.stickers)
          collected[st.id] = !missingNums.has(String(st.num));
      } else {
        for (const st of team.stickers)
          collected[st.id] = true;
      }
    }
  }

  saveState();
  render();
  updateStats();
  return Object.values(collected).filter(Boolean).length;
}

// ── Import modal ──────────────────────────────────────────────────────────────
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-overlay').classList.remove('hidden');
});
['import-close', 'import-cancel'].forEach(id =>
  document.getElementById(id).addEventListener('click', () =>
    document.getElementById('import-overlay').classList.add('hidden'))
);
document.getElementById('import-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('import-overlay'))
    document.getElementById('import-overlay').classList.add('hidden');
});
document.getElementById('import-confirm').addEventListener('click', () => {
  if (viewerUid) return;
  const text = document.getElementById('import-textarea').value.trim();
  if (!text) { showToast('Pegá una lista primero'); return; }
  const got = parseAndImport(text);
  if (!got) { showToast('No se reconoció ningún equipo. Verificá el formato.'); return; }
  document.getElementById('import-overlay').classList.add('hidden');
  document.getElementById('import-textarea').value = '';
  showToast(`✅ ¡Listo! Tenés ${got} figuritas marcadas.`);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('¿Segura que querés reiniciar todo el álbum?\nSe van a borrar todas las figuritas marcadas.')) {
    collected = {};
    saveState();
    render();
    updateStats();
  }
});

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────

function updateCountdown() {
  const start = new Date('2026-06-11T00:00:00');
  const now = new Date();
  const diff = start - now;
  const el = document.getElementById('countdown');
  if (diff <= 0) {
    el.textContent = '¡El Mundial ya comenzó! ⚽';
  } else {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    el.textContent = `⏳ Faltan ${days} días, ${hours}h ${mins}m para el Mundial`;
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').catch(() => {});

loadState();
updateAuthUI(null);
render();
updateStats();
updateCountdown();
setInterval(updateCountdown, 60000);

const urlUid = new URLSearchParams(location.search).get('uid');
if (urlUid) {
  viewerUid = urlUid;
  loadViewerMode(urlUid);
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  updateAuthUI(user);
  if (viewerUid) return;
  if (user) {
    await loadFromFirestore(user.uid);
    render();
    updateStats();
  }
});
