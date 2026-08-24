(() => {
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = value => String(value || "mobiliario").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mobiliario";

  function syncFurnitureCosts() {
    const activeIds = new Set();
    state.assets.forEach((asset, index) => {
      asset.id = asset.id || `asset-${index}-${String(asset.name||'mobiliario').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
      activeIds.add(asset.id);
      const costPerUse = Number(asset.usefulEvents) > 0 ? Number(asset.value||0) / Number(asset.usefulEvents) : 0;
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

  const previousRender = render;
  render = function() {
    syncFurnitureCosts();
    previousRender();
    lockFurnitureRows();
  };
  render();
})();
