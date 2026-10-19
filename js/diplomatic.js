(function initialiseDiplomaticArchive(global) {
  "use strict";

  const documents = global.DIPLOMATIC_DOCUMENTS || [];
  const catalogue = document.querySelector("#diplomatic-catalogue");
  if (!catalogue) return;

  const elements = {
    room: document.querySelector("#archive-room"),
    catalogue,
    panel: document.querySelector("#diplomatic-catalogue-panel"),
    records: document.querySelector("#diplomatic-records"),
    closeCatalogue: document.querySelector("#diplomatic-close"),
    backdrop: catalogue.querySelector(".diplomatic__backdrop"),
    viewer: document.querySelector("#document-viewer"),
    back: document.querySelector("#document-back"),
    closeDocument: document.querySelector("#document-close"),
    kicker: document.querySelector("#document-kicker"),
    title: document.querySelector("#document-title"),
    viewport: document.querySelector("#document-viewport"),
    image: document.querySelector("#document-image"),
    previous: document.querySelector("#document-previous"),
    next: document.querySelector("#document-next"),
    counter: document.querySelector("#document-counter"),
    zoomOut: document.querySelector("#document-zoom-out"),
    zoomIn: document.querySelector("#document-zoom-in"),
    zoomOutput: document.querySelector("#document-zoom"),
    reset: document.querySelector("#document-reset"),
    fullscreen: document.querySelector("#archive-fullscreen")
  };

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2.5;
  const ZOOM_STEP = .25;
  let isCatalogueOpen = false;
  let isDocumentOpen = false;
  let activeDocument = null;
  let currentPage = 0;
  let catalogueScroll = 0;
  let opener = null;
  let documentOpener = null;
  let zoom = MIN_ZOOM;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let pageChangeTimer = 0;

  const scrollIcon = `
    <svg viewBox="0 0 36 46" aria-hidden="true">
      <path d="M7 7.5h22v31H7zM4 7.5h6M26 7.5h6M4 38.5h6M26 38.5h6"/>
      <path d="M11.5 15h13M11.5 20h13M11.5 25h9M11.5 30h11"/>
    </svg>`;

  function renderRecords() {
    const fragment = document.createDocumentFragment();
    documents.forEach((record) => {
      const button = document.createElement("button");
      button.className = "diplomatic-record";
      button.type = "button";
      button.dataset.documentId = record.id;
      button.setAttribute("aria-label", `Open ${record.title}, ${record.year}`);
      button.innerHTML = `
        <span class="diplomatic-record__icon">${scrollIcon}</span>
        <span class="diplomatic-record__main">
          <span class="diplomatic-record__title">${record.title}</span>
          <span class="diplomatic-record__description">${record.description}</span>
        </span>
        <span class="diplomatic-record__details">
          <span class="diplomatic-record__parties">${record.parties}</span>
        </span>
        <span class="diplomatic-record__year">${record.year}</span>
        <span class="diplomatic-record__category">${record.category}</span>
        <span class="diplomatic-record__arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m9.5 5 7 7-7 7"/></svg>
        </span>`;
      button.addEventListener("click", () => openDocument(record, button));
      fragment.append(button);
    });
    elements.records.replaceChildren(fragment);
  }

  function openCatalogue(sourceElement) {
    if (isCatalogueOpen) return;
    opener = sourceElement || document.activeElement;
    isCatalogueOpen = true;
    elements.catalogue.setAttribute("aria-hidden", "false");
    elements.catalogue.classList.add("is-open");
    document.body.classList.add("is-diplomatic-open");
    if (elements.room) elements.room.inert = true;
    requestAnimationFrame(() => elements.closeCatalogue.focus({ preventScroll: true }));
  }

  function closeCatalogue() {
    if (!isCatalogueOpen) return;
    if (isDocumentOpen) closeDocument(false);
    isCatalogueOpen = false;
    elements.catalogue.classList.remove("is-open");
    elements.catalogue.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-diplomatic-open");
    if (elements.room) elements.room.inert = false;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  function preloadPages(record) {
    record.pages.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }

  function openDocument(record, sourceElement) {
    activeDocument = record;
    documentOpener = sourceElement;
    currentPage = 0;
    catalogueScroll = elements.panel.scrollTop;
    preloadPages(record);
    elements.kicker.textContent = `${record.category} · ${record.year} · ${record.parties}`;
    elements.title.textContent = record.title;
    elements.viewer.hidden = false;
    elements.viewer.setAttribute("aria-hidden", "false");
    elements.panel.inert = true;
    isDocumentOpen = true;
    setDocumentPage(0, false);
    requestAnimationFrame(() => {
      elements.viewer.classList.add("is-open");
      elements.back.focus({ preventScroll: true });
    });
  }

  function closeDocument(restoreFocus = true) {
    if (!isDocumentOpen) return;
    window.clearTimeout(pageChangeTimer);
    isDocumentOpen = false;
    activeDocument = null;
    drag = null;
    elements.viewer.classList.remove("is-open");
    elements.viewer.setAttribute("aria-hidden", "true");
    elements.panel.inert = false;
    elements.panel.scrollTop = catalogueScroll;
    elements.viewer.hidden = true;
    resetView();
    if (restoreFocus && documentOpener && document.contains(documentOpener)) {
      documentOpener.focus({ preventScroll: true });
    }
  }

  function setDocumentPage(index, animate = true) {
    if (!activeDocument || index < 0 || index >= activeDocument.pages.length) return;
    window.clearTimeout(pageChangeTimer);
    const applyPage = () => {
      currentPage = index;
      resetView();
      elements.image.src = activeDocument.pages[currentPage];
      elements.image.alt = `${activeDocument.title}, page ${currentPage + 1} of ${activeDocument.pages.length}`;
      elements.counter.textContent = `Page ${currentPage + 1} of ${activeDocument.pages.length}`;
      elements.previous.disabled = currentPage === 0;
      elements.next.disabled = currentPage === activeDocument.pages.length - 1;
      const reveal = () => requestAnimationFrame(() => elements.viewport.classList.remove("is-changing"));
      if (elements.image.complete) reveal();
      else elements.image.addEventListener("load", reveal, { once: true });
    };

    if (!animate) {
      applyPage();
      return;
    }
    elements.viewport.classList.add("is-changing");
    pageChangeTimer = window.setTimeout(applyPage, 105);
  }

  function clampPan() {
    if (zoom <= MIN_ZOOM) {
      panX = 0;
      panY = 0;
      return;
    }
    const maxX = Math.max(0, (elements.image.offsetWidth * zoom - elements.viewport.clientWidth) / 2);
    const maxY = Math.max(0, (elements.image.offsetHeight * zoom - elements.viewport.clientHeight) / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  }

  function renderView() {
    clampPan();
    elements.image.style.setProperty("--document-zoom", zoom.toFixed(2));
    elements.image.style.setProperty("--pan-x", `${panX}px`);
    elements.image.style.setProperty("--pan-y", `${panY}px`);
    elements.zoomOutput.value = `${Math.round(zoom * 100)}%`;
    elements.zoomOutput.textContent = `${Math.round(zoom * 100)}%`;
    elements.zoomOut.disabled = zoom <= MIN_ZOOM;
    elements.zoomIn.disabled = zoom >= MAX_ZOOM;
    elements.viewport.classList.toggle("is-zoomed", zoom > MIN_ZOOM);
  }

  function setZoom(nextZoom, clientX, clientY) {
    const previousZoom = zoom;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(nextZoom * 100) / 100));
    if (Number.isFinite(clientX) && Number.isFinite(clientY) && previousZoom !== zoom) {
      const rect = elements.viewport.getBoundingClientRect();
      const pointX = clientX - (rect.left + rect.width / 2);
      const pointY = clientY - (rect.top + rect.height / 2);
      const ratio = zoom / previousZoom;
      panX = pointX - (pointX - panX) * ratio;
      panY = pointY - (pointY - panY) * ratio;
    }
    renderView();
  }

  function resetView() {
    zoom = MIN_ZOOM;
    panX = 0;
    panY = 0;
    renderView();
  }

  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    elements.viewport.classList.remove("is-dragging");
    if (elements.viewport.hasPointerCapture(event.pointerId)) elements.viewport.releasePointerCapture(event.pointerId);
  }

  function fullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function trapFocus(event) {
    const scope = isDocumentOpen ? elements.viewer : elements.panel;
    const focusable = Array.from(scope.querySelectorAll("button:not([disabled]), [tabindex='0']"))
      .filter((item) => !item.hidden && item.offsetParent !== null);
    if (elements.fullscreen && !elements.fullscreen.disabled) focusable.push(elements.fullscreen);
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && index === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  }

  elements.closeCatalogue.addEventListener("click", closeCatalogue);
  elements.backdrop.addEventListener("click", closeCatalogue);
  elements.back.addEventListener("click", () => closeDocument());
  elements.closeDocument.addEventListener("click", () => closeDocument());
  elements.previous.addEventListener("click", () => setDocumentPage(currentPage - 1));
  elements.next.addEventListener("click", () => setDocumentPage(currentPage + 1));
  elements.zoomOut.addEventListener("click", () => setZoom(zoom - ZOOM_STEP));
  elements.zoomIn.addEventListener("click", () => setZoom(zoom + ZOOM_STEP));
  elements.reset.addEventListener("click", resetView);

  elements.viewport.addEventListener("wheel", (event) => {
    if (!isDocumentOpen) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
  }, { passive: false });

  elements.viewport.addEventListener("pointerdown", (event) => {
    if (!isDocumentOpen || zoom <= MIN_ZOOM || event.button !== 0) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
    elements.viewport.setPointerCapture(event.pointerId);
    elements.viewport.classList.add("is-dragging");
  });

  elements.viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    panX = drag.panX + event.clientX - drag.x;
    panY = drag.panY + event.clientY - drag.y;
    renderView();
  });
  elements.viewport.addEventListener("pointerup", endDrag);
  elements.viewport.addEventListener("pointercancel", endDrag);
  elements.image.addEventListener("load", renderView);
  window.addEventListener("resize", renderView, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (!isCatalogueOpen) return;
    if (event.key === "Escape") {
      if (fullscreenActive()) return;
      event.preventDefault();
      if (isDocumentOpen) closeDocument();
      else closeCatalogue();
    } else if (isDocumentOpen && event.key === "ArrowLeft") {
      event.preventDefault();
      setDocumentPage(currentPage - 1);
    } else if (isDocumentOpen && event.key === "ArrowRight") {
      event.preventDefault();
      setDocumentPage(currentPage + 1);
    } else if (isDocumentOpen && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      setZoom(zoom + ZOOM_STEP);
    } else if (isDocumentOpen && event.key === "-") {
      event.preventDefault();
      setZoom(zoom - ZOOM_STEP);
    } else if (isDocumentOpen && event.key === "0") {
      event.preventDefault();
      resetView();
    } else if (event.key === "Tab") {
      trapFocus(event);
    }
  });

  renderRecords();
  global.DiplomaticArchive = Object.freeze({ openCatalogue, closeCatalogue, closeDocument });
})(window);
