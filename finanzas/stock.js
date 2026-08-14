(() => {
  let category = 'Todas';
  const stockSection = document.getElementById('stock');
  if (!stockSection) return;

  const dialog = document.createElement('dialog');
  dialog.innerHTML = '<form class="modal" id="stockForm"><div class="modal-head"><div><h2 id="stockDialogTitle"></h2><p class="modal-intro" id="stockDialogIntro"></p></div><button class="close" type="button" data-stock-close aria-label="Cerrar">×</button></div><div class="form-grid" id="stockFields"></div><div class="footer-actions"><button class="btn" type="button" data-stock-close>Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>';
  document.body.appendChild(dialog);
  let mode = 'control', selectedId = '';
  const form = dialog.querySelector('#stockForm');
  const fields = dialog.querySelector('#stockFields');
  dialog.querySelectorAll('[data-stock-close]').forEach(button => button.onclick = () => dialog.close());

  async function loadStaticInventory() {
    try {
      const response = await fetch(`inventario.json?v=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`Inventario ${response.status}`);
      const inventory = await response.json();
      const normalize = value => String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
      const existing = new Map(state.costItems.map(item => [normalize(item.name), item]));
      state.stockChecks = (state.stockChecks||[]).filter(x => x.notes !== 'Control inicial según inventario Happy Deco');
      inventory.items.forEach(imported => {
        const current = existing.get(normalize(imported.name));
        if (current) Object.assign(current, imported);
        else { state.costItems.push(imported); existing.set(normalize(imported.name), imported); }
      });
      const controlled = new Set(state.stockChecks.map(x=>x.itemId));
      inventory.items.forEach(imported => {
        if (controlled.has(imported.id)) return;
        state.stockChecks.push({id:`initial-${imported.id}`,itemId:imported.id,itemName:imported.name,controlDate:'2025-12-15',previousStock:Number(imported.stock)||0,counted:Number(imported.stock)||0,difference:0,notes:'Control inicial según inventario Happy Deco'});
      });
      state.inventoryVersion = inventory.version;
      localStorage.setItem('happyDecoFinanceV1', JSON.stringify(state));
      render(); renderStock();
      return true;
    } catch (error) {
      console.error('No se pudo cargar el inventario incluido en el sitio', error);
      return false;
    }
  }

  function itemOptions(selected = '') {
    return state.costItems.slice().sort((a,b) => String(a.category).localeCompare(String(b.category)) || a.name.localeCompare(b.name)).map(item => `<option value="${item.id}" ${item.id===selected?'selected':''}>${item.category || 'Sin clasificar'} · ${item.name}</option>`).join('');
  }
  function openControl(itemId = '') {
    mode = 'control'; selectedId = itemId || state.costItems[0]?.id || '';
    document.getElementById('stockDialogTitle').textContent = 'Registrar control de stock';
    document.getElementById('stockDialogIntro').textContent = 'Ingresá la cantidad que existe físicamente. La diferencia se calcula automáticamente.';
    fields.innerHTML = `<div class="field full"><label>Ítem o insumo</label><select name="itemId" required>${itemOptions(selectedId)}</select></div><div class="field"><label>Fecha del control</label><input name="controlDate" type="date" value="${new Date().toISOString().slice(0,10)}" required></div><div class="field"><label>Cantidad contada</label><input name="counted" type="number" min="0" step="1" required></div><div class="field full"><label>Observación</label><textarea name="notes" rows="3" placeholder="Ej.: faltan dos unidades, material dañado o trasladado"></textarea></div>`;
    dialog.showModal();
  }
  function openSupply() {
    mode = 'supply';
    document.getElementById('stockDialogTitle').textContent = 'Agregar insumo';
    document.getElementById('stockDialogIntro').textContent = 'El insumo quedará disponible tanto en Control de stock como en Ítems y precios.';
    fields.innerHTML = `<div class="field wide"><label>Nombre del insumo</label><input name="name" required></div><div class="field"><label>Categoría</label><select name="category"><option>Insumos</option><option>Globos y decoración</option><option>Gráfica e impresión</option><option>Materiales de armado</option><option>Flores y textiles</option><option>Limpieza y consumibles</option><option>Herramientas</option><option>Otros</option></select></div><div class="field"><label>Unidad de medida</label><select name="unit"><option>unidad</option><option>paquete</option><option>caja</option><option>rollo</option><option>metro</option><option>litro</option><option>kilogramo</option></select></div><div class="field"><label>Cantidad inicial</label><input name="stock" type="number" min="0" step="1" value="0" required></div><div class="field"><label>Precio unitario</label><input name="unitCost" type="number" min="0" step="0.01" value="0" required></div><div class="field wide"><label>Ubicación</label><input name="location" placeholder="Ej.: depósito, estante 2"></div>`;
    dialog.showModal();
  }
  form.onsubmit = event => {
    event.preventDefault(); const data = new FormData(form);
    if (mode === 'control') {
      const item = state.costItems.find(x => x.id === data.get('itemId')); if (!item) return;
      const previousStock = Number(item.stock) || 0, counted = Number(data.get('counted')) || 0;
      state.stockChecks.push({id:`control-${Date.now()}`,itemId:item.id,itemName:item.name,controlDate:data.get('controlDate'),previousStock,counted,difference:counted-previousStock,notes:data.get('notes').trim()});
      item.stock = counted; item.lastStockControl = data.get('controlDate');
    } else {
      const today = new Date().toISOString().slice(0,10), item = {id:`supply-${Date.now()}`,name:data.get('name').trim(),category:data.get('category'),unit:data.get('unit'),stock:Number(data.get('stock'))||0,unitCost:Number(data.get('unitCost'))||0,location:data.get('location').trim(),updated:today,source:'Carga manual'};
      state.costItems.push(item);
      if (item.stock > 0) state.stockChecks.push({id:`control-${Date.now()}`,itemId:item.id,itemName:item.name,controlDate:today,previousStock:0,counted:item.stock,difference:item.stock,notes:'Cantidad inicial'});
    }
    dialog.close(); render(); renderStock(); save();
  };

  function renderStock() {
    const categories = ['Todas', ...new Set(state.costItems.map(x => x.category || 'Sin clasificar'))];
    const visible = category === 'Todas' ? state.costItems : state.costItems.filter(x => (x.category || 'Sin clasificar') === category);
    const latest = new Map(); state.stockChecks.slice().sort((a,b)=>String(b.controlDate).localeCompare(String(a.controlDate))).forEach(x=>{if(!latest.has(x.itemId))latest.set(x.itemId,x)});
    const total = state.costItems.reduce((sum,x)=>sum+(Number(x.stock)||0),0), pending = state.costItems.filter(x=>!latest.has(x.id)).length;
    stockSection.innerHTML = `<div class="explain"><strong>Control físico del inventario.</strong> Registrá la cantidad contada en una fecha determinada. El historial queda guardado y actualiza las existencias.</div><div class="grid kpis"><div class="card kpi"><div class="label">Ítems registrados</div><div class="value">${state.costItems.length}</div><div class="detail">Catálogo completo</div></div><div class="card kpi"><div class="label">Unidades disponibles</div><div class="value">${total}</div><div class="detail">Según último control</div></div><div class="card kpi"><div class="label">Sin control registrado</div><div class="value">${pending}</div><div class="detail">Pendientes de contar</div></div></div><div class="card"><div class="section-head"><div><h2>Existencias por categoría</h2><p class="crud-help">Filtrá la lista o registrá un nuevo control.</p></div><div class="actions"><div class="field"><label>Categoría</label><select id="stockCategoryFilter">${categories.map(x=>`<option ${x===category?'selected':''}>${x}</option>`).join('')}</select></div><button class="btn" id="addSupplyBtn">+ Agregar insumo</button><button class="btn primary" id="addStockCheckBtn">+ Registrar control</button></div></div><div class="table-wrap"><table><thead><tr><th>Ítem / insumo</th><th>Categoría</th><th>Ubicación</th><th class="num">Cantidad</th><th>Último control</th><th></th></tr></thead><tbody>${visible.map(x=>{const c=latest.get(x.id);return `<tr><td><strong>${x.name}</strong><br><span class="mini">${x.unit||'unidad'}</span></td><td>${x.category||'Sin clasificar'}</td><td>${x.location||'—'}</td><td class="num"><strong>${Number(x.stock)||0}</strong></td><td>${c?`${c.controlDate}<br><span class="mini">Diferencia: ${c.difference>0?'+':''}${c.difference}</span>`:'<span class="pill warn">Pendiente</span>'}</td><td><button class="icon-btn" data-control-item="${x.id}">Controlar</button></td></tr>`}).join('')}</tbody></table></div></div><div class="card" style="margin-top:14px"><h2>Historial reciente</h2>${state.stockChecks.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Ítem</th><th class="num">Anterior</th><th class="num">Contado</th><th class="num">Diferencia</th><th>Observación</th></tr></thead><tbody>${state.stockChecks.slice().sort((a,b)=>String(b.controlDate).localeCompare(String(a.controlDate))).slice(0,30).map(x=>`<tr><td>${x.controlDate}</td><td><strong>${x.itemName}</strong></td><td class="num">${x.previousStock}</td><td class="num"><strong>${x.counted}</strong></td><td class="num">${x.difference>0?'+':''}${x.difference}</td><td>${x.notes||'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Todavía no se registraron controles.</div>'}</div>`;
    document.getElementById('stockCategoryFilter').onchange = e => { category=e.target.value; renderStock(); };
    document.getElementById('addSupplyBtn').onclick = openSupply; document.getElementById('addStockCheckBtn').onclick = () => openControl();
    stockSection.querySelectorAll('[data-control-item]').forEach(button => button.onclick = () => openControl(button.dataset.controlItem));
  }
  const originalRender = render; render = function(){ originalRender(); renderStock(); };
  const originalSync = syncDashboardEvents;
  syncDashboardEvents = async function(manual=false) {
    const inventoryReady = await loadStaticInventory();
    await originalSync(false);
    const button = document.getElementById('syncEventsBtn');
    const remoteFailed = button?.textContent === 'No se pudo actualizar';
    if (manual && remoteFailed) {
      button.textContent = inventoryReady ? 'Inventario actualizado · ventas sin conexión' : 'Sin conexión';
      let notice = document.getElementById('syncNotice');
      if (!notice) {
        notice = document.createElement('div'); notice.id='syncNotice'; notice.className='note';
        document.querySelector('.top').insertAdjacentElement('afterend', notice);
      }
      notice.innerHTML = inventoryReady
        ? '<strong>El inventario está actualizado.</strong> Ventas, cobranzas y datos compartidos no respondieron en este intento. Podés seguir trabajando con el stock y volver a intentar más tarde.'
        : '<strong>No se pudo establecer conexión.</strong> Los datos guardados en este dispositivo siguen disponibles.';
    } else if (!remoteFailed) {
      document.getElementById('syncNotice')?.remove();
    }
  };
  renderStock();
  loadStaticInventory();
})();
