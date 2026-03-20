export function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

export function hexToRgb(hex) {
  const n = hexToInt(hex);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function intToHex(n) {
  return '#' + ('000000' + n.toString(16)).slice(-6);
}

export function disposeMesh(mesh) {
  if (mesh.isInstancedMesh) mesh.dispose();
  if (mesh.geometry && !mesh.geometry._shared) mesh.geometry.dispose();
  if (mesh.material && !mesh.material._shared) mesh.material.dispose();
}

export function disposeGroup(group) {
  group.traverse(function (child) {
    if (child.isMesh) disposeMesh(child);
  });
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  let sec = (s % 60).toFixed(2);
  if (sec < 10) sec = '0' + sec;
  return m + ':' + sec;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    code.charCodeAt(0) - 65 + 0x1F1E6,
    code.charCodeAt(1) - 65 + 0x1F1E6
  );
}
