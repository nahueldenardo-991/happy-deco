(() => {
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
        updated:new Date().toISOString().slice(0,10),
        stock:0,
        location:'Gestionado en Mobiliario',
        features:`Valor ${money(asset.value)} ÷ ${asset.usefulEvents||0} eventos de vida útil`,
        source:'Mobiliario'
      });
    });
    state.costItems = state.costItems.filter(item => !item.linkedAssetId || activeIds.has(item.linkedAssetId));
  }

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
