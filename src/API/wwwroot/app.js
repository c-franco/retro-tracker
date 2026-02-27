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
    filterSel.innerHTML = '<option value="">Todas las plataformas</option>' + options;
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
// INICIALIZACIÓN
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      App.showView(link.dataset.view);
    });
  });

  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => el.value = today);

  document.getElementById('sell-price').addEventListener('input', App.updateSellPreview);

  populatePlatformSelects();
  App.showView('dashboard');
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
    if (!fieldEl.value.trim()) { V.error(fieldEl, `${label} es obligatorio`); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Número estrictamente > 0 */
  requirePositive(fieldEl, label = 'El valor') {
    const val = parseFloat(fieldEl.value);
    if (isNaN(val) || val <= 0) { V.error(fieldEl, `${label} debe ser mayor que 0`); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Número >= 0 */
  requireNonNegative(fieldEl, label = 'El valor') {
    const val = parseFloat(fieldEl.value);
    if (isNaN(val) || val < 0) { V.error(fieldEl, `${label} no puede ser negativo`); return false; }
    V.clear(fieldEl);
    return true;
  },

  /** Fecha válida y no futura */
  requireDate(fieldEl, label = 'La fecha') {
    const val = fieldEl.value;
    if (!val) { V.error(fieldEl, `${label} es obligatoria`); return false; }
    const d = new Date(val);
    if (isNaN(d.getTime())) { V.error(fieldEl, `${label} no es válida`); return false; }
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d > tomorrow) { V.error(fieldEl, `${label} no puede ser futura`); return false; }
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
    if (view === 'inventory') App.loadInventory();
    if (view === 'lots')      App.loadLots();
    if (view === 'settings')  App.loadSettings();
    if (view === 'quick-add') App.loadRecentItems();
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  // ── Dashboard ───────────────────────────

  async loadDashboard() {
    try {
      const data = await App.get('/dashboard');

      document.getElementById('stat-invested').textContent    = fmt(data.totalInvested);
      document.getElementById('stat-revenue').textContent     = fmt(data.totalRevenue);
      document.getElementById('stat-profit').textContent      = fmt(data.totalProfit);
      document.getElementById('stat-balance').textContent     = fmt(data.currentBalance);
      document.getElementById('stat-stock-value').textContent = fmt(data.stockValue);
      document.getElementById('stat-stock-count').textContent = `${data.stockItems} artículo${data.stockItems !== 1 ? 's' : ''}`;
      document.getElementById('stat-collection-value').textContent = fmt(data.collectionValue);
      document.getElementById('stat-collection-count').textContent = `${data.collectionItems} artículo${data.collectionItems !== 1 ? 's' : ''}`;

      document.querySelector('.stat-card.profit .stat-value').style.color =
        data.totalProfit >= 0 ? 'var(--green)' : 'var(--red)';
      document.querySelector('.stat-card.balance .stat-value').style.color =
        data.currentBalance >= 0 ? 'var(--accent)' : 'var(--red)';

      App.renderMonthlyChart(data.monthlyStats);
      App.renderPlatformChart(data.platformStats);
      App.renderPendingTable(data.pendingItems);
      document.getElementById('pending-count').textContent = data.stockItems;
    } catch (e) {
      App.toast('Error cargando dashboard', 'error');
    }
  },

  renderMonthlyChart(stats) {
    const ctx = document.getElementById('chartMonthly').getContext('2d');
    if (chartMonthly) chartMonthly.destroy();
    chartMonthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stats.map(s => `${s.monthName.slice(0, 3)} ${s.year}`),
        datasets: [
          { label: 'Invertido',   data: stats.map(s => s.invested), backgroundColor: 'rgba(255,107,53,0.7)' },
          { label: 'Recuperado',  data: stats.map(s => s.revenue),  backgroundColor: 'rgba(0,255,136,0.7)' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#555' }, grid: { color: '#222' } },
          y: { ticks: { color: '#555', callback: v => `${v}€` }, grid: { color: '#222' } }
        }
      }
    });
  },

  renderPlatformChart(stats) {
    if (!stats.length) return;
    const ctx = document.getElementById('chartPlatform').getContext('2d');
    if (chartPlatform) chartPlatform.destroy();
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
    chartPlatform = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: stats.map(s => s.platform),
        datasets: [{ data: stats.map(s => s.totalItems), backgroundColor: colors, borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } } }
    });
  },

  renderPendingTable(items) {
    const tbody = document.querySelector('#pending-table tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#555;padding:2rem">Sin artículos pendientes 🎉</td></tr>';
      return;
    }
    const today = new Date();
    tbody.innerHTML = items.map(item => {
      const days = Math.floor((today - new Date(item.purchaseDate)) / 86400000);
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.platform || '—'}</td>
        <td>${typeBadge(item.type)}</td>
        <td class="neutral">${fmt(item.totalCost)}</td>
        <td style="color:${days > 60 ? '#ff4444' : '#888'}">${days}d</td>
        <td><button class="btn-icon" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})" title="Vender">💰</button></td>
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

    try {
      const items = await App.get(`/items?${params}`);
      App.renderInventoryTable(items);
    } catch (e) {
      App.toast('Error cargando inventario', 'error');
    }
  },

  renderInventoryTable(items) {
    const tbody = document.querySelector('#inventory-table tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#555;padding:2rem">Sin artículos</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => {
      const profit = item.profit !== null
        ? `<span class="${item.profit >= 0 ? 'positive' : 'negative'}">${fmt(item.profit)}</span>`
        : '<span class="neutral">—</span>';
      const collectionBadge = item.isCollection
        ? '<span class="badge badge-collection">⭐</span>&nbsp;'
        : '';
      return `<tr class="${item.isCollection ? 'row-collection' : ''}">
        <td>${collectionBadge}<strong>${escapeHtml(item.name)}</strong></td>
        <td>${typeBadge(item.type)}</td>
        <td><span class="badge">${item.platform || '—'}</span></td>
        <td>${item.lotName ? `<span class="badge">${escapeHtml(item.lotName)}</span>` : '<span style="color:#555">—</span>'}</td>
        <td class="neutral">${fmt(item.totalCost)}</td>
        <td>${item.salePrice ? fmt(item.salePrice) : '<span style="color:#555">—</span>'}</td>
        <td>${profit}</td>
        <td class="neutral" style="font-size:0.78rem">${fmtDate(item.purchaseDate)}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${!item.isSold && !item.isCollection
              ? `<button class="btn-icon" title="Vender" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰</button>`
              : item.isSold ? `<button class="btn-icon" title="Deshacer venta" onclick="App.unsell(${item.id})">↩️</button>` : ''
            }
            <button class="btn-icon" title="${item.isCollection ? 'Mover a stock' : 'Mover a colección'}" onclick="App.toggleCollection(${item.id},${item.isCollection})">${item.isCollection ? '📦' : '⭐'}</button>
            <button class="btn-icon" title="Editar"   onclick="App.openItemModal(${item.id})">✏️</button>
            <button class="btn-icon" title="Eliminar" onclick="App.deleteItem(${item.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  // ── Modal Artículo ───────────────────────

  async openItemModal(itemId = null) {
    currentItemId = itemId;
    document.getElementById('modal-item-title').textContent = itemId ? 'Editar Artículo' : 'Añadir Artículo';
    V.clearAll(document.getElementById('modal-item'));


    const lots = await App.get('/lots');
    const lotSel = document.getElementById('item-lot-id');
    lotSel.innerHTML = '<option value="">Sin lote</option>' +
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
    } else {
      ['item-id','item-name','item-notes'].forEach(id => document.getElementById(id).value = '');
      document.getElementById('item-platform').value       = '';
      document.getElementById('item-purchase-price').value = '';
      document.getElementById('item-shipping').value       = '0';
      document.getElementById('item-purchase-date').value  = new Date().toISOString().split('T')[0];
      document.getElementById('item-lot-id').value         = '';
      document.getElementById('item-is-collection').checked = false;
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
    ok = V.requireText(nameEl,         'El nombre')             && ok;
    ok = V.requireText(platformEl,     'La plataforma')         && ok;
    ok = V.requirePositive(priceEl,    'El precio de compra')   && ok;
    ok = V.requireNonNegative(shipEl,  'Los gastos de envío')   && ok;
    ok = V.requireDate(dateEl,         'La fecha de compra')    && ok;
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
      isCollection:  document.getElementById('item-is-collection').checked
    };
  },

  async saveItem() {
    const body = App._validateItemForm();
    if (!body) return;
    const id = document.getElementById('item-id').value;
    try {
      if (id) { await App.put(`/items/${id}`, body);  App.toast('Artículo actualizado ✅'); }
      else    { await App.post('/items', body);         App.toast('Artículo añadido ✅'); }
      App.closeModal('modal-item');
      App.loadInventory();
    } catch (e) {
      App.toast('Error guardando artículo', 'error');
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
      `<span class="neutral">Coste total: ${fmt(cost)}</span>`;
    V.watch(document.getElementById('sell-price'));
    V.watch(document.getElementById('sell-date'));
    App.openModal('modal-sell');
  },

  updateSellPreview() {
    const price = parseFloat(document.getElementById('sell-price').value) || 0;
    const profit = price - currentSellCost;
    const cls = profit >= 0 ? 'positive' : 'negative';
    document.getElementById('sell-profit-preview').innerHTML =
      `Beneficio estimado: <span class="${cls}">${fmt(profit)}</span>`;
  },

  async confirmSell() {
    const priceEl = document.getElementById('sell-price');
    const dateEl  = document.getElementById('sell-date');
    let ok = true;
    ok = V.requirePositive(priceEl, 'El precio de venta') && ok;
    ok = V.requireDate(dateEl,      'La fecha de venta')  && ok;
    if (!ok) return;

    const id = document.getElementById('sell-item-id').value;
    try {
      await App.post(`/items/${id}/sell`, { salePrice: parseFloat(priceEl.value), saleDate: dateEl.value });
      App.toast('Venta registrada 💰');
      App.closeModal('modal-sell');
      App.loadInventory();
      App.loadDashboard();
    } catch (e) {
      App.toast('Error registrando venta', 'error');
    }
  },

  async unsell(id) {
    if (!confirm('¿Deshacer la venta de este artículo?')) return;
    try {
      await App.post(`/items/${id}/unsell`, {});
      App.toast('Venta deshecha ↩️');
      App.loadInventory();
    } catch (e) {
      App.toast('Error deshaciendo venta', 'error');
    }
  },

  async toggleCollection(id, currentValue) {
    try {
      await App.put(`/items/${id}`, { isCollection: !currentValue });
      App.toast(!currentValue ? '⭐ Movido a colección' : '📦 Movido a stock');
      App.loadInventory();
    } catch (e) {
      App.toast('Error actualizando artículo', 'error');
    }
  },

  async deleteItem(id) {
    if (!confirm('¿Eliminar este artículo? Esta acción no se puede deshacer.')) return;
    try {
      await App.delete(`/items/${id}`);
      App.toast('Artículo eliminado 🗑️');
      App.loadInventory();
    } catch (e) {
      App.toast('Error eliminando artículo', 'error');
    }
  },

  // ── Lotes ───────────────────────────────

  async loadLots() {
    try {
      const lots = await App.get('/lots');
      const grid = document.getElementById('lots-grid');
      if (!lots.length) {
        grid.innerHTML = '<p style="color:#555">No hay lotes. ¡Crea el primero!</p>';
        return;
      }
      grid.innerHTML = lots.map(lot => {
        const profitCls = lot.totalProfit >= 0 ? 'positive' : 'negative';
        return `<div class="lot-card">
          <div class="lot-card-header">
            <div class="lot-card-title">🎁 ${escapeHtml(lot.name)}</div>
            <div class="lot-card-actions">
              <button class="btn-sm" onclick="App.openAddToLotModal(${lot.id},'${escapeHtml(lot.name)}')">+ Artículo</button>
              <button class="btn-icon" onclick="App.openEditLotModal(${lot.id},'${escapeHtml(lot.name)}','${lot.purchaseDate.split('T')[0]}','${escapeHtml(lot.notes||'')}')">✏️</button>
              <button class="btn-icon" onclick="App.deleteLot(${lot.id})">🗑️</button>
            </div>
          </div>
          <div class="lot-card-meta">${fmtDate(lot.purchaseDate)}${lot.notes ? ` — ${escapeHtml(lot.notes)}` : ''}</div>
          <div class="lot-card-stats">
            <div class="lot-stat"><div class="lot-stat-value">${fmt(lot.totalCost)}</div><div class="lot-stat-label">Invertido</div></div>
            <div class="lot-stat"><div class="lot-stat-value">${fmt(lot.totalRevenue)}</div><div class="lot-stat-label">Recuperado</div></div>
            <div class="lot-stat"><div class="lot-stat-value ${profitCls}">${fmt(lot.totalProfit)}</div><div class="lot-stat-label">Beneficio</div></div>
          </div>
          <div class="lot-items-preview">
            ${lot.items.map(item => `
              <div class="lot-item-row ${item.isSold ? 'sold' : ''}">
                <span>${typeBadge(item.type)} ${escapeHtml(item.name)}</span>
                <span style="display:flex;gap:6px;align-items:center">
                  <span class="neutral">${fmt(item.totalCost)}</span>
                  ${item.isSold
                    ? `<span class="positive">${fmt(item.salePrice)}</span>`
                    : `<button class="btn-icon" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰</button>`
                  }
                </span>
              </div>`).join('')}
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      App.toast('Error cargando lotes', 'error');
    }
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
      <label style="font-size:0.78rem">Tipo
        <select data-field="type">
          <option value="Console">Consola</option>
          <option value="VideoGame">Juego</option>
          <option value="Accessory">Accesorio</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma *
        <select data-field="platform"><option value="">— Selecciona —</option></select>
      </label>
      <label style="font-size:0.78rem">Precio €
        <input type="number" step="0.01" min="0" placeholder="0.00" data-field="price"
               oninput="App.recalcLotItems()" />
      </label>
      <label style="font-size:0.78rem">Envío €
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
    if (!rows.length) { document.getElementById("lot-total-info").innerHTML = "<strong>Total artículos: 0</strong>"; return; }

    const priceSum = Array.from(rows)
      .map(r => parseFloat(r.querySelector('[data-field="price"]')?.value) || 0)
      .reduce((a, b) => a + b, 0);

    let info = `<strong>Total artículos: ${rows.length}</strong>`;
    if (priceSum > 0 && Math.abs(priceSum - totalPrice) > 0.01) {
      info += ` — <span style="color:#ff4444">⚠️ Suma: ${fmt(priceSum)} ≠ total: ${fmt(totalPrice)}</span>`;
    } else if (priceSum === 0 && totalPrice > 0) {
      const perItem = Math.round(totalPrice    / rows.length * 100) / 100;
      const perShip = Math.round(totalShipping / rows.length * 100) / 100;
      info += ` — Reparto equitativo: ${fmt(perItem)}/art + ${fmt(perShip)}/envío`;
    }
    document.getElementById('lot-total-info').innerHTML = info;
  },

  _validateLotForm() {
    const nameEl  = document.getElementById('lot-name');
    const priceEl = document.getElementById('lot-price');
    const shipEl  = document.getElementById('lot-shipping');
    const dateEl  = document.getElementById('lot-date');

    let ok = true;
    ok = V.requireText(nameEl,         'El nombre del lote') && ok;
    ok = V.requireNonNegative(priceEl, 'El precio total')    && ok;
    ok = V.requireNonNegative(shipEl,  'El envío total')     && ok;
    ok = V.requireDate(dateEl,         'La fecha')           && ok;

    const rows = document.querySelectorAll('#lot-items-list .lot-item-form-row');
    if (!rows.length) { App.toast('Añade al menos un artículo al lote', 'error'); ok = false; }

    rows.forEach(row => {
      const n = row.querySelector('[data-field="name"]');
      const p = row.querySelector('[data-field="price"]');
      const s = row.querySelector('[data-field="shipping"]');
      const pl = row.querySelector('[data-field="platform"]');
      if (!n.value.trim()) { V.error(n, 'Nombre obligatorio'); ok = false; }
      if (!pl.value.trim()) { V.error(pl, 'Plataforma obligatoria'); ok = false; }
      if (isNaN(parseFloat(p.value)) || parseFloat(p.value) < 0) { V.error(p, 'Precio inválido'); ok = false; }
      if (isNaN(parseFloat(s.value)) || parseFloat(s.value) < 0) { V.error(s, 'Envío inválido');  ok = false; }
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
          condition:     'Used',
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
      App.toast('Lote creado 🎁');
      App.closeModal('modal-lot');
      App.loadLots();
    } catch (e) {
      App.toast('Error creando lote', 'error');
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
    ok = V.requireText(nameEl, 'El nombre') && ok;
    ok = V.requireDate(dateEl, 'La fecha')  && ok;
    if (!ok) return;

    const id = document.getElementById('edit-lot-id').value;
    try {
      await App.put(`/lots/${id}`, {
        name:         nameEl.value.trim(),
        notes:        document.getElementById('edit-lot-notes').value.trim(),
        purchaseDate: dateEl.value || null
      });
      App.toast('Lote actualizado ✅');
      App.closeModal('modal-edit-lot');
      App.loadLots();
    } catch (e) {
      App.toast('Error actualizando lote', 'error');
    }
  },

  // ── Añadir artículos a lote ──────────────

  openAddToLotModal(lotId, lotName) {
    V.clearAll(document.getElementById('modal-add-to-lot'));

    document.getElementById('add-to-lot-id').value = lotId;
    document.getElementById('add-to-lot-subtitle').textContent = `Lote: ${lotName}`;
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
      <label style="font-size:0.78rem">Nombre *
        <input type="text" placeholder="Ej: Nintendo DS Lite" data-field="name" />
      </label>
      <label style="font-size:0.78rem">Tipo
        <select data-field="type">
          <option value="Console">Consola</option>
          <option value="VideoGame">Juego</option>
          <option value="Accessory">Accesorio</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma *
        <select data-field="platform"><option value="">— Selecciona —</option></select>
      </label>
      <label style="font-size:0.78rem">Condición
        <select data-field="condition">
          <option value="Used">Usado</option>
          <option value="New">Nuevo</option>
          <option value="NeedsRepair">Reparar</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Precio €
        <input type="number" step="0.01" min="0" placeholder="0.00" data-field="price" />
      </label>
      <label style="font-size:0.78rem">Envío €
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
    if (!rows.length) { App.toast('Añade al menos un artículo', 'error'); return; }

    let ok = true;
    rows.forEach(row => {
      const n = row.querySelector('[data-field="name"]');
      const p = row.querySelector('[data-field="price"]');
      const s = row.querySelector('[data-field="shipping"]');
      const pl = row.querySelector('[data-field="platform"]');
      if (!n.value.trim()) { V.error(n, 'Nombre obligatorio'); ok = false; }
      if (!pl.value.trim()) { V.error(pl, 'Plataforma obligatoria'); ok = false; }
      if (isNaN(parseFloat(p.value)) || parseFloat(p.value) < 0) { V.error(p, 'Precio inválido'); ok = false; }
      if (isNaN(parseFloat(s.value)) || parseFloat(s.value) < 0) { V.error(s, 'Envío inválido');  ok = false; }
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
      App.toast(`✅ ${items.length} artículo(s) añadido(s) al lote`);
      App.closeModal('modal-add-to-lot');
      App.loadLots();
    } catch (e) {
      App.toast('Error añadiendo artículos', 'error');
    }
  },

  async deleteLot(id) {
    if (!confirm('¿Eliminar el lote y todos sus artículos no vendidos?')) return;
    try {
      await App.delete(`/lots/${id}`);
      App.toast('Lote eliminado');
      App.loadLots();
    } catch (e) {
      App.toast('No se puede eliminar: hay artículos vendidos', 'error');
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
    ok = V.requireText(nameEl,         'El nombre')           && ok;
    ok = V.requireText(platformEl,     'La plataforma')       && ok;
    ok = V.requirePositive(priceEl,    'El precio de compra') && ok;
    ok = V.requireNonNegative(shipEl,  'Los gastos de envío') && ok;
    ok = V.requireDate(dateEl,         'La fecha de compra')  && ok;
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
      isCollection:  document.getElementById('qa-collection')?.checked || false
    };
  },

  async quickAdd() {
    const item = App._validateQuickForm();
    if (!item) return;
    try {
      const created = await App.post('/items', item);
      App.toast(`✅ ${created.name} añadido`);
      App.clearQuickForm();
      App.loadRecentItems();
    } catch (e) {
      App.toast('Error al añadir', 'error');
    }
  },

  async quickAddAndSell() {
    const item = App._validateQuickForm();
    if (!item) return;

    const salePriceStr = prompt('¿Precio de venta? (€)');
    if (salePriceStr === null) return;
    const salePrice = parseFloat(salePriceStr);
    if (isNaN(salePrice) || salePrice <= 0) {
      App.toast('El precio de venta debe ser mayor que 0', 'error');
      return;
    }
    try {
      const created = await App.post('/items', item);
      await App.post(`/items/${created.id}/sell`, { salePrice, saleDate: item.purchaseDate });
      App.toast(`✅ ${created.name} añadido y vendido`);
      App.clearQuickForm();
      App.loadRecentItems();
    } catch (e) {
      App.toast('Error', 'error');
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
          <button class="btn-sm" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰 Vender</button>
        </div>
      `).join('') || '<p style="color:#555">Sin artículos en stock</p>';
    } catch (e) {}
  },

  // ── Ajustes ──────────────────────────────

  async loadSettings() {
    const s = await App.get('/settings');
    document.getElementById('settings-balance').value  = s.initialBalance;
    document.getElementById('settings-currency').value = s.currency;
    document.getElementById('settings-platforms').value = getPlatforms().join('\n');
    V.watch(document.getElementById('settings-balance'));
    V.watch(document.getElementById('settings-currency'));
  },

  async saveAllSettings() {
    // ── Validar plataformas ──
    const raw = document.getElementById('settings-platforms').value;
    const platforms = raw.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (platforms.length === 0) {
      App.showFeedback('settings-feedback', '⚠️ Añade al menos una plataforma', 'error');
      return;
    }

    // ── Validar configuración financiera ──
    const balanceEl  = document.getElementById('settings-balance');
    const currencyEl = document.getElementById('settings-currency');
    let ok = true;
    ok = V.requireNonNegative(balanceEl,  'El saldo inicial') && ok;
    ok = V.requireText(currencyEl,        'La moneda')        && ok;
    if (!ok) return;

    try {
      // Guardar ajustes financieros en el servidor
      await App.put('/settings', {
        initialBalance: parseFloat(balanceEl.value) || 0,
        currency:       currencyEl.value.trim().toUpperCase()
      });

      // Guardar plataformas en localStorage
      localStorage.setItem('rtPlatforms', JSON.stringify(platforms));
      ['qa-platform', 'item-platform'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      populatePlatformSelects();

      App.showFeedback('settings-feedback', 'Ajustes guardados ✅', 'success');
    } catch (e) {
      App.showFeedback('settings-feedback', 'Error guardando ajustes', 'error');
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

    App.toast('Importando...');
    try {
      const r = await fetch('/api/import/excel', { method: 'POST', body: formData });
      const data = await r.json();

      if (r.ok) {
        App.toast(data.message, 'success');
        App.loadInventory();
        App.loadDashboard();
      } else {
        const lines = (data.errors || [])
          .map(e => `Fila ${e.fila} · ${e.columna}: "${e.valor}" — ${e.motivo}`)
          .join('\n');
        alert('Importación cancelada.\n\n' + (lines || data.error));
      }
    } catch (e) {
      App.toast('Error de conexión al importar', 'error');
    }
  },

  // ── Modal helpers ────────────────────────

  openModal(id)  { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── HTTP helpers ─────────────────────────

  async get(path) {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error(r.status);
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
// UTILIDADES
// ═══════════════════════════════════════════

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function typeBadge(type) {
  const map = { Console: ['badge-console','🎮'], VideoGame: ['badge-game','💿'], Accessory: ['badge-accessory','🔌'] };
  const [cls, icon] = map[type] || ['badge','?'];
  return `<span class="badge ${cls}">${icon} ${type==='Console'?'Consola':type==='VideoGame'?'Juego':'Accesorio'}</span>`;
}

function condBadge(cond) {
  const map = { New: ['badge-sold','✨ Nuevo'], Used: ['badge-stock','📦 Usado'], NeedsRepair: ['badge-repair','🔧 Reparar'] };
  const [cls, label] = map[cond] || ['badge', cond];
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
