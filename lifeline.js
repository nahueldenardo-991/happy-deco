(function () {
  const steps = [
    ["consulta", "Consulta", "Consulta"],
    ["presupuesto", "Presupuesto", "Presup."],
    ["confirmado", "Confirmado", "Conf."],
    ["proceso", "Proceso", "Proc."],
    ["produccion", "Producción", "Prod."],
    ["realizado", "Realizado", "Real."],
    ["finanzas", "Finanzas", "Fin."]
  ];

  function text(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function has(record, fields) {
    return fields.every(field => text(record?.[field]));
  }

  function hasAny(record, fields) {
    return fields.some(field => text(record?.[field]));
  }

  function materialCount(record) {
    const materials = record?.materials || record?.materiales || record?.productionMaterials;
    if (Array.isArray(materials)) return materials.filter(Boolean).length;
    if (typeof materials === "string") return materials.split(/\n|,/).map(item => item.trim()).filter(Boolean).length;
    return 0;
  }

  function isPastDate(value) {
    if (!value) return false;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  function isToday(value) {
    if (!value) return false;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  }

  function isSignedStage(stageKey) {
    return stageKey === "senado"
      || stageKey === "señado"
      || stageKey === "se?ado"
      || stageKey.includes("seã")
      || (stageKey.startsWith("se") && stageKey.endsWith("ado") && stageKey.includes("n"));
  }

  function calculate(record) {
    const stage = text(record?.etapa || record?.commercialStage);
    const stageKey = lower(stage);
    const operative = text(record?.estadoOperativo || record?.operativeStatus);
    const operativeKey = lower(operative);
    const status = lower(record?.status);
    const production = text(record?.productionStatus || record?.estadoProduccion);
    const productionKey = lower(production);
    const date = record?.fechaEvento || record?.date;
    const signed = isSignedStage(stageKey);
    const confirmed = signed || ["pagado completo", "realizado"].includes(stageKey);
    const cancelled = stageKey === "cancelado";
    const proposalReady = signed || ["presupuesto enviado", "pagado completo", "realizado"].includes(stageKey);
    const missingBasics = !has(record, ["cliente", "fechaEvento", "tematica", "propuesta", "responsable", "lugar"])
      && !has(record, ["client", "date", "theme"]);
    const hasSketch = Boolean(record?.sketch?.dataUrl || record?.sketchDataUrl || record?.bocetoUrl);
    const hasMaterials = materialCount(record) > 0;
    const processActive = Boolean(record?.dashboardRecordId || record?.id || status);
    const processAdvanced = ["compras pendientes", "en produccion", "en producción", "listo para producir", "listo para montar"].includes(operativeKey)
      || ["produccion", "montaje", "cerrado"].includes(status);
    const productionActive = ["listo para producir", "en produccion", "en producción", "en preparacion", "en preparación", "materiales listos", "listo para montar", "decorado"].includes(operativeKey)
      || ["listo para producir", "en preparacion", "en preparación", "materiales listos", "decorado"].includes(productionKey)
      || ["produccion", "montaje"].includes(status)
      || hasSketch
      || hasMaterials;
    const finalized = productionKey === "finalizado";
    const done = stageKey === "realizado" || operativeKey === "realizado" || finalized || status === "cerrado";
    const billing = lower(record?.facturacion || record?.billing || "pendiente");
    const balance = num(record?.saldo || record?.balance);
    const costLoaded = num(record?.costo || record?.actualCost) > 0;
    const billingResolved = ["facturado", "no requiere factura"].includes(billing);
    const financeComplete = done && balance <= 0 && billingResolved && costLoaded;
    const financeAttention = confirmed && (balance > 0 || !billingResolved || (done && !costLoaded));

    return [
      {
        id: "consulta",
        label: "Consulta",
        state: cancelled ? "danger" : missingBasics ? "warning" : ["consulta nueva", "datos incompletos", "seguimiento"].includes(stageKey) ? "current" : "done",
        note: missingBasics ? "Faltan datos básicos" : "Consulta registrada"
      },
      {
        id: "presupuesto",
        label: "Presupuesto",
        state: cancelled ? "danger" : proposalReady ? "done" : hasAny(record, ["propuesta", "monto", "budget", "package"]) ? "current" : "warning",
        note: proposalReady ? "Presupuesto avanzado" : "Revisar propuesta o monto"
      },
      {
        id: "confirmado",
        label: "Confirmado",
        state: cancelled ? "danger" : confirmed ? "done" : stageKey === "presupuesto enviado" ? "current" : "pending",
        note: confirmed ? "Evento confirmado" : cancelled ? "Cancelado" : "Pendiente de seña o pago"
      },
      {
        id: "proceso",
        label: "Proceso",
        state: cancelled ? "danger" : processAdvanced ? "done" : processActive && confirmed ? (hasSketch || hasMaterials || !missingBasics ? "current" : "warning") : "pending",
        note: processAdvanced ? "Proceso avanzado" : "Revisar boceto, materiales o datos"
      },
      {
        id: "produccion",
        label: "Producción",
        state: cancelled ? "danger" : finalized ? "done" : productionActive ? (hasMaterials && (hasSketch || processAdvanced) ? "current" : "warning") : "pending",
        note: finalized ? "Producción finalizada" : productionActive ? "Preparación activa" : "Todavía no corresponde"
      },
      {
        id: "realizado",
        label: "Realizado",
        state: cancelled ? "danger" : done ? "done" : isPastDate(date) ? "warning" : isToday(date) ? "current" : "pending",
        note: done ? "Cerrado como realizado" : isPastDate(date) ? "Fecha pasada sin cierre" : "Pendiente"
      },
      {
        id: "finanzas",
        label: "Finanzas",
        state: cancelled ? "danger" : financeComplete ? "done" : financeAttention ? "warning" : confirmed ? "current" : "pending",
        note: financeComplete ? "Cierre financiero completo" : financeAttention ? "Revisar saldo, facturación o costos" : "No muestra importes sensibles"
      }
    ];
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render(record, options = {}) {
    const isCompact = Boolean(options.compact);
    const compact = isCompact ? " event-lifeline-compact" : "";
    const aria = options.label || "Línea de vida del evento";
    return `
      <div class="event-lifeline${compact}" role="group" aria-label="${escapeHtml(aria)}">
        <div class="event-lifeline-title">${escapeHtml(options.title || "Línea de vida del evento")}</div>
        <div class="event-lifeline-track">
          ${calculate(record).map(step => `
            <div class="event-life-step ${escapeHtml(step.state)}" title="${escapeHtml(`${step.label}: ${step.note}`)}">
              <span class="event-life-dot" aria-hidden="true"></span>
              <span class="event-life-label">${escapeHtml(isCompact ? compactLabel(step.id) : step.label)}</span>
            </div>
          `).join("")}
        </div>
        ${isCompact ? "" : `
          <div class="event-lifeline-legend" aria-label="Referencias de color">
            <span class="event-life-legend-item"><span class="event-life-legend-dot"></span>Pendiente</span>
            <span class="event-life-legend-item"><span class="event-life-legend-dot current"></span>En curso</span>
            <span class="event-life-legend-item"><span class="event-life-legend-dot done"></span>Completo</span>
            <span class="event-life-legend-item"><span class="event-life-legend-dot warning"></span>Atención</span>
            <span class="event-life-legend-item"><span class="event-life-legend-dot danger"></span>Problema</span>
          </div>
        `}
      </div>
    `;
  }

  function compactLabel(id) {
    const found = steps.find(step => step[0] === id);
    return found?.[2] || id;
  }

  window.HappyDecoLifeline = { calculate, render };
})();
