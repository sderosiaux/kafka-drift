import { TECH_NODES, EFFECT_MODES } from './TechTree';
import { TOPICS, CLUSTERS, type TopicConfig } from './TopicData';

export interface ConsumerMachine {
  id: string;
  level: number;
  assignedTopic: string | null;
  partitions: number;
}

export interface Pipeline {
  id: string;
  fromTopic: string;
  toTopic: string;
}

export interface SaveData {
  version: number;
  messages: number;
  schemas: number;
  throughput: number;
  unlockedTech: string[];
  clearedTopics: string[];
  bestScores: Record<string, number>;
  consumers: ConsumerMachine[];
  pipelines: Pipeline[];
  lastOnline: number;
  totalTimePlayed: number;
  equippedPowerUp: string | null;
  powerUps: string[];
}

const DEFAULT_SAVE: SaveData = {
  version: 1,
  messages: 0,
  schemas: 0,
  throughput: 0,
  unlockedTech: [],
  clearedTopics: [],
  bestScores: {},
  consumers: [
    { id: 'consumer-1', level: 1, assignedTopic: null, partitions: 1 },
  ],
  pipelines: [],
  lastOnline: Date.now(),
  totalTimePlayed: 0,
  equippedPowerUp: null,
  powerUps: [],
};

const STORAGE_KEY = 'kafka-drift-save';

export class GameState {
  data: SaveData;

  constructor() {
    this.data = this.load();
    this.calcIdleIncome();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    } catch { /* corrupted save, start fresh */ }
    return { ...DEFAULT_SAVE, lastOnline: Date.now() };
  }

  save() {
    this.data.lastOnline = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = { ...DEFAULT_SAVE, lastOnline: Date.now() };
  }

  // --- Currencies ---
  addMessages(n: number) { this.data.messages += n; }
  addSchemas(n: number) { this.data.schemas += n; }
  addThroughput(n: number) { this.data.throughput += n; }

  canAfford(cost: { messages: number; schemas: number }) {
    return this.data.messages >= cost.messages && this.data.schemas >= cost.schemas;
  }

  spend(cost: { messages: number; schemas: number }) {
    if (!this.canAfford(cost)) return false;
    this.data.messages -= cost.messages;
    this.data.schemas -= cost.schemas;
    return true;
  }

  // --- Tech Tree ---
  isTechUnlocked(id: string) { return this.data.unlockedTech.includes(id); }

  canUnlockTech(id: string): boolean {
    const node = TECH_NODES.find(n => n.id === id);
    if (!node || this.isTechUnlocked(id)) return false;
    if (!node.requires.every(r => this.isTechUnlocked(r))) return false;
    return this.canAfford(node.cost);
  }

  unlockTech(id: string): boolean {
    const node = TECH_NODES.find(n => n.id === id);
    if (!node || !this.canUnlockTech(id)) return false;
    this.spend(node.cost);
    this.data.unlockedTech.push(id);
    return true;
  }

  getEffect(key: string): number {
    const mode = EFFECT_MODES[key] || 'set';
    let value = mode === 'multiply' ? 1 : 0;
    let found = false;

    for (const id of this.data.unlockedTech) {
      const node = TECH_NODES.find(n => n.id === id);
      if (!node || !(key in node.effect)) continue;
      found = true;
      const v = node.effect[key];
      if (mode === 'add') value += v;
      else if (mode === 'multiply') value *= v;
      else value = v; // set: last wins
    }

    return found ? value : 0;
  }

  // --- Topics ---
  isTopicCleared(id: string) { return this.data.clearedTopics.includes(id); }

  clearTopic(id: string, score: number) {
    if (!this.data.clearedTopics.includes(id)) {
      this.data.clearedTopics.push(id);
    }
    const best = this.data.bestScores[id] ?? 0;
    if (score > best) this.data.bestScores[id] = score;
  }

  isClusterUnlocked(clusterId: number): boolean {
    const cluster = CLUSTERS.find(c => c.id === clusterId);
    if (!cluster) return false;
    return this.data.clearedTopics.length >= cluster.requiredCleared;
  }

  getAvailableTopics(): TopicConfig[] {
    return TOPICS.filter(t => this.isClusterUnlocked(t.cluster));
  }

  // --- Consumers (Idle) ---
  getIdleRate(): number {
    let rate = 0;
    for (const c of this.data.consumers) {
      if (!c.assignedTopic) continue;
      rate += c.level * c.partitions * 2;
    }
    const idleMult = this.getEffect('idleMultiplier') || 1;
    const effMult = this.getEffect('consumerEfficiency') || 1;
    const pipelineBonus = this.getPipelineMultiplier();
    return rate * idleMult * effMult * pipelineBonus;
  }

  getPipelineMultiplier(): number {
    return 1 + this.data.pipelines.length * 0.5;
  }

  calcIdleIncome(): number {
    const now = Date.now();
    const elapsed = (now - this.data.lastOnline) / 1000;
    let earned = 0;
    if (elapsed > 0) {
      earned = Math.floor(this.getIdleRate() * elapsed);
      if (earned > 0) this.addMessages(earned);
    }
    this.data.lastOnline = now;
    return earned;
  }

  // --- Consumer Machines ---
  buyConsumer(): boolean {
    const maxSlots = 3 + (this.getEffect('consumerSlots') || 0);
    if (this.data.consumers.length >= maxSlots) return false;
    const cost = { messages: 1000 * Math.pow(3, this.data.consumers.length), schemas: 0 };
    if (!this.spend(cost)) return false;
    this.data.consumers.push({
      id: `consumer-${Date.now()}`,
      level: 1,
      assignedTopic: null,
      partitions: 1,
    });
    return true;
  }

  upgradeConsumer(id: string): boolean {
    const c = this.data.consumers.find(c => c.id === id);
    if (!c || c.level >= 5) return false;
    const cost = { messages: 500 * Math.pow(2, c.level), schemas: c.level * 3 };
    if (!this.spend(cost)) return false;
    c.level++;
    return true;
  }

  assignConsumer(consumerId: string, topicId: string | null) {
    const c = this.data.consumers.find(c => c.id === consumerId);
    if (c) c.assignedTopic = topicId;
  }

  // --- Pipelines ---
  addPipeline(from: string, to: string): boolean {
    const exists = this.data.pipelines.some(p => p.fromTopic === from && p.toTopic === to);
    if (exists) return false;
    if (!this.isTopicCleared(from) || !this.isTopicCleared(to)) return false;
    const cost = { messages: 5000 * (this.data.pipelines.length + 1), schemas: 10 };
    if (!this.spend(cost)) return false;
    this.data.pipelines.push({ id: `pipe-${Date.now()}`, fromTopic: from, toTopic: to });
    return true;
  }

  removePipeline(id: string) {
    this.data.pipelines = this.data.pipelines.filter(p => p.id !== id);
  }
}

export const gameState = new GameState();
