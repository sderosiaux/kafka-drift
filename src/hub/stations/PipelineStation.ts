import * as THREE from 'three';
import { gameState } from '../../state/GameState';
import { TOPICS } from '../../state/TopicData';
import { ProximityTrigger } from '../ProximityTrigger';

export class PipelineStation {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private flowLines: THREE.Line[] = [];

  constructor() {
    this.group.position.set(-10, 0, 10);

    // Table
    const tableGeo = new THREE.BoxGeometry(5, 0.15, 3);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x220044, emissiveIntensity: 0.3, metalness: 0.8 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 1;
    this.group.add(table);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const [x, z] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, 0.5, z);
      this.group.add(leg);
    }

    this.buildFlowLines();

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(-10, 0, 10),
      5,
      'Press F — Pipelines'
    );
  }

  private buildFlowLines() {
    for (const line of this.flowLines) this.group.remove(line);
    this.flowLines = [];

    const pipelines = gameState.data.pipelines;
    const clearedTopics = TOPICS.filter(t => gameState.isTopicCleared(t.id));

    // Place topic nodes on table
    const topicPositions = new Map<string, THREE.Vector3>();
    clearedTopics.forEach((t, i) => {
      const angle = (i / clearedTopics.length) * Math.PI * 2;
      const r = 1.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      topicPositions.set(t.id, new THREE.Vector3(x, 1.2, z));

      // Small node
      const nodeGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(x, 1.2, z);
      this.group.add(node);
    });

    // Draw pipeline connections
    for (const pipe of pipelines) {
      const from = topicPositions.get(pipe.fromTopic);
      const to = topicPositions.get(pipe.toTopic);
      if (!from || !to) continue;

      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.6 });
      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.flowLines.push(line);
    }
  }

  refreshVisuals() {
    this.buildFlowLines();
  }

  update(_elapsed: number) {}
}
