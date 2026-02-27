// ── State ──
let activeVideo = null;
let hideTimeout = null;

// ── Shadow DOM piercing video finder ──
function findVideo(root) {
  const video = root.querySelector("video");
  if (video) return video;

  const elements = root.querySelectorAll("*");
  for (const el of elements) {
    if (el.shadowRoot) {
      const found = findVideo(el.shadowRoot);
      if (found) return found;
    }
  }

  return null;
}

// ── Format seconds → H:MM:SS or M:SS ──
function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const paddedS = s.toString().padStart(2, "0");

  if (h > 0) {
    const paddedM = m.toString().padStart(2, "0");
    return `${h}:${paddedM}:${paddedS}`;
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
timeDisplay.innerText = "0:00";

const fwdGroup = document.createElement("div");
fwdGroup.className = "skipper-group";

const backSkips = [-60, -30, -10, -5];
const fwdSkips = [5, 10, 30, 60];

backSkips.forEach((amount) => {
  backGroup.appendChild(makeButton(amount));
});

fwdSkips.forEach((amount) => {
  fwdGroup.appendChild(makeButton(amount));
});

toolbar.appendChild(backGroup);
toolbar.appendChild(timeDisplay);
toolbar.appendChild(fwdGroup);

function makeButton(amount) {
  const btn = document.createElement("button");
  btn.className = "skipper-btn";
  btn.innerText = (amount > 0 ? "+" : "") + amount + "s";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    skipTime(amount);
  });

  btn.addEventListener("mousedown", (e) => e.stopPropagation());
  btn.addEventListener("mouseup", (e) => e.stopPropagation());

  return btn;
}

// Block toolbar clicks from reaching the player AND reset hide timer
toolbar.addEventListener("click", (e) => {
  e.stopPropagation();
  resetHideTimer();
});

toolbar.addEventListener("mousedown", (e) => {
  e.stopPropagation();
  resetHideTimer();
});

toolbar.addEventListener("mouseup", (e) => {
  e.stopPropagation();
});

// ── Skip logic ──
function skipTime(amount) {
  resetHideTimer();
  if (activeVideo && !activeVideo.isConnected) {
    activeVideo.removeEventListener("timeupdate", updateTimeDisplay);
    activeVideo = findVideo(document.fullscreenElement);
    if (activeVideo) {
      activeVideo.addEventListener("timeupdate", updateTimeDisplay);
    }
  }

  if (activeVideo) {
    activeVideo.currentTime += amount;
    updateTimeDisplay();
  }
}

// ── Time display updater ──
function updateTimeDisplay() {
  if (activeVideo) {
    timeDisplay.innerText = formatTime(activeVideo.currentTime);
  }
}

// ── Auto-hide timer ──
function resetHideTimer() {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    toolbar.classList.remove("visible");
  }, 15000);
}

// ── Show/hide with hysteresis ──
function handleMouseMove(e) {
  if (e.clientY < 90) {
    toolbar.classList.add("visible");
    resetHideTimer();
  } else if (e.clientY > 150) {
    toolbar.classList.remove("visible");
    clearTimeout(hideTimeout);
  }
}

// ── Inject into fullscreen element & cache video ──
document.addEventListener("fullscreenchange", () => {
  const fsEl = document.fullscreenElement;

  if (fsEl) {
    activeVideo = findVideo(fsEl);
    if (activeVideo) {
      activeVideo.addEventListener("timeupdate", updateTimeDisplay);
      updateTimeDisplay();
    }
    fsEl.appendChild(toolbar);
    toolbar.classList.remove("visible");
    document.addEventListener("mousemove", handleMouseMove);
  } else {
    if (activeVideo) {
      activeVideo.removeEventListener("timeupdate", updateTimeDisplay);
    }
    activeVideo = null;
    document.removeEventListener("mousemove", handleMouseMove);
    clearTimeout(hideTimeout);
    if (toolbar.parentNode) {
      toolbar.parentNode.removeChild(toolbar);
    }
  }

});

// ── Sizing Logic & Zoom Correction ──
let currentBaseScale = 1.0;

function applyScale(baseScale) {
  currentBaseScale = baseScale;
  
  const correctedScale = baseScale / window.devicePixelRatio;
  const inverseWidth = 100 / correctedScale;
  
  toolbar.style.transform = `scale(${correctedScale})`;
  toolbar.style.width = `${inverseWidth}%`;
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
