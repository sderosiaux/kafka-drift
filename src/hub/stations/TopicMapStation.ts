import * as THREE from 'three';
import { TOPICS, CLUSTERS } from '../../state/TopicData';
import { gameState } from '../../state/GameState';
import { ProximityTrigger } from '../ProximityTrigger';

const CLUSTER_COLORS = [0x00ff88, 0x00ffff, 0xff69b4, 0xffd700, 0x8b00ff, 0xff0066];

export class TopicMapStation {
  group = new THREE.Group();
  trigger: ProximityTrigger;
  private globe: THREE.Mesh;
  private markers: THREE.Mesh[] = [];

  constructor() {
    this.group.position.set(-10, 0, -10);

    // Pedestal
    const pedGeo = new THREE.CylinderGeometry(1.5, 1.8, 0.8, 6);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, emissive: 0x220044, emissiveIntensity: 0.3, metalness: 0.9 });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = 0.4;
    this.group.add(pedestal);

    // Globe (wireframe sphere)
    const globeGeo = new THREE.SphereGeometry(2, 24, 24);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0044,
      emissive: 0x4400aa,
      emissiveIntensity: 0.3,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    this.globe = new THREE.Mesh(globeGeo, globeMat);
    this.globe.position.y = 3;
    this.group.add(this.globe);

    // Topic markers on globe
    const topicCount = TOPICS.length;
    TOPICS.forEach((topic, i) => {
      const phi = Math.acos(-1 + (2 * i) / topicCount);
      const theta = Math.sqrt(topicCount * Math.PI) * phi;
      const r = 2.1;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi) + 3;
      const z = r * Math.sin(phi) * Math.sin(theta);

      const cleared = gameState.isTopicCleared(topic.id);
      const unlocked = gameState.isClusterUnlocked(topic.cluster);
      const color = CLUSTER_COLORS[topic.cluster - 1] ?? 0xffffff;

      const markerGeo = new THREE.SphereGeometry(cleared ? 0.12 : 0.08, 8, 8);
      const markerMat = new THREE.MeshStandardMaterial({
        color: unlocked ? color : 0x333333,
        emissive: cleared ? color : 0x000000,
        emissiveIntensity: cleared ? 0.8 : 0,
        transparent: true,
        opacity: unlocked ? 1 : 0.3,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      // Position relative to globe center (globe is at y=3 in group space)
      marker.position.set(x, y - 3, z);
      this.globe.add(marker);
      this.markers.push(marker);
    });

    // Light above globe
    const light = new THREE.PointLight(0x4400aa, 0.8, 8);
    light.position.set(-10, 6, -10);
    this.group.add(light);

    this.trigger = new ProximityTrigger(
      new THREE.Vector3(-10, 0, -10),
      5,
      'Press F — Topic Map'
    );
  }

  update(elapsed: number) {
    this.globe.rotation.y = elapsed * 0.1;
  }

  refreshVisuals() {
    TOPICS.forEach((topic, i) => {
      const marker = this.markers[i];
      if (!marker) return;
      const cleared = gameState.isTopicCleared(topic.id);
      const unlocked = gameState.isClusterUnlocked(topic.cluster);
      const color = CLUSTER_COLORS[topic.cluster - 1] ?? 0xffffff;
      const mat = marker.material as THREE.MeshStandardMaterial;
      mat.color.setHex(unlocked ? color : 0x333333);
      mat.emissive.setHex(cleared ? color : 0x000000);
      mat.emissiveIntensity = cleared ? 0.8 : 0;
      mat.opacity = unlocked ? 1 : 0.3;
    });
  }
}
