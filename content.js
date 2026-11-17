// ── State ──
let activeVideo = null;
let hideTimeout = null;
let currentBaseScale = 1.0;
let nativeVideoFullscreen = false;
let touchButton = null;

const HIDE_DELAY_MS = 15000;
const SHOW_ZONE_Y = 90;
const HIDE_ZONE_Y = 150;
const DEFAULT_TIME_TEXT = "0:00";

// ── Shadow DOM piercing video finder ──
function findVideo(root) {
  if (!root) return null;

  if (root instanceof HTMLVideoElement) {
    return root;
  }

  if (typeof root.querySelector === "function") {
    const directVideo = root.querySelector("video");
    if (directVideo) return directVideo;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;

  while (node) {
    if (node.shadowRoot) {
      const found = findVideo(node.shadowRoot);
      if (found) return found;
    }

    node = walker.nextNode();
  }

  return null;
}

// ── Format seconds → H:MM:SS or M:SS ──
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_TIME_TEXT;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const paddedS = String(s).padStart(2, "0");

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${paddedS}`;
  }

  return `${m}:${paddedS}`;
}

// ── Build toolbar ──
const toolbar = document.createElement("div");
toolbar.id = "time-skipper-toolbar";
toolbar.setAttribute("popover", "manual");
toolbar.setAttribute("role", "toolbar");
toolbar.setAttribute("aria-label", "Video skip controls");

// A popover enters the browser's top layer, even when <video> is fullscreen.
// Isolate its styles from the page. Native video has no rendered child subtree,
// so its overlay lives outside it and routes pointer input by hit testing.
const toolbarHost = document.createElement("div");
const toolbarRoot = toolbarHost.attachShadow({ mode: "open" });
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = chrome.runtime.getURL("style.css");
stylesheet.addEventListener("load", () => applyScale(currentBaseScale));
toolbarRoot.append(stylesheet, toolbar);

const backGroup = document.createElement("div");
backGroup.className = "skipper-group";

const timeDisplay = document.createElement("span");
timeDisplay.id = "skipper-time";
timeDisplay.textContent = DEFAULT_TIME_TEXT;

const fwdGroup = document.createElement("div");
fwdGroup.className = "skipper-group";

const backSkips = [-60, -30, -10, -5];
const fwdSkips = [5, 10, 30, 60];

for (const amount of backSkips) {
  backGroup.appendChild(makeButton(amount));
}

for (const amount of fwdSkips) {
  fwdGroup.appendChild(makeButton(amount));
}

toolbar.append(backGroup, timeDisplay, fwdGroup);

function makeButton(amount) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "skipper-btn";
  btn.dataset.skip = String(amount);
  btn.textContent = `${amount > 0 ? "+" : ""}${amount}s`;
  return btn;
}

// Intercept before document/player capture listeners. Handle clicks here because
// stopping propagation at window also prevents the toolbar's own listeners.
function handleToolbarInteraction(e) {
  const path = e.composedPath();
  const hit = hitTestToolbar(e);
  if (!path.includes(toolbar) && !hit.inside) return;

  e.stopImmediatePropagation();
  resetHideTimer();

  const button = path.find(
    (node) => node instanceof Element && node.matches(".skipper-btn")
  ) || hit.button;
  if (e.type === "keydown" || e.type === "keyup") {
    if (button && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if ((e.key === "Enter" && e.type === "keydown") ||
          (e.key === " " && e.type === "keyup")) {
        skipTime(Number(button.dataset.skip));
      }
    }
    return;
  }
  if (e.cancelable) e.preventDefault();

  if (e.type === "touchstart") touchButton = button;
  // Touch defaults are canceled, so handle the tap here instead of waiting for
  // a synthesized mouse click. This also avoids seeking twice on touchscreens.
  if (e.type === "click" || (e.type === "touchend" && button === touchButton)) {
    if (button) skipTime(Number(button.dataset.skip));
  }
  if (e.type === "touchend" || e.type === "touchcancel") touchButton = null;
}

function hitTestToolbar(e) {
  if (!nativeVideoFullscreen || !toolbar.classList.contains("visible")) {
    return { inside: false, button: null };
  }
  const point = e.touches?.[0] || e.changedTouches?.[0] || e;
  const contains = (rect) => point.clientX >= rect.left &&
    point.clientX <= rect.right && point.clientY >= rect.top &&
    point.clientY <= rect.bottom;
  const inside = contains(toolbar.getBoundingClientRect());
  const button = inside ? [...toolbar.querySelectorAll(".skipper-btn")].find(
    (candidate) => contains(candidate.getBoundingClientRect())
  ) : null;
  return { inside, button };
}

for (const type of [
  "pointerdown", "pointerup", "pointercancel", "mousedown", "mouseup",
  "click", "dblclick", "auxclick", "contextmenu", "touchstart", "touchend", "touchcancel",
  "keydown", "keyup",
]) {
  window.addEventListener(type, handleToolbarInteraction, {
    capture: true,
    passive: false,
  });
}

// ── Video management ──
function setActiveVideo(video) {
  if (activeVideo === video) return;

  if (activeVideo) {
    activeVideo.removeEventListener("timeupdate", updateTimeDisplay);
  }

  activeVideo = video;

  if (activeVideo) {
    activeVideo.addEventListener("timeupdate", updateTimeDisplay);
  }

  updateTimeDisplay();
}

// ── Skip logic ──
function skipTime(amount) {
  resetHideTimer();

  if (!activeVideo || !activeVideo.isConnected) {
    setActiveVideo(findVideo(getFullscreenElement()));
  }

  if (!activeVideo) return;

  let nextTime = activeVideo.currentTime + amount;

  if (Number.isFinite(activeVideo.duration)) {
    nextTime = Math.min(nextTime, activeVideo.duration);
  }

  activeVideo.currentTime = Math.max(0, nextTime);
  updateTimeDisplay();
}

// ── Time display updater ──
function updateTimeDisplay() {
  timeDisplay.textContent = activeVideo
    ? formatTime(activeVideo.currentTime)
    : DEFAULT_TIME_TEXT;
}

// ── Auto-hide timer ──
function resetHideTimer() {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    toolbar.classList.remove("visible");
  }, HIDE_DELAY_MS);
}

function showToolbar() {
  if (!activeVideo || !activeVideo.isConnected) {
    setActiveVideo(findVideo(getFullscreenElement()));
  }
  if (!activeVideo) {
    hideToolbar();
    return;
  }
  toolbar.classList.add("visible");
  resetHideTimer();
}

function hideToolbar(clearTimer = true) {
  toolbar.classList.remove("visible");

  if (clearTimer) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// ── Show/hide with hysteresis ──
function handleMouseMove(e) {
  const hit = hitTestToolbar(e);
  for (const button of toolbar.querySelectorAll(".skipper-btn")) {
    button.classList.toggle("pointer-hover", button === hit.button);
  }
  if (e.composedPath().includes(toolbar) || hit.inside) {
    resetHideTimer();
    return;
  }
  if (e.clientY < SHOW_ZONE_Y) {
    showToolbar();
  } else if (e.clientY > HIDE_ZONE_Y) {
    hideToolbar();
  }
}

// ── Fullscreen handling ──
function getFullscreenElement() {
  let element = document.fullscreenElement;
  while (element?.shadowRoot?.fullscreenElement) {
    element = element.shadowRoot.fullscreenElement;
  }
  return element;
}

function handleFullscreenChange() {
  const fsEl = getFullscreenElement();
  nativeVideoFullscreen = fsEl instanceof HTMLVideoElement;

  if (fsEl) {
    setActiveVideo(findVideo(fsEl));

    const mount = nativeVideoFullscreen
      ? document.documentElement
      : fsEl.shadowRoot || fsEl;
    if (toolbarHost.parentNode !== mount) mount.append(toolbarHost);
    // Reopen after each fullscreen transition to put the toolbar above the new
    // fullscreen element in the top layer.
    if (toolbar.matches(":popover-open")) toolbar.hidePopover();
    toolbar.showPopover();
    applyScale(currentBaseScale);

    hideToolbar();
    document.removeEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousemove", handleMouseMove, {
      passive: true,
    });
  } else {
    setActiveVideo(null);
    document.removeEventListener("mousemove", handleMouseMove);
    clearTimeout(hideTimeout);
    hideTimeout = null;

    hideToolbar();
    if (toolbar.matches(":popover-open")) toolbar.hidePopover();
    toolbarHost.remove();
  }
}

document.addEventListener("fullscreenchange", handleFullscreenChange);

// ── Sizing Logic & Zoom Correction ──
function applyScale(baseScale) {
  const value = Number(baseScale);
  currentBaseScale = Number.isFinite(value) && value > 0 ? value : 1;

  const requestedScale = currentBaseScale / (window.devicePixelRatio || 1);
  const fitScale = toolbar.offsetWidth > 0
    ? Math.max(1, window.innerWidth - 24) / toolbar.offsetWidth
    : requestedScale;
  const correctedScale = Math.min(requestedScale, fitScale);
  toolbar.style.setProperty("--skipper-scale", String(correctedScale));
}

new ResizeObserver(() => applyScale(currentBaseScale)).observe(toolbar);

chrome.storage.local.get({ scale: 1.0 }, (data) => {
  applyScale(data.scale);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.scale) {
    applyScale(changes.scale.newValue);
  }
});

window.addEventListener("resize", () => {
  applyScale(currentBaseScale);
});
