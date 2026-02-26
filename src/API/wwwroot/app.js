/**
 * RetroGame Tracker — Frontend SPA
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
// INICIALIZACIÓN
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Navegación
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      App.showView(link.dataset.view);
    });
  });

  // Fecha por defecto = hoy
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(el => el.value = today);

  // Calcular beneficio en tiempo real en modal venta
  document.getElementById('sell-price').addEventListener('input', App.updateSellPreview);

  App.showView('dashboard');
});

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

    // Cerrar sidebar en móvil
    document.getElementById('sidebar').classList.remove('open');

    if (view === 'dashboard') App.loadDashboard();
    if (view === 'inventory') App.loadInventory();
    if (view === 'lots') App.loadLots();
    if (view === 'settings') App.loadSettings();
    if (view === 'quick-add') App.loadRecentItems();
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  // ── Dashboard ───────────────────────────

  async loadDashboard() {
    try {
      const data = await App.get('/dashboard');

      // Stat cards
      document.getElementById('stat-invested').textContent = fmt(data.totalInvested);
      document.getElementById('stat-revenue').textContent = fmt(data.totalRevenue);
      document.getElementById('stat-profit').textContent = fmt(data.totalProfit);
      document.getElementById('stat-balance').textContent = fmt(data.currentBalance);
      document.getElementById('stat-stock-value').textContent = fmt(data.stockValue);
      document.getElementById('stat-items').textContent =
        `${data.soldItems}/${data.totalItems}`;

      // Badge balance
      const badge = document.getElementById('dash-balance-badge');
      badge.textContent = data.isPositive ? '✅ En positivo' : '🔴 En negativo';
      badge.className = `subtitle ${data.isPositive ? 'positive' : 'negative'}`;

      // Profit card color
      const profitCard = document.querySelector('.stat-card.profit .stat-value');
      profitCard.className = `stat-value ${data.totalProfit >= 0 ? 'positive' : 'negative'}`;

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
          {
            label: 'Invertido',
            data: stats.map(s => s.invested),
            backgroundColor: 'rgba(255,107,53,0.7)',
          },
          {
            label: 'Recuperado',
            data: stats.map(s => s.revenue),
            backgroundColor: 'rgba(0,255,136,0.7)',
          }
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

    const colors = ['#00ff88','#ff6b35','#ffd60a','#00b4d8','#9d4edd','#f72585'];

    chartPlatform = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: stats.map(s => s.platform),
        datasets: [{
          data: stats.map(s => s.totalItems),
          backgroundColor: colors.slice(0, stats.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } }
      }
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
        <td>
          <button class="btn-icon" onclick="App.openSellModal(${item.id}, '${escapeHtml(item.name)}', ${item.totalCost})" title="Vender">💰</button>
        </td>
      </tr>`;
    }).join('');
  },

  // ── Inventario ──────────────────────────

  async loadInventory() {
    const search = document.getElementById('search-input')?.value || '';
    const platform = document.getElementById('filter-platform')?.value || '';
    const type = document.getElementById('filter-type')?.value || '';
    const isSold = document.getElementById('filter-status')?.value || '';

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (platform) params.set('platform', platform);
    if (type) params.set('type', type);
    if (isSold !== '') params.set('isSold', isSold);

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
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#555;padding:2rem">Sin artículos</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => {
      const profit = item.profit !== null
        ? `<span class="${item.profit >= 0 ? 'positive' : 'negative'}">${fmt(item.profit)}</span>`
        : '<span class="neutral">—</span>';

      return `<tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${typeBadge(item.type)}</td>
        <td><span class="badge">${item.platform || '—'}</span></td>
        <td>${condBadge(item.condition)}</td>
        <td>${item.lotName ? `<span class="badge">${escapeHtml(item.lotName)}</span>` : '<span style="color:#555">—</span>'}</td>
        <td class="neutral">${fmt(item.totalCost)}</td>
        <td>${item.salePrice ? fmt(item.salePrice) : '<span style="color:#555">—</span>'}</td>
        <td>${profit}</td>
        <td class="neutral" style="font-size:0.78rem">${fmtDate(item.purchaseDate)}</td>
        <td>
          <div style="display:flex;gap:4px">
            ${!item.isSold
              ? `<button class="btn-icon" title="Vender" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})">💰</button>`
              : `<button class="btn-icon" title="Deshacer venta" onclick="App.unsell(${item.id})">↩️</button>`
            }
            <button class="btn-icon" title="Editar" onclick="App.openItemModal(${item.id})">✏️</button>
            <button class="btn-icon" title="Eliminar" onclick="App.deleteItem(${item.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  // ── Modal Artículo ───────────────────────

  async openItemModal(itemId = null) {
    currentItemId = itemId;
    document.getElementById('modal-item-title').textContent =
      itemId ? 'Editar Artículo' : 'Añadir Artículo';

    // Poblar selector de lotes
    const lots = await App.get('/lots');
    const lotSel = document.getElementById('item-lot-id');
    lotSel.innerHTML = '<option value="">Sin lote</option>' +
      lots.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');

    if (itemId) {
      const item = await App.get(`/items/${itemId}`);
      document.getElementById('item-id').value = item.id;
      document.getElementById('item-name').value = item.name;
      document.getElementById('item-platform').value = item.platform || '';
      document.getElementById('item-type').value = item.type;
      document.getElementById('item-condition').value = item.condition;
      document.getElementById('item-purchase-price').value = item.purchasePrice;
      document.getElementById('item-shipping').value = item.shippingCost;
      document.getElementById('item-purchase-date').value = item.purchaseDate.split('T')[0];
      document.getElementById('item-lot-id').value = item.lotId || '';
      document.getElementById('item-notes').value = item.notes || '';
    } else {
      document.getElementById('item-id').value = '';
      document.getElementById('item-name').value = '';
      document.getElementById('item-platform').value = '';
      document.getElementById('item-purchase-price').value = '';
      document.getElementById('item-shipping').value = '0';
      document.getElementById('item-purchase-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('item-lot-id').value = '';
      document.getElementById('item-notes').value = '';
    }

    App.openModal('modal-item');
  },

  async saveItem() {
    const id = document.getElementById('item-id').value;
    const body = {
      name: document.getElementById('item-name').value,
      platform: document.getElementById('item-platform').value,
      type: document.getElementById('item-type').value,
      condition: document.getElementById('item-condition').value,
      purchasePrice: parseFloat(document.getElementById('item-purchase-price').value) || 0,
      shippingCost: parseFloat(document.getElementById('item-shipping').value) || 0,
      purchaseDate: document.getElementById('item-purchase-date').value,
      lotId: document.getElementById('item-lot-id').value || null,
      notes: document.getElementById('item-notes').value
    };

    if (!body.name) { App.toast('El nombre es obligatorio', 'error'); return; }

    try {
      if (id) {
        await App.put(`/items/${id}`, body);
        App.toast('Artículo actualizado ✅');
      } else {
        await App.post('/items', body);
        App.toast('Artículo añadido ✅');
      }
      App.closeModal('modal-item');
      App.loadInventory();
    } catch (e) {
      App.toast('Error guardando artículo', 'error');
    }
  },

  // ── Venta ───────────────────────────────

  openSellModal(itemId, name, cost) {
    document.getElementById('sell-item-id').value = itemId;
    document.getElementById('sell-item-name').textContent = name;
    document.getElementById('sell-price').value = '';
    document.getElementById('sell-date').value = new Date().toISOString().split('T')[0];
    currentSellCost = cost;
    document.getElementById('sell-profit-preview').innerHTML =
      `<span class="neutral">Coste total: ${fmt(cost)}</span>`;
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
    const id = document.getElementById('sell-item-id').value;
    const price = parseFloat(document.getElementById('sell-price').value);
    if (!price) { App.toast('Introduce el precio de venta', 'error'); return; }

    try {
      await App.post(`/items/${id}/sell`, {
        salePrice: price,
        saleDate: document.getElementById('sell-date').value
      });
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
            <div>
              <div class="lot-card-title">🎁 ${escapeHtml(lot.name)}</div>
              <div class="lot-card-meta">${fmtDate(lot.purchaseDate)}${lot.notes ? ` — ${escapeHtml(lot.notes)}` : ''}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="btn-sm" onclick="App.openAddToLotModal(${lot.id}, '${escapeHtml(lot.name)}')" title="Añadir artículo al lote">+ Artículo</button>
              <button class="btn-icon" onclick="App.deleteLot(${lot.id})" title="Eliminar lote">🗑️</button>
            </div>
          </div>
          <div class="lot-card-stats">
            <div class="lot-stat">
              <div class="lot-stat-value">${fmt(lot.totalCost)}</div>
              <div class="lot-stat-label">Invertido</div>
            </div>
            <div class="lot-stat">
              <div class="lot-stat-value">${fmt(lot.totalRevenue)}</div>
              <div class="lot-stat-label">Recuperado</div>
            </div>
            <div class="lot-stat">
              <div class="lot-stat-value ${profitCls}">${fmt(lot.totalProfit)}</div>
              <div class="lot-stat-label">Beneficio</div>
            </div>
          </div>
          <div class="lot-items-preview">
            ${lot.items.map(item => `
              <div class="lot-item-row ${item.isSold ? 'sold' : ''}">
                <span>${typeBadge(item.type)} ${escapeHtml(item.name)}</span>
                <span style="display:flex;gap:6px;align-items:center">
                  <span class="neutral">${fmt(item.totalCost)}</span>
                  ${item.isSold
                    ? `<span class="positive">${fmt(item.salePrice)}</span>`
                    : `<button class="btn-icon" onclick="App.openSellModal(${item.id},'${escapeHtml(item.name)}',${item.totalCost})" title="Vender">💰</button>`
                  }
                </span>
              </div>
            `).join('')}
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
    document.getElementById('lot-name').value = '';
    document.getElementById('lot-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('lot-price').value = '';
    document.getElementById('lot-shipping').value = '0';
    document.getElementById('lot-notes').value = '';
    document.getElementById('lot-items-list').innerHTML = '';
    document.getElementById('lot-total-info').innerHTML = '';

    // Añadir 2 items por defecto
    App.addLotItem();
    App.addLotItem();
    App.openModal('modal-lot');
  },

  addLotItem() {
    lotItemCount++;
    const row = document.createElement('div');
    row.className = 'lot-item-form-row';
    row.id = `lot-item-${lotItemCount}`;
    row.innerHTML = `
      <label style="font-size:0.78rem">Nombre
        <input type="text" placeholder="Ej: Nintendo DSi" data-field="name" />
      </label>
      <label style="font-size:0.78rem">Tipo
        <select data-field="type">
          <option value="Console">Consola</option>
          <option value="VideoGame">Juego</option>
          <option value="Accessory">Accesorio</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma
        <input type="text" placeholder="DS" data-field="platform" list="platforms-list" />
      </label>
      <label style="font-size:0.78rem">Precio €
        <input type="number" step="0.01" placeholder="0" data-field="price"
               oninput="App.recalcLotItems()" />
      </label>
      <label style="font-size:0.78rem">Envío €
        <input type="number" step="0.01" placeholder="0" data-field="shipping" />
      </label>
      <button class="btn-icon" style="margin-top:1.4rem"
              onclick="document.getElementById('lot-item-${lotItemCount}').remove();App.recalcLotItems()">✕</button>
    `;
    document.getElementById('lot-items-list').appendChild(row);
  },

  recalcLotItems() {
    const totalPrice = parseFloat(document.getElementById('lot-price').value) || 0;
    const totalShipping = parseFloat(document.getElementById('lot-shipping').value) || 0;
    const rows = document.querySelectorAll('#lot-items-list .lot-item-form-row');
    if (!rows.length) return;

    const itemPrices = Array.from(rows).map(r =>
      parseFloat(r.querySelector('[data-field="price"]')?.value) || 0
    );
    const priceSum = itemPrices.reduce((a, b) => a + b, 0);

    let info = `<strong>Total artículos: ${rows.length}</strong>`;
    if (priceSum > 0 && Math.abs(priceSum - totalPrice) > 0.01) {
      info += ` — <span style="color:#ff4444">⚠️ Suma precios: ${fmt(priceSum)} ≠ total: ${fmt(totalPrice)}</span>`;
    } else if (priceSum === 0 && totalPrice > 0) {
      const perItem = Math.round(totalPrice / rows.length * 100) / 100;
      const perShip = Math.round(totalShipping / rows.length * 100) / 100;
      info += ` — Reparto equitativo: ${fmt(perItem)}/art + ${fmt(perShip)}/envío`;
    }
    document.getElementById('lot-total-info').innerHTML = info;
  },

  async saveLot() {
    const name = document.getElementById('lot-name').value;
    if (!name) { App.toast('El nombre del lote es obligatorio', 'error'); return; }

    const rows = document.querySelectorAll('#lot-items-list .lot-item-form-row');
    if (!rows.length) { App.toast('Añade al menos un artículo', 'error'); return; }

    const items = Array.from(rows).map(r => ({
      name: r.querySelector('[data-field="name"]').value || 'Sin nombre',
      type: r.querySelector('[data-field="type"]').value,
      platform: r.querySelector('[data-field="platform"]').value,
      condition: 'Used',
      purchasePrice: parseFloat(r.querySelector('[data-field="price"]').value) || 0,
      shippingCost: parseFloat(r.querySelector('[data-field="shipping"]').value) || 0
    }));

    const body = {
      name,
      notes: document.getElementById('lot-notes').value,
      purchaseDate: document.getElementById('lot-date').value,
      totalPurchasePrice: parseFloat(document.getElementById('lot-price').value) || 0,
      totalShippingCost: parseFloat(document.getElementById('lot-shipping').value) || 0,
      items
    };

    try {
      await App.post('/lots', body);
      App.toast('Lote creado 🎁');
      App.closeModal('modal-lot');
      App.loadLots();
    } catch (e) {
      App.toast('Error creando lote', 'error');
    }
  },


  // ── Añadir artículos a lote existente ──

  openAddToLotModal(lotId, lotName) {
    document.getElementById('add-to-lot-id').value = lotId;
    document.getElementById('add-to-lot-subtitle').textContent = `Lote: ${lotName}`;
    document.getElementById('add-to-lot-items-list').innerHTML = '';
    App._addToLotCount = 0;
    App.addItemToLotForm();  // Empezar con 1 fila vacía
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
      <label style="font-size:0.78rem">Nombre
        <input type="text" placeholder="Ej: Nintendo DS Lite" data-field="name" />
      </label>
      <label style="font-size:0.78rem">Tipo
        <select data-field="type">
          <option value="Console">Consola</option>
          <option value="VideoGame">Juego</option>
          <option value="Accessory">Accesorio</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Plataforma
        <input type="text" placeholder="DS" data-field="platform" list="platforms-list" />
      </label>
      <label style="font-size:0.78rem">Condición
        <select data-field="condition">
          <option value="Used">Usado</option>
          <option value="New">Nuevo</option>
          <option value="NeedsRepair">Reparar</option>
        </select>
      </label>
      <label style="font-size:0.78rem">Precio €
        <input type="number" step="0.01" placeholder="0.00" data-field="price" />
      </label>
      <label style="font-size:0.78rem">Envío €
        <input type="number" step="0.01" placeholder="0.00" value="0" data-field="shipping" />
      </label>
      <button class="btn-icon" style="margin-top:1.4rem"
              onclick="document.getElementById('atl-item-${idx}').remove()" title="Quitar">✕</button>
    `;
    document.getElementById('add-to-lot-items-list').appendChild(row);
  },

  async saveAddToLot() {
    const lotId = document.getElementById('add-to-lot-id').value;
    const rows = document.querySelectorAll('#add-to-lot-items-list .lot-item-form-row');

    if (!rows.length) { App.toast('Añade al menos un artículo', 'error'); return; }

    const items = Array.from(rows).map(r => ({
      name: r.querySelector('[data-field="name"]').value || 'Sin nombre',
      type: r.querySelector('[data-field="type"]').value,
      platform: r.querySelector('[data-field="platform"]').value,
      condition: r.querySelector('[data-field="condition"]').value,
      purchasePrice: parseFloat(r.querySelector('[data-field="price"]').value) || 0,
      shippingCost: parseFloat(r.querySelector('[data-field="shipping"]').value) || 0
    }));

    const invalid = items.filter(i => !i.name || i.name === 'Sin nombre');
    if (invalid.length) { App.toast('Todos los artículos deben tener nombre', 'error'); return; }

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

  async quickAdd() {
    const item = App.buildQuickItem();
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
    const item = App.buildQuickItem();
    if (!item) return;
    const salePrice = parseFloat(prompt('¿Precio de venta?'));
    if (!salePrice) return;

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

  buildQuickItem() {
    const name = document.getElementById('qa-name').value;
    const price = parseFloat(document.getElementById('qa-price').value);
    if (!name || !price) {
      App.showFeedback('qa-feedback', 'Nombre y precio son obligatorios', 'error');
      return null;
    }
    return {
      name,
      platform: document.getElementById('qa-platform').value,
      type: document.getElementById('qa-type').value,
      condition: document.getElementById('qa-condition').value,
      purchasePrice: price,
      shippingCost: parseFloat(document.getElementById('qa-shipping').value) || 0,
      purchaseDate: document.getElementById('qa-date').value,
      notes: document.getElementById('qa-notes').value
    };
  },

  clearQuickForm() {
    document.getElementById('qa-name').value = '';
    document.getElementById('qa-platform').value = '';
    document.getElementById('qa-price').value = '';
    document.getElementById('qa-shipping').value = '0';
    document.getElementById('qa-notes').value = '';
    document.getElementById('qa-feedback').innerHTML = '';
  },

  async loadRecentItems() {
    try {
      const items = await App.get('/items?isSold=false');
      const recent = items.slice(0, 5);
      const container = document.getElementById('qa-recent');
      container.innerHTML = recent.map(item => `
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
    document.getElementById('settings-balance').value = s.initialBalance;
    document.getElementById('settings-currency').value = s.currency;
  },

  async saveSettings() {
    const body = {
      initialBalance: parseFloat(document.getElementById('settings-balance').value) || 0,
      currency: document.getElementById('settings-currency').value || 'EUR'
    };
    try {
      await App.put('/settings', body);
      App.showFeedback('settings-feedback', 'Ajustes guardados ✅', 'success');
    } catch (e) {
      App.showFeedback('settings-feedback', 'Error guardando', 'error');
    }
  },

  // ── Exportar ─────────────────────────────

  exportExcel() {
    window.location.href = '/api/export/excel';
  },

  // ── Modal helpers ────────────────────────

  openModal(id) { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── HTTP helpers ─────────────────────────

  async get(path) {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },

  async post(path, body) {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(r.status);
    return r.json().catch(() => null);
  },

  async put(path, body) {
    const r = await fetch(API + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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
  const map = {
    Console: ['badge-console', '🎮'],
    VideoGame: ['badge-game', '💿'],
    Accessory: ['badge-accessory', '🔌']
  };
  const [cls, icon] = map[type] || ['badge', '?'];
  return `<span class="badge ${cls}">${icon} ${type === 'Console' ? 'Consola' : type === 'VideoGame' ? 'Juego' : 'Accesorio'}</span>`;
}

function condBadge(cond) {
  const map = {
    New: ['badge-sold', '✨ Nuevo'],
    Used: ['badge-stock', '📦 Usado'],
    NeedsRepair: ['badge-repair', '🔧 Reparar']
  };
  const [cls, label] = map[cond] || ['badge', cond];
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
