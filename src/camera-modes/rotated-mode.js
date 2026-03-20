import CameraMode from './camera-mode.js';
import { CAMERA_HEIGHT } from '../intrinsic-constants.js';

export default class RotatedMode extends CameraMode {
  constructor() {
    super('ROTATED', false, 1.0);
  }

  applyPosition(camera, player) {
    if (player) {
      camera.active.position.set(player.x, CAMERA_HEIGHT, player.z);
    }
  }

  update(camera, player, _dt) {
    camera.active.position.set(player.x, CAMERA_HEIGHT, player.z);
    camera.active.up.set(-Math.sin(player.angle), 0, -Math.cos(player.angle));
    camera.active.lookAt(player.x, 0, player.z);
  }
}
