(function () {
  "use strict";

  const config = {
    apiKey: "AIzaSyD9jO4G_-O5Fd4pcM5eMtp5lNdxWPkr2Cc",
    projectId: "happy-deco-web"
  };
  const historicalConfig = {
    url: "https://niwkiklxyblrvbeusqbd.supabase.co",
    anonKey: "sb_publishable_BZOa1hRBnH0KWocgyCZmfw_-lrLIgGd"
  };
  const historicalCooldownKey = "happyDecoSupabaseHistoricalRetryAt";
  const historicalCooldownMs = 10 * 60 * 1000;
  const firebaseQuotaCooldownKey = "happyDecoFirebaseQuotaRetryAt";
  const firebaseQuotaCooldownMs = 30 * 60 * 1000;
  const listCachePrefix = "happyDecoFirebaseListCache:";
  const pendingWritesKey = "happyDecoFirebasePendingWritesV1";
  const pendingDeletesKey = "happyDecoFirebasePendingDeletesV1";
  const listCacheMs = 60 * 1000;
  const listCache = new Map();
  const pendingLists = new Map();

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

  function withKey(url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}key=${encodeURIComponent(config.apiKey)}`;
  }

  function parsePath(path) {
    const [table, queryText = ""] = String(path || "").split("?");
    const params = new URLSearchParams(queryText);
    const idFilter = params.get("id") || "";
    const id = idFilter.startsWith("eq.") ? decodeURIComponent(idFilter.slice(3)) : "";
    return { table, id };
  }

  function documentUrl(table, id) {
    return `${baseUrl}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
  }

  function collectionUrl(table) {
    return `${baseUrl}/${encodeURIComponent(table)}?pageSize=1000`;
  }

  function rowFromDocument(doc) {
    if (!doc || !doc.fields) return null;
    let data = null;
    try {
      data = JSON.parse(doc.fields.dataJson?.stringValue || "null");
    } catch {
      data = null;
    }
    return {
      id: decodeURIComponent(String(doc.name || "").split("/").pop() || doc.fields.id?.stringValue || ""),
      data,
      updated_at: doc.fields.updatedAt?.timestampValue || data?.updatedAt || ""
    };
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : null;
    let detail = text || response.statusText || "Error de Firebase";
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || detail;
      const reason = parsed.error?.details?.find(item => item?.metadata?.service === "firestore.googleapis.com")?.reason;
      if (reason === "SERVICE_DISABLED") {
        detail = "Firebase está creado, pero falta activar Cloud Firestore en este proyecto.";
      } else if (parsed.error?.status === "PERMISSION_DENIED") {
        detail = "Firebase respondió sin permisos. Revisá que Firestore esté creado y que sus reglas permitan leer y escribir desde Happy Deco.";
      } else if (response.status === 429 || parsed.error?.status === "RESOURCE_EXHAUSTED") {
        detail = "Firebase alcanzó temporalmente su cuota de operaciones. Happy Deco conservará los datos locales y reintentará más tarde.";
      }
    } catch {
      // Keep the raw detail when Firebase returns plain text.
    }
    throw new Error(`${response.status} ${detail}`);
  }

  function cacheKey(table) {
    return `${listCachePrefix}${table}`;
  }

  function readStoredList(table) {
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey(table)) || "null");
      return Array.isArray(stored?.rows) ? stored : null;
    } catch {
      return null;
    }
  }

  function cachedRows(table, allowStale = false) {
    const cached = listCache.get(table) || readStoredList(table);
    if (!cached) return null;
    if (!allowStale && Date.now() - Number(cached.savedAt || 0) > listCacheMs) return null;
    listCache.set(table, cached);
    return cached.rows;
  }

  function storeRows(table, rows) {
    const cached = { savedAt: Date.now(), rows };
    listCache.set(table, cached);
    try {
      localStorage.setItem(cacheKey(table), JSON.stringify(cached));
    } catch {
      // The in-memory cache still prevents repeated reads in this tab.
    }
  }

  function firebaseQuotaLimited() {
    return Date.now() < Number(localStorage.getItem(firebaseQuotaCooldownKey) || 0);
  }

  function markFirebaseQuotaLimited(error) {
    const message = String(error?.message || error || "");
    if (!/429|quota|resource_exhausted/i.test(message)) return false;
    localStorage.setItem(firebaseQuotaCooldownKey, String(Date.now() + firebaseQuotaCooldownMs));
    return true;
  }

  function readPendingWrites() {
    try {
      const rows = JSON.parse(localStorage.getItem(pendingWritesKey) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function storePendingWrites(rows) {
    try {
      localStorage.setItem(pendingWritesKey, JSON.stringify(rows));
    } catch {
      // Page-level local storage still keeps the edited business record.
    }
  }

  function queuePendingWrites(table, rows) {
    const pending = new Map(readPendingWrites().map(item => [`${item.table}:${item.row?.id}`, item]));
    rows.filter(row => row?.id).forEach(row => {
      pending.set(`${table}:${row.id}`, { table, row, queuedAt: new Date().toISOString() });
    });
    storePendingWrites([...pending.values()]);
  }

  function readPendingDeletes() {
    try {
      const rows = JSON.parse(localStorage.getItem(pendingDeletesKey) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function storePendingDeletes(rows) {
    try {
      localStorage.setItem(pendingDeletesKey, JSON.stringify(rows));
    } catch {
      // Page-level local storage still reflects the user's deletion.
    }
  }

  function queuePendingDelete(table, id) {
    const pending = new Map(readPendingDeletes().map(item => [`${item.table}:${item.id}`, item]));
    pending.set(`${table}:${id}`, { table, id, queuedAt: new Date().toISOString() });
    storePendingDeletes([...pending.values()]);
  }

  async function writeRow(table, row) {
    const updatedAt = row.updated_at || row.data?.updatedAt || new Date().toISOString();
    const payload = {
      fields: {
        id: { stringValue: String(row.id) },
        dataJson: { stringValue: JSON.stringify(row.data || {}) },
        updatedAt: { timestampValue: updatedAt }
      }
    };
    await parseResponse(await fetch(withKey(documentUrl(table, row.id)), {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));
    return { id: row.id, data: row.data || {}, updated_at: updatedAt };
  }

  let flushingPendingWrites = false;
  async function flushPendingWrites() {
    if (flushingPendingWrites || firebaseQuotaLimited()) return;
    const deletes = readPendingDeletes();
    const pending = readPendingWrites();
    if (!pending.length && !deletes.length) return;
    flushingPendingWrites = true;
    const remaining = [];
    try {
      const remainingDeletes = [];
      for (let index = 0; index < deletes.length; index += 1) {
        const item = deletes[index];
        try {
          const response = await fetch(withKey(documentUrl(item.table, item.id)), { method: "DELETE", cache: "no-store" });
          if (response.status !== 404) await parseResponse(response);
        } catch (error) {
          remainingDeletes.push(...deletes.slice(index));
          markFirebaseQuotaLimited(error);
          break;
        }
      }
      storePendingDeletes(remainingDeletes);
      if (remainingDeletes.length) return;
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        try {
          await writeRow(item.table, item.row);
        } catch (error) {
          remaining.push(...pending.slice(index));
          markFirebaseQuotaLimited(error);
          break;
        }
      }
      storePendingWrites(remaining);
    } finally {
      flushingPendingWrites = false;
    }
  }

  async function list(table) {
    const fresh = cachedRows(table);
    if (fresh) return fresh;
    if (firebaseQuotaLimited()) {
      const stale = cachedRows(table, true);
      if (stale) return stale;
      throw new Error("429 Firebase alcanzó temporalmente su cuota de operaciones.");
    }
    if (pendingLists.has(table)) return pendingLists.get(table);
    const request = (async () => {
      try {
        const result = await parseResponse(await fetch(withKey(collectionUrl(table)), { cache: "no-store" }));
        const rows = (result.documents || [])
          .map(rowFromDocument)
          .filter(Boolean)
          .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
        localStorage.removeItem(firebaseQuotaCooldownKey);
        storeRows(table, rows);
        setTimeout(flushPendingWrites, 0);
        return rows;
      } catch (error) {
        markFirebaseQuotaLimited(error);
        const stale = cachedRows(table, true);
        if (stale) return stale;
        throw error;
      } finally {
        pendingLists.delete(table);
      }
    })();
    pendingLists.set(table, request);
    return request;
  }

  async function get(table, id) {
    const cached = cachedRows(table, true);
    if (firebaseQuotaLimited() && cached) return cached.filter(row => String(row.id) === String(id));
    const response = await fetch(withKey(documentUrl(table, id)), { cache: "no-store" });
    if (response.status === 404) return [];
    return [rowFromDocument(await parseResponse(response))].filter(Boolean);
  }

  async function upsert(table, rows) {
    const listRows = Array.isArray(rows) ? rows : [rows];
    if (firebaseQuotaLimited()) {
      queuePendingWrites(table, listRows);
      throw new Error("429 Firebase está temporalmente en pausa. Los cambios quedaron en cola y se sincronizarán automáticamente.");
    }
    const saved = [];
    for (let index = 0; index < listRows.length; index += 1) {
      const row = listRows[index];
      if (!row?.id) continue;
      try {
        saved.push(await writeRow(table, row));
      } catch (error) {
        queuePendingWrites(table, listRows.slice(index));
        markFirebaseQuotaLimited(error);
        throw error;
      }
    }
    return saved;
  }

  async function remove(table, id) {
    if (!id) return null;
    if (firebaseQuotaLimited()) {
      queuePendingDelete(table, id);
      throw new Error("429 Firebase está temporalmente en pausa. La eliminación sigue pendiente de sincronización.");
    }
    const response = await fetch(withKey(documentUrl(table, id)), { method: "DELETE", cache: "no-store" });
    if (response.status === 404) return null;
    try {
      return await parseResponse(response);
    } catch (error) {
      queuePendingDelete(table, id);
      markFirebaseQuotaLimited(error);
      throw error;
    }
  }

  async function supabaseRead(path) {
    if (!historicalConfig.url || !historicalConfig.anonKey) return [];
    const retryAt = Number(localStorage.getItem(historicalCooldownKey) || 0);
    if (retryAt && Date.now() < retryAt) return [];
    try {
      const response = await fetch(`${historicalConfig.url}/rest/v1/${path}`, {
        cache: "no-store",
        headers: {
          apikey: historicalConfig.anonKey,
          Authorization: `Bearer ${historicalConfig.anonKey}`,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        localStorage.setItem(historicalCooldownKey, String(Date.now() + historicalCooldownMs));
        console.warn("Supabase histórico no disponible; se usa Firebase.", response.status, await response.text());
        return [];
      }
      localStorage.removeItem(historicalCooldownKey);
      const text = await response.text();
      const rows = text ? JSON.parse(text) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      localStorage.setItem(historicalCooldownKey, String(Date.now() + historicalCooldownMs));
      console.warn("Supabase histórico no disponible; se usa Firebase.", error);
      return [];
    }
  }

  function hasValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function mergeData(historicalData, firebaseData) {
    const merged = { ...(historicalData || {}), ...(firebaseData || {}) };
    Object.entries(historicalData || {}).forEach(([key, value]) => {
      if (!hasValue(firebaseData?.[key]) && hasValue(value)) merged[key] = value;
    });
    return merged;
  }

  function mergeRows(firebaseRows, historicalRows) {
    const byId = new Map();
    historicalRows.filter(row => row?.id).forEach(row => {
      byId.set(String(row.id), { ...row, source: "supabase-historical" });
    });
    firebaseRows.filter(row => row?.id).forEach(row => {
      const existing = byId.get(String(row.id));
      byId.set(String(row.id), existing
        ? {
            ...existing,
            ...row,
            data: mergeData(existing.data, row.data),
            source: "firebase-with-historical-backfill"
          }
        : { ...row, source: "firebase" });
    });
    return [...byId.values()]
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }

  async function request(path, options = {}) {
    const { table, id } = parsePath(path);
    if (!table) return null;
    const method = String(options.method || "GET").toUpperCase();
    if (method === "GET") {
      const [firebaseResult, historicalResult] = await Promise.allSettled([
        id ? get(table, id) : list(table),
        supabaseRead(path)
      ]);
      const firebaseRows = firebaseResult.status === "fulfilled"
        ? firebaseResult.value
        : (cachedRows(table, true) || []);
      const historicalRows = historicalResult.status === "fulfilled" ? historicalResult.value : [];
      if (firebaseResult.status === "rejected" && !firebaseRows.length && !historicalRows.length) {
        throw firebaseResult.reason;
      }
      return mergeRows(firebaseRows, historicalRows);
    }
    if (method === "DELETE") return remove(table, id);
    const body = options.body ? JSON.parse(options.body) : [];
    return upsert(table, body);
  }

  window.HappyDecoFirebaseCloud = {
    name: "Firebase + Supabase histórico",
    isConfigured: () => Boolean(config.apiKey && config.projectId),
    request,
    pendingWrites: () => readPendingWrites().length + readPendingDeletes().length,
    quotaLimited: firebaseQuotaLimited
  };
})();
