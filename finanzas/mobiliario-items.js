(() => {
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = value => String(value || "mobiliario").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mobiliario";
  const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const furnitureKeywords = ["panel", "mesa", "ostra", "3d", "carrito", "estante", "escalera"];

  function isFurnitureLike(value) {
    const text = normalize(value);
    return furnitureKeywords.some(keyword => text.includes(keyword));
  }

  function assetCostPerUse(asset) {
    return Number(asset.usefulEvents) > 0 ? Number(asset.value || 0) / Number(asset.usefulEvents) : 0;
  }

  function ensureFinanceLists() {
    state.assets = Array.isArray(state.assets) ? state.assets : [];
    state.reusables = Array.isArray(state.reusables) ? state.reusables : [];
    state.costItems = Array.isArray(state.costItems) ? state.costItems : [];
    state.stockChecks = Array.isArray(state.stockChecks) ? state.stockChecks : [];
  }

  function syncFurnitureCosts() {
    ensureFinanceLists();
    const movedCount = migrateFurnitureFromReusables() + migrateFurnitureCostItems();
    const activeIds = new Set();
    state.assets.forEach((asset, index) => {
      asset.id = asset.id || `asset-${index}-${String(asset.name||'mobiliario').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
      activeIds.add(asset.id);
      const costPerUse = assetCostPerUse(asset);
      let item = state.costItems.find(x => x.linkedAssetId === asset.id);
      if (!item) {
        item = {id:`furniture-cost-${asset.id}`,linkedAssetId:asset.id};
        state.costItems.push(item);
      }
      Object.assign(item, {
        name:`Costo de uso · ${asset.name}`,
        category:'Mobiliario',
        unit:'uso',
        unitCost:costPerUse,
        updated:today(),
        stock:item.stock ?? asset.stock ?? 0,
        location:item.location || asset.location || 'Gestionado en Mobiliario',
        features:`Valor ${money(asset.value)} ÷ ${asset.usefulEvents||0} eventos de vida útil`,
        source:'Mobiliario'
      });
    });
    state.costItems = state.costItems.filter(item => !item.linkedAssetId || activeIds.has(item.linkedAssetId));
    if (movedCount && typeof save === "function") save();
  }

  function migrateFurnitureFromReusables() {
    ensureFinanceLists();
    const moving = [];
    state.reusables = state.reusables.filter(reusable => {
      const shouldMove = isFurnitureLike(`${reusable.name || ""} ${reusable.category || ""}`);
      if (shouldMove) moving.push(reusable);
      return !shouldMove;
    });
    moving.forEach(reusable => {
      const reusableCostId = `reusable-cost-${reusable.id}`;
      const existingAsset = state.assets.find(asset => slug(asset.name) === slug(reusable.name));
      const asset = existingAsset || {
        id: `asset-${reusable.id || Date.now()}`,
        name: reusable.name || "Mobiliario",
        value: Number(reusable.value) || 0,
        usefulEvents: Number(reusable.usefulEvents) || 1,
        uses: Number(reusable.uses) || 0,
        status: "Bueno"
      };
      Object.assign(asset, {
        name: reusable.name || asset.name,
        value: Number(reusable.value) || Number(asset.value) || 0,
        usefulEvents: Number(reusable.usefulEvents) || Number(asset.usefulEvents) || 1,
        uses: Number(reusable.uses) || Number(asset.uses) || 0,
        stock: Number(reusable.stock ?? asset.stock) || 0,
        location: reusable.location || asset.location || "",
        notes: reusable.notes || asset.notes || "Movido automáticamente desde Reutilizables."
      });
      if (!existingAsset) state.assets.push(asset);

      let costItem = state.costItems.find(item => item.linkedReusableId === reusable.id || item.id === reusableCostId);
      if (!costItem) {
        costItem = { id: `furniture-cost-${asset.id}` };
        state.costItems.push(costItem);
      }
      delete costItem.linkedReusableId;
      Object.assign(costItem, {
        id: costItem.id || `furniture-cost-${asset.id}`,
        linkedAssetId: asset.id,
        name: `Costo de uso · ${asset.name}`,
        category: "Mobiliario",
        unit: "uso",
        unitCost: assetCostPerUse(asset),
        updated: today(),
        stock: costItem.stock ?? asset.stock ?? 0,
        location: costItem.location || asset.location || "Gestionado en Mobiliario",
        features: `Valor ${money(asset.value)} ÷ ${asset.usefulEvents || 0} eventos de vida útil`,
        source: "Mobiliario"
      });

      state.stockChecks.forEach(check => {
        if (check.itemId === reusableCostId || normalize(check.itemName).includes(normalize(reusable.name))) {
          check.itemId = costItem.id;
          check.itemName = costItem.name;
        }
      });
      state.proposals.forEach(proposal => {
        (proposal.items || []).forEach(component => {
          if (component.name === `Costo de uso · ${reusable.name}` || component.name === reusable.name) {
            component.name = costItem.name;
            component.unitCost = costItem.unitCost;
          }
        });
        proposal.inclusions = (proposal.items || []).map(component => component.name).join("; ");
        proposal.standardCost = (proposal.items || []).reduce((sum, component) => sum + (Number(component.quantity) || 0) * (Number(component.unitCost) || 0), 0);
      });
    });
    return moving.length;
  }

  function cleanFurnitureName(value) {
    return String(value || "Mobiliario").replace(/^Costo de uso\s*·\s*/i, "").trim() || "Mobiliario";
  }

  function migrateFurnitureCostItems() {
    ensureFinanceLists();
    let moved = 0;
    state.costItems.forEach(item => {
      if (!item || item.linkedAssetId || item.linkedReusableId || item.source === "Mobiliario") return;
      if (!isFurnitureLike(`${item.name || ""} ${item.category || ""}`)) return;
      const name = cleanFurnitureName(item.name);
      const existingAsset = state.assets.find(asset => slug(asset.name) === slug(name));
      const asset = existingAsset || {
        id: `asset-${item.id || Date.now()}-${slug(name)}`,
        name,
        value: Number(item.unitCost) || 0,
        usefulEvents: 1,
        uses: 0,
        status: "Bueno",
        stock: Number(item.stock) || 0,
        location: item.location || "",
        notes: "Movido automáticamente desde Ítems y precios."
      };
      if (existingAsset) {
        asset.value = Number(asset.value) || Number(item.unitCost) || 0;
        asset.usefulEvents = Number(asset.usefulEvents) || 1;
        asset.stock = Number(asset.stock ?? item.stock) || 0;
        asset.location = asset.location || item.location || "";
      } else {
        state.assets.push(asset);
      }
      delete item.linkedReusableId;
      item.linkedAssetId = asset.id;
      item.name = `Costo de uso · ${asset.name}`;
      item.category = "Mobiliario";
      item.unit = "uso";
      item.unitCost = assetCostPerUse(asset);
      item.updated = today();
      item.stock = item.stock ?? asset.stock ?? 0;
      item.location = item.location || asset.location || "Gestionado en Mobiliario";
      item.features = `Valor ${money(asset.value)} ÷ ${asset.usefulEvents || 0} eventos de vida útil`;
      item.source = "Mobiliario";
      state.stockChecks.forEach(check => {
        if (check.itemId === item.id || normalize(check.itemName).includes(normalize(name))) {
          check.itemId = item.id;
          check.itemName = item.name;
        }
      });
      state.proposals.forEach(proposal => {
        (proposal.items || []).forEach(component => {
          if (component.name === name || component.name === item.name || normalize(component.name).includes(normalize(name))) {
            component.name = item.name;
            component.unitCost = item.unitCost;
          }
        });
        proposal.inclusions = (proposal.items || []).map(component => component.name).join("; ");
        proposal.standardCost = (proposal.items || []).reduce((sum, component) => sum + (Number(component.quantity) || 0) * (Number(component.unitCost) || 0), 0);
      });
      moved += 1;
    });
    return moved;
  }

  function linkedFurnitureItem(asset) {
    return state.costItems.find(item => item.linkedAssetId === asset.id);
  }

  function ensureInitialStockCheck(asset, previousAsset = null) {
    const item = linkedFurnitureItem(asset);
    if (!item) return;
    const stock = Number(asset.stock) || 0;
    item.stock = stock;
    item.location = asset.location || item.location || 'Gestionado en Mobiliario';
    const alreadyChecked = state.stockChecks?.some(check => check.itemId === item.id);
    if (!previousAsset && stock > 0 && !alreadyChecked) {
      state.stockChecks = state.stockChecks || [];
      state.stockChecks.push({
        id: `control-${Date.now()}-${slug(asset.name)}`,
        itemId: item.id,
        itemName: item.name,
        controlDate: today(),
        previousStock: 0,
        counted: stock,
        difference: stock,
        notes: 'Cantidad inicial cargada en Mobiliario'
      });
    }
  }

  if (crudConfigs?.asset && !crudConfigs.asset.fields.some(field => field[0] === 'stock')) {
    crudConfigs.asset.fields.splice(5, 0, ['stock', 'Cantidad inicial disponible', 'number'], ['location', 'Ubicación en depósito', 'text']);
  }

  const previousSubmit = crudForm.onsubmit;
  crudForm.onsubmit = event => {
    const isAsset = crudContext?.type === 'asset';
    const previousIndex = isAsset ? crudContext.index : null;
    const previousAsset = previousIndex === null ? null : { ...(state.assets?.[previousIndex] || {}) };
    const beforeIds = new Set((state.assets || []).map(asset => asset.id));
    previousSubmit(event);
    if (isAsset) {
      syncFurnitureCosts();
      const currentAsset = previousIndex === null
        ? state.assets.find(asset => !beforeIds.has(asset.id))
        : state.assets[previousIndex];
      if (currentAsset) ensureInitialStockCheck(currentAsset, previousAsset);
      save();
      render();
    }
  };

  function lockFurnitureRows() {
    state.costItems.forEach((item,index) => {
      if (!item.linkedAssetId) return;
      const edit = document.querySelector(`[data-edit="costItem"][data-index="${index}"]`);
      if (edit?.parentElement) edit.parentElement.innerHTML='<span class="pill">Desde Mobiliario</span>';
    });
    const explanation=document.querySelector('#items .explain');
    if (explanation && !explanation.dataset.furnitureLink) {
      explanation.dataset.furnitureLink='true';
      explanation.insertAdjacentHTML('beforeend',' <strong>Los costos de uso de mobiliario se calculan automáticamente y se editan únicamente desde la solapa Mobiliario.</strong>');
    }
  }

  window.HappyDecoFurnitureTools = {
    isFurnitureLike,
    syncFurnitureCosts
  };
  syncFurnitureCosts();

  const previousRender = render;
  render = function() {
    syncFurnitureCosts();
    previousRender();
    lockFurnitureRows();
  };
  render();
})();
