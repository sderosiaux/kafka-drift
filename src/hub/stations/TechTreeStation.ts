import * as THREE from 'three';
import { TECH_NODES, type TechNode } from '../../state/TechTree';
import { gameState } from '../../state/GameState';
import { ProximityTrigger } from '../ProximityTrigger';

const BRANCH_POSITIONS: Record<string, { x: number; z: number }> = {
  speed: { x: -2, z: -2 },
  data: { x: 2, z: -2 },
  infra: { x: -2, z: 2 },
  mastery: { x: 2, z: 2 },
};

export class TechTreeStation {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private lineMeshes: THREE.Line[] = [];

  constructor() {
    this.group.position.set(0, 0, 0); // Center of hub

    // Base platform
    const platGeo = new THREE.CylinderGeometry(4, 4.5, 0.2, 32);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x4400aa, emissiveIntensity: 0.2, metalness: 0.8 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = 0.1;
    this.group.add(platform);

    // Central hologram pillar
    const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const pillarMat = new THREE.MeshBasicMaterial({ color: 0x8b00ff, transparent: true, opacity: 0.2 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 3;
    this.group.add(pillar);

    // Build nodes
    this.buildNodes();
    this.buildConnections();

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(0, 0, 0),
      5,
      'Press F — Tech Tree'
    );
  }

  private buildNodes() {
    const nodesByBranch: Record<string, TechNode[]> = { speed: [], data: [], infra: [], mastery: [] };
    for (const node of TECH_NODES) {
      nodesByBranch[node.branch]?.push(node);
    }

    for (const [branch, nodes] of Object.entries(nodesByBranch)) {
      const base = BRANCH_POSITIONS[branch];
      nodes.forEach((node, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = base.x + col * 1.2;
        const z = base.z + row * 1.2;
        const y = 1.5 + row * 0.8;

        const geo = new THREE.SphereGeometry(0.2, 16, 16);
        const unlocked = gameState.isTechUnlocked(node.id);
        const mat = new THREE.MeshStandardMaterial({
          color: unlocked ? 0x00ff88 : 0x444444,
          emissive: unlocked ? 0x00ff88 : 0x222222,
          emissiveIntensity: unlocked ? 0.8 : 0.1,
          transparent: true,
          opacity: unlocked ? 1 : 0.6,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        this.nodeMeshes.set(node.id, mesh);
      });
    }
  }

  private buildConnections() {
    for (const node of TECH_NODES) {
      const mesh = this.nodeMeshes.get(node.id);
      if (!mesh) continue;
      for (const reqId of node.requires) {
        const reqMesh = this.nodeMeshes.get(reqId);
        if (!reqMesh) continue;
        const points = [mesh.position, reqMesh.position];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: gameState.isTechUnlocked(node.id) ? 0x00ff88 : 0x333333,
          transparent: true,
          opacity: 0.5,
        });
        const line = new THREE.Line(geo, mat);
        this.group.add(line);
        this.lineMeshes.push(line);
      }
    }
  }

  refreshVisuals() {
    for (const node of TECH_NODES) {
      const mesh = this.nodeMeshes.get(node.id);
      if (!mesh) continue;
      const unlocked = gameState.isTechUnlocked(node.id);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(unlocked ? 0x00ff88 : 0x444444);
      mat.emissive.setHex(unlocked ? 0x00ff88 : 0x222222);
      mat.emissiveIntensity = unlocked ? 0.8 : 0.1;
      mat.opacity = unlocked ? 1 : 0.6;
    }
  }

  update(elapsed: number) {
    // Gentle float animation for nodes
    for (const [, mesh] of this.nodeMeshes) {
      mesh.position.y += Math.sin(elapsed * 2 + mesh.position.x) * 0.001;
    }
  }
}
