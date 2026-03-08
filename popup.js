const slider = document.getElementById("scale");
const label = document.getElementById("scale-val");

chrome.storage.local.get({ scale: 1.0 }, (data) => {
  slider.value = data.scale;
  label.textContent = Number(data.scale).toFixed(1);
});

slider.addEventListener("input", (e) => {
  const val = Number(e.target.value);
  label.textContent = val.toFixed(1);
  chrome.storage.local.set({ scale: val });
});
