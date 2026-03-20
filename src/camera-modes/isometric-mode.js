import CameraMode from './camera-mode.js';

export default class IsometricMode extends CameraMode {
  constructor() {
    super('ISOMETRIC', false, 1.08);
  }

  applyPosition(camera, player) {
    if (player) {
      camera.active.position.set(player.x + 180, 200, player.z + 180);
      camera.active.lookAt(player.x, 0, player.z);
    }
  }

  update(camera, player, dt) {
    const f08 = 1 - 0.92**(dt * 60);
    const isoOff = 180;
    camera.active.position.x += (player.x + isoOff - camera.active.position.x) * f08;
    camera.active.position.z += (player.z + isoOff - camera.active.position.z) * f08;
    camera.active.position.y = 200;
    camera.active.up.set(0, 1, 0);
    camera.active.lookAt(player.x, 0, player.z);
  }
}
