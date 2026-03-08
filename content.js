// ── State ──
let activeVideo = null;
let hideTimeout = null;
let currentBaseScale = 1.0;

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

// Block toolbar interaction from reaching the player
toolbar.addEventListener("click", (e) => {
  e.stopPropagation();
  resetHideTimer();

  const target = e.target instanceof Element ? e.target : null;
  const button = target?.closest(".skipper-btn");
  if (!button) return;

  e.preventDefault();
  skipTime(Number(button.dataset.skip));
});

toolbar.addEventListener("mousedown", (e) => {
  e.stopPropagation();
  resetHideTimer();
});

toolbar.addEventListener("mouseup", (e) => {
  e.stopPropagation();
  resetHideTimer();
});

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

  if (activeVideo && !activeVideo.isConnected) {
    setActiveVideo(findVideo(document.fullscreenElement));
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
  if (e.clientY < SHOW_ZONE_Y) {
    showToolbar();
  } else if (e.clientY > HIDE_ZONE_Y) {
    hideToolbar();
  }
}

// ── Fullscreen handling ──
document.addEventListener("fullscreenchange", () => {
  const fsEl = document.fullscreenElement;

  if (fsEl) {
    setActiveVideo(findVideo(fsEl));

    if (toolbar.parentNode !== fsEl) {
      fsEl.appendChild(toolbar);
    }

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

    if (toolbar.parentNode) {
      toolbar.parentNode.removeChild(toolbar);
    }
  }
});

// ── Sizing Logic & Zoom Correction ──
function applyScale(baseScale) {
  currentBaseScale = baseScale;

  const correctedScale = baseScale / window.devicePixelRatio;
  toolbar.style.setProperty("--skipper-scale", String(correctedScale));
}

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
