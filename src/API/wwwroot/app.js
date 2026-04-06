/**
 * Retro Tracker — Frontend SPA
 * Vanilla JS, sin dependencias externas (excepto Chart.js)
 */

const API = '/api';
let chartMonthly = null;
let chartPlatform = null;
let currentItemId = null;
let currentSellCost = 0;
let lotItemCount = 0;
let recentItems = [];
let _currency = 'EUR';
let _texts = {};

// ── Paginación inventario ──
let _invItems = [];
let _invPage  = 1;
const _pageSizeKey = 'retro_inv_page_size';
let _invPageSize = parseInt(localStorage.getItem(_pageSizeKey)) || 10;

// ── Paginación lotes ──
let _lotItems = [];
let _lotPage  = 1;
const _lotPageSizeKey = 'retro_lot_page_size';
let _lotPageSize = parseInt(localStorage.getItem(_lotPageSizeKey)) || 10;

function t(key, ...args) {
  const template = _texts[key] ?? key;
  return template.replace(/\{(\d+)\}/g, (_, index) => `${args[Number(index)] ?? ''}`);
}

function applyStaticTexts() {
  document.title = t('meta.pageTitle');

  document.querySelectorAll('[data-text]').forEach(el => {
    el.textContent = t(el.dataset.text);
  });

  document.querySelectorAll('[data-text-html]').forEach(el => {
    el.innerHTML = t(el.dataset.textHtml);
  });

  document.querySelectorAll('[data-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.placeholder);
  });

  document.querySelectorAll('[data-title]').forEach(el => {
    el.title = t(el.dataset.title);
  });
}

async function loadTexts() {
  try {
    _texts = await fetch(`${API}/resources`).then(r => r.json());
  } catch {
    _texts = {};
  }
}

// ═══════════════════════════════════════════
// SISTEMA DE ETIQUETAS
// ═══════════════════════════════════════════

// Cache de todos los tags existentes (id, name, itemCount)
let _allTags = [];

async function loadTagsCache() {
  try { _allTags = await App.get('/tags'); } catch {}
}

// Devuelve un color CSS consistente basado en el nombre del tag
function tagColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return `tag-c${h % 6}`;
}

// Renderiza una pill con botón de quitar (para pill-inputs)
function tagPillRemovable(name) {
  return `<span class="tag ${tagColor(name)}" data-tag="${escapeHtml(name)}">${escapeHtml(name)}<em class="tag-remove" onclick="App.tags.removePill(this)">✕</em></span>`;
}

// Renderiza una pill de solo lectura (para tabla)
function tagPillReadonly(name) {
  return `<span class="tag ${tagColor(name)}">${escapeHtml(name)}</span>`;
}

// ═══════════════════════════════════════════
// PLATAFORMAS
// ═══════════════════════════════════════════

const DEFAULT_PLATFORMS = [
  'DS','3DS','Switch','GBA','GBC','GB',
  'PSP','PS1','PS2','PS3','PS4','PS5','PSV',
  'Xbox','X360','XOne',
  'Wii','WiiU','NES','SNES','N64','GCN',
  'Genesis','Saturn','DC','GG',
  'PC','Otro'
];

function getPlatforms() {
  const stored = localStorage.getItem('rtPlatforms');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch(e) {}
  }
  return DEFAULT_PLATFORMS;
}

function populatePlatformSelects() {
  const platforms = getPlatforms();
  const options = platforms.map(p => `<option value="${p}">${p}</option>`).join('');

  // Filtro de inventario: incluye opción vacía "Todas"
  const filterSel = document.getElementById('filter-platform');
  if (filterSel) {
    const current = filterSel.value;
    filterSel.innerHTML = `<option value="">${t('inventory.allPlatforms')}</option>` + options;
    if (current) filterSel.value = current;
  }

  // Registro rápido
  const qaSel = document.getElementById('qa-platform');
  if (qaSel) {
    const current = qaSel.value;
    qaSel.innerHTML = options;
    qaSel.value = (current && platforms.includes(current)) ? current : platforms[0] || '';
  }

  // Modal artículo
  const itemSel = document.getElementById('item-platform');
  if (itemSel) {
    const current = itemSel.value;
    itemSel.innerHTML = options;
    itemSel.value = (current && platforms.includes(current)) ? current : platforms[0] || '';
  }

  // Filas dinámicas de lote
  document.querySelectorAll('[data-field="platform"]').forEach(el => {
    if (el.tagName === 'SELECT') {
      const current = el.value;
      el.innerHTML = options;
      el.value = (current && platforms.includes(current)) ? current : platforms[0] || '';
    }
  });
}

// ═══════════════════════════════════════════
// COLUMNAS VISIBLES EN INVENTARIO
// ═══════════════════════════════════════════

const ALL_COLS = ['tipo','plataforma','estado','lote','coste','venta','beneficio','fecha','etiquetas'];
const LS_COLS_KEY = 'rtVisibleCols';

function getVisibleCols() {
  try {
    const stored = localStorage.getItem(LS_COLS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...ALL_COLS]; // todas visibles por defecto
}

function saveVisibleCols(cols) {
  localStorage.setItem(LS_COLS_KEY, JSON.stringify(cols));
}

function applyVisibleCols() {
  const visible = getVisibleCols();
  ALL_COLS.forEach(col => {
    const hidden = !visible.includes(col);
    document.querySelectorAll(`.inv-col-${col}`)
      .forEach(el => el.classList.toggle('inv-col-hidden', hidden));
  });
}

function loadColToggles() {
  const visible = getVisibleCols();
  document.querySelectorAll('[data-col]').forEach(cb => {
    cb.checked = visible.includes(cb.dataset.col);
  });
}



document.addEventListener('DOMContentLoaded', async () => {
  await loadTexts();
  applyStaticTexts();

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      App.showView(link.dataset.view);
    });
  });

  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => el.value = today);

  document.getElementById('sell-price').addEventListener('input', App.updateSellPreview);

  // Cargar moneda antes del primer render para que fmt() la use desde el inicio
  try {
    const s = await App.get('/settings');
    _currency = s.currency || 'EUR';
  } catch { /* usar EUR por defecto */ }

  populatePlatformSelects();
  applyVisibleCols();
  await loadTagsCache();
  App.showView('dashboard');

  // Chart.js con responsive:true y maintainAspectRatio:false gestiona el resize de forma nativa.

  // Refrescar datos al volver a la pestaña (el flag _dashboardLoading evita concurrencia)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const dashActive = document.getElementById('view-dashboard')?.classList.contains('active');
      if (dashActive) App.loadDashboard();
    }
  });
});

// ═══════════════════════════════════════════
// VALIDACIÓN — utilidades
// ═══════════════════════════════════════════

const V = {
  /** Marca un campo como erróneo y muestra mensaje inline */
  error(fieldEl, msg) {
    fieldEl.classList.add('field-error');
    let hint = fieldEl.parentElement.querySelector('.field-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'field-hint error';
      fieldEl.parentElement.appendChild(hint);
    }
    hint.textContent = msg;
    hint.className = 'field-hint error';
  },

  /** Limpia el estado de error de un campo */
  clear(fieldEl) {
    fieldEl.classList.remove('field-error');
    const hint = fieldEl.parentElement?.querySelector('.field-hint');
    if (hint) hint.remove();
  },

  /** Limpia todos los errores dentro de un contenedor */
  clearAll(containerEl) {
    containerEl.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
    containerEl.querySelectorAll('.field-hint').forEach(el => el.remove());
  },

  /** Texto no vacío */
  requireText(fieldEl, label = 'Este campo') {
    if (!fieldEl.value.trim()) { V.error(fieldEl, t('validation.required', label)); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Número estrictamente > 0 */
  requirePositive(fieldEl, label = 'El valor') {
    const val = parseFloat(fieldEl.value);
    if (isNaN(val) || val <= 0) { V.error(fieldEl, t('validation.positive', label)); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Número >= 0 */
  requireNonNegative(fieldEl, label = 'El valor') {
    const val = parseFloat(fieldEl.value);
    if (isNaN(val) || val < 0) { V.error(fieldEl, t('validation.nonNegative', label)); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Fecha válida y no futura */
  requireDate(fieldEl, label = 'La fecha') {
    const val = fieldEl.value;
    if (!val) { V.error(fieldEl, t('validation.dateRequired', label)); return false; }
    const d = new Date(val);
    if (isNaN(d.getTime())) { V.error(fieldEl, t('validation.dateInvalid', label)); return false; }
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d > tomorrow) { V.error(fieldEl, t('validation.dateFuture', label)); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Registra listener para limpiar error al modificar el campo */
  watch(fieldEl) {
    if (!fieldEl || fieldEl._vWatched) return;
    fieldEl._vWatched = true;
    fieldEl.addEventListener('input',  () => V.clear(fieldEl));
    fieldEl.addEventListener('change', () => V.clear(fieldEl));
  }
};

// ═══════════════════════════════════════════
// NAMESPACE PRINCIPAL
// ═══════════════════════════════════════════

const App = {

  // ── Navegación ──────────────────────────

  showView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');

    if (view === 'dashboard') App.loadDashboard();
    if (view === 'inventory') { loadTagsCache().then(() => { App.populateTagFilter(); App.loadInventory(); }); }
    if (view === 'lots')      App.loadLots();
    if (view === 'settings')  { App.loadSettings(); loadColToggles(); }
    if (view === 'quick-add') { V.clearAll(document.getElementById('view-quick-add')); App.loadRecentItems(); }
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  // ── Dashboard ───────────────────────────

  async loadDashboard() {
    // Evitar llamadas concurrentes
    if (App._dashboardLoading) return;
    App._dashboardLoading = true;

    try {
      const data = await App.fetchWithRetry('/dashboard', 2);
      App._lastDashboardData = data;
      App._renderDashboardData(data);
    } catch (e) {
      console.error('[Dashboard]', e);
      // Si falla y hay datos cacheados, mostrarlos
      if (App._lastDashboardData) {
        App._renderDashboardData(App._lastDashboardData);
      }
    } finally {
      App._dashboardLoading = false;
    }
  },

  async fetchWithRetry(path, retries = 2, delayMs = 800) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await App.get(path);
      } catch (e) {
        console.warn(`[fetchWithRetry] Intento ${i + 1}/${retries + 1} fallido para ${path}:`, e);
        if (i === retries) throw e;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  },

  _renderDashboardData(data) {
      document.getElementById('stat-invested').textContent    = fmt(data.totalInvested);
      document.getElementById('stat-revenue').textContent     = fmt(data.totalRevenue);
      document.getElementById('stat-profit').textContent      = fmt(data.totalProfit);
      document.getElementById('stat-balance').textContent     = fmt(data.currentBalance);
      document.getElementById('stat-stock-value').textContent = fmt(data.stockValue);
      document.getElementById('stat-stock-count').textContent = t('common.articleCount', data.stockItems, data.stockItems !== 1 ? 's' : '');
      document.getElementById('stat-collection-value').textContent = fmt(data.collectionValue);
      document.getElementById('stat-collection-count').textContent = t('common.articleCount', data.collectionItems, data.collectionItems !== 1 ? 's' : '');

      document.querySelector('.stat-card.profit .stat-value').style.color =
        data.totalProfit >= 0 ? 'var(--green)' : 'var(--red)';
      document.querySelector('.stat-card.balance .stat-value').style.color =
        data.currentBalance >= 0 ? 'var(--accent)' : 'var(--red)';

      App.renderMonthlyChart(data.monthlyStats);
      App.renderPlatformChart(data.platformStats);
      App.renderPendingTable(data.pendingItems);
      document.getElementById('pending-count').textContent = data.stockItems;
  },

  renderMonthlyChart(stats) {
    const canvas = document.getElementById('chartMonthly');
    // Destruir cualquier instancia previa (incluso si la variable se perdió)
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    chartMonthly = null;

    const isMobile = window.innerWidth < 768;

    chartMonthly = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: stats.map(s => isMobile
          ? s.monthName.slice(0, 3)
          : `${s.monthName.slice(0, 3)} ${s.year}`
        ),
        datasets: [
          { label: 'Invertido',  data: stats.map(s => s.invested), backgroundColor: 'rgba(255,107,53,0.7)' },
          { label: 'Recuperado', data: stats.map(s => s.revenue),  backgroundColor: 'rgba(0,255,136,0.7)'  }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: isMobile ? 'bottom' : 'top',
            labels: {
              color: '#888',
              font: { size: isMobile ? 10 : 11 },
              boxWidth: isMobile ? 10 : 14,
              padding: isMobile ? 8 : 10
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#555',
              font: { size: isMobile ? 9 : 11 },
              maxRotation: isMobile ? 45 : 0,
              minRotation: isMobile ? 45 : 0,
              maxTicksLimit: isMobile ? 6 : 12
            },
            grid: { color: '#222' }
          },
          y: {
            ticks: {
              color: '#555',
              font: { size: isMobile ? 9 : 11 },
              callback: v => `${v}€`,
              maxTicksLimit: isMobile ? 4 : 6
            },
            grid: { color: '#222' }
          }
        }
      }
    });
  },

  renderPlatformChart(stats) {
    if (!stats.length) return;

    const isMobile = window.innerWidth < 768;
    const platformColors = {
      'GB':'#5a8a00','GBC':'#7ab800','GBA':'#9fd600','DS':'#c8f000','3DS':'#f0e000',
      'NES':'#e84000','SNES':'#cc2200','N64':'#a80000','GCN':'#6a0dad',
      'Wii':'#009ac7','WiiU':'#005f7a','Switch':'#e4000f',
      'PS1':'#003087','PS2':'#0050b3','PS3':'#0077cc','PS4':'#0099ee','PS5':'#00bbff',
      'PSP':'#00aaff','PSV':'#4400cc',
      'Xbox':'#107c10','X360':'#52b043','XOne':'#2d7a2d',
      'Genesis':'#1a1aff','Saturn':'#5555ff','DC':'#ff8800','GG':'#ff5500',
      'PC':'#888888','Otro':'#444444',
    };
    const fallback = ['#ff00aa','#00ffcc','#ff99ff','#ffcc00','#cc00ff','#00ff66'];
    let fi = 0;
    const colors = stats.map(s => platformColors[s.platform] || fallback[fi++ % fallback.length]);

    const canvas = document.getElementById('chartPlatform');
    const listEl  = document.getElementById('platformList');
    // Destruir cualquier instancia previa de forma segura
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    chartPlatform = null;

    if (isMobile) {
      canvas.style.display = 'none';
      listEl.style.display = 'block';

      const total = stats.reduce((sum, s) => sum + s.totalItems, 0);
      // Mostrar top 8 para no saturar
      listEl.innerHTML = stats.slice(0, 8).map((s, i) => {
        const pct = total > 0 ? Math.round(s.totalItems / total * 100) : 0;
        const color = colors[i];
        return `<div class="platform-row">
          <div class="platform-row-top">
            <span class="platform-name">${s.platform}</span>
            <span class="platform-count">${s.totalItems} art. · ${pct}%</span>
          </div>
          <div class="platform-bar-bg">
            <div class="platform-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
      }).join('');
    } else {
      canvas.style.display = 'block';
      listEl.style.display = 'none';

      chartPlatform = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: stats.map(s => s.platform),
          datasets: [{ data: stats.map(s => s.totalItems), backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#888',
                font: { size: 11 },
                boxWidth: 12,
                padding: 8
              }
            }
          }
        }
      });
    }
  },

  renderPendingTable(items) {
    const tbody = document.querySelector('#pending-table tbody');
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#555;padding:2rem">${t('dashboard.pending.empty')}</td></tr>`;
      return;
    }
    const today = new Date();
    tbody.innerHTML = items.map(item => {
      const days = Math.floor((today - new Date(item.purchaseDate)) / 86400000);
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.platform || t('common.none')}</td>
        <td>${typeBadge(item.type)}</td>
        <td class="neutral">${fmt(item.totalCost)}</td>
        <td style="color:${days > 60 ? '#ff4444' : '#888'}">${t('dashboard.daysShort', days)}</td>
        <td><button class="btn-icon" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})" title="${t('common.sell')}">💰</button></td>
      </tr>`;
    }).join('');
  },

  // ── Inventario ──────────────────────────

  async loadInventory() {
    const search       = document.getElementById('search-input')?.value || '';
    const platform     = document.getElementById('filter-platform')?.value || '';
    const type         = document.getElementById('filter-type')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (platform) params.set('platform', platform);
    if (type)     params.set('type', type);
    if (statusFilter === 'collection') params.set('isCollection', 'true');
    else if (statusFilter === 'false') { params.set('isSold', 'false'); params.set('isCollection', 'false'); }
    else if (statusFilter === 'true') params.set('isSold', 'true');

    const activeTags = App.getActiveTagFilters();
    if (activeTags.length) params.set('tags', activeTags.join(','));

    try {
      _invItems = await App.get(`/items?${params}`);
      _invPage  = 1; // reset a primera página al cambiar filtros
      App.renderInventoryPage();
    } catch (e) {
      App.toast(t('inventory.loadError'), 'error');
    }
  },

  onPageSizeChange() {
    const sel = document.getElementById('page-size-select');
    _invPageSize = parseInt(sel.value) || 10;
    localStorage.setItem(_pageSizeKey, _invPageSize);
    _invPage = 1;
    App.renderInventoryPage();
  },

  goToPage(page) {
    _invPage = page;
    App.renderInventoryPage();
    // Scroll suave al top de la tabla
    document.getElementById('inventory-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderInventoryPage() {
    const total      = _invItems.length;
    const totalPages = Math.max(1, Math.ceil(total / _invPageSize));
    if (_invPage > totalPages) _invPage = totalPages;

    const start = (_invPage - 1) * _invPageSize;
    const page  = _invItems.slice(start, start + _invPageSize);

    App.renderInventoryTable(page);
    App.renderPaginationBar(total, totalPages);
  },

  renderPaginationBar(total, totalPages) {
    const bar = document.getElementById('pagination-bar');
    if (!bar) return;

    if (total === 0) { bar.innerHTML = ''; return; }

    const start = (_invPage - 1) * _invPageSize + 1;
    const end   = Math.min(_invPage * _invPageSize, total);

    // Botones de página (máx 5 visibles con ellipsis)
    let pages = '';
    const delta = 2;
    const left  = Math.max(1, _invPage - delta);
    const right = Math.min(totalPages, _invPage + delta);

    if (left > 1) {
      pages += `<button class="page-btn" onclick="App.goToPage(1)">1</button>`;
      if (left > 2) pages += `<span style="color:var(--text3);padding:0 0.2rem">…</span>`;
    }
    for (let i = left; i <= right; i++) {
      pages += `<button class="page-btn ${i === _invPage ? 'active' : ''}" onclick="App.goToPage(${i})">${i}</button>`;
    }
    if (right < totalPages) {
      if (right < totalPages - 1) pages += `<span style="color:var(--text3);padding:0 0.2rem">…</span>`;
      pages += `<button class="page-btn" onclick="App.goToPage(${totalPages})">${totalPages}</button>`;
    }

    bar.innerHTML = `
      <span class="pagination-info">${t('inventory.pagination', start, end, total)}</span>
      <div class="pagination-controls">
        <button class="page-btn" onclick="App.goToPage(${_invPage - 1})" ${_invPage === 1 ? 'disabled' : ''}>‹</button>
        ${totalPages > 1 ? pages : ''}
        <button class="page-btn" onclick="App.goToPage(${_invPage + 1})" ${_invPage === totalPages ? 'disabled' : ''}>›</button>
      </div>
      <div class="pagination-right">
        <label>${t('inventory.itemsPerPage')}
          <select id="page-size-select" onchange="App.onPageSizeChange()">
            <option value="10" ${_invPageSize === 10 ? 'selected' : ''}>10</option>
            <option value="15" ${_invPageSize === 15 ? 'selected' : ''}>15</option>
            <option value="20" ${_invPageSize === 20 ? 'selected' : ''}>20</option>
          </select>
        </label>
      </div>`;
  },

  // Devuelve los tags seleccionados en el dropdown de filtro
  getActiveTagFilters() {
    return Array.from(document.querySelectorAll('#tagFilterDropdown input:checked'))
      .map(cb => cb.dataset.tag);
  },

  // Pobla el dropdown de filtro de tags con los tags del cache
  // FIX: usa <div> en lugar de <label> para evitar heredar flex-direction:column del label global
  populateTagFilter() {
    const dd = document.getElementById('tagFilterDropdown');
    if (!dd) return;
    const active = App.getActiveTagFilters();
    if (!_allTags.length) {
      dd.innerHTML = `<div class="tag-filter-empty">${t('inventory.noTagsYet')}</div>`;
      return;
    }
    dd.innerHTML = _allTags.map(tag =>
      `<div class="tag-filter-option" onclick="this.querySelector('input').click();event.stopPropagation()">
        <input type="checkbox" data-tag="${escapeHtml(tag.name)}" ${active.includes(tag.name) ? 'checked' : ''}
               onchange="App.onTagFilterChange()" onclick="event.stopPropagation()" />
        ${tagPillReadonly(tag.name)}
        <span style="color:var(--text3);font-size:0.72rem;margin-left:auto">${tag.itemCount}</span>
      </div>`
    ).join('');
  },

  toggleTagFilterDropdown() {
    const dd  = document.getElementById('tagFilterDropdown');
    const btn = document.getElementById('tagFilterBtn');
    const isOpen = dd.classList.contains('open');
    if (isOpen) { dd.classList.remove('open'); return; }

    // Abrir primero para poder medir el ancho real
    dd.style.position = 'fixed';
    dd.style.top    = '-9999px';
    dd.style.left   = '-9999px';
    dd.style.width  = '220px';
    dd.style.zIndex = '9999';
    dd.classList.add('open');

    // Calcular posición tras render
    const rect   = btn.getBoundingClientRect();
    const ddW    = dd.offsetWidth;
    const vw     = window.innerWidth;
    const margin = 8; // margen mínimo del borde del viewport

    let left = rect.left;
    // Si se sale por la derecha, alinear al borde derecho del botón
    if (left + ddW + margin > vw) {
      left = rect.right - ddW;
    }
    // Si aún así se sale por la izquierda, pegarlo al margen izquierdo
    if (left < margin) left = margin;

    dd.style.top  = (rect.bottom + 6) + 'px';
    dd.style.left = left + 'px';
  },

  onTagFilterChange() {
    const active = App.getActiveTagFilters();
    const btn = document.getElementById('tagFilterBtn');
    const countEl = document.getElementById('tagFilterCount');
    if (active.length) {
      btn.classList.add('has-active');
      countEl.textContent = `(${active.length}) `;
    } else {
      btn.classList.remove('has-active');
      countEl.textContent = '';
    }
    App.loadInventory();
  },

  renderInventoryTable(items) {
    const tbody = document.querySelector('#inventory-table tbody');
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:#555;padding:2rem">${t('inventory.empty')}</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(item => {
      const profit = item.profit !== null
        ? `<span class="${item.profit >= 0 ? 'positive' : 'negative'}">${fmt(item.profit)}</span>`
        : `<span class="neutral">${t('common.none')}</span>`;
      const collectionBadge = item.isCollection
        ? '<span class="badge badge-collection">⭐</span>&nbsp;'
        : '';
      return `<tr class="${item.isSold ? 'row-sold' : item.isCollection ? 'row-collection' : ''}">
        <td>${collectionBadge}<strong>${escapeHtml(item.name)}</strong></td>
        <td class="inv-col-tipo">${typeBadge(item.type)}</td>
        <td class="inv-col-plataforma"><span class="badge">${item.platform || t('common.none')}</span></td>
        <td class="inv-col-estado">${condBadge(item.condition)}</td>
        <td class="inv-col-lote">${item.lotId
          ? `<span class="badge badge-lot-code" style="cursor:pointer" onclick="App.openLotDetail(${item.lotId})" title="${escapeHtml(t('common.viewLot', item.lotCode || ''))}">${escapeHtml(item.lotCode || item.lotName || t('common.none'))}</span>`
          : `<span style="color:#555">${t('common.none')}</span>`}</td>
        <td class="inv-col-etiquetas">
          <div class="tags-cell">
            ${(item.tags || []).map(tagPillReadonly).join('') || `<span style="color:var(--text3)">${t('common.none')}</span>`}
          </div>
        </td>
        <td class="inv-col-coste neutral">${fmt(item.totalCost)}</td>
        <td class="inv-col-venta">${item.salePrice ? fmt(item.salePrice) : `<span style="color:#555">${t('common.none')}</span>`}</td>
        <td class="inv-col-beneficio">${profit}</td>
        <td class="inv-col-fecha neutral" style="font-size:0.78rem">${fmtDate(item.purchaseDate)}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${!item.isSold && !item.isCollection
              ? `<button class="btn-icon" title="${t('common.sell')}" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰</button>`
              : item.isSold ? `<button class="btn-icon" title="${t('common.unsell')}" onclick="App.unsell(${item.id})">↩️</button>` : ''
            }
            ${!item.isSold
              ? `<button class="btn-icon" title="${item.isCollection ? t('common.moveToStock') : t('common.moveToCollection')}" onclick="App.toggleCollection(${item.id},${item.isCollection})">${item.isCollection ? '📦' : '⭐'}</button>`
              : ''
            }
            <button class="btn-icon" title="${t('common.edit')}"   onclick="App.openItemModal(${item.id})">✏️</button>
            <button class="btn-icon" title="${t('common.delete')}" onclick="App.deleteItem(${item.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
    applyVisibleCols();
  },

  // ── Modal Artículo ───────────────────────

  async openItemModal(itemId = null) {
    currentItemId = itemId;
    document.getElementById('modal-item-title').textContent = itemId ? t('modal.item.editTitle') : t('modal.item.addTitle');
    V.clearAll(document.getElementById('modal-item'));


    const lots = await App.get('/lots');
    const lotSel = document.getElementById('item-lot-id');
    lotSel.innerHTML = `<option value="">${t('common.noLot')}</option>` +
      lots.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');

    if (itemId) {
      const item = await App.get(`/items/${itemId}`);
      document.getElementById('item-id').value             = item.id;
      document.getElementById('item-name').value           = item.name;
      document.getElementById('item-platform').value       = item.platform || getPlatforms()[0] || '';
      document.getElementById('item-type').value           = item.type;
      document.getElementById('item-condition').value      = item.condition;
      document.getElementById('item-purchase-price').value = item.purchasePrice;
      document.getElementById('item-shipping').value       = item.shippingCost;
      document.getElementById('item-purchase-date').value  = item.purchaseDate.split('T')[0];
      document.getElementById('item-lot-id').value         = item.lotId || '';
      document.getElementById('item-notes').value          = item.notes || '';
      document.getElementById('item-is-collection').checked = item.isCollection || false;
      App.tags.load('item', item.tags || []);
    } else {
      ['item-id','item-name','item-notes'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('item-platform').value       = '';
      document.getElementById('item-purchase-price').value = '';
      document.getElementById('item-shipping').value       = '0';
      document.getElementById('item-purchase-date').value  = new Date().toISOString().split('T')[0];
      document.getElementById('item-lot-id').value         = '';
      document.getElementById('item-is-collection').checked = false;
      App.tags.clear('item');
    }

    populatePlatformSelects();
    ['item-name','item-purchase-price','item-shipping','item-purchase-date'].forEach(id =>
      V.watch(document.getElementById(id))
    );
    App.openModal('modal-item');
  },

  _validateItemForm() {
    const nameEl  = document.getElementById('item-name');
    const priceEl = document.getElementById('item-purchase-price');
    const shipEl  = document.getElementById('item-shipping');
    const dateEl  = document.getElementById('item-purchase-date');

    const platformEl = document.getElementById('item-platform');
    let ok = true;
    ok = V.requireText(nameEl,         t('form.name'))          && ok;
    ok = V.requireText(platformEl,     t('form.platform'))      && ok;
    ok = V.requirePositive(priceEl,    t('form.purchasePrice')) && ok;
    ok = V.requireNonNegative(shipEl,  t('form.shippingCost'))  && ok;
    ok = V.requireDate(dateEl,         t('form.purchaseDate'))  && ok;
    if (!ok) return null;

    return {
      name:          nameEl.value.trim(),
      platform:      platformEl.value.trim(),
      type:          document.getElementById('item-type').value,
      condition:     document.getElementById('item-condition').value,
      purchasePrice: parseFloat(priceEl.value),
      shippingCost:  parseFloat(shipEl.value),
      purchaseDate:  dateEl.value,
      lotId:         document.getElementById('item-lot-id').value || null,
      notes:         document.getElementById('item-notes').value.trim(),
      isCollection:  document.getElementById('item-is-collection').checked,
      tags:          App.tags.get('item')
    };
  },

  async saveItem() {
    const body = App._validateItemForm();
    if (!body) return;
    const id = document.getElementById('item-id').value;
    try {
      if (id) { await App.put(`/items/${id}`, body);  App.toast(t('inventory.itemUpdated')); }
      else    { await App.post('/items', body);         App.toast(t('inventory.itemAdded')); }
      App.closeModal('modal-item');
      await loadTagsCache();
      App.populateTagFilter();
      App.loadInventory();
    } catch (e) {
      App.toast(t('inventory.saveError'), 'error');
    }
  },

  // ── Venta ───────────────────────────────

  openSellModal(itemId, name, cost) {
    V.clearAll(document.getElementById('modal-sell'));
    document.getElementById('sell-item-id').value   = itemId;
    document.getElementById('sell-item-name').textContent = name;
    document.getElementById('sell-price').value     = '';
    document.getElementById('sell-date').value      = new Date().toISOString().split('T')[0];
    currentSellCost = cost;
    document.getElementById('sell-profit-preview').innerHTML =
      `<span class="neutral">${t('common.costTotal', fmt(cost))}</span>`;
    V.watch(document.getElementById('sell-price'));
    V.watch(document.getElementById('sell-date'));
    App.openModal('modal-sell');
  },

  updateSellPreview() {
    const price = parseFloat(document.getElementById('sell-price').value) || 0;
    const profit = price - currentSellCost;
    const cls = profit >= 0 ? 'positive' : 'negative';
    document.getElementById('sell-profit-preview').innerHTML =
      `${t('common.estimatedProfit', `<span class="${cls}">${fmt(profit)}</span>`)}`;
  },

  async confirmSell() {
    const priceEl = document.getElementById('sell-price');
    const dateEl  = document.getElementById('sell-date');
    let ok = true;
    ok = V.requirePositive(priceEl, t('form.salePrice')) && ok;
    ok = V.requireDate(dateEl,      t('form.saleDate'))  && ok;
    if (!ok) return;

    const id = document.getElementById('sell-item-id').value;
    try {
      await App.post(`/items/${id}/sell`, { salePrice: parseFloat(priceEl.value), saleDate: dateEl.value });
      App.toast(t('inventory.saleRegistered'));
      App.closeModal('modal-sell');

      // Callback opcional desde el popup de detalle de lote
      if (App._sellCallback) {
        await App._sellCallback();
        App._sellCallback = null;
      } else {
        App.loadInventory();
        App.loadDashboard();
        App.loadLots();
      }
    } catch (e) {
      App.toast(t('inventory.sellError'), 'error');
    }
  },

  async unsell(id) {
    const ok = await App.confirmDialog.show({
      message: t('inventory.confirmUnsell'),
      submessage: t('inventory.confirmUnsellDetail'),
      icon: '↩️',
      okLabel: t('common.unsell'),
      okClass: 'btn-secondary'
    });
    if (!ok) return;
    try {
      await App.post(`/items/${id}/unsell`, {});
      App.toast(t('inventory.saleReverted'));
      App.loadInventory();
    } catch (e) {
      App.toast(t('inventory.unsellError'), 'error');
    }
  },

  async toggleCollection(id, currentValue) {
    try {
      await App.put(`/items/${id}`, { isCollection: !currentValue });
      App.toast(!currentValue ? t('inventory.movedToCollection') : t('inventory.movedToStock'));
      App.loadInventory();
    } catch (e) {
      App.toast(t('inventory.updateError'), 'error');
    }
  },

  async deleteItem(id) {
    const ok = await App.confirmDialog.show({
      message: t('inventory.confirmDeleteItem'),
      submessage: t('inventory.confirmDeleteDetail'),
      icon: '🗑️',
      okLabel: t('common.delete'),
      okClass: 'btn-danger'
    });
    if (!ok) return;
    try {
      await App.delete(`/items/${id}`);
      App.toast(t('inventory.itemDeleted'));
      App.loadInventory();
    } catch (e) {
      App.toast(t('inventory.deleteError'), 'error');
    }
  },

  // ── Lotes ───────────────────────────────

  async loadLots() {
    try {
      const allLots = await App.get('/lots');
      const search  = (document.getElementById('lots-search')?.value || '').trim().toLowerCase();
      const period  = document.getElementById('lots-period')?.value || '';

      let minDate = null;
      if (period) {
        const now = new Date();
        if (period === 'week') {
          minDate = new Date(now); minDate.setDate(now.getDate() - 7);
        } else if (period === 'month') {
          minDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === '3months') {
          minDate = new Date(now); minDate.setMonth(now.getMonth() - 3);
        } else if (period === '6months') {
          minDate = new Date(now); minDate.setMonth(now.getMonth() - 6);
        } else if (period === 'year') {
          minDate = new Date(now.getFullYear(), 0, 1);
        }
      }

      _lotItems = allLots.filter(lot => {
        if (search) {
          const matchCode = lot.code.toLowerCase().includes(search);
          const matchName = lot.name.toLowerCase().includes(search);
          if (!matchCode && !matchName) return false;
        }
        if (minDate && new Date(lot.purchaseDate) < minDate) return false;
        return true;
      });

      _lotPage = 1;
      App.renderLotsPage(allLots.length);
    } catch (e) {
      App.toast(t('lots.loadError'), 'error');
    }
  },

  onLotPageSizeChange() {
    const sel = document.getElementById('lot-page-size-select');
    _lotPageSize = parseInt(sel?.value) || 10;
    localStorage.setItem(_lotPageSizeKey, _lotPageSize);
    _lotPage = 1;
    App.renderLotsPage();
  },

  goToLotPage(page) {
    _lotPage = page;
    App.renderLotsPage();
    document.getElementById('lots-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderLotsPage(totalAll) {
    const total      = _lotItems.length;
    const totalPages = Math.max(1, Math.ceil(total / _lotPageSize));
    if (_lotPage > totalPages) _lotPage = totalPages;

    const start = (_lotPage - 1) * _lotPageSize;
    const page  = _lotItems.slice(start, start + _lotPageSize);

    App.renderLotsTable(page, totalAll);
    App.renderLotsPaginationBar(total, totalPages);
  },

  renderLotsTable(lots, totalAll) {
    const tbody = document.querySelector('#lots-table tbody');

    if (!lots.length) {
      const msg = (totalAll !== undefined ? totalAll : _lotItems.length) === 0
        ? t('lots.empty')
        : t('lots.emptyFiltered');
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#555;padding:2rem">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = lots.map(lot => {
      const profitCls = lot.totalProfit >= 0 ? 'positive' : 'negative';
      const collectionItems = lot.collectionItems ?? 0;
      const pctSold       = lot.totalItems > 0 ? Math.round(lot.soldItems      / lot.totalItems * 100) : 0;
      const pctCollection = lot.totalItems > 0 ? Math.round(collectionItems    / lot.totalItems * 100) : 0;
      return `<tr>
        <td><span class="badge badge-lot-code">${escapeHtml(lot.code)}</span></td>
        <td class="neutral" style="font-size:0.78rem;white-space:nowrap">${fmtDate(lot.purchaseDate)}</td>
        <td style="font-weight:600">${escapeHtml(lot.name)}</td>
        <td class="neutral" style="font-size:0.78rem;max-width:140px;overflow:hidden;text-overflow:ellipsis">${lot.notes ? escapeHtml(lot.notes) : `<span style="color:#555">${t('common.none')}</span>`}</td>
        <td>
          <div class="lots-progress">
            <span>${lot.totalItems}</span>
            <div class="lots-progress-bar">
              <div class="lots-progress-fill lots-progress-sold"       style="width:${pctSold}%"></div>
              <div class="lots-progress-fill lots-progress-collection" style="width:${pctCollection}%"></div>
            </div>
            <span style="font-size:0.72rem;color:var(--text3)">${t('lots.soldShort', lot.soldItems)}</span>
          </div>
        </td>
        <td class="neutral" style="font-family:var(--font-mono);font-size:0.82rem">${fmt(lot.totalCost)}</td>
        <td style="font-family:var(--font-mono);font-size:0.82rem;color:var(--accent3)">${fmt(lot.totalRevenue)}</td>
        <td class="${profitCls}" style="font-family:var(--font-mono);font-size:0.82rem">${lot.totalProfit >= 0 ? '+' : ''}${fmt(lot.totalProfit)}</td>
        <td>
          <div style="display:flex;gap:3px;align-items:center">
            <button class="btn-sm" onclick="App.openLotDetail(${lot.id})">${t('lots.viewDetail')}</button>
            <button class="btn-icon" onclick="App.deleteLot(${lot.id})" title="${t('common.delete')}">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  renderLotsPaginationBar(total, totalPages) {
    const bar = document.getElementById('lots-pagination-bar');
    if (!bar) return;

    if (total === 0) { bar.innerHTML = ''; return; }

    const start = (_lotPage - 1) * _lotPageSize + 1;
    const end   = Math.min(_lotPage * _lotPageSize, total);

    let pages = '';
    const delta = 2;
    const left  = Math.max(1, _lotPage - delta);
    const right = Math.min(totalPages, _lotPage + delta);

    if (left > 1) {
      pages += `<button class="page-btn" onclick="App.goToLotPage(1)">1</button>`;
      if (left > 2) pages += `<span style="color:var(--text3);padding:0 0.2rem">…</span>`;
    }
    for (let i = left; i <= right; i++) {
      pages += `<button class="page-btn ${i === _lotPage ? 'active' : ''}" onclick="App.goToLotPage(${i})">${i}</button>`;
    }
    if (right < totalPages) {
      if (right < totalPages - 1) pages += `<span style="color:var(--text3);padding:0 0.2rem">…</span>`;
      pages += `<button class="page-btn" onclick="App.goToLotPage(${totalPages})">${totalPages}</button>`;
    }

    bar.innerHTML = `
      <span class="pagination-info">${t('lots.pagination', start, end, total)}</span>
      <div class="pagination-controls">
        <button class="page-btn" onclick="App.goToLotPage(${_lotPage - 1})" ${_lotPage === 1 ? 'disabled' : ''}>‹</button>
        ${totalPages > 1 ? pages : ''}
        <button class="page-btn" onclick="App.goToLotPage(${_lotPage + 1})" ${_lotPage === totalPages ? 'disabled' : ''}>›</button>
      </div>
      <div class="pagination-right">
        <label>${t('lots.itemsPerPage')}
          <select id="lot-page-size-select" onchange="App.onLotPageSizeChange()">
            <option value="10" ${_lotPageSize === 10 ? 'selected' : ''}>10</option>
            <option value="15" ${_lotPageSize === 15 ? 'selected' : ''}>15</option>
            <option value="20" ${_lotPageSize === 20 ? 'selected' : ''}>20</option>
          </select>
        </label>
      </div>`;
  },

  // ── Popup de detalle de lote ─────────────

  _currentLotId: null,

  async openLotDetail(lotId) {
    App._currentLotId = lotId;
    try {
      const lot = await App.get(`/lots/${lotId}`);
      App._renderLotDetail(lot);
      App.openModal('modal-lot-detail');
    } catch (e) {
      App.toast(t('lots.detailLoadError'), 'error');
    }
  },

  _renderLotDetail(lot) {
    // Cabecera
    document.getElementById('lot-detail-code').textContent = lot.code;
    document.getElementById('lot-detail-name').textContent = lot.name;
    document.getElementById('lot-detail-add-btn').dataset.lotId   = lot.id;
    document.getElementById('lot-detail-edit-btn').dataset.lotId  = lot.id;

    const meta = document.getElementById('lot-detail-meta');
    meta.innerHTML = `
      <span>📅 ${fmtDate(lot.purchaseDate)}</span>
      ${lot.notes ? `<span>📝 ${escapeHtml(lot.notes)}</span>` : ''}
    `;

    // Stats
    const profitCls = lot.totalProfit >= 0 ? 'positive' : 'negative';
    document.getElementById('lot-detail-stats').innerHTML = `
      <div class="lot-detail-stat-grid">
        <div class="lot-detail-stat">
          <span class="lot-detail-stat-val neutral">${fmt(lot.totalCost)}</span>
          <span class="lot-detail-stat-lbl">${t('lots.detail.invested')}</span>
        </div>
        <div class="lot-detail-stat">
          <span class="lot-detail-stat-val" style="color:var(--accent3)">${fmt(lot.totalRevenue)}</span>
          <span class="lot-detail-stat-lbl">${t('lots.detail.recovered')}</span>
        </div>
        <div class="lot-detail-stat">
          <span class="lot-detail-stat-val ${profitCls}">${lot.totalProfit >= 0 ? '+' : ''}${fmt(lot.totalProfit)}</span>
          <span class="lot-detail-stat-lbl">${t('lots.detail.profit')}</span>
        </div>
        <div class="lot-detail-stat">
          <span class="lot-detail-stat-val">${lot.soldItems} / ${lot.totalItems}</span>
          <span class="lot-detail-stat-lbl">${t('lots.detail.sold')}</span>
        </div>
        <div class="lot-detail-stat">
          <span class="lot-detail-stat-val">${lot.stockItems}</span>
          <span class="lot-detail-stat-lbl">${t('lots.detail.inStock')}</span>
        </div>
      </div>`;

    // Listado de artículos
    const container = document.getElementById('lot-detail-items');
    if (!lot.items.length) {
      container.innerHTML = `<p style="color:#555;font-size:0.85rem;padding:0.5rem">${t('lots.detail.empty')}</p>`;
      return;
    }
    container.innerHTML = lot.items.map(item => {
      const rowClass = item.isSold ? 'sold' : item.isCollection ? 'lot-item-collection' : '';

      let actions = '';
      if (item.isSold) {
        actions = `<button class="btn-icon" title="${t('common.unsell')}" onclick="App.unsellFromDetail(${item.id})">↩️</button>`;
      } else if (item.isCollection) {
        actions = `<button class="btn-icon" title="${t('common.moveToStock')}" onclick="App.toggleCollectionFromDetail(${item.id}, true)">📦</button>`;
      } else {
        actions = `<button class="btn-icon" title="${t('common.sell')}" onclick="App.openSellModalFromDetail(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰</button>`;
      }

      const collectionBadge = item.isCollection && !item.isSold
        ? `<span style="font-size:0.7rem;color:var(--accent3);margin-right:2px">⭐</span>` : '';

      return `<div class="lot-item-row ${rowClass}">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${collectionBadge}${typeBadge(item.type)} <strong>${escapeHtml(item.name)}</strong>
        </span>
        <span style="display:flex;align-items:center;gap:0.6rem;flex-shrink:0">
          <span class="neutral" style="font-family:var(--font-mono);font-size:0.82rem">${fmt(item.totalCost)}</span>
          ${item.isSold ? `<span class="positive" style="font-family:var(--font-mono);font-size:0.82rem">${fmt(item.salePrice)}</span>` : ''}
          ${actions}
          <button class="btn-icon" title="${t('lots.removeFromLot')}" onclick="App.removeItemFromLot(${item.id})">🗑️</button>
        </span>
      </div>`;
    }).join('');
  },

  // Acciones desde el popup de detalle
  openSellModalFromDetail(itemId, name, cost) {
    App.openSellModal(itemId, name, cost);
    // Al confirmar la venta refrescamos el detalle
    App._sellCallback = async () => {
      const lot = await App.get(`/lots/${App._currentLotId}`);
      App._renderLotDetail(lot);
      App.loadLots();
    };
  },

  async unsellFromDetail(itemId) {
    if (!confirm(t('inventory.confirmUnsell'))) return;
    try {
      await App.post(`/items/${itemId}/unsell`, {});
      App.toast(t('inventory.saleReverted'));
      const lot = await App.get(`/lots/${App._currentLotId}`);
      App._renderLotDetail(lot);
      App.loadLots();
    } catch (e) {
      App.toast(t('inventory.unsellError'), 'error');
    }
  },

  async toggleCollectionFromDetail(itemId, currentIsCollection) {
    try {
      await App.put(`/items/${itemId}`, { isCollection: !currentIsCollection });
      App.toast(!currentIsCollection ? t('inventory.movedToCollection') : t('inventory.movedToStock'));
      const lot = await App.get(`/lots/${App._currentLotId}`);
      App._renderLotDetail(lot);
    } catch (e) {
      App.toast(t('inventory.updateError'), 'error');
    }
  },

  async removeItemFromLot(itemId) {
    const ok = await App.confirmDialog.show({
      message: t('lots.removeFromLotConfirm'),
      submessage: t('lots.removeFromLotDetail'),
      icon: '🗑️',
      okLabel: t('lots.removeFromLot'),
      okClass: 'btn-danger'
    });
    if (!ok) return;
    try {
      await App.put(`/items/${itemId}`, { unlinkLot: true });
      App.toast(t('lots.removeFromLotSuccess'));
      const lot = await App.get(`/lots/${App._currentLotId}`);
      App._renderLotDetail(lot);
      App.loadLots();
    } catch (e) {
      App.toast(t('lots.removeFromLotError'), 'error');
    }
  },

  openEditLotFromDetail() {
    const lotId = App._currentLotId;
    App.get(`/lots/${lotId}`).then(lot => {
      App.openEditLotModal(lot.id, lot.name, lot.purchaseDate.split('T')[0], lot.notes || '');
    });
  },

  openAddToLotFromDetail() {
    const lotId = App._currentLotId;
    App.get(`/lots/${lotId}`).then(lot => {
      App.openAddToLotModal(lot.id, lot.name);
    });
  },

  // ── Modal Lote ───────────────────────────

  openLotModal() {
    lotItemCount = 0;
    V.clearAll(document.getElementById('modal-lot'));

    document.getElementById('lot-name').value     = '';
    document.getElementById('lot-date').value     = new Date().toISOString().split('T')[0];
    document.getElementById('lot-price').value    = '';
    document.getElementById('lot-shipping').value = '0';
    document.getElementById('lot-notes').value    = '';
    document.getElementById('lot-items-list').innerHTML = '';
    document.getElementById('lot-total-info').innerHTML = '';

    ['lot-name','lot-price','lot-shipping','lot-date'].forEach(id => V.watch(document.getElementById(id)));
    App.addLotItem();
    App.addLotItem();
    App.openModal('modal-lot');
  },

  addLotItem() {
    lotItemCount++;
    const idx = lotItemCount;
    const row = document.createElement('div');
    row.className = 'lot-item-form-row';
    row.id = `lot-item-${idx}`;
    row.innerHTML = `
      <label style="font-size:0.78rem">Nombre *
        <input type="text" placeholder="Ej: Nintendo DSi" data-field="name" />
      </label>
      <label style="font-size:0.78rem">${t('form.type')}
        <select data-field="type">
          <option value="Console">${t('inventory.type.console')}</option>
          <option value="VideoGame">${t('status.game')}</option>
          <option value="Accessory">${t('inventory.type.accessory')}</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma *
        <select data-field="platform"><option value="">${t('common.selectOption')}</option></select>
      </label>
      <label style="font-size:0.78rem">${t('form.condition')}
        <select data-field="condition">
          <option value="Used">${t('status.used')}</option>
          <option value="New">${t('status.new')}</option>
          <option value="NeedsRepair">${t('status.needsRepair')}</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Precio (€)
        <input type="number" step="0.01" min="0" placeholder="0.00" data-field="price"
               oninput="App.recalcLotItems()" />
      </label>
      <label style="font-size:0.78rem">Envío (€)
        <input type="number" step="0.01" min="0" placeholder="0.00" data-field="shipping" />
      </label>
      <button class="btn-icon" style="margin-top:1.4rem"
              onclick="document.getElementById('lot-item-${idx}').remove();App.recalcLotItems()">✕</button>
    `;
    document.getElementById('lot-items-list').appendChild(row);
    populatePlatformSelects();
    row.querySelector('[data-field="name"]').addEventListener('input', function() { V.clear(this); });
    row.querySelector('[data-field="price"]').addEventListener('input', function() { V.clear(this); });
    row.querySelector('[data-field="shipping"]').addEventListener('input', function() { V.clear(this); });
    App.recalcLotItems();
  },

  recalcLotItems() {
    const totalPrice    = parseFloat(document.getElementById('lot-price').value) || 0;
    const totalShipping = parseFloat(document.getElementById('lot-shipping').value) || 0;
    const rows = document.querySelectorAll('#lot-items-list .lot-item-form-row');
    if (!rows.length) { document.getElementById("lot-total-info").innerHTML = `<strong>${t('lots.totalItems', 0)}</strong>`; return; }

    const priceSum = Array.from(rows)
      .map(r => parseFloat(r.querySelector('[data-field="price"]')?.value) || 0)
      .reduce((a, b) => a + b, 0);

    let info = `<strong>${t('lots.totalItems', rows.length)}</strong>`;
    if (priceSum > 0 && Math.abs(priceSum - totalPrice) > 0.01) {
      info += ` — <span style="color:#ff4444">${t('lots.sumMismatch', fmt(priceSum), fmt(totalPrice))}</span>`;
    } else if (priceSum === 0 && totalPrice > 0) {
      const perItem = Math.round(totalPrice    / rows.length * 100) / 100;
      const perShip = Math.round(totalShipping / rows.length * 100) / 100;
      info += ` — ${t('lots.evenSplit', fmt(perItem), fmt(perShip))}`;
    }
    document.getElementById('lot-total-info').innerHTML = info;
  },

  _validateLotForm() {
    const nameEl  = document.getElementById('lot-name');
    const priceEl = document.getElementById('lot-price');
    const shipEl  = document.getElementById('lot-shipping');
    const dateEl  = document.getElementById('lot-date');

    let ok = true;
    ok = V.requireText(nameEl,         t('form.lotName'))       && ok;
    ok = V.requireNonNegative(priceEl, t('form.totalPrice'))    && ok;
    ok = V.requireNonNegative(shipEl,  t('form.totalShipping')) && ok;
    ok = V.requireDate(dateEl,         t('form.date'))          && ok;

    const rows = document.querySelectorAll('#lot-items-list .lot-item-form-row');
    if (!rows.length) { App.toast(t('lots.addAtLeastOne'), 'error'); ok = false; }

    rows.forEach(row => {
      const n = row.querySelector('[data-field="name"]');
      const p = row.querySelector('[data-field="price"]');
      const s = row.querySelector('[data-field="shipping"]');
      const pl = row.querySelector('[data-field="platform"]');
      if (!n.value.trim()) { V.error(n, t('validation.invalidName')); ok = false; }
      if (!pl.value.trim()) { V.error(pl, t('validation.invalidPlatform')); ok = false; }
      if (isNaN(parseFloat(p.value)) || parseFloat(p.value) < 0) { V.error(p, t('validation.invalidPrice')); ok = false; }
      if (isNaN(parseFloat(s.value)) || parseFloat(s.value) < 0) { V.error(s, t('validation.invalidShipping'));  ok = false; }
    });

    if (!ok) return null;

    return {
      body: {
        name:               nameEl.value.trim(),
        notes:              document.getElementById('lot-notes').value.trim(),
        purchaseDate:       dateEl.value,
        totalPurchasePrice: parseFloat(priceEl.value) || 0,
        totalShippingCost:  parseFloat(shipEl.value)  || 0,
        items: Array.from(rows).map(r => ({
          name:          r.querySelector('[data-field="name"]').value.trim(),
          type:          r.querySelector('[data-field="type"]').value,
          platform:      r.querySelector('[data-field="platform"]').value.trim(),
          condition:     r.querySelector('[data-field="condition"]').value,
          purchasePrice: parseFloat(r.querySelector('[data-field="price"]').value)    || 0,
          shippingCost:  parseFloat(r.querySelector('[data-field="shipping"]').value) || 0
        }))
      }
    };
  },

  async saveLot() {
    const result = App._validateLotForm();
    if (!result) return;
    try {
      await App.post('/lots', result.body);
      App.toast(t('lots.createSuccess'));
      App.closeModal('modal-lot');
      App.loadLots();
    } catch (e) {
      App.toast(t('lots.createError'), 'error');
    }
  },

  // ── Editar lote ──────────────────────────

  openEditLotModal(lotId, name, date, notes) {
    V.clearAll(document.getElementById('modal-edit-lot'));
    document.getElementById('edit-lot-id').value    = lotId;
    document.getElementById('edit-lot-name').value  = name;
    document.getElementById('edit-lot-date').value  = date;
    document.getElementById('edit-lot-notes').value = notes;
    ['edit-lot-name','edit-lot-date'].forEach(id => V.watch(document.getElementById(id)));
    App.openModal('modal-edit-lot');
  },

  async saveEditLot() {
    const nameEl = document.getElementById('edit-lot-name');
    const dateEl = document.getElementById('edit-lot-date');
    let ok = true;
    ok = V.requireText(nameEl, t('form.name')) && ok;
    ok = V.requireDate(dateEl, t('form.date')) && ok;
    if (!ok) return;

    const id = document.getElementById('edit-lot-id').value;
    try {
      await App.put(`/lots/${id}`, {
        name:         nameEl.value.trim(),
        notes:        document.getElementById('edit-lot-notes').value.trim(),
        purchaseDate: dateEl.value || null
      });
      App.toast(t('lots.updateSuccess'));
      App.closeModal('modal-edit-lot');
      App.loadLots();
      // Si el popup de detalle estaba abierto, refrescarlo
      if (App._currentLotId == id) {
        const lot = await App.get(`/lots/${id}`);
        App._renderLotDetail(lot);
      }
    } catch (e) {
      App.toast(t('lots.updateError'), 'error');
    }
  },

  // ── Añadir artículos a lote ──────────────

  openAddToLotModal(lotId, lotName) {
    V.clearAll(document.getElementById('modal-add-to-lot'));

    document.getElementById('add-to-lot-id').value = lotId;
    document.getElementById('add-to-lot-subtitle').textContent = t('common.lotLabel', lotName);
    document.getElementById('add-to-lot-items-list').innerHTML = '';
    App._addToLotCount = 0;
    App.addItemToLotForm();
    App.openModal('modal-add-to-lot');
  },

  addItemToLotForm() {
    if (!App._addToLotCount) App._addToLotCount = 0;
    App._addToLotCount++;
    const idx = App._addToLotCount;
    const row = document.createElement('div');
    row.className = 'lot-item-form-row';
    row.id = `atl-item-${idx}`;
    row.innerHTML = `
      <label style="font-size:0.78rem">${t('form.name')} *
        <input type="text" placeholder="${t('quickAdd.namePlaceholder')}" data-field="name" />
      </label>
      <label style="font-size:0.78rem">${t('form.type')}
        <select data-field="type">
          <option value="Console">${t('inventory.type.console')}</option>
          <option value="VideoGame">${t('status.game')}</option>
          <option value="Accessory">${t('inventory.type.accessory')}</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma *
        <select data-field="platform"><option value="">${t('common.selectOption')}</option></select>
      </label>
      <label style="font-size:0.78rem">${t('form.condition')}
        <select data-field="condition">
          <option value="Used">${t('status.used')}</option>
          <option value="New">${t('status.new')}</option>
          <option value="NeedsRepair">${t('status.needsRepair')}</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Precio (€)
        <input type="number" step="0.01" min="0" placeholder="0.00" data-field="price" />
      </label>
      <label style="font-size:0.78rem">Envío (€)
        <input type="number" step="0.01" min="0" placeholder="0.00" value="0" data-field="shipping" />
      </label>
      <button class="btn-icon" style="margin-top:1.4rem"
              onclick="document.getElementById('atl-item-${idx}').remove()">✕</button>
    `;
    document.getElementById('add-to-lot-items-list').appendChild(row);
    populatePlatformSelects();
    row.querySelector('[data-field="name"]').addEventListener('input',     function() { V.clear(this); });
    row.querySelector('[data-field="price"]').addEventListener('input',    function() { V.clear(this); });
    row.querySelector('[data-field="shipping"]').addEventListener('input', function() { V.clear(this); });
  },

  async saveAddToLot() {
    const lotId = document.getElementById('add-to-lot-id').value;
    const rows  = document.querySelectorAll('#add-to-lot-items-list .lot-item-form-row');
    if (!rows.length) { App.toast(t('lots.addAtLeastOneItem'), 'error'); return; }

    let ok = true;
    rows.forEach(row => {
      const n = row.querySelector('[data-field="name"]');
      const p = row.querySelector('[data-field="price"]');
      const s = row.querySelector('[data-field="shipping"]');
      const pl = row.querySelector('[data-field="platform"]');
      if (!n.value.trim()) { V.error(n, t('validation.invalidName')); ok = false; }
      if (!pl.value.trim()) { V.error(pl, t('validation.invalidPlatform')); ok = false; }
      if (isNaN(parseFloat(p.value)) || parseFloat(p.value) < 0) { V.error(p, t('validation.invalidPrice')); ok = false; }
      if (isNaN(parseFloat(s.value)) || parseFloat(s.value) < 0) { V.error(s, t('validation.invalidShipping'));  ok = false; }
    });
    if (!ok) return;

    const items = Array.from(rows).map(r => ({
      name:          r.querySelector('[data-field="name"]').value.trim(),
      type:          r.querySelector('[data-field="type"]').value,
      platform:      r.querySelector('[data-field="platform"]').value.trim(),
      condition:     r.querySelector('[data-field="condition"]').value,
      purchasePrice: parseFloat(r.querySelector('[data-field="price"]').value)    || 0,
      shippingCost:  parseFloat(r.querySelector('[data-field="shipping"]').value) || 0
    }));

    try {
      await App.post(`/lots/${lotId}/items`, { items });
      App.toast(t('lots.addToLotSuccess', items.length));
      App.closeModal('modal-add-to-lot');
      App.loadLots();
      // Refrescar popup de detalle si está abierto para este lote
      if (App._currentLotId == lotId) {
        const lot = await App.get(`/lots/${lotId}`);
        App._renderLotDetail(lot);
      }
    } catch (e) {
      App.toast(t('lots.addToLotError'), 'error');
    }
  },

  async deleteLot(id) {
    const ok = await App.confirmDialog.show({
      message: t('lots.deleteConfirm'),
      submessage: t('inventory.confirmDeleteDetail'),
      icon: '🎁',
      okLabel: t('modal.confirm.delete'),
      okClass: 'btn-danger'
    });
    if (!ok) return;
    try {
      await App.delete(`/lots/${id}`);
      App.toast(t('lots.deleteSuccess'));
      App.loadLots();
    } catch (e) {
      App.toast(t('lots.deleteErrorSoldItems'), 'error');
    }
  },

  // ── Registro Rápido ─────────────────────

  _validateQuickForm() {
    const nameEl     = document.getElementById('qa-name');
    const platformEl = document.getElementById('qa-platform');
    const priceEl    = document.getElementById('qa-price');
    const shipEl     = document.getElementById('qa-shipping');
    const dateEl     = document.getElementById('qa-date');

    let ok = true;
    ok = V.requireText(nameEl,         t('form.name'))          && ok;
    ok = V.requireText(platformEl,     t('form.platform'))      && ok;
    ok = V.requirePositive(priceEl,    t('form.purchasePrice')) && ok;
    ok = V.requireNonNegative(shipEl,  t('form.shippingCost'))  && ok;
    ok = V.requireDate(dateEl,         t('form.purchaseDate'))  && ok;
    if (!ok) return null;

    return {
      name:          nameEl.value.trim(),
      platform:      platformEl.value.trim(),
      type:          document.getElementById('qa-type').value,
      condition:     document.getElementById('qa-condition').value,
      purchasePrice: parseFloat(priceEl.value),
      shippingCost:  parseFloat(shipEl.value),
      purchaseDate:  dateEl.value,
      notes:         document.getElementById('qa-notes').value.trim(),
      isCollection:  document.getElementById('qa-collection')?.checked || false,
      tags:          App.tags.get('qa')
    };
  },

  async quickAdd() {
    const item = App._validateQuickForm();
    if (!item) return;
    try {
      const created = await App.post('/items', item);
      App.toast(t('quickAdd.added', created.name));
      App.clearQuickForm();
      await loadTagsCache();
      App.loadRecentItems();
    } catch (e) {
      App.toast(t('quickAdd.addError'), 'error');
    }
  },

  async quickAddAndSell() {
    const item = App._validateQuickForm();
    if (!item) return;

    const salePriceStr = prompt(t('quickAdd.askSalePrice'));
    if (salePriceStr === null) return;
    const salePrice = parseFloat(salePriceStr);
    if (isNaN(salePrice) || salePrice <= 0) {
      App.toast(t('quickAdd.salePriceInvalid'), 'error');
      return;
    }
    try {
      const created = await App.post('/items', item);
      await App.post(`/items/${created.id}/sell`, { salePrice, saleDate: item.purchaseDate });
      App.toast(t('quickAdd.addedAndSold', created.name));
      App.clearQuickForm();
      await loadTagsCache();
      App.loadRecentItems();
    } catch (e) {
      App.toast(t('quickAdd.genericError'), 'error');
    }
  },

  clearQuickForm() {
    V.clearAll(document.getElementById('view-quick-add'));
    document.getElementById('qa-name').value     = '';
    const qaPlatSel = document.getElementById('qa-platform');
    qaPlatSel.value = getPlatforms()[0] || '';
    document.getElementById('qa-price').value    = '';
    document.getElementById('qa-shipping').value = '0';
    document.getElementById('qa-notes').value    = '';
    document.getElementById('qa-collection').checked = false;
    document.getElementById('qa-feedback').innerHTML  = '';
    App.tags.clear('qa');
  },

  async loadRecentItems() {
    // Registrar watchers en campos del formulario rápido al entrar a la vista
    ['qa-name','qa-platform','qa-price','qa-shipping','qa-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) V.watch(el);
    });
    try {
      const items = await App.get('/items?isSold=false');
      const container = document.getElementById('qa-recent');
      container.innerHTML = items.slice(0, 5).map(item => `
        <div class="recent-item">
          ${typeBadge(item.type)}
          <strong>${escapeHtml(item.name)}</strong>
          <span class="badge">${item.platform || '?'}</span>
          <span class="neutral">${fmt(item.totalCost)}</span>
          <button class="btn-sm" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰 ${t('common.sell')}</button>
        </div>
      `).join('') || `<p style="color:#555">${t('quickAdd.noItemsInStock')}</p>`;
    } catch (e) {}
  },

  // ── Ajustes ──────────────────────────────

  async loadSettings() {
    const s = await App.get('/settings');
    document.getElementById('settings-balance').value  = s.initialBalance;
    document.getElementById('settings-currency').value = s.currency;
    document.getElementById('settings-platforms').value = getPlatforms().join('\n');
    _currency = s.currency || 'EUR';
    V.watch(document.getElementById('settings-balance'));
    V.watch(document.getElementById('settings-currency'));

    // Cargar lista de etiquetas
    await loadTagsCache();
    const list  = document.getElementById('settings-tags-list');
    const empty = document.getElementById('settings-tags-empty');
    if (!_allTags.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      list.innerHTML = _allTags.map(tag => `
        <div class="settings-tag-row" id="settings-tag-${tag.id}">
          ${tagPillReadonly(tag.name)}
          <span class="tag-count">${t('common.articleCount', tag.itemCount, tag.itemCount !== 1 ? 's' : '')}</span>
          <button class="btn-icon" title="${t('common.rename')}" onclick="App.renameTag(${tag.id},'${escapeHtml(tag.name)}')">✏️</button>
          <button class="btn-icon" title="${t('common.delete')}"  onclick="App.deleteTag(${tag.id},'${escapeHtml(tag.name)}')">🗑️</button>
        </div>`).join('');
    }
  },

  renameTag(id, currentName) {
    document.getElementById('rename-tag-id').value = id;
    const input = document.getElementById('rename-tag-input');
    input.value = currentName;
    // Preview en tiempo real
    const preview = document.getElementById('rename-tag-preview');
    preview.innerHTML = tagPillReadonly(currentName);
    input.oninput = () => {
      const val = input.value.trim().toLowerCase();
      preview.innerHTML = val ? tagPillReadonly(val) : '';
    };
    App.openModal('modal-rename-tag');
    setTimeout(() => { input.focus(); input.select(); }, 50);
  },

  async confirmRenameTag() {
    const id      = document.getElementById('rename-tag-id').value;
    const newName = document.getElementById('rename-tag-input').value.trim();
    if (!newName) { App.toast(t('validation.emptyTagName'), 'error'); return; }
    try {
      await App.put(`/tags/${id}`, { name: newName });
      App.toast(t('settings.tagRenamed'));
      App.closeModal('modal-rename-tag');
      App.loadSettings();
    } catch (e) {
      App.toast(t('settings.tagRenameError'), 'error');
    }
  },

  async deleteTag(id, name) {
    const confirmed = await App.confirmDialog.show({
      icon: '🏷️',
      message: t('settings.deleteTagTitle', name),
      submessage: t('settings.deleteTagMessage'),
      okLabel: t('common.delete'),
      okClass: 'btn-danger'
    });
    if (!confirmed) return;
    try {
      await App.delete(`/tags/${id}`);
      App.toast(t('settings.tagDeleted'));
      App.loadSettings();
    } catch (e) {
      App.toast(t('settings.tagDeleteError'), 'error');
    }
  },

  async saveAllSettings() {
    // ── Validar plataformas ──
    const raw = document.getElementById('settings-platforms').value;
    const platforms = raw.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (platforms.length === 0) {
      App.showFeedback('settings-feedback', t('settings.addAtLeastOnePlatform'), 'error');
      return;
    }

    // ── Validar configuración financiera ──
    const balanceEl  = document.getElementById('settings-balance');
    const currencyEl = document.getElementById('settings-currency');
    let ok = true;
    ok = V.requireNonNegative(balanceEl,  t('form.initialBalance')) && ok;
    ok = V.requireText(currencyEl,        t('settings.currency'))    && ok;
    if (!ok) return;

    try {
      // Guardar ajustes financieros en el servidor
      await App.put('/settings', {
        initialBalance: parseFloat(balanceEl.value) || 0,
        currency:       currencyEl.value.trim().toUpperCase()
      });

      // Actualizar moneda activa globalmente
      _currency = currencyEl.value.trim().toUpperCase();

      // Guardar plataformas en localStorage
      localStorage.setItem('rtPlatforms', JSON.stringify(platforms));
      ['qa-platform', 'item-platform'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      populatePlatformSelects();

      // Guardar columnas visibles en localStorage
      const visibleCols = Array.from(document.querySelectorAll('[data-col]'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.col);
      saveVisibleCols(visibleCols);
      applyVisibleCols();

      App.toast(t('settings.saveSuccess'));
    } catch (e) {
      App.showFeedback('settings-feedback', t('settings.saveError'), 'error');
    }
  },

  // ── Exportar ─────────────────────────────

  exportExcel() { window.location.href = '/api/export/excel'; },

  async importExcel(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const formData = new FormData();
    formData.append('file', file);

    App.toast(t('import.loading'));
    try {
      const r = await fetch('/api/import/excel', { method: 'POST', body: formData });
      const data = await r.json();

      if (r.ok) {
        App.toast(data.message, 'success');
        App.loadInventory();
        App.loadDashboard();
      } else {
        const errors = data.errors || [];
        const list = document.getElementById('import-errors-list');

        const summary = `<div class="import-errors-summary">
          ⛔ ${t('common.errorsFound', errors.length, errors.length !== 1 ? 'es' : '', errors.length !== 1 ? 's' : '')}
        </div>`;

        const rows = errors.length
          ? errors.map(e => `
              <div class="import-error-row">
                <span class="err-fila">${t('common.row', e.fila)}</span>
                <span class="err-col">${e.columna}</span>
                <span class="err-msg">${escapeHtml(e.motivo)}</span>
                ${e.valor ? `<span class="err-val">${escapeHtml(t('common.receivedValue', e.valor))}</span>` : ''}
              </div>`).join('')
          : `<div class="import-error-row"><span class="err-msg" style="grid-column:1/-1">${escapeHtml(data.error || t('common.unknownError'))}</span></div>`;

        list.innerHTML = summary + rows;
        App.openModal('modal-import-errors');
      }
    } catch (e) {
      App.toast(t('import.connectionError'), 'error');
    }
  },

  // ── Modal helpers ────────────────────────

  openModal(id)  { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── HTTP helpers ─────────────────────────

  async get(path) {
    const r = await fetch(API + path);
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[API GET] ${path} → ${r.status} ${r.statusText}`, body);
      throw new Error(r.status);
    }
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(r.status);
    return r.json().catch(() => null);
  },
  async put(path, body) {
    const r = await fetch(API + path, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },
  async delete(path) {
    const r = await fetch(API + path, { method: 'DELETE' });
    if (!r.ok) throw new Error(r.status);
    return true;
  },

  // ── UI helpers ───────────────────────────

  toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    setTimeout(() => el.className = 'toast', 3000);
  },

  showFeedback(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `feedback-msg ${type}`;
    setTimeout(() => el.className = 'feedback-msg', 3000);
  }
};

// ═══════════════════════════════════════════
// MODAL DE CONFIRMACIÓN PERSONALIZADO
// ═══════════════════════════════════════════

App.confirmDialog = {
  _resolve: null,

  show({ message, submessage = '', icon = '🗑️', okLabel = 'Eliminar', okClass = 'btn-danger' }) {
    return new Promise(resolve => {
      this._resolve = resolve;
      document.getElementById('confirm-message').textContent = message;
      document.getElementById('confirm-submessage').textContent = submessage;
      document.getElementById('confirm-icon').textContent = icon;
      const okBtn = document.getElementById('confirm-ok-btn');
      okBtn.textContent = okLabel;
      okBtn.className = okClass;
      document.getElementById('modal-confirm').classList.add('open');
    });
  },

  accept() {
    document.getElementById('modal-confirm').classList.remove('open');
    if (this._resolve) { this._resolve(true); this._resolve = null; }
  },

  cancel() {
    document.getElementById('modal-confirm').classList.remove('open');
    if (this._resolve) { this._resolve(false); this._resolve = null; }
  }
};



function fmt(n) {
  if (n === null || n === undefined) return t('common.none');
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: _currency }).format(n);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function typeBadge(type) {
  const map = { Console: ['badge-console','🎮'], VideoGame: ['badge-game','💿'], Accessory: ['badge-accessory','🔌'] };
  const [cls, icon] = map[type] || ['badge','?'];
  const label = type === 'Console'
    ? t('status.console')
    : type === 'VideoGame'
      ? t('status.game')
      : t('status.accessory');
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function condBadge(cond) {
  const map = {
    New: ['badge-sold', t('status.new')],
    Used: ['badge-stock', t('status.used')],
    NeedsRepair: ['badge-repair', t('status.needsRepair')]
  };
  const [cls, label] = map[cond] || ['badge', cond];
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ═══════════════════════════════════════════
// TAGS — operaciones (después de App)
// ═══════════════════════════════════════════

App.tags = {
  get(prefix) {
    return Array.from(document.querySelectorAll(`#${prefix}-tags-wrap .tag`))
      .map(el => el.dataset.tag);
  },

  clear(prefix) {
    const wrap = document.getElementById(`${prefix}-tags-wrap`);
    if (!wrap) return;
    wrap.querySelectorAll('.tag').forEach(el => el.remove());
    const inp = document.getElementById(`${prefix}-tag-input`);
    if (inp) inp.value = '';
    const sug = document.getElementById(`${prefix}-tag-suggestions`);
    if (sug) { sug.innerHTML = ''; sug.classList.remove('open'); }
  },

  load(prefix, names) {
    App.tags.clear(prefix);
    const wrap = document.getElementById(`${prefix}-tags-wrap`);
    const inp  = document.getElementById(`${prefix}-tag-input`);
    if (!wrap || !inp) return;
    names.forEach(name => wrap.insertBefore(_parsePill(name), inp));
  },

  add(prefix, name) {
    name = name.trim().toLowerCase();
    if (!name) return;
    if (App.tags.get(prefix).includes(name)) return;
    const wrap = document.getElementById(`${prefix}-tags-wrap`);
    const inp  = document.getElementById(`${prefix}-tag-input`);
    if (!wrap || !inp) return;
    wrap.insertBefore(_parsePill(name), inp);
    inp.value = '';
    App.tags.hideSuggestions(prefix);
  },

  removePill(btn) { btn.closest('.tag').remove(); },

  onInput(prefix) {
    const inp = document.getElementById(`${prefix}-tag-input`);
    const raw = inp.value;

    // Detectar coma como separador (funciona en todos los teclados)
    if (raw.includes(',')) {
      const parts = raw.split(',');
      // Añadir todo excepto el último fragmento (que puede estar escribiéndose)
      parts.slice(0, -1).forEach(p => App.tags.add(prefix, p));
      inp.value = parts[parts.length - 1];
    }

    const val = inp.value.trim().toLowerCase();
    if (!val) { App.tags.hideSuggestions(prefix); return; }
    const existing = App.tags.get(prefix);
    const matches  = _allTags.filter(t => t.name.includes(val) && !existing.includes(t.name));
    App.tags.showSuggestions(prefix, val, matches);
  },

  onKey(e, prefix) {
    const inp = e.target;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const val = inp.value.trim();
      if (val) App.tags.add(prefix, val);
    } else if (e.key === 'Backspace' && !inp.value) {
      const pills = document.getElementById(`${prefix}-tags-wrap`)?.querySelectorAll('.tag');
      if (pills?.length) pills[pills.length - 1].remove();
    } else if (e.key === 'Escape') {
      App.tags.hideSuggestions(prefix);
    }
  },

  showSuggestions(prefix, val, matches) {
    const box = document.getElementById(`${prefix}-tag-suggestions`);
    if (!box) return;
    const items = matches.map(tag =>
      `<div class="tag-suggestion-item" onclick="App.tags.add('${prefix}','${escapeHtml(tag.name)}')">
         ${tagPillReadonly(tag.name)}
         <span class="tag-suggestion-count">${t('common.articleCount', tag.itemCount, tag.itemCount !== 1 ? 's' : '')}</span>
       </div>`
    );
    const exactExists = _allTags.some(t => t.name === val);
    if (!exactExists && val) {
      items.push(`<div class="tag-suggestion-item" onclick="App.tags.add('${prefix}','${escapeHtml(val)}')">
        <span style="color:var(--accent);font-size:0.8rem">${t('common.createTag', `<strong>${escapeHtml(val)}</strong>`)}</span>
       </div>`);
    }
    box.innerHTML = items.join('');
    box.classList.toggle('open', items.length > 0);
  },

  hideSuggestions(prefix) {
    const box = document.getElementById(`${prefix}-tag-suggestions`);
    if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  },
};

function _parsePill(name) {
  const span = document.createElement('span');
  span.className  = `tag ${tagColor(name)}`;
  span.dataset.tag = name;
  span.innerHTML  = `${escapeHtml(name)}<em class="tag-remove" onclick="App.tags.removePill(this)">✕</em>`;
  return span;
}

// Cerrar dropdowns al click fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.tag-filter-wrap'))
    document.getElementById('tagFilterDropdown')?.classList.remove('open');
  if (!e.target.closest('.pill-input-wrap') && !e.target.closest('.tag-suggestions')) {
    App.tags.hideSuggestions('item');
    App.tags.hideSuggestions('qa');
  }
});
