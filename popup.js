const slider = document.getElementById("scale");
const label = document.getElementById("scale-val");

// Load saved scale
chrome.storage.local.get({ scale: 1.0 }, (data) => {
  slider.value = data.scale;
  label.innerText = data.scale;
});

// Update label and save on drag
slider.addEventListener("input", (e) => {
  const val = e.target.value;
  label.innerText = val;
  chrome.storage.local.set({ scale: parseFloat(val) });
});
