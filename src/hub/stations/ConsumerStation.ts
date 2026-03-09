import * as THREE from 'three';
import { gameState } from '../../state/GameState';
import { ProximityTrigger } from '../ProximityTrigger';

export class ConsumerStation {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private machines: THREE.Group[] = [];

  constructor() {
    this.group.position.set(10, 0, -10);

    // Title plate
    const platGeo = new THREE.BoxGeometry(6, 0.3, 3);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x220044, emissiveIntensity: 0.3, metalness: 0.9 });
    const plate = new THREE.Mesh(platGeo, platMat);
    plate.position.y = 0.15;
    this.group.add(plate);

    this.buildMachines();

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(10, 0, -10),
      5,
      'Press F — Consumer Machines'
    );
  }

  private buildMachines() {
    // Clear old
    for (const m of this.machines) this.group.remove(m);
    this.machines = [];

    const consumers = gameState.data.consumers;
    consumers.forEach((c, i) => {
      const machine = new THREE.Group();
      const x = (i - (consumers.length - 1) / 2) * 2;

      // Body
      const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.5, 8);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: c.assignedTopic ? 0x00ff88 : 0x444444,
        emissive: c.assignedTopic ? 0x00ff88 : 0x111111,
        emissiveIntensity: c.assignedTopic ? 0.4 : 0.1,
        metalness: 0.7,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1;
      machine.add(body);

      // Gear on top
      const gearGeo = new THREE.TorusGeometry(0.3, 0.05, 4, 12);
      const gearMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff1493, emissiveIntensity: 0.3 });
      const gear = new THREE.Mesh(gearGeo, gearMat);
      gear.position.y = 1.9;
      gear.rotation.x = Math.PI / 2;
      machine.add(gear);

      // Level indicator dots
      for (let lvl = 0; lvl < c.level; lvl++) {
        const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(0.35, 0.5 + lvl * 0.25, 0.35);
        machine.add(dot);
      }

      machine.position.set(x, 0, 0);
      this.group.add(machine);
      this.machines.push(machine);
    });
  }

  refreshVisuals() {
    this.buildMachines();
  }

  update(elapsed: number) {
    // Spin gears on active machines
    for (let i = 0; i < this.machines.length; i++) {
      const c = gameState.data.consumers[i];
      if (c?.assignedTopic) {
        const gear = this.machines[i].children[1];
        if (gear) gear.rotation.z = elapsed * 2;
      }
    }
  }
}
