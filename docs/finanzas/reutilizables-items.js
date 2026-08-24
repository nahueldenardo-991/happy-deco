(() => {
  const section = document.getElementById("reutilizables");
  if (!section) return;

  const today = () => new Date().toISOString().slice(0, 10);
  const slug = value => String(value || "reutilizable").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reutilizable";
  const reusableCategories = ["Textiles", "Luces", "Alfombras", "Herramientas", "Soportes", "Decoración reutilizable", "Otros"];

  function ensureState() {
    state.reusables = Array.isArray(state.reusables) ? state.reusables : [];
    state.costItems = Array.isArray(state.costItems) ? state.costItems : [];
    state.stockChecks = Array.isArray(state.stockChecks) ? state.stockChecks : [];
  }

  function costPerUse(item) {
    return Number(item.usefulEvents) > 0 ? Number(item.value || 0) / Number(item.usefulEvents) : 0;
  }

  function linkedCostItem(reusable) {
    return state.costItems.find(item => item.linkedReusableId === reusable.id);
  }

  function syncReusableCosts() {
    ensureState();
    const activeIds = new Set();
    state.reusables.forEach((item, index) => {
      item.id = item.id || `reusable-${index}-${slug(item.name)}`;
      activeIds.add(item.id);
      const previousCostItem = linkedCostItem(item);
      const reusableCost = costPerUse(item);
      const costItem = previousCostItem || { id: `reusable-cost-${item.id}`, linkedReusableId: item.id };
      Object.assign(costItem, {
        name: `Costo de uso · ${item.name}`,
        category: "Reutilizables",
        unit: "uso",
        unitCost: reusableCost,
        updated: today(),
        stock: previousCostItem?.stock ?? 0,
        location: previousCostItem?.location || "Controlar en Stock",
        features: `Valor ${money(item.value)} ÷ ${item.usefulEvents || 0} usos de vida útil`,
        source: "Reutilizables"
      });
      if (!previousCostItem) state.costItems.push(costItem);
    });
    state.costItems = state.costItems.filter(item => !item.linkedReusableId || activeIds.has(item.linkedReusableId));
  }

  function availability(item) {
    const costItem = linkedCostItem(item);
    const stock = Number(costItem?.stock) || 0;
    const hasControl = state.stockChecks.some(check => check.itemId === costItem?.id);
    if (stock <= 0) return { stock, label: hasControl ? "Sin disponibilidad" : "Sin control", tone: "warn" };
    return { stock, label: "Disponible", tone: "" };
  }

  function statusPill(item) {
    const progress = Number(item.uses || 0) / Math.max(Number(item.usefulEvents || 0), 1);
    if (progress >= 1) return '<span class="pill bad">Reponer</span>';
    if (progress > 0.85) return '<span class="pill warn">Revisar</span>';
    return '<span class="pill">Rentable</span>';
  }

  function availabilityPill(item) {
    const info = availability(item);
    return `<span class="pill ${info.tone}">${info.label}</span><br><span class="mini">${info.stock} disponibles en Stock</span>`;
  }

  function reusableCandidates() {
    const blocked = /globo/i;
    const alreadyReusable = new Set(state.reusables.map(item => slug(item.name)));
    return state.costItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item && !item.linkedAssetId && !item.linkedReusableId && item.source !== "Mobiliario" && item.source !== "Reutilizables")
      .filter(({ item }) => !blocked.test(`${item.category || ""} ${item.name || ""}`))
      .filter(({ item }) => !alreadyReusable.has(slug(item.name)));
  }

  function importCandidate(index, options = {}) {
    const item = state.costItems[index];
    if (!item) return;
    const baseName = String(item.name || "Reutilizable").replace(/^Costo de uso\s*·\s*/i, "").trim();
    const newReusable = {
      id: `reusable-${Date.now()}-${slug(baseName)}`,
      name: baseName,
      category: reusableCategories.includes(item.category) ? item.category : "Otros",
      value: Number(item.unitCost) || 0,
      usefulEvents: 1,
      uses: 0,
      notes: "Importado desde Ítems y precios. Revisar valor y vida útil."
    };
    const newCostName = `Costo de uso · ${newReusable.name}`;
    state.reusables.push(newReusable);
    state.costItems.splice(index, 1);
    state.proposals.forEach(proposal => {
      (proposal.items || []).forEach(component => {
        if (component.name === item.name) {
          component.name = newCostName;
          component.unitCost = costPerUse(newReusable);
        }
      });
      proposal.inclusions = (proposal.items || []).map(component => component.name).join("; ");
      proposal.standardCost = (proposal.items || []).reduce((sum, component) => sum + (Number(component.quantity) || 0) * (Number(component.unitCost) || 0), 0);
    });
    syncReusableCosts();
    if (!options.silent) {
      save();
      render();
    }
  }

  function importAllCandidates() {
    const candidates = reusableCandidates();
    if (!candidates.length) return;
    if (!confirm(`¿Pasar ${candidates.length} ítems a Reutilizables? Se excluirán los que digan "globo" y se actualizarán en Ítems y precios como costos por uso.`)) return;
    candidates
      .slice()
      .sort((a, b) => b.index - a.index)
      .forEach(({ index }) => importCandidate(index, { silent: true }));
    syncReusableCosts();
    save();
    render();
  }

  function renderReusableSection() {
    ensureState();
    syncReusableCosts();
    const totalValue = state.reusables.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const pending = state.reusables.filter(item => availability(item).stock <= 0).length;
    const candidates = reusableCandidates();
    section.innerHTML = `
      <div class="explain"><strong>¿Qué se carga aquí?</strong> Elementos reutilizables que no son mobiliario ni consumibles: telas, luces, alfombras, herramientas, soportes y decoración que vuelve a usarse. No cargar globos, descartables ni muebles/paneles grandes.</div>
      <div class="grid kpis">
        <div class="card kpi"><div class="label">Reutilizables</div><div class="value">${state.reusables.length}</div><div class="detail">Activos registrados</div></div>
        <div class="card kpi"><div class="label">Valor inventario</div><div class="value">${money(totalValue)}</div><div class="detail">Compra o reposición</div></div>
        <div class="card kpi"><div class="label">Alertas stock</div><div class="value">${pending}</div><div class="detail">Sin disponibilidad o control</div></div>
      </div>
      <div class="card">
        <div class="section-head">
          <div>
            <h2>Reutilizables y costo por uso</h2>
            <p class="crud-help">Al guardar un reutilizable, se crea o actualiza su costo de uso en Ítems y precios.</p>
          </div>
          <button class="btn primary" data-add="reusable">+ Agregar reutilizable</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Reutilizable</th><th>Categoría</th><th class="num">Valor</th><th class="num">Vida útil</th><th class="num">Usos</th><th class="num">Costo por uso</th><th>Disponibilidad</th><th>Estado</th><th></th></tr></thead>
            <tbody>${state.reusables.map((item, index) => `
              <tr>
                <td><strong>${item.name || "Sin nombre"}</strong>${item.notes ? `<br><span class="mini">${item.notes}</span>` : ""}</td>
                <td>${item.category || "Sin clasificar"}</td>
                <td class="num">${money(item.value)}</td>
                <td class="num">${Number(item.usefulEvents || 0)} usos</td>
                <td class="num">${Number(item.uses || 0)}</td>
                <td class="num"><strong>${money(costPerUse(item))}</strong></td>
                <td>${availabilityPill(item)}</td>
                <td>${statusPill(item)}</td>
                <td class="action-cell"><button class="icon-btn" data-edit="reusable" data-index="${index}">Editar</button><button class="icon-btn danger-btn" data-remove="reusable" data-index="${index}">Eliminar</button></td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </div>`;
    if (candidates.length) {
    section.insertAdjacentHTML("beforeend", `
        <div class="card" style="margin-top:14px">
          <div class="section-head">
            <div>
              <h2>Reutilizables todavía cargados en Ítems y precios</h2>
              <p class="crud-help">${candidates.length} ítems detectados. Se excluye automáticamente todo lo que diga "globo".</p>
            </div>
            <button class="btn primary" type="button" id="importAllReusableBtn">Pasar todos a Reutilizables</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Ítem actual</th><th>Categoría</th><th>Unidad</th><th class="num">Precio actual</th><th></th></tr></thead>
              <tbody>${candidates.map(({ item, index }) => `
                <tr>
                  <td><strong>${item.name}</strong>${item.features ? `<br><span class="mini">${item.features}</span>` : ""}</td>
                  <td>${item.category || "Sin clasificar"}</td>
                  <td>${item.unit || "unidad"}</td>
                  <td class="num">${money(item.unitCost)}</td>
                  <td class="action-cell"><button class="icon-btn" data-import-reusable="${index}">Pasar a Reutilizables</button></td>
                </tr>
              `).join("")}</tbody>
            </table>
          </div>
        </div>`);
    }
    section.querySelectorAll('[data-add="reusable"]').forEach(button => button.onclick = () => openCrud("reusable"));
    section.querySelectorAll('[data-edit="reusable"]').forEach(button => button.onclick = () => openCrud("reusable", Number(button.dataset.index)));
    section.querySelectorAll('[data-remove="reusable"]').forEach(button => button.onclick = () => removeCrud("reusable", Number(button.dataset.index)));
    section.querySelectorAll("[data-import-reusable]").forEach(button => button.onclick = () => importCandidate(Number(button.dataset.importReusable)));
    const importAllButton = document.getElementById("importAllReusableBtn");
    if (importAllButton) importAllButton.onclick = importAllCandidates;
  }

  function lockReusableRows() {
    state.costItems.forEach((item, index) => {
      if (!item.linkedReusableId) return;
      const actionCell = document.querySelector(`[data-edit="costItem"][data-index="${index}"]`)?.parentElement;
      if (actionCell) actionCell.innerHTML = '<span class="pill">Desde Reutilizables</span>';
    });
    const explanation = document.querySelector("#items .explain");
    if (explanation && !explanation.dataset.reusableLink) {
      explanation.dataset.reusableLink = "true";
      explanation.insertAdjacentHTML("beforeend", ' <strong>Los costos de uso de reutilizables se calculan automáticamente y se editan únicamente desde la solapa Reutilizables.</strong>');
    }
  }

  crudConfigs.reusable = {
    title: "reutilizable",
    list: "reusables",
    intro: "No cargar mobiliario ni consumibles. El costo por uso se calcula con valor dividido por vida útil.",
    fields: [
      ["name", "Nombre del reutilizable", "text"],
      ["category", "Categoría", "select", reusableCategories],
      ["value", "Valor de compra o reposición", "number"],
      ["usefulEvents", "Vida útil en usos/eventos", "number"],
      ["uses", "Usos acumulados", "number"],
      ["notes", "Observaciones", "textarea"]
    ]
  };

  const originalSubmit = crudForm.onsubmit;
  crudForm.onsubmit = event => {
    const isReusable = crudContext?.type === "reusable";
    originalSubmit(event);
    if (isReusable) {
      syncReusableCosts();
      save();
      render();
    }
  };

  const originalRemove = removeCrud;
  removeCrud = function(type, index) {
    originalRemove(type, index);
    if (type === "reusable") {
      syncReusableCosts();
      save();
      render();
    }
  };

  const previousRender = render;
  render = function() {
    syncReusableCosts();
    previousRender();
    renderReusableSection();
    lockReusableRows();
  };

  render();
})();
