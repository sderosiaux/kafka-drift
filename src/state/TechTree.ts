export interface TechNode {
  id: string;
  name: string;
  branch: 'speed' | 'data' | 'infra' | 'mastery';
  cost: { messages: number; schemas: number };
  requires: string[];
  effect: Record<string, number>;
  description: string;
}

export type EffectMode = 'set' | 'add' | 'multiply';

export const EFFECT_MODES: Record<string, EffectMode> = {
  speedMultiplier: 'multiply',
  extraLanes: 'add',
  boostDuration: 'set',
  airControl: 'set',
  collectRadius: 'set',
  schemaDropRate: 'set',
  schemaValue: 'set',
  messagePreview: 'set',
  messageSize: 'multiply',
  compactionMultiplier: 'set',
  allMessageValue: 'multiply',
  replicationReward: 'set',
  consumerSlots: 'add',
  brokerFailureResist: 'set',
  retentionExtend: 'set',
  lagSlowdown: 'multiply',
  idleMultiplier: 'set',
  noDuplicatePenalty: 'set',
  shieldCharges: 'set',
  transactionWindow: 'set',
  aclBypass: 'set',
  quotaImmune: 'set',
  consumerEfficiency: 'set',
};

export const TECH_NODES: TechNode[] = [
  // SPEED branch
  { id: 'board-speed-1', name: 'Board Speed I', branch: 'speed', cost: { messages: 200, schemas: 0 }, requires: [], effect: { speedMultiplier: 1.15 }, description: '+15% board speed' },
  { id: 'board-speed-2', name: 'Board Speed II', branch: 'speed', cost: { messages: 1000, schemas: 5 }, requires: ['board-speed-1'], effect: { speedMultiplier: 1.3 }, description: '+30% board speed' },
  { id: 'board-speed-3', name: 'Board Speed III', branch: 'speed', cost: { messages: 8000, schemas: 20 }, requires: ['board-speed-2'], effect: { speedMultiplier: 1.5 }, description: '+50% board speed' },
  { id: 'partition-lanes-1', name: 'Partition Lanes +1', branch: 'speed', cost: { messages: 500, schemas: 2 }, requires: [], effect: { extraLanes: 1 }, description: 'See one extra lane in forks' },
  { id: 'partition-lanes-2', name: 'Partition Lanes +2', branch: 'speed', cost: { messages: 5000, schemas: 15 }, requires: ['partition-lanes-1'], effect: { extraLanes: 2 }, description: 'See two extra lanes in forks' },
  { id: 'boost-duration', name: 'Boost Duration+', branch: 'speed', cost: { messages: 3000, schemas: 10 }, requires: ['board-speed-1'], effect: { boostDuration: 2.0 }, description: 'Boost lasts 2x longer' },
  { id: 'air-control', name: 'Air Control', branch: 'speed', cost: { messages: 2000, schemas: 8 }, requires: ['partition-lanes-1'], effect: { airControl: 1 }, description: 'Change lanes mid-jump' },
  { id: 'magnetic-collect', name: 'Magnetic Collect', branch: 'speed', cost: { messages: 15000, schemas: 30 }, requires: ['board-speed-2', 'air-control'], effect: { collectRadius: 3.0 }, description: 'Messages are attracted to you' },

  // DATA branch
  { id: 'schema-registry', name: 'Schema Registry', branch: 'data', cost: { messages: 800, schemas: 0 }, requires: [], effect: { schemaDropRate: 1.5 }, description: 'Schema messages appear 50% more often' },
  { id: 'avro-decoder', name: 'Avro Decoder', branch: 'data', cost: { messages: 2000, schemas: 5 }, requires: ['schema-registry'], effect: { schemaValue: 2.0 }, description: 'Schema messages worth 2x' },
  { id: 'protobuf-decoder', name: 'Protobuf Decoder', branch: 'data', cost: { messages: 6000, schemas: 15 }, requires: ['avro-decoder'], effect: { schemaValue: 3.0 }, description: 'Schema messages worth 3x' },
  { id: 'header-reader', name: 'Header Reader', branch: 'data', cost: { messages: 1500, schemas: 3 }, requires: ['schema-registry'], effect: { messagePreview: 1 }, description: 'See message value before collecting' },
  { id: 'compression-lz4', name: 'Compression LZ4', branch: 'data', cost: { messages: 4000, schemas: 12 }, requires: ['header-reader'], effect: { messageSize: 0.7 }, description: 'Messages 30% smaller, easier to dodge between' },
  { id: 'compaction-view', name: 'Compaction View', branch: 'data', cost: { messages: 10000, schemas: 25 }, requires: ['compression-lz4'], effect: { compactionMultiplier: 2.0 }, description: 'Compaction zones give 2x more' },
  { id: 'serde', name: 'SerDe', branch: 'data', cost: { messages: 20000, schemas: 40 }, requires: ['protobuf-decoder', 'compaction-view'], effect: { allMessageValue: 1.5 }, description: 'All messages worth 50% more' },

  // INFRA branch
  { id: 'replication-2', name: 'Replication x2', branch: 'infra', cost: { messages: 1000, schemas: 0 }, requires: [], effect: { replicationReward: 2.0 }, description: 'End-of-run rewards doubled' },
  { id: 'replication-3', name: 'Replication x3', branch: 'infra', cost: { messages: 8000, schemas: 20 }, requires: ['replication-2'], effect: { replicationReward: 3.0 }, description: 'End-of-run rewards tripled' },
  { id: 'multi-broker', name: 'Multi-Broker', branch: 'infra', cost: { messages: 3000, schemas: 8 }, requires: ['replication-2'], effect: { consumerSlots: 2 }, description: '+2 consumer machine slots' },
  { id: 'rack-awareness-tech', name: 'Rack Awareness', branch: 'infra', cost: { messages: 12000, schemas: 25 }, requires: ['multi-broker'], effect: { brokerFailureResist: 0.5 }, description: '50% less impact from broker failures' },
  { id: 'tiered-storage-tech', name: 'Tiered Storage', branch: 'infra', cost: { messages: 25000, schemas: 50 }, requires: ['rack-awareness-tech'], effect: { retentionExtend: 2.0 }, description: 'Messages stay 2x longer before fading' },
  { id: 'controller-ha', name: 'Controller HA', branch: 'infra', cost: { messages: 15000, schemas: 35 }, requires: ['rack-awareness-tech'], effect: { lagSlowdown: 0.8 }, description: 'Lag wave 20% slower' },
  { id: 'mirrormaker-tech', name: 'MirrorMaker', branch: 'infra', cost: { messages: 50000, schemas: 80 }, requires: ['controller-ha', 'tiered-storage-tech'], effect: { idleMultiplier: 2.0 }, description: 'Idle income doubled' },

  // MASTERY branch
  { id: 'idempotent-producer', name: 'Idempotent Producer', branch: 'mastery', cost: { messages: 2000, schemas: 5 }, requires: [], effect: { noDuplicatePenalty: 1 }, description: 'No penalty for touching same message twice' },
  { id: 'exactly-once', name: 'Exactly-Once Shield', branch: 'mastery', cost: { messages: 10000, schemas: 30 }, requires: ['idempotent-producer'], effect: { shieldCharges: 3 }, description: '3 shield charges per run (block lag hit)' },
  { id: 'transactions', name: 'Transactions', branch: 'mastery', cost: { messages: 20000, schemas: 45 }, requires: ['exactly-once'], effect: { transactionWindow: 5 }, description: '5s undo window after collecting poison pill' },
  { id: 'acl-passkeys', name: 'ACL Passkeys', branch: 'mastery', cost: { messages: 5000, schemas: 15 }, requires: ['idempotent-producer'], effect: { aclBypass: 1 }, description: 'Pass through ACL gates without slowing' },
  { id: 'quota-bypass', name: 'Quota Bypass', branch: 'mastery', cost: { messages: 30000, schemas: 60 }, requires: ['acl-passkeys'], effect: { quotaImmune: 1 }, description: 'Immune to quota throttling' },
  { id: 'consumer-isolation', name: 'Consumer Isolation', branch: 'mastery', cost: { messages: 40000, schemas: 70 }, requires: ['transactions', 'quota-bypass'], effect: { consumerEfficiency: 2.0 }, description: 'Consumer machines 2x more efficient' },
];
