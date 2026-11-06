// Hari & Rashmi wedding gallery.
// Reads albums.json (made by build_gallery.py). Albums are tabs across the top,
// photos sit in a tight grid, and tapping a photo opens PhotoSwipe, which
// supports swiping on phones, pinch zoom, and arrow keys on desktop.

const PHOTOSWIPE_VERSION = "5.4.4";
const PSWP_BASE = `https://cdn.jsdelivr.net/npm/photoswipe@${PHOTOSWIPE_VERSION}/dist`;
const SLIDESHOW_MS = 4000;
const DEFAULT_TITLE = "Hari & Rashmi Wedding";

const $ = (id) => document.getElementById(id);

let data = { site: {}, albums: [] };
let current = null;          // the album being shown
let items = [];              // [{ anchor, ratio }] for the current album
let columns = 0;             // how many grid columns are drawn right now
let lightbox = null;
let renderToken = 0;
let slideshowOn = false;
let slideTimer = null;
let toastTimer = null;
const tabEls = [];

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2200);
}

/* ---------- Loading ---------- */

async function loadData() {
  try {
    const response = await fetch("albums.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    data = { site: {}, albums: [] };
    const message = $("empty");
    message.textContent =
      "The albums list could not be loaded. If you opened index.html by double-clicking it, " +
      "start a local server instead (see the README), or check that albums.json was uploaded.";
    message.hidden = false;
  }
}

function applySiteInfo() {
  const site = data.site || {};
  const title = site.title || DEFAULT_TITLE;

  $("cover-title").textContent = title;
  $("brand-title").textContent = title;
  $("cover-date").textContent = site.date || "";
  $("cover-credit").textContent = site.photographer || "";
  $("brand-sub").textContent = site.photographer || "";
  $("credit").textContent = site.photographer ? `Photos by ${site.photographer}` : "";
  document.title = title;

  if (site.coverFocus) $("cover-photo").style.backgroundPosition = site.coverFocus;

  const firstAlbum = data.albums[0];
  const coverSrc = site.hero || (firstAlbum && firstAlbum.photos[0] && firstAlbum.photos[0].full);
  if (coverSrc) {
    const probe = new Image();
    probe.onload = () => {
      $("cover-photo").style.backgroundImage = `url("${coverSrc}")`;
      $("cover-photo").classList.add("is-loaded");
    };
    probe.src = coverSrc;
  }
}

/* ---------- Album tabs, with a "More" menu on wide screens ---------- */

function buildTabs() {
  tabEls.length = 0;
  for (const album of data.albums) {
    tabEls.push(el("a", { class: "tab", href: `#/${album.slug}`, text: album.title }));
  }
  fitTabs();
}

function fitTabs() {
  const tabs = $("tabs");
  const more = $("more");
  const menu = $("more-menu");

  closeMenu();
  more.hidden = true;
  menu.replaceChildren();
  tabs.replaceChildren(...tabEls);

  if (tabEls.length && window.matchMedia("(min-width: 900px)").matches) {
    const available = tabs.clientWidth;
    const gap = parseFloat(getComputedStyle(tabs).columnGap) || 30;
    const widths = tabEls.map((tab) => tab.offsetWidth);
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);

    if (total > available) {
      const reserve = 100; // room for the "More" button
      let used = 0;
      let keep = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = used + widths[i] + (i ? gap : 0);
        if (next + gap + reserve > available) break;
        used = next;
        keep = i + 1;
      }
      keep = Math.max(keep, 1);
      tabs.replaceChildren(...tabEls.slice(0, keep));
      menu.replaceChildren(...tabEls.slice(keep));
      more.hidden = false;
    }
  }
  updateActiveTab();
}

function updateActiveTab() {
  let activeInMenu = false;
  tabEls.forEach((tab, index) => {
    const isActive = current && data.albums[index] === current;
    if (isActive) {
      tab.setAttribute("aria-current", "page");
      if ($("more-menu").contains(tab)) activeInMenu = true;
    } else {
      tab.removeAttribute("aria-current");
    }
  });
  $("more-btn").classList.toggle("is-active", activeInMenu);
}

function closeMenu() {
  $("more-menu").hidden = true;
  $("more-btn").setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const willOpen = $("more-menu").hidden;
  $("more-menu").hidden = !willOpen;
  $("more-btn").setAttribute("aria-expanded", String(willOpen));
}

/* ---------- Photo grid ----------
   "rows" (default): every row has the same height and photos keep their shape,
   like the original gallery. "uniform": every cell is the same 2:3 size.
   "natural": columns with each photo's own height. Set it with "grid" in build_gallery.py. */

let mode = "rows";
let lastWidth = 0;

function gridMode() {
  const setting = data.site && data.site.grid;
  return setting === "uniform" || setting === "natural" ? setting : "rows";
}

function columnCountFor(width) {
  if (width >= 1100) return 6;
  if (width >= 860) return 5;
  if (width >= 640) return 4;
  if (width >= 440) return 3;
  return 2;
}

function layoutGrid(force = false) {
  if (mode === "rows") layoutRows(force);
  else layoutColumns(force);
}

function layoutColumns(force) {
  const grid = $("grid");
  const count = columnCountFor(grid.clientWidth || window.innerWidth);
  if (!force && count === columns && grid.childElementCount) return;
  columns = count;

  const cols = Array.from({ length: count }, () => el("div", { class: "col" }));
  const heights = new Array(count).fill(0);

  for (const item of items) {
    item.anchor.style.flex = "";
    const ratio = mode === "uniform" ? 1.5 : 1 / item.aspect;
    const shortest = heights.indexOf(Math.min(...heights));
    cols[shortest].append(item.anchor);
    heights[shortest] += ratio + 0.04; // the small extra stands in for the gap
  }
  grid.replaceChildren(...cols);
}

function layoutRows(force) {
  const grid = $("grid");
  const width = grid.clientWidth;
  if (!width) return;
  if (!force && Math.abs(width - lastWidth) < 1 && grid.childElementCount) return;
  lastWidth = width;

  const gap = parseFloat(getComputedStyle(grid).getPropertyValue("--gap")) || 6;
  const target = width < 600 ? 250 : Math.min(Math.max(width * 0.2, 180), 360);
  const heightFor = (aspectSum, count) => (width - gap * (count - 1)) / aspectSum;

  // Group photos into rows. A row is closed when adding another photo would
  // move its height further away from the target height.
  const rows = [];
  let row = [];
  let sum = 0;
  for (const item of items) {
    if (row.length) {
      const withIt = heightFor(sum + item.aspect, row.length + 1);
      const without = heightFor(sum, row.length);
      if (withIt < target && Math.abs(withIt - target) > Math.abs(without - target)) {
        rows.push({ row, height: without, full: true });
        row = [];
        sum = 0;
      }
    }
    row.push(item);
    sum += item.aspect;
  }
  if (row.length) {
    // Last row: stretch it to the full width if that looks natural,
    // otherwise keep the target height and leave it short.
    const height = heightFor(sum, row.length);
    rows.push(height <= target * 1.35
      ? { row, height, full: true }
      : { row, height: target, full: false });
  }

  const nodes = rows.map(({ row: members, height, full }) => {
    const node = el("div", { class: "row" });
    node.style.height = `${height}px`;
    for (const item of members) {
      item.anchor.style.flex = full ? `${item.aspect} 1 0` : `0 0 ${item.aspect * height}px`;
      node.append(item.anchor);
    }
    return node;
  });
  grid.replaceChildren(...nodes);
}

function showAlbum(album) {
  current = album;
  const token = ++renderToken;

  const siteTitle = (data.site && data.site.title) || DEFAULT_TITLE;
  document.title = `${album.title} | ${siteTitle}`;

  mode = gridMode();
  $("grid").classList.toggle("rows", mode === "rows");
  $("grid").classList.toggle("uniform", mode === "uniform");

  items = album.photos.map((photo, index) => {
    const image = el("img", {
      src: photo.thumb,
      alt: `${album.title}, photo ${index + 1}`,
      width: photo.w,
      height: photo.h,
      loading: "lazy",
      decoding: "async",
    });
    const anchor = el(
      "a",
      { href: photo.full, "data-index": index, target: "_blank", rel: "noopener" },
      [image]
    );
    return { anchor, aspect: photo.w / photo.h };
  });

  layoutGrid(true);
  updateActiveTab();
  startLightbox(album, token);
}

/* ---------- Swipe viewer ---------- */

const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4.5M10.5 5.5 4 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5 21.5 10.5 15 16.5v-3.5c-5.5 0-9 1.5-12 6 .8-6 4.8-9.5 12-10V4.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5v14M15.5 5v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

let playEl = null; // the play/pause button inside the open viewer

function registerViewerUI(viewer) {
  const ui = viewer.pswp.ui;
  const add = (name, order, label, html, onClick, onInit) =>
    ui.registerElement({ name, order, isButton: true, title: label, ariaLabel: label, html, onClick, onInit });

  // The viewer's own loading spinner sits at order 7 and pushes everything before it to the
  // left. Back stays left; the other buttons must come after it (order above 7) to sit on the right.
  add("back", 1, "Back to gallery", ICONS.back, (event, node, pswp) => pswp.close());
  add("download", 8, "Download photo", ICONS.download, (event, node, pswp) => downloadPhoto(pswp));
  add("share", 9, "Share", ICONS.share, () => shareGallery());
  add("play", 10, "Play slideshow", ICONS.play, () => toggleSlideshow(), (node) => {
    playEl = node;
    refreshPlayButton();
  });

  // File name under the photo, like the original gallery
  ui.registerElement({
    name: "caption",
    order: 11,
    isButton: false,
    appendTo: "root",
    html: "",
    onInit: (node, pswp) => {
      const update = () => {
        const slide = pswp.currSlide;
        node.textContent = (slide && slide.data.name) || "";
      };
      pswp.on("change", update);
      update();
    },
  });
}

function downloadPhoto(pswp) {
  const slide = pswp.currSlide;
  if (!slide) return;
  const link = el("a", { href: slide.data.src, download: slide.data.name || "photo.jpg" });
  document.body.append(link);
  link.click();
  link.remove();
}

async function startLightbox(album, token) {
  stopSlideshow();
  if (lightbox) {
    lightbox.destroy();
    lightbox = null;
  }
  $("slideshow").disabled = true;

  try {
    const module = await import(`${PSWP_BASE}/photoswipe-lightbox.esm.min.js`);
    if (token !== renderToken) return; // the person already switched albums
    const PhotoSwipeLightbox = module.default;

    const viewer = new PhotoSwipeLightbox({
      dataSource: album.photos.map((photo) => ({
        src: photo.full,
        width: photo.w,
        height: photo.h,
        msrc: photo.thumb,
        name: photo.name || "",
        alt: "",
      })),
      pswpModule: () => import(`${PSWP_BASE}/photoswipe.esm.min.js`),
      bgOpacity: 1,
      wheelToZoom: true,
      showHideAnimationType: "fade",
      paddingFn: (viewport) =>
        viewport.x < 700
          ? { top: 64, bottom: 52, left: 0, right: 0 }
          : { top: 76, bottom: 76, left: 90, right: 90 },
    });

    viewer.on("uiRegister", () => registerViewerUI(viewer));
    viewer.on("afterInit", () => {
      refreshPlayButton();
      if (slideshowOn) startSlideshowTimer();
    });
    // after someone swipes or taps an arrow, give that photo a full interval before moving on
    viewer.on("change", () => {
      if (slideshowOn && slideTimer) {
        clearInterval(slideTimer);
        slideTimer = null;
        startSlideshowTimer();
      }
    });
    viewer.on("destroy", () => {
      stopSlideshow();
      playEl = null;
    });

    viewer.init();
    lightbox = viewer;
    $("slideshow").disabled = false;
  } catch (error) {
    // If the viewer cannot load, each photo is still a normal link that opens full size.
    console.warn("Swipe viewer unavailable, photos will open as plain links.", error);
  }
}

function openPhoto(event) {
  const anchor = event.target.closest("a[data-index]");
  if (!anchor || !lightbox) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
  event.preventDefault();
  lightbox.loadAndOpen(Number(anchor.dataset.index));
}

/* ---------- Slideshow ---------- */

function refreshPlayButton() {
  // black background while the slideshow plays
  const viewerRoot = lightbox && lightbox.pswp && lightbox.pswp.element;
  if (viewerRoot) viewerRoot.classList.toggle("pswp--slideshow", slideshowOn);

  if (!playEl) return;
  playEl.innerHTML = slideshowOn ? ICONS.pause : ICONS.play;
  const label = slideshowOn ? "Pause slideshow" : "Play slideshow";
  playEl.setAttribute("aria-label", label);
  playEl.title = label;
}

function startSlideshowTimer() {
  if (slideTimer) return;
  slideTimer = setInterval(() => {
    if (lightbox && lightbox.pswp) lightbox.pswp.next();
  }, SLIDESHOW_MS);
}

// Play button in the gallery bar: open the first photo and start playing
function startSlideshow() {
  if (!lightbox) return;
  slideshowOn = true;
  lightbox.loadAndOpen(0);
}

// Play/pause button inside the open viewer
function toggleSlideshow() {
  if (slideshowOn) {
    stopSlideshow();
  } else {
    slideshowOn = true;
    startSlideshowTimer();
    refreshPlayButton();
  }
}

function stopSlideshow() {
  slideshowOn = false;
  clearInterval(slideTimer);
  slideTimer = null;
  refreshPlayButton();
}

/* ---------- Share ---------- */

async function shareGallery() {
  const url = location.href;
  const title = document.title;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch (error) {
    toast("Copy the link from the address bar");
  }
}

/* ---------- Routing ---------- */

let firstRoute = true;

function route() {
  const match = decodeURIComponent(location.hash).match(/^#\/(.+)$/);
  const target = match ? data.albums.find((a) => a.slug === match[1]) : null;
  const album = target || current || data.albums[0];
  if (!album) return;

  const changed = album !== current;
  if (changed) showAlbum(album);

  const gallery = $("gallery");
  if (firstRoute && target) {
    gallery.scrollIntoView({ behavior: "instant", block: "start" });
  } else if (changed && window.scrollY > gallery.offsetTop) {
    gallery.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  firstRoute = false;
}

/* ---------- Start ---------- */

await loadData();
applySiteInfo();
if (data.albums.length === 0 && $("empty").hidden) $("empty").hidden = false;
buildTabs();
route();

window.addEventListener("hashchange", () => {
  closeMenu();
  route();
});

$("grid").addEventListener("click", openPhoto);
$("share").addEventListener("click", shareGallery);
$("slideshow").addEventListener("click", startSlideshow);
$("more-btn").addEventListener("click", toggleMenu);
$("cover-link").addEventListener("click", (event) => {
  event.preventDefault();
  $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.addEventListener("click", (event) => {
  if (!$("more").contains(event.target)) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

let resizeFrame = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    layoutGrid();
    fitTabs();
  });
}).observe(document.body);
