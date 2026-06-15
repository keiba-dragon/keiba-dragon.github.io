const LS_KEY   = 'travel_map_v1';
const MIN_DATE = '2020-04-12';

let data        = {};   // { prefId: [{id, date, memo, photos}] }
let activeId    = null; // selected prefecture
let panelMode   = 'list';  // 'list' | 'form'
let editVisitId = null;    // null = new visit, string = editing existing

/* ── ID generator ── */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* ── Storage ── */
function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    data = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) {
        data[k] = v;
      } else if (v && v.visited) {
        // migrate old single-visit format
        data[k] = [{ id: genId(), date: v.date || '', memo: v.memo || '', photos: v.photos || [] }];
      }
    }
  } catch { data = {}; }
}

function saveData() {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ── Google Drive URL → viewable image URL ── */
function toImageUrl(url) {
  url = url.trim();
  const m1 = url.match(/\/d\/([\w-]+)/);
  if (m1) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
  const m2 = url.match(/[?&]id=([\w-]+)/);
  if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
  return url;
}

/* ── Map ── */
function buildMap() {
  const grid = document.getElementById('map-grid');
  grid.innerHTML = '';
  PREFS.forEach(p => {
    const visits = data[p.id] || [];
    const el = document.createElement('div');
    el.className = 'cell'
      + (visits.length > 0 ? ' visited' : '')
      + (activeId === p.id ? ' active' : '');
    el.dataset.id     = p.id;
    el.dataset.region = p.region;
    el.style.gridColumn = String(p.col + 1);
    el.style.gridRow    = String(p.row + 1);

    const nameEl = document.createElement('span');
    nameEl.textContent = p.name;
    el.appendChild(nameEl);

    if (visits.length > 1) {
      const badge = document.createElement('span');
      badge.className   = 'cell-badge';
      badge.textContent = visits.length + '回';
      el.appendChild(badge);
    }

    const lastDate = visits.length > 0 ? visits[visits.length - 1].date : '';
    el.title = p.name + (lastDate ? ` — 最終: ${lastDate}` : '');
    el.addEventListener('click', () => openPanel(p.id));
    grid.appendChild(el);
  });
  updateStats();
}

function updateStats() {
  const prefCount  = Object.values(data).filter(v => v.length > 0).length;
  const visitCount = Object.values(data).reduce((s, v) => s + v.length, 0);
  document.getElementById('visited-count').textContent = prefCount;
  document.getElementById('total-visits').textContent  = visitCount;
  document.getElementById('progress-fill').style.width = (prefCount / 47 * 100) + '%';
}

/* ── Panel open/close ── */
function openPanel(id) {
  activeId    = id;
  panelMode   = 'list';
  editVisitId = null;
  document.getElementById('panel').classList.remove('hidden');
  const p = PREFS.find(x => x.id === id);
  document.getElementById('panel-name').textContent   = p.name;
  document.getElementById('panel-region').textContent = p.region + '地方';
  renderPanel();
  buildMap();
}

function closePanel() {
  activeId = null;
  document.getElementById('panel').classList.add('hidden');
  buildMap();
}

/* ── Panel render dispatcher ── */
function renderPanel() {
  if (panelMode === 'list') renderVisitList();
  else                       renderVisitForm();
}

/* ── Visit list ── */
function renderVisitList() {
  const visits = data[activeId] || [];
  const body   = document.getElementById('panel-body');
  const footer = document.getElementById('panel-footer');
  footer.innerHTML = '';

  if (visits.length === 0) {
    body.innerHTML = `
      <div class="panel-empty">
        <div class="panel-empty-icon">📍</div>
        <div>まだ訪問記録がありません</div>
      </div>
      <button class="btn-add-visit" onclick="startNewVisit()">＋ 訪問を追加</button>
    `;
    return;
  }

  const sorted = [...visits].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = sorted.map(v => `
    <div class="visit-card">
      <div class="visit-card-head">
        <span class="visit-date">${formatDate(v.date)}</span>
        <div class="visit-card-actions">
          <button class="btn-sm" onclick="startEditVisit('${v.id}')">編集</button>
          <button class="btn-sm danger" onclick="deleteVisit('${v.id}')">🗑</button>
        </div>
      </div>
      ${v.memo ? `<div class="visit-memo">${escHtml(v.memo)}</div>` : ''}
      ${v.photos && v.photos.length > 0
        ? `<div class="visit-photo-count">📷 ${v.photos.length}枚</div>`
        : ''}
    </div>
  `).join('') + `<button class="btn-add-visit" onclick="startNewVisit()">＋ 訪問を追加</button>`;
}

/* ── Visit form ── */
function startNewVisit() {
  panelMode   = 'form';
  editVisitId = null;
  renderVisitForm();
}

function startEditVisit(visitId) {
  panelMode   = 'form';
  editVisitId = visitId;
  renderVisitForm();
}

function renderVisitForm() {
  const visit  = editVisitId ? (data[activeId] || []).find(v => v.id === editVisitId) : null;
  const photos = visit?.photos || [];
  const body   = document.getElementById('panel-body');
  const footer = document.getElementById('panel-footer');

  body.innerHTML = `
    <button class="form-back" onclick="backToList()">← 訪問リストに戻る</button>
    <div class="form-group">
      <label>訪問日（2020/04/12 以降）</label>
      <input type="date" id="f-date" value="${visit?.date || ''}" min="${MIN_DATE}">
    </div>
    <div class="form-group">
      <label>メモ</label>
      <textarea id="f-memo" placeholder="感想・行った場所など">${visit?.memo || ''}</textarea>
    </div>
    <div class="form-group">
      <label>写真（Google Drive 共有リンク）</label>
      <div class="photos-list" id="photos-list">
        ${photos.map((url, i) => photoRowHTML(url, i)).join('')}
      </div>
      <div class="add-photo-row">
        <button class="btn-icon add" onclick="addPhotoRow()" title="写真を追加">＋</button>
      </div>
      <div class="photo-preview" id="photo-preview">
        ${photos.map(url => thumbHTML(url)).join('')}
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn btn-cancel" onclick="backToList()">キャンセル</button>
    <button class="btn btn-save" id="btn-save">保存する</button>
  `;
  document.getElementById('btn-save').addEventListener('click', saveVisit);
}

function backToList() {
  panelMode   = 'list';
  editVisitId = null;
  renderPanel();
}

/* ── Save / Delete ── */
function saveVisit() {
  const date = document.getElementById('f-date').value;
  if (date && date < MIN_DATE) {
    alert(`訪問日は ${MIN_DATE} 以降で入力してください。`);
    return;
  }

  const visit = {
    id:     editVisitId || genId(),
    date,
    memo:   document.getElementById('f-memo').value,
    photos: getPhotoUrls(),
  };

  if (!data[activeId]) data[activeId] = [];

  if (editVisitId) {
    const idx = data[activeId].findIndex(v => v.id === editVisitId);
    if (idx !== -1) data[activeId][idx] = visit;
  } else {
    data[activeId].push(visit);
  }

  saveData();
  buildMap();
  panelMode   = 'list';
  editVisitId = null;
  renderPanel();
  flashSave();
}

function deleteVisit(visitId) {
  if (!confirm('この訪問記録を削除しますか？')) return;
  data[activeId] = (data[activeId] || []).filter(v => v.id !== visitId);
  if (data[activeId].length === 0) delete data[activeId];
  saveData();
  buildMap();
  renderPanel();
}

function flashSave() {
  const btn = document.getElementById('btn-save');
  if (!btn) return;
  btn.textContent      = '保存しました ✓';
  btn.style.background = '#16a34a';
  setTimeout(() => { btn.textContent = '保存する'; btn.style.background = ''; }, 1800);
}

/* ── Photo helpers ── */
function photoRowHTML(url, i) {
  return `<div class="photo-row" id="pr-${i}">
    <input type="text" placeholder="https://drive.google.com/file/d/..." value="${escAttr(url)}" oninput="refreshPreview()">
    <button class="btn-icon" onclick="removePhotoRow(${i})" title="削除">✕</button>
  </div>`;
}

function thumbHTML(url) {
  const src = toImageUrl(url);
  return `<img class="photo-thumb" src="${escAttr(src)}" onerror="this.style.display='none'" onclick="openPhotoModal('${escAttr(src)}')">`;
}

function addPhotoRow() {
  const list = document.getElementById('photos-list');
  const i    = list.children.length;
  const div  = document.createElement('div');
  div.innerHTML = photoRowHTML('', i);
  list.appendChild(div.firstElementChild);
}

function removePhotoRow(i) {
  document.getElementById('pr-' + i)?.remove();
  refreshPreview();
}

function refreshPreview() {
  const preview = document.getElementById('photo-preview');
  if (preview) preview.innerHTML = getPhotoUrls().map(u => thumbHTML(u)).join('');
}

function getPhotoUrls() {
  const list = document.getElementById('photos-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('input'))
    .map(i => i.value.trim()).filter(Boolean);
}

/* ── Export / Import ── */
document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `travel_map_${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (typeof imported !== 'object') throw new Error();
      // merge: imported visits are added on top of existing ones (dedup by id)
      for (const [k, visits] of Object.entries(imported)) {
        if (!Array.isArray(visits)) continue;
        if (!data[k]) data[k] = [];
        const existingIds = new Set(data[k].map(v => v.id));
        visits.forEach(v => { if (!existingIds.has(v.id)) data[k].push(v); });
        if (data[k].length === 0) delete data[k];
      }
      saveData();
      buildMap();
      if (activeId) renderPanel();
      alert('インポート完了しました。');
    } catch {
      alert('ファイルの読み込みに失敗しました。JSONフォーマットを確認してください。');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ── Photo modal ── */
function openPhotoModal(url) {
  document.getElementById('modal-img').src = url;
  document.getElementById('photo-modal').classList.add('open');
}
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('photo-modal').classList.remove('open');
});
document.getElementById('photo-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

/* ── Panel close ── */
document.getElementById('panel-close').addEventListener('click', closePanel);

/* ── Utilities ── */
function formatDate(str) {
  if (!str) return '日付未設定';
  const [y, m, d] = str.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Init ── */
loadData();
buildMap();
