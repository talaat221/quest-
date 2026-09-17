const base64ToBlobUrl = (base64, mime = "image/webp") => {
  const clean = String(base64 || "").replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
};

let farmUrl = null;
let observer = null;

const applyFarm = () => {
  if (!farmUrl) return;
  const value = `url("${farmUrl}")`;
  document.documentElement.style.setProperty("--quest-farm-home", value);
  document.querySelectorAll(".qd-root").forEach((node) => {
    node.style.setProperty("--quest-farm-home", value);
  });
};

export async function loadPixelHomeAssets() {
  try {
    const response = await fetch("/quest-farm-hero.b64.txt");
    if (!response.ok) throw new Error("Pixel farm artwork could not be loaded.");
    const base64 = await response.text();
    if (farmUrl) URL.revokeObjectURL(farmUrl);
    farmUrl = base64ToBlobUrl(base64);
    applyFarm();

    if (!observer) {
      observer = new MutationObserver(applyFarm);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  } catch (error) {
    console.warn("Quest pixel home artwork unavailable:", error);
  }
}

loadPixelHomeAssets();
