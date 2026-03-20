import Renderer from './renderer.js';
import { hexToInt, disposeGroup } from '../utils/index.js';
import { createUnderglowMesh, applyUnderglowAppearance } from './underglow-mesh.js';

export default class DayRenderer extends Renderer {
  constructor(scene, carSettings) {
    super(scene, carSettings);
    this.ambientLight = null;
    this.underglowMesh = null;
    this.underglowLight = null;
    this.setup(carSettings);
  }

  setup(carSettings) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);
    this.applyDaySettings();

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);
    this.scene.add(this.underglowMesh, this.underglowLight);
    this.underglowMesh.visible = false;
  }

  applyDaySettings() {
    this.ambientLight.intensity = 1.0;
    this.scene.background.set(0x5d8a4a);
    this.scene.fog = null;
  }

  updateColors(carSettings) {
    applyUnderglowAppearance(this.underglowMesh, this.underglowLight, carSettings);
  }

  rebuildMeshes(carSettings) {
    disposeGroup(this.underglowMesh);
    this.scene.remove(this.underglowMesh, this.underglowLight);

    this.underglowMesh = createUnderglowMesh(carSettings.underglowColor, carSettings.underglowOpacity);
    this.underglowLight = new THREE.PointLight(hexToInt(carSettings.underglowColor), 0, 60, 2);

    this.scene.add(this.underglowMesh, this.underglowLight);
    this.underglowMesh.visible = false;
  }

  update(player, underglowOpacity, _cameraModeIndex) {
    const hasPlayer = !!player;
    this.underglowMesh.visible = hasPlayer && underglowOpacity > 0;
    this.underglowLight.intensity = hasPlayer ? 2.5 * (underglowOpacity / 100) : 0;
    if (hasPlayer) {
      this.underglowMesh.position.set(player.x, 0, player.z);
      this.underglowLight.position.set(player.x, 1.5, player.z);
    }
  }

  cleanup() {
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.underglowMesh) {
      disposeGroup(this.underglowMesh);
      this.scene.remove(this.underglowMesh);
      this.underglowMesh = null;
    }
    if (this.underglowLight) {
      this.scene.remove(this.underglowLight);
      this.underglowLight = null;
    }
  }
}
