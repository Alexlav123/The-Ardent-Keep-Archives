(function initialiseFullscreenControl() {
  "use strict";

  const button = document.querySelector("#archive-fullscreen");
  const label = button?.querySelector(".archive__fullscreen-label");
  const root = document.documentElement;
  const requestFullscreen = root.requestFullscreen
    || root.webkitRequestFullscreen
    || root.mozRequestFullScreen
    || root.msRequestFullscreen;
  const exitFullscreen = document.exitFullscreen
    || document.webkitExitFullscreen
    || document.mozCancelFullScreen
    || document.msExitFullscreen;

  if (!button) return;
  if (button.dataset.fullscreenReady === "true") return;
  button.dataset.fullscreenReady = "true";

  function getFullscreenElement() {
    return document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement
      || document.msFullscreenElement
      || null;
  }

  function syncFullscreenState() {
    const isFullscreen = getFullscreenElement() === root;
    button.classList.toggle("is-fullscreen", isFullscreen);
    button.setAttribute("aria-pressed", String(isFullscreen));
    button.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
    if (label) label.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      window.ArchiveReader?.resize?.();
    });
  }

  async function toggleFullscreen() {
    if (typeof requestFullscreen !== "function" || typeof exitFullscreen !== "function") return;
    try {
      if (getFullscreenElement()) await exitFullscreen.call(document);
      else await requestFullscreen.call(root);
    } catch (_) {
      syncFullscreenState();
    }
  }

  button.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenState);
  document.addEventListener("webkitfullscreenchange", syncFullscreenState);
  document.addEventListener("mozfullscreenchange", syncFullscreenState);
  document.addEventListener("MSFullscreenChange", syncFullscreenState);
  document.addEventListener("fullscreenerror", syncFullscreenState);
  if (typeof requestFullscreen !== "function" || typeof exitFullscreen !== "function") {
    button.disabled = true;
    button.title = "Fullscreen is unavailable in this browser";
  }
  syncFullscreenState();
})();
