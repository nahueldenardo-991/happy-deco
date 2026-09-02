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
      }
    } catch {
      // Keep the raw detail when Firebase returns plain text.
    }
    throw new Error(`${response.status} ${detail}`);
  }

  async function list(table) {
    const result = await parseResponse(await fetch(withKey(collectionUrl(table)), { cache: "no-store" }));
    return (result.documents || [])
      .map(rowFromDocument)
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }

  async function get(table, id) {
    const response = await fetch(withKey(documentUrl(table, id)), { cache: "no-store" });
    if (response.status === 404) return [];
    return [rowFromDocument(await parseResponse(response))].filter(Boolean);
  }

  async function upsert(table, rows) {
    const listRows = Array.isArray(rows) ? rows : [rows];
    const saved = [];
    for (const row of listRows) {
      if (!row?.id) continue;
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
      saved.push({ id: row.id, data: row.data || {}, updated_at: updatedAt });
    }
    return saved;
  }

  async function remove(table, id) {
    if (!id) return null;
    const response = await fetch(withKey(documentUrl(table, id)), { method: "DELETE", cache: "no-store" });
    if (response.status === 404) return null;
    return parseResponse(response);
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
      const [firebaseRows, historicalRows] = await Promise.all([
        id ? get(table, id) : list(table),
        supabaseRead(path)
      ]);
      return mergeRows(firebaseRows, historicalRows);
    }
    if (method === "DELETE") return remove(table, id);
    const body = options.body ? JSON.parse(options.body) : [];
    return upsert(table, body);
  }

  window.HappyDecoFirebaseCloud = {
    name: "Firebase + Supabase histórico",
    isConfigured: () => Boolean(config.apiKey && config.projectId),
    request
  };
})();
