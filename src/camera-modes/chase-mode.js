import CameraMode from './camera-mode.js';

export default class ChaseMode extends CameraMode {
  constructor() {
    super('CHASE', true, 1.0);
  }

  applyPosition(camera, player) {
    if (player) {
      camera.active.up.set(0, 1, 0);
      camera.active.position.set(
        player.x - Math.sin(player.angle) * 60, 35,
        player.z - Math.cos(player.angle) * 60
      );
      camera.active.lookAt(player.x, 2, player.z);
    }
  }

  update(camera, player, dt) {
    const f05 = 1 - 0.95**(dt * 60);
    const chaseDist = 60;
    const chaseHeight = 35;
    const lookAhead = 28;
    const aimY = 2;
    const behindX = player.x - Math.sin(player.angle) * chaseDist;
    const behindZ = player.z - Math.cos(player.angle) * chaseDist;
    camera.active.up.set(0, 1, 0);
    camera.active.position.x += (behindX - camera.active.position.x) * f05;
    camera.active.position.z += (behindZ - camera.active.position.z) * f05;
    camera.active.position.y += (chaseHeight - camera.active.position.y) * f05;
    camera.active.lookAt(
      player.x + Math.sin(player.angle) * lookAhead,
      aimY,
      player.z + Math.cos(player.angle) * lookAhead
    );
  }
}
