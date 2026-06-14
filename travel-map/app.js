const LS_KEY  = 'travel_map_v1';
const MIN_DATE = '2020-04-12';

let data     = {};
let activeId = null;

/* ── Storage ── */
function loadData() {
  try { data = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { data = {}; }
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
    const el = document.createElement('div');
    el.className = 'cell' + (data[p.id] ? ' visited' : '') + (activeId === p.id ? ' active' : '');
    el.dataset.id     = p.id;
    el.dataset.region = p.region;
    el.style.gridColumn = String(p.col + 1);
    el.style.gridRow    = String(p.row + 1);
    el.textContent      = p.name;
    el.title = p.name + (data[p.id]?.date ? ` — ${data[p.id].date}` : '');
    el.addEventListener('click', () => openPanel(p.id));
    grid.appendChild(el);
  });
  updateStats();
}

function updateStats() {
  const count = Object.values(data).filter(Boolean).length;
  document.getElementById('visited-count').textContent  = count;
  document.getElementById('progress-fill').style.width  = (count / 47 * 100) + '%';
}

/* ── Panel ── */
function openPanel(id) {
  activeId = id;
  const p = PREFS.find(x => x.id === id);
  document.getElementById('panel').classList.remove('hidden');
  document.getElementById('panel-name').textContent   = p.name;
  document.getElementById('panel-region').textContent = p.region + '地方';
  renderForm(id);
  buildMap();
}

function closePanel() {
  activeId = null;
  document.getElementById('panel').classList.add('hidden');
  buildMap();
}

function renderForm(id) {
  const d      = data[id] || {};
  const photos = d.photos || [];
  const footer = document.getElementById('panel-footer');
  footer.style.display = 'flex';

  document.getElementById('panel-body').innerHTML = `
    <div class="form-group">
      <label>訪問日（2020/04/12 以降）</label>
      <input type="date" id="f-date" value="${d.date || ''}" min="${MIN_DATE}">
    </div>
    <div class="form-group">
      <label>メモ</label>
      <textarea id="f-memo" placeholder="感想・行った場所など">${d.memo || ''}</textarea>
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

  document.getElementById('btn-delete').style.display = data[id] ? 'block' : 'none';
}

function photoRowHTML(url, i) {
  return `<div class="photo-row" id="pr-${i}">
    <input type="text" placeholder="https://drive.google.com/file/d/..." value="${url}" oninput="refreshPreview()">
    <button class="btn-icon" onclick="removePhotoRow(${i})" title="削除">✕</button>
  </div>`;
}

function thumbHTML(url) {
  const src = toImageUrl(url);
  return `<img class="photo-thumb" src="${src}" onerror="this.style.display='none'" onclick="openPhotoModal('${src}')">`;
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
  const urls    = getPhotoUrls();
  const preview = document.getElementById('photo-preview');
  if (preview) preview.innerHTML = urls.map(u => thumbHTML(u)).join('');
}

function getPhotoUrls() {
  const list = document.getElementById('photos-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('input'))
    .map(i => i.value.trim())
    .filter(Boolean);
}

/* ── Save / Delete ── */
document.getElementById('btn-save').addEventListener('click', () => {
  if (!activeId) return;

  const date = document.getElementById('f-date').value;
  if (date && date < MIN_DATE) {
    alert(`訪問日は ${MIN_DATE} 以降で入力してください。`);
    return;
  }

  data[activeId] = {
    visited: true,
    date,
    memo:   document.getElementById('f-memo').value,
    photos: getPhotoUrls(),
  };
  saveData();
  buildMap();
  renderForm(activeId);
  flashSave();
});

document.getElementById('btn-delete').addEventListener('click', () => {
  if (!activeId) return;
  const name = PREFS.find(p => p.id === activeId).name;
  if (!confirm(`${name} の記録を削除しますか？`)) return;
  delete data[activeId];
  saveData();
  buildMap();
  renderForm(activeId);
});

function flashSave() {
  const btn = document.getElementById('btn-save');
  btn.textContent       = '保存しました ✓';
  btn.style.background  = '#16a34a';
  setTimeout(() => { btn.textContent = '保存する'; btn.style.background = ''; }, 1800);
}

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

/* ── Close panel ── */
document.getElementById('panel-close').addEventListener('click', closePanel);

/* ── Init ── */
loadData();
buildMap();
