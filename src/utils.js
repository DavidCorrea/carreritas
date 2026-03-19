export function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

export function hexToRgb(hex) {
  var n = hexToInt(hex);
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
  var m = Math.floor(s / 60);
  var sec = (s % 60).toFixed(2);
  if (sec < 10) sec = '0' + sec;
  return m + ':' + sec;
}
