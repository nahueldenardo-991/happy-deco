(function () {
  const script = document.currentScript;
  const baseUrl = script ? new URL("mascots/", script.src).href : "assets/mascots/";
  const assets = {
    save: "save-bunny.gif",
    wait: "wait-elephant.gif",
    setup: "setup-bear.gif",
    success: "success-unicorn.gif",
    build: "build-puppy.gif",
    general: "general-arch.gif",
    update: "setup-bear.gif",
    error: "wait-elephant.gif"
  };

  function src(type) {
    return baseUrl + (assets[type] || assets.general);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function textWithoutMascot(button) {
    return Array.from(button.childNodes)
      .filter(node => !(node.nodeType === 1 && node.classList?.contains("happy-loader-button-mascot")))
      .map(node => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function typeForText(text) {
    const value = String(text || "").toLowerCase();
    if (/guard|save|sincron|subiendo|boceto|material|item/.test(value)) return "save";
    if (/actualiz|refresh|nube|firebase|datos/.test(value)) return "wait";
    if (/prepar|produc|arm|evento/.test(value)) return "build";
    if (/listo|complet|ok|actualizado|guardado/.test(value)) return "success";
    if (/error|no se pudo|fall/.test(value)) return "error";
    return "general";
  }

  function mascot(type, className, alt) {
    const image = document.createElement("img");
    image.className = className;
    image.src = src(type);
    image.alt = alt || "";
    image.loading = "eager";
    image.decoding = "async";
    return image;
  }

  function decorateButton(button, forcedType) {
    if (!button || button.dataset.happyLoaderLocked === "1") return;
    const text = textWithoutMascot(button);
    if (!text) return;
    const loading = /actualizando|cargando|guardando|sincronizando|subiendo|preparando|leyendo|creando/i.test(text);
    const done = /actualizado|guardado|listo|completo/i.test(text);
    if (!loading && !done) {
      button.classList.remove("happy-loader-button");
      button.dataset.happyLoaderType = "";
      button.querySelector(".happy-loader-button-mascot")?.remove();
      return;
    }
    const type = forcedType || typeForText(text);
    if (button.dataset.happyLoaderType === type && button.querySelector(".happy-loader-button-mascot")) return;
    button.classList.add("happy-loader-button");
    button.querySelector(".happy-loader-button-mascot")?.remove();
    button.dataset.happyLoaderType = type;
    button.prepend(mascot(type, "happy-loader-button-mascot", ""));
  }

  function setButton(button, type, label) {
    if (!button) return () => {};
    if (!button.dataset.happyLoaderOriginal) button.dataset.happyLoaderOriginal = button.textContent.trim();
    button.dataset.happyLoaderLocked = "1";
    button.disabled = true;
    button.classList.add("happy-loader-button");
    button.innerHTML = "";
    button.append(mascot(type || "general", "happy-loader-button-mascot", ""));
    button.append(document.createTextNode(label || "Trabajando..."));
    return () => {
      button.dataset.happyLoaderLocked = "";
      button.disabled = false;
      button.textContent = button.dataset.happyLoaderOriginal || "";
      decorateButton(button);
    };
  }

  function status(target, type, message) {
    if (!target) return;
    target.classList.add("happy-loader-status");
    target.innerHTML = `<img class="happy-loader-status-mascot" src="${src(type || typeForText(message))}" alt=""> <span>${escapeHtml(message || "Trabajando...")}</span>`;
  }

  function textStatus(target, message) {
    if (!target) return;
    target.classList.remove("happy-loader-status");
    target.textContent = message || "";
  }

  function card(type, title, body) {
    return `<div class="happy-loader-card" role="status" aria-live="polite">
      <img src="${src(type || "general")}" alt="">
      <div><strong>${escapeHtml(title || "Preparando información")}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ""}</div>
    </div>`;
  }

  function watchButtons() {
    document.querySelectorAll("button").forEach(button => decorateButton(button));
    const observer = new MutationObserver(mutations => {
      const seen = new Set();
      mutations.forEach(mutation => {
        const button = mutation.target.closest?.("button") || (mutation.target.matches?.("button") ? mutation.target : null);
        if (button && !seen.has(button)) {
          seen.add(button);
          requestAnimationFrame(() => decorateButton(button));
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.HappyLoader = { src, status, textStatus, card, setButton, decorateButton };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchButtons);
  } else {
    watchButtons();
  }
})();
