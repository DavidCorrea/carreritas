import CameraMode from './camera-mode.js';

/**
 * Hood cam: eye slightly behind car center (driver-ish) so we’re outside the hull, not inside it
 * (inside = backfaces culled → invisible car). Look ahead below eye to keep hood in frame.
 */
const EYE_Y = 6.35;
const FORWARD = -0.95;
const LOOK_AHEAD_Y = 0.95;

export default class FirstPersonMode extends CameraMode {
  constructor() {
    super('FIRST-PERSON', true, 1.0);
  }

  applyPosition(camera, player) {
    if (!player) return;
    const fx = Math.sin(player.angle);
    const fz = Math.cos(player.angle);
    camera.active.up.set(0, 1, 0);
    camera.active.position.set(
      player.x + fx * FORWARD,
      EYE_Y,
      player.z + fz * FORWARD
    );
    camera.active.lookAt(
      camera.active.position.x + fx * 200,
      LOOK_AHEAD_Y,
      camera.active.position.z + fz * 200
    );
  }

  update(camera, player, _dt) {
    // No smoothing: lerp would lag behind the car mesh (which follows the player each frame)
    // and make the body look like it’s sliding past the camera.
    this.applyPosition(camera, player);
  }
}
