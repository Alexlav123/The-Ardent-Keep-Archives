(function initialiseCartographicArchive(global) {
  "use strict";

  const maps = global.CARTOGRAPHIC_MAPS || [];
  const catalogue = document.querySelector("#cartographic-catalogue");
  if (!catalogue) return;

  const elements = {
    room: document.querySelector("#archive-room"),
    catalogue,
    panel: document.querySelector("#cartographic-catalogue-panel"),
    regions: document.querySelector("#cartographic-regions"),
    closeCatalogue: document.querySelector("#cartographic-close"),
    backdrop: catalogue.querySelector(".cartographic__backdrop"),
    viewer: document.querySelector("#map-viewer"),
    back: document.querySelector("#map-back"),
    closeMap: document.querySelector("#map-close"),
    kicker: document.querySelector("#map-viewer-kicker"),
    title: document.querySelector("#map-viewer-title"),
    viewport: document.querySelector("#map-viewport"),
    image: document.querySelector("#map-image"),
    zoomOut: document.querySelector("#map-zoom-out"),
    zoomIn: document.querySelector("#map-zoom-in"),
    zoomOutput: document.querySelector("#map-zoom"),
    fit: document.querySelector("#map-fit"),
    fullscreen: document.querySelector("#archive-fullscreen")
  };

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = .25;
  let isCatalogueOpen = false;
  let isMapOpen = false;
  let activeMap = null;
  let opener = null;
  let mapOpener = null;
  let catalogueScroll = 0;
  let zoom = MIN_ZOOM;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let pinch = null;
  const pointers = new Map();

  function yearSortValue(map) {
    if (Number.isFinite(map.year)) return map.year;
    if (Number.isFinite(map.approximateYear)) return map.approximateYear;
    return Number.POSITIVE_INFINITY;
  }

  function displayYear(map) {
    if (Number.isFinite(map.year)) return String(map.year);
    if (Number.isFinite(map.approximateYear)) return `c. ${map.approximateYear}`;
    return "Date unknown";
  }

  function optionalMetadata(map) {
    return [
      map.cartographer ? `<dt>Cartographer</dt><dd>${map.cartographer}</dd>` : "",
      map.provenance ? `<dt>Provenance</dt><dd>${map.provenance}</dd>` : ""
    ].join("");
  }

  function renderCatalogue() {
    const byRegion = new Map();
    maps.forEach((map) => {
      const region = map.continent || map.region || "Region unknown";
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region).push(map);
    });

    const fragment = document.createDocumentFragment();
    Array.from(byRegion.keys()).sort((a, b) => a.localeCompare(b)).forEach((regionName) => {
      const section = document.createElement("section");
      section.className = "cartographic-region";
      const heading = document.createElement("h3");
      heading.className = "cartographic-region__heading";
      heading.textContent = regionName;
      const grid = document.createElement("div");
      grid.className = "cartographic-region__maps";

      byRegion.get(regionName)
        .slice()
        .sort((a, b) => yearSortValue(a) - yearSortValue(b) || a.title.localeCompare(b.title))
        .forEach((map) => {
          const button = document.createElement("button");
          button.className = "map-card";
          button.type = "button";
          button.dataset.mapId = map.id;
          button.setAttribute("aria-label", `Inspect ${map.title}`);
          button.innerHTML = `
            <span class="map-card__thumbnail">
              <img src="${map.image}" alt="Preview of ${map.title}" loading="lazy" draggable="false">
            </span>
            <span class="map-card__content">
              <span class="map-card__title">${map.title}</span>
              <dl class="map-card__metadata">
                <dt>Continent</dt><dd>${map.continent || map.region || "Unknown"}</dd>
                <dt>Year</dt><dd>${displayYear(map)}</dd>
                <dt>Type</dt><dd>${map.type || "Map"}</dd>
                ${optionalMetadata(map)}
              </dl>
              ${map.description ? `<span class="map-card__description">${map.description}</span>` : ""}
            </span>`;
          button.addEventListener("click", () => openMap(map, button));
          grid.append(button);
        });

      section.append(heading, grid);
      fragment.append(section);
    });
    elements.regions.replaceChildren(fragment);
  }

  function openCatalogue(sourceElement) {
    if (isCatalogueOpen) return;
    opener = sourceElement || document.activeElement;
    isCatalogueOpen = true;
    elements.catalogue.setAttribute("aria-hidden", "false");
    elements.catalogue.classList.add("is-open");
    document.body.classList.add("is-cartographic-open");
    if (elements.room) elements.room.inert = true;
    requestAnimationFrame(() => elements.closeCatalogue.focus({ preventScroll: true }));
  }

  function closeCatalogue() {
    if (!isCatalogueOpen) return;
    if (isMapOpen) closeMap(false);
    isCatalogueOpen = false;
    elements.catalogue.classList.remove("is-open");
    elements.catalogue.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-cartographic-open");
    if (elements.room) elements.room.inert = false;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  function openMap(map, sourceElement) {
    activeMap = map;
    mapOpener = sourceElement;
    catalogueScroll = elements.panel.scrollTop;
    elements.kicker.textContent = `${map.continent || map.region || "Unknown region"} · ${displayYear(map)} · ${map.type || "Map"}`;
    elements.title.textContent = map.title;
    elements.image.alt = `${map.title}, full-size map`;
    elements.viewport.classList.add("is-loading");
    elements.image.src = map.image;
    elements.viewer.hidden = false;
    elements.viewer.setAttribute("aria-hidden", "false");
    elements.panel.inert = true;
    isMapOpen = true;
    resetView();
    if (elements.image.complete && elements.image.naturalWidth) elements.viewport.classList.remove("is-loading");
    requestAnimationFrame(() => {
      elements.viewer.classList.add("is-open");
      elements.back.focus({ preventScroll: true });
    });
  }

  function closeMap(restoreFocus = true) {
    if (!isMapOpen) return;
    isMapOpen = false;
    activeMap = null;
    drag = null;
    pinch = null;
    pointers.clear();
    elements.viewer.classList.remove("is-open");
    elements.viewer.setAttribute("aria-hidden", "true");
    elements.panel.inert = false;
    elements.panel.scrollTop = catalogueScroll;
    elements.viewer.hidden = true;
    resetView();
    if (restoreFocus && mapOpener && document.contains(mapOpener)) mapOpener.focus({ preventScroll: true });
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
    elements.image.style.setProperty("--map-zoom", zoom.toFixed(2));
    elements.image.style.setProperty("--map-pan-x", `${panX}px`);
    elements.image.style.setProperty("--map-pan-y", `${panY}px`);
    elements.zoomOutput.value = `${Math.round(zoom * 100)}%`;
    elements.zoomOutput.textContent = `${Math.round(zoom * 100)}%`;
    elements.zoomOut.disabled = zoom <= MIN_ZOOM;
    elements.zoomIn.disabled = zoom >= MAX_ZOOM;
    elements.fit.disabled = zoom <= MIN_ZOOM && panX === 0 && panY === 0;
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

  function beginPinch() {
    const points = Array.from(pointers.values());
    if (points.length !== 2) return;
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    pinch = {
      distance: Math.hypot(dx, dy),
      zoom,
      panX,
      panY,
      centerX: (points[0].x + points[1].x) / 2,
      centerY: (points[0].y + points[1].y) / 2
    };
    drag = null;
  }

  function updatePinch() {
    if (!pinch || pointers.size !== 2) return;
    const points = Array.from(pointers.values());
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.zoom * distance / Math.max(1, pinch.distance)));
    const rect = elements.viewport.getBoundingClientRect();
    const pointX = pinch.centerX - (rect.left + rect.width / 2);
    const pointY = pinch.centerY - (rect.top + rect.height / 2);
    const ratio = nextZoom / pinch.zoom;
    zoom = Math.round(nextZoom * 100) / 100;
    panX = pointX - (pointX - pinch.panX) * ratio;
    panY = pointY - (pointY - pinch.panY) * ratio;
    renderView();
  }

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (elements.viewport.hasPointerCapture(event.pointerId)) elements.viewport.releasePointerCapture(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      drag = null;
      elements.viewport.classList.remove("is-dragging");
    }
  }

  function fullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function trapFocus(event) {
    const scope = isMapOpen ? elements.viewer : elements.panel;
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
  elements.back.addEventListener("click", () => closeMap());
  elements.closeMap.addEventListener("click", () => closeMap());
  elements.zoomOut.addEventListener("click", () => setZoom(zoom - ZOOM_STEP));
  elements.zoomIn.addEventListener("click", () => setZoom(zoom + ZOOM_STEP));
  elements.fit.addEventListener("click", resetView);

  elements.viewport.addEventListener("wheel", (event) => {
    if (!isMapOpen) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
  }, { passive: false });

  elements.viewport.addEventListener("pointerdown", (event) => {
    if (!isMapOpen || event.button !== 0) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    elements.viewport.setPointerCapture(event.pointerId);
    if (pointers.size === 2) beginPinch();
    else if (zoom > MIN_ZOOM) {
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
      elements.viewport.classList.add("is-dragging");
    }
  });

  elements.viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch) updatePinch();
    else if (drag && drag.pointerId === event.pointerId) {
      panX = drag.panX + event.clientX - drag.x;
      panY = drag.panY + event.clientY - drag.y;
      renderView();
    }
  });

  elements.viewport.addEventListener("pointerup", releasePointer);
  elements.viewport.addEventListener("pointercancel", releasePointer);
  elements.image.addEventListener("load", () => {
    elements.viewport.classList.remove("is-loading");
    renderView();
  });
  window.addEventListener("resize", renderView, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (!isCatalogueOpen) return;
    if (event.key === "Escape") {
      if (fullscreenActive()) return;
      event.preventDefault();
      if (isMapOpen) closeMap();
      else closeCatalogue();
    } else if (isMapOpen && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      setZoom(zoom + ZOOM_STEP);
    } else if (isMapOpen && event.key === "-") {
      event.preventDefault();
      setZoom(zoom - ZOOM_STEP);
    } else if (isMapOpen && event.key === "0") {
      event.preventDefault();
      resetView();
    } else if (event.key === "Tab") {
      trapFocus(event);
    }
  });

  renderCatalogue();
  global.CartographicArchive = Object.freeze({ openCatalogue, closeCatalogue, closeMap });
})(window);
