// Compatibility bridge for browsers holding an older cached page shell. The
// reader script is already versioned with content updates, so it can restore
// the global fullscreen control without requiring a manual cache purge.
(function ensureArchiveFullscreenControl() {
  let button = document.querySelector("#archive-fullscreen");
  if (!button) {
    button = document.createElement("button");
    button.className = "archive__fullscreen";
    button.id = "archive-fullscreen";
    button.type = "button";
    button.setAttribute("aria-label", "Enter fullscreen");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<span class="archive__fullscreen-icon" aria-hidden="true"></span><span class="archive__fullscreen-label">Fullscreen</span>';
    document.querySelector(".archive")?.appendChild(button);
  }

  button.hidden = false;

  if (getComputedStyle(button).position !== "fixed") {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "css/archive.css?v=fullscreen-visible-2";
    document.head.appendChild(stylesheet);
  }

  if (button.dataset.fullscreenReady !== "true" && !document.querySelector("script[data-fullscreen-fallback]")) {
    const script = document.createElement("script");
    script.src = "js/fullscreen.js?v=fullscreen-visible-2";
    script.dataset.fullscreenFallback = "true";
    document.head.appendChild(script);
  }
})();

const elements = {
  reader: document.querySelector("#reader"),
  backdrop: document.querySelector("#reader-backdrop"),
  title: document.querySelector("#reader-title"),
  meta: document.querySelector("#reader-meta"),
  inspect: document.querySelector("#reader-inspect"),
  sound: document.querySelector("#reader-sound"),
  contents: document.querySelector("#reader-contents"),
  close: document.querySelector("#reader-close"),
  previous: document.querySelector("#reader-previous"),
  next: document.querySelector("#reader-next"),
  status: document.querySelector("#reader-status"),
  bookShell: document.querySelector("#reader-book-shell"),
  bookStage: document.querySelector("#reader-book-stage"),
  hardcover: document.querySelector("#reader-hardcover"),
  insideFront: document.querySelector("#reader-inside-front"),
  insideBack: document.querySelector("#reader-inside-back"),
  book: document.querySelector("#reader-book"),
  counter: document.querySelector("#reader-counter"),
  currentPage: document.querySelector("#reader-current-page"),
  counterSeparator: document.querySelector("#reader-counter-separator"),
  totalPages: document.querySelector("#reader-total-pages"),
  inspection: document.querySelector("#reader-inspection"),
  inspectionTitle: document.querySelector("#inspection-title"),
  inspectionViewport: document.querySelector("#inspection-viewport"),
  inspectionImage: document.querySelector("#inspection-image"),
  inspectionZoom: document.querySelector("#inspection-zoom"),
  zoomOut: document.querySelector("#inspection-zoom-out"),
  zoomIn: document.querySelector("#inspection-zoom-in"),
  zoomReset: document.querySelector("#inspection-reset"),
  inspectionClose: document.querySelector("#inspection-close")
};

let pageFlip = null;
let activeCollection = null;
let activeBookPages = [];
let isOpen = false;
let opener = null;
let loadToken = 0;
let isFlipAnimating = false;
let isInspectSelecting = false;
let isInspecting = false;
let inspectionOpener = null;
let inspectedPageNumber = null;
let inspectionLoadToken = 0;
let fitScale = 1;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let dragState = null;
let lastSoundSpreadIndex = null;
let soundPlayedForTurn = false;
let isUserFolding = false;
let soundGuardTimer = null;

const PAGE_FLIP_DURATION = 440;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
const SOUND_PREFERENCE_KEY = "ardent-keep-page-sound-muted";
const turnAudio = new Audio("assets/audio/page_turn.mp3");
turnAudio.preload = "auto";
turnAudio.volume = 0.3;

function readSoundPreference() {
  try { return localStorage.getItem(SOUND_PREFERENCE_KEY) === "true"; }
  catch (_) { return false; }
}

let isSoundMuted = readSoundPreference();

function setSoundMuted(muted, persist = true) {
  isSoundMuted = Boolean(muted);
  turnAudio.muted = isSoundMuted;
  elements.sound.classList.toggle("is-muted", isSoundMuted);
  elements.sound.setAttribute("aria-pressed", String(!isSoundMuted));
  elements.sound.setAttribute("aria-label", isSoundMuted ? "Enable page-turn sound" : "Mute page-turn sound");
  if (persist) {
    try { localStorage.setItem(SOUND_PREFERENCE_KEY, String(isSoundMuted)); }
    catch (_) { /* Preference storage may be unavailable in private contexts. */ }
  }
}

function playTurnSound() {
  if (isSoundMuted) return;
  turnAudio.pause();
  turnAudio.currentTime = 0;
  const playback = turnAudio.play();
  if (playback?.catch) playback.catch(() => {});
}

function setStatus(message, isError = false) {
  elements.status.hidden = false;
  elements.status.classList.toggle("is-error", isError);
  elements.status.innerHTML = isError
    ? `<p>${message}</p>`
    : `<span class="reader__loader" aria-hidden="true"></span><p>${message}</p>`;
}

function safeErrorMessage() {
  return "The recovered pages could not be prepared. Please check that the collection files are available, then try again.";
}

function destroyPageFlip() {
  if (pageFlip) {
    try { pageFlip.destroy(); } catch (error) { console.warn("PageFlip cleanup warning:", error); }
    pageFlip = null;
  }

  if (!document.contains(elements.book)) {
    const replacement = document.createElement("div");
    replacement.className = "reader__book";
    replacement.id = "reader-book";
    replacement.setAttribute("aria-label", "The Blacktower Papers flipbook");
    elements.bookStage.appendChild(replacement);
    elements.book = replacement;
  } else {
    elements.book.replaceChildren();
  }
}

function preloadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(source);
    image.onerror = () => reject(new Error(`Unable to load book asset: ${source}`));
    image.src = source;
  });
}

async function loadCollectionPages(collection) {
  const book = collection.book;
  if (!book?.insideFront || !book?.insideBack || !book.contentPages?.length) {
    throw new Error(`Collection ${collection.id} is missing its image-book manifest.`);
  }

  const pages = book.contentPages.map((source, index) => ({
    kind: "content",
    source,
    contentNumber: index + 1
  }));

  await Promise.all([
    book.insideFront,
    book.insideBack,
    ...pages.map((page) => page.source)
  ].map(preloadImage));
  return pages;
}

function configurePhysicalBacking(collection) {
  const book = collection.book;
  const oversize = Number.isFinite(book.coverOversize) ? book.coverOversize : 0.035;
  const oversizePercent = Math.max(0, oversize) * 100;

  elements.insideFront.src = book.insideFront;
  elements.insideBack.src = book.insideBack;
  elements.insideBack.classList.toggle("is-mirrored", book.mirrorInsideBack === true);
  // X is halved because the stage contains two page widths; each outer edge
  // still extends by the configured percentage of one manuscript page.
  elements.bookStage.style.setProperty("--cover-overhang-x", `${oversizePercent / 2}%`);
  elements.bookStage.style.setProperty("--cover-overhang-y", `${oversizePercent}%`);
}

function setFlipState(event) {
  const state = event?.data;
  if (state === "user_fold") isUserFolding = true;
  if (state === "flipping" && !soundPlayedForTurn) {
    playTurnSound();
    soundPlayedForTurn = true;
  }
  if (state === "read") {
    window.clearTimeout(soundGuardTimer);
    soundGuardTimer = window.setTimeout(() => {
      soundPlayedForTurn = false;
      isUserFolding = false;
    }, 0);
  }

  isFlipAnimating = state !== "read";
  elements.bookShell.classList.toggle("is-flipping", isFlipAnimating);

  if (isFlipAnimating) {
    elements.previous.disabled = true;
    elements.next.disabled = true;
    elements.contents.disabled = true;
  } else {
    elements.contents.disabled = false;
    updateControls();
  }
}

function handlePageFlip(event) {
  if (!pageFlip) return;
  const pageIndex = typeof event?.data === "number" ? event.data : pageFlip.getCurrentPageIndex();
  const pages = pageFlip.getPageCollection();
  const spreadIndex = pages.getSpreadIndexByPage(pageIndex) ?? 0;
  if (isUserFolding && !soundPlayedForTurn && lastSoundSpreadIndex !== null && spreadIndex !== lastSoundSpreadIndex) {
    playTurnSound();
    soundPlayedForTurn = true;
  }
  lastSoundSpreadIndex = spreadIndex;
  updateControls(event);
}

function navigate(action) {
  if (!pageFlip || isFlipAnimating || isInspectSelecting || isInspecting || pageFlip.getState() !== "read") return false;
  action();
  return true;
}

function updateControls(event) {
  if (!pageFlip || !activeCollection) return;
  const pageIndex = typeof event?.data === "number" ? event.data : pageFlip.getCurrentPageIndex();
  const pageCollection = pageFlip.getPageCollection();
  const spreads = pageCollection.getSpread();
  const spreadIndex = pageCollection.getSpreadIndexByPage(pageIndex) ?? 0;
  const visiblePages = spreads[spreadIndex] || [pageIndex];
  const contentNumbers = visiblePages
    .map((index) => activeBookPages[index]?.contentNumber)
    .filter(Number.isInteger);
  const totalContentPages = activeCollection.book.contentPages.length;

  if (contentNumbers.length) {
    const first = contentNumbers[0];
    const last = contentNumbers.at(-1);
    elements.currentPage.textContent = first === last ? String(first) : `${first}\u2013${last}`;
    elements.counterSeparator.hidden = false;
    elements.totalPages.hidden = false;
    elements.counter.setAttribute("aria-label", `Content pages ${elements.currentPage.textContent} of ${totalContentPages}`);
  }

  elements.totalPages.textContent = String(totalContentPages);
  const inspectionBlocksNavigation = isInspectSelecting || isInspecting;
  elements.previous.disabled = inspectionBlocksNavigation || spreadIndex <= 0;
  elements.next.disabled = inspectionBlocksNavigation || spreadIndex >= spreads.length - 1;
  elements.contents.disabled = inspectionBlocksNavigation || isFlipAnimating;
  elements.inspect.disabled = isFlipAnimating || !contentNumbers.length;
}

function setInspectionSelection(enabled) {
  if (!isOpen || !pageFlip || isFlipAnimating || isInspecting) enabled = false;
  isInspectSelecting = Boolean(enabled);
  elements.reader.classList.toggle("is-selecting-page", isInspectSelecting);
  elements.inspect.setAttribute("aria-pressed", String(isInspectSelecting));
  elements.inspect.setAttribute("aria-label", isInspectSelecting
    ? "Cancel page inspection"
    : "Inspect a visible manuscript page");
  updateControls();
}

function clampPan() {
  if (!elements.inspectionImage.naturalWidth) return;
  const viewportWidth = elements.inspectionViewport.clientWidth;
  const viewportHeight = elements.inspectionViewport.clientHeight;
  const renderedWidth = elements.inspectionImage.naturalWidth * fitScale * zoomLevel;
  const renderedHeight = elements.inspectionImage.naturalHeight * fitScale * zoomLevel;
  const maxX = Math.max(0, (renderedWidth - viewportWidth) / 2);
  const maxY = Math.max(0, (renderedHeight - viewportHeight) / 2);
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
}

function renderInspectionTransform() {
  clampPan();
  const scale = fitScale * zoomLevel;
  elements.inspectionImage.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${scale})`;
  elements.inspectionZoom.textContent = `${Math.round(zoomLevel * 100)}%`;
  elements.zoomOut.disabled = zoomLevel <= MIN_ZOOM;
  elements.zoomIn.disabled = zoomLevel >= MAX_ZOOM;
  elements.inspectionViewport.classList.toggle("can-pan", zoomLevel > MIN_ZOOM);
}

function calculateInspectionFit() {
  if (!isInspecting || !elements.inspectionImage.naturalWidth) return;
  const padding = 32;
  const availableWidth = Math.max(1, elements.inspectionViewport.clientWidth - padding);
  const availableHeight = Math.max(1, elements.inspectionViewport.clientHeight - padding);
  fitScale = Math.min(
    availableWidth / elements.inspectionImage.naturalWidth,
    availableHeight / elements.inspectionImage.naturalHeight,
    1
  );
  renderInspectionTransform();
}

function setInspectionZoom(nextZoom, clientX, clientY) {
  if (!isInspecting || !elements.inspectionImage.naturalWidth) return;
  const previousZoom = zoomLevel;
  const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  if (clampedZoom === previousZoom) return;

  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const rect = elements.inspectionViewport.getBoundingClientRect();
    const cursorX = clientX - rect.left - rect.width / 2;
    const cursorY = clientY - rect.top - rect.height / 2;
    const ratio = clampedZoom / previousZoom;
    panX = cursorX - (cursorX - panX) * ratio;
    panY = cursorY - (cursorY - panY) * ratio;
  } else {
    const ratio = clampedZoom / previousZoom;
    panX *= ratio;
    panY *= ratio;
  }

  zoomLevel = clampedZoom;
  renderInspectionTransform();
}

function resetInspection() {
  zoomLevel = MIN_ZOOM;
  panX = 0;
  panY = 0;
  renderInspectionTransform();
}

function openInspection(contentPage) {
  const pageData = activeBookPages.find((page) => page.contentNumber === Number(contentPage));
  if (!pageData || isInspecting) return;

  inspectionOpener = elements.inspect;
  inspectedPageNumber = pageData.contentNumber;
  isInspecting = true;
  setInspectionSelection(false);
  elements.reader.classList.add("is-inspecting");
  document.body.classList.add("is-inspecting");
  elements.inspection.hidden = false;
  elements.inspection.setAttribute("aria-hidden", "false");
  elements.inspectionTitle.textContent = `${activeCollection.title} — manuscript page ${pageData.contentNumber}`;
  elements.inspectionImage.alt = `${activeCollection.title}, enlarged manuscript page ${pageData.contentNumber}`;
  elements.inspectionImage.removeAttribute("src");
  zoomLevel = MIN_ZOOM;
  panX = 0;
  panY = 0;
  fitScale = 1;
  const token = ++inspectionLoadToken;
  elements.inspectionImage.onload = () => {
    if (!isInspecting || token !== inspectionLoadToken) return;
    calculateInspectionFit();
    elements.inspectionViewport.focus({ preventScroll: true });
  };
  elements.inspectionImage.src = pageData.source;
  updateControls();
}

function closeInspection(restoreFocus = true) {
  if (!isInspecting) return;
  isInspecting = false;
  inspectedPageNumber = null;
  inspectionLoadToken += 1;
  dragState = null;
  elements.inspectionViewport.classList.remove("is-dragging", "can-pan");
  elements.inspection.hidden = true;
  elements.inspection.setAttribute("aria-hidden", "true");
  elements.reader.classList.remove("is-inspecting");
  document.body.classList.remove("is-inspecting");
  updateControls();
  if (restoreFocus && inspectionOpener && document.contains(inspectionOpener)) {
    inspectionOpener.focus({ preventScroll: true });
  }
}

function resizeReader() {
  if (isInspecting) requestAnimationFrame(calculateInspectionFit);
}

function createPageElement(pageData, viewerIndex, collection) {
  const page = document.createElement("div");
  page.className = "reader__page";
  page.dataset.pageKind = pageData.kind;
  page.dataset.viewerPage = String(viewerIndex + 1);
  if (pageData.contentNumber) page.dataset.contentPage = String(pageData.contentNumber);

  const image = document.createElement("img");
  image.className = "reader__page-image";
  image.src = pageData.source;
  image.alt = pageData.kind === "content"
    ? `${collection.title}, manuscript page ${pageData.contentNumber}`
    : `${collection.title}, ${pageData.kind.replaceAll("-", " ")}`;
  image.draggable = false;
  page.appendChild(image);

  if (pageData.contentNumber === collection.contentsPage) {
    for (const entry of collection.entries || []) {
      if (!entry.contentsRegion) continue;
      const region = entry.contentsRegion;
      const fragmentLabel = entry.fragment ? " — fragment" : "";
      const accessibleLabel = `${entry.label} - ${entry.date}${fragmentLabel}`;
      const link = document.createElement("button");
      link.className = "reader__contents-link";
      link.type = "button";
      link.dataset.readerJumpPage = String(entry.startPage);
      link.setAttribute("aria-label", `Open ${accessibleLabel}`);
      link.style.left = `${region.x * 100}%`;
      link.style.top = `${region.y * 100}%`;
      link.style.width = `${region.width * 100}%`;
      link.style.height = `${region.height * 100}%`;
      link.innerHTML = `<span class="sr-only">${accessibleLabel}</span>`;
      page.appendChild(link);
    }
  }

  return page;
}

function jumpToContentPage(contentPage) {
  if (!pageFlip || isFlipAnimating || pageFlip.getState() !== "read") return;
  const requestedPage = Number(contentPage);
  const pageIndex = activeBookPages.findIndex((page) => page.contentNumber === requestedPage);
  if (pageIndex < 0) return;

  const pages = pageFlip.getPageCollection();
  const currentSpread = pages.getSpreadIndexByPage(pageFlip.getCurrentPageIndex());
  const targetSpread = pages.getSpreadIndexByPage(pageIndex);

  if (currentSpread === targetSpread) {
    pageFlip.turnToPage(pageIndex);
    updateControls();
    return;
  }

  navigate(() => pageFlip.flip(pageIndex, "top"));
}

function createPageFlip(bookPages, collection) {
  destroyPageFlip();
  activeBookPages = bookPages;
  const pageElements = bookPages.map((pageData, index) => (
    createPageElement(pageData, index, collection)
  ));

  pageFlip = new window.St.PageFlip(elements.book, {
    width: 760,
    height: 1074,
    size: "stretch",
    minWidth: 260,
    maxWidth: 760,
    minHeight: 368,
    maxHeight: 1074,
    maxShadowOpacity: 0.42,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    flippingTime: PAGE_FLIP_DURATION,
    drawShadow: true,
    autoSize: true,
    clickEventForward: true,
    showPageCorners: true,
    disableFlipByClick: false
  });

  pageFlip.loadFromHTML(pageElements);
  pageFlip.on("flip", handlePageFlip);
  pageFlip.on("changeOrientation", updateControls);
  pageFlip.on("changeState", setFlipState);
  isFlipAnimating = false;
  lastSoundSpreadIndex = pageFlip.getPageCollection().getSpreadIndexByPage(pageFlip.getCurrentPageIndex()) ?? 0;
  updateControls();
}

async function open(collection, sourceElement) {
  if (!collection || collection.type !== "image-book") return;

  activeCollection = collection;
  opener = sourceElement || document.activeElement;
  isOpen = true;
  const token = ++loadToken;

  elements.title.textContent = collection.title;
  elements.meta.innerHTML = `${collection.creator} <span aria-hidden="true">·</span> ${collection.provenance}`;
  configurePhysicalBacking(collection);
  elements.reader.setAttribute("aria-hidden", "false");
  elements.reader.classList.add("is-open");
  elements.bookShell.hidden = true;
  elements.bookShell.classList.remove("is-ready");
  elements.contents.hidden = true;
  elements.inspect.hidden = true;
  elements.counter.hidden = true;
  setStatus(`Opening ${collection.title}…`);
  document.body.classList.add("is-reader-open");
  elements.close.focus({ preventScroll: true });

  try {
    const pages = await loadCollectionPages(collection);
    if (!isOpen || token !== loadToken) return;
    createPageFlip(pages, collection);
    elements.status.hidden = true;
    elements.bookShell.hidden = false;
    elements.counter.hidden = false;
    elements.contents.hidden = !collection.contentsPage;
    elements.inspect.hidden = false;
    requestAnimationFrame(() => elements.bookShell.classList.add("is-ready"));
  } catch (error) {
    console.error("Unable to open archive collection:", error);
    if (!isOpen || token !== loadToken) return;
    destroyPageFlip();
    elements.bookShell.hidden = true;
    elements.counter.hidden = true;
    setStatus(safeErrorMessage(), true);
  }
}

function close() {
  if (!isOpen) return;
  closeInspection(false);
  setInspectionSelection(false);
  isOpen = false;
  loadToken += 1;
  isFlipAnimating = false;
  lastSoundSpreadIndex = null;
  soundPlayedForTurn = false;
  isUserFolding = false;
  window.clearTimeout(soundGuardTimer);
  elements.reader.classList.remove("is-open");
  elements.reader.setAttribute("aria-hidden", "true");
  elements.bookShell.classList.remove("is-ready");
  elements.contents.hidden = true;
  document.body.classList.remove("is-reader-open");

  window.setTimeout(() => {
    if (isOpen) return;
    destroyPageFlip();
    elements.bookShell.hidden = true;
    elements.counter.hidden = true;
    elements.status.hidden = true;
  }, PAGE_FLIP_DURATION + 60);

  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
}

elements.close.addEventListener("click", close);
elements.sound.addEventListener("click", () => setSoundMuted(!isSoundMuted));
elements.inspect.addEventListener("click", () => setInspectionSelection(!isInspectSelecting));
elements.contents.addEventListener("click", () => jumpToContentPage(activeCollection?.contentsPage));
elements.previous.addEventListener("click", () => navigate(() => pageFlip.flipPrev()));
elements.next.addEventListener("click", () => navigate(() => pageFlip.flipNext()));

elements.backdrop.addEventListener("click", close);
elements.bookShell.addEventListener("pointerdown", (event) => {
  if (!isInspectSelecting) return;
  const selectedPage = event.target.closest(".reader__page[data-content-page]");
  if (!selectedPage) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openInspection(selectedPage.dataset.contentPage);
}, true);

elements.bookShell.addEventListener("click", (event) => {
  const contentsLink = event.target.closest("[data-reader-jump-page]");
  if (contentsLink) {
    event.preventDefault();
    event.stopPropagation();
    jumpToContentPage(contentsLink.dataset.readerJumpPage);
    return;
  }

  if (!event.target.closest(".reader__book") && !event.target.closest(".reader__turn")) close();
});

elements.zoomOut.addEventListener("click", () => setInspectionZoom(zoomLevel - ZOOM_STEP));
elements.zoomIn.addEventListener("click", () => setInspectionZoom(zoomLevel + ZOOM_STEP));
elements.zoomReset.addEventListener("click", resetInspection);
elements.inspectionClose.addEventListener("click", () => closeInspection());

elements.inspectionViewport.addEventListener("wheel", (event) => {
  if (!isInspecting) return;
  event.preventDefault();
  event.stopPropagation();
  const direction = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  setInspectionZoom(zoomLevel + direction, event.clientX, event.clientY);
}, { passive: false });

elements.inspectionViewport.addEventListener("pointerdown", (event) => {
  if (!isInspecting || zoomLevel <= MIN_ZOOM || event.button !== 0) return;
  event.preventDefault();
  dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
  elements.inspectionViewport.setPointerCapture(event.pointerId);
  elements.inspectionViewport.classList.add("is-dragging");
});

elements.inspectionViewport.addEventListener("pointermove", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  panX = dragState.panX + event.clientX - dragState.x;
  panY = dragState.panY + event.clientY - dragState.y;
  renderInspectionTransform();
});

function endInspectionDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  elements.inspectionViewport.classList.remove("is-dragging");
  if (elements.inspectionViewport.hasPointerCapture(event.pointerId)) {
    elements.inspectionViewport.releasePointerCapture(event.pointerId);
  }
}

elements.inspectionViewport.addEventListener("pointerup", endInspectionDrag);
elements.inspectionViewport.addEventListener("pointercancel", endInspectionDrag);

document.addEventListener("keydown", (event) => {
  if (!isOpen) return;

  if (event.key === "Escape") {
    event.preventDefault();
    if (isInspecting) closeInspection();
    else if (isInspectSelecting) setInspectionSelection(false);
    else close();
  } else if (isInspecting && (event.key === "+" || event.key === "=")) {
    event.preventDefault();
    setInspectionZoom(zoomLevel + ZOOM_STEP);
  } else if (isInspecting && event.key === "-") {
    event.preventDefault();
    setInspectionZoom(zoomLevel - ZOOM_STEP);
  } else if (isInspecting && event.key === "0") {
    event.preventDefault();
    resetInspection();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    navigate(() => pageFlip.flipPrev());
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    navigate(() => pageFlip.flipNext());
  } else if (event.key === "Tab") {
    if (isInspecting) {
      const inspectionFocusable = [elements.inspectionViewport, elements.zoomOut, elements.zoomIn, elements.zoomReset, elements.inspectionClose]
        .filter((item) => !item.hidden && !item.disabled);
      const inspectionIndex = inspectionFocusable.indexOf(document.activeElement);
      if (event.shiftKey && inspectionIndex <= 0) {
        event.preventDefault();
        inspectionFocusable.at(-1)?.focus();
      } else if (!event.shiftKey && inspectionIndex === inspectionFocusable.length - 1) {
        event.preventDefault();
        inspectionFocusable[0]?.focus();
      }
      return;
    }
    const pageLinks = Array.from(elements.book.querySelectorAll(".reader__contents-link"))
      .filter((item) => item.offsetParent !== null);
    const focusable = [elements.inspect, elements.sound, elements.contents, ...pageLinks, elements.previous, elements.next, elements.close, document.querySelector("#archive-fullscreen")]
      .filter((item) => !item.hidden && !item.disabled);
    const currentIndex = focusable.indexOf(document.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  }
});

window.addEventListener("resize", resizeReader, { passive: true });
setSoundMuted(isSoundMuted, false);

window.ArchiveReader = Object.freeze({ open, close, resize: resizeReader });
