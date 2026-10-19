const config = window.ARCHIVE_CONFIG;
const room = document.querySelector("#archive-room");
const scene = document.querySelector("#archive-scene");
const background = document.querySelector("#archive-background");
const hotspots = document.querySelector("#archive-hotspots");

function sizeScene() {
  const sourceWidth = background.naturalWidth || 1672;
  const sourceHeight = background.naturalHeight || 941;
  // Fill the browser at every aspect ratio. The scene and its hotspots share
  // these dimensions, so the interactive regions stay locked to the artwork
  // even when a small amount of the image is cropped at an edge.
  const scale = Math.max(window.innerWidth / sourceWidth, window.innerHeight / sourceHeight);
  const renderedWidth = Math.round(sourceWidth * scale);
  const renderedHeight = Math.round(sourceHeight * scale);

  scene.style.width = `${renderedWidth}px`;
  scene.style.height = `${renderedHeight}px`;
  // Portrait screens crop heavily at the sides. Focus the configured section
  // of the room so the primary collectible remains visible and aligned.
  const portraitFocusX = config.room?.portraitFocusX ?? 0.5;
  const focusedLeft = Math.round((window.innerWidth / 2) - (renderedWidth * portraitFocusX));
  const sceneLeft = renderedWidth > window.innerWidth
    ? Math.min(0, Math.max(window.innerWidth - renderedWidth, focusedLeft))
    : Math.round((window.innerWidth - renderedWidth) / 2);
  scene.style.left = `${sceneLeft}px`;
  scene.style.top = `${Math.round((window.innerHeight - renderedHeight) / 2)}px`;
}

function makeArchiveObject(object) {
  const collection = config.collections[object.collectionId];
  if (!collection || object.visible === false) return null;

  const button = document.createElement("button");
  const placement = object.placement || object.hotspot;
  if (!placement) return null;

  const { x, y, width, height, rotation = 0 } = placement;
  button.className = "archive-object";
  if (object.presentation === "hotspot") button.classList.add("archive-object--hotspot");
  if (object.highlightOnHover) button.classList.add("archive-object--highlighted-hotspot");
  if (object.labelSide === "left") button.classList.add("archive-object--label-left");
  button.type = "button";
  button.setAttribute("aria-label", `Open ${collection.title}`);
  button.style.left = `${x * 100}%`;
  button.style.top = `${y * 100}%`;
  button.style.width = `${width * 100}%`;
  if (height) button.style.height = `${height * 100}%`;
  button.style.setProperty("--object-rotation", `${rotation}deg`);
  button.dataset.objectId = object.id;
  button.dataset.debug = `${object.id} · x ${x.toFixed(3)} · y ${y.toFixed(3)} · w ${width.toFixed(3)} · r ${rotation.toFixed(1)}°`;
  button.innerHTML = `
    ${object.presentation === "image" && object.imageSrc ? `
      <img
        class="archive-object__image"
        src="${object.imageSrc}"
        alt=""
        draggable="false"
      >
    ` : ""}
    <span class="archive-object__label" aria-hidden="true">
      <span class="archive-object__title">${object.title || collection.title}</span>
      ${object.presentation === "hotspot" ? "" : `<span class="archive-object__creator">${collection.creator}</span>`}
      ${object.presentation === "hotspot" ? "" : `<span class="archive-object__provenance">${collection.provenance}</span>`}
    </span>
  `;

  if (config.debugHotspots) button.classList.add("is-debug");
  button.addEventListener("click", () => {
    if (collection.type === "document-catalogue" && window.DiplomaticArchive?.openCatalogue) {
      window.DiplomaticArchive.openCatalogue(button);
      return;
    }
    if (collection.type === "map-catalogue" && window.CartographicArchive?.openCatalogue) {
      window.CartographicArchive.openCatalogue(button);
      return;
    }
    if (window.ArchiveReader?.open) {
      window.ArchiveReader.open(collection, button);
      return;
    }

    const protocolNotice = document.querySelector("#file-protocol-notice");
    if (protocolNotice) protocolNotice.hidden = false;
  });
  return button;
}

function buildHotspots() {
  const fragment = document.createDocumentFragment();
  config.objects.forEach((object) => {
    const archiveObject = makeArchiveObject(object);
    if (archiveObject) fragment.append(archiveObject);
  });
  hotspots.replaceChildren(fragment);
}

function initialiseRoom() {
  sizeScene();
  buildHotspots();
  requestAnimationFrame(() => room.classList.add("is-ready"));
}

if (background.complete) initialiseRoom();
else background.addEventListener("load", initialiseRoom, { once: true });

window.addEventListener("resize", sizeScene, { passive: true });
