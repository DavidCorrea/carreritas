import CameraMode from './camera-mode.js';
import { CAMERA_HEIGHT } from '../intrinsic-constants.js';

export default class TopDownMode extends CameraMode {
  constructor() {
    super('TOP-DOWN', false, 1.0);
  }

  applyPosition(camera, player) {
    if (player) {
      camera.active.position.set(player.x, CAMERA_HEIGHT, player.z);
    }
  }

  update(camera, player, _dt) {
    // No XY smoothing: lag made look-at target the ground under the camera, so the car drifted off-center.
    camera.active.position.set(player.x, CAMERA_HEIGHT, player.z);
    camera.active.up.set(0, 0, -1);
    camera.active.lookAt(player.x, 0, player.z);
  }
}
