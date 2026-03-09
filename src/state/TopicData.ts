export interface TopicConfig {
  id: string;
  name: string;
  cluster: number;
  clusterName: string;
  speed: number;
  partitions: number;
  lagAccel: number;
  messageDensity: number;
  length: number;
  rewards: { messages: number; schemas: number };
  obstacles: string[];
  description: string;
  baseMessageValue: number;
}

export const TOPICS: TopicConfig[] = [
  // Cluster 1: Getting Started
  { id: 'hello-world', name: 'Hello World', cluster: 1, clusterName: 'Getting Started', speed: 8, partitions: 1, lagAccel: 0.1, messageDensity: 20, length: 500, rewards: { messages: 100, schemas: 0 }, obstacles: [], description: 'Your first topic. Just surf and collect.', baseMessageValue: 1 },
  { id: 'first-messages', name: 'First Messages', cluster: 1, clusterName: 'Getting Started', speed: 10, partitions: 2, lagAccel: 0.15, messageDensity: 25, length: 600, rewards: { messages: 200, schemas: 0 }, obstacles: ['poison-pill'], description: 'Watch out for poison pills.', baseMessageValue: 2 },
  { id: 'basic-partitions', name: 'Basic Partitions', cluster: 1, clusterName: 'Getting Started', speed: 12, partitions: 3, lagAccel: 0.2, messageDensity: 30, length: 700, rewards: { messages: 300, schemas: 1 }, obstacles: ['poison-pill'], description: 'Choose your lane wisely.', baseMessageValue: 4 },
  { id: 'consumer-basics', name: 'Consumer Basics', cluster: 1, clusterName: 'Getting Started', speed: 14, partitions: 3, lagAccel: 0.25, messageDensity: 35, length: 800, rewards: { messages: 500, schemas: 2 }, obstacles: ['poison-pill', 'tombstone'], description: 'Learn to consume at speed.', baseMessageValue: 8 },

  // Cluster 2: The Producer
  { id: 'key-value-pairs', name: 'Key-Value Pairs', cluster: 2, clusterName: 'The Producer', speed: 16, partitions: 3, lagAccel: 0.3, messageDensity: 40, length: 900, rewards: { messages: 800, schemas: 3 }, obstacles: ['poison-pill', 'tombstone'], description: 'Keys determine your partition lane.', baseMessageValue: 15 },
  { id: 'serialization', name: 'Serialization', cluster: 2, clusterName: 'The Producer', speed: 18, partitions: 4, lagAccel: 0.35, messageDensity: 45, length: 1000, rewards: { messages: 1200, schemas: 5 }, obstacles: ['poison-pill', 'tombstone', 'retention'], description: 'Avro messages appear. Grab them.', baseMessageValue: 25 },
  { id: 'batch-compression', name: 'Batch Compression', cluster: 2, clusterName: 'The Producer', speed: 20, partitions: 4, lagAccel: 0.4, messageDensity: 50, length: 1100, rewards: { messages: 1800, schemas: 8 }, obstacles: ['poison-pill', 'compaction'], description: 'Compaction zones compress rewards.', baseMessageValue: 40 },
  { id: 'acks-reliability', name: 'Acks & Reliability', cluster: 2, clusterName: 'The Producer', speed: 22, partitions: 4, lagAccel: 0.45, messageDensity: 55, length: 1200, rewards: { messages: 2500, schemas: 10 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction'], description: 'Reliability matters at speed.', baseMessageValue: 60 },

  // Cluster 3: The Broker
  { id: 'replication', name: 'Replication', cluster: 3, clusterName: 'The Broker', speed: 24, partitions: 4, lagAccel: 0.5, messageDensity: 55, length: 1300, rewards: { messages: 4000, schemas: 12 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure'], description: 'Replicas keep you safe. Sometimes.', baseMessageValue: 80 },
  { id: 'isr-dance', name: 'ISR Dance', cluster: 3, clusterName: 'The Broker', speed: 26, partitions: 5, lagAccel: 0.55, messageDensity: 60, length: 1400, rewards: { messages: 6000, schemas: 15 }, obstacles: ['poison-pill', 'isr-rings', 'broker-failure'], description: 'Stay in sync for massive combos.', baseMessageValue: 100 },
  { id: 'log-segments', name: 'Log Segments', cluster: 3, clusterName: 'The Broker', speed: 28, partitions: 5, lagAccel: 0.6, messageDensity: 65, length: 1500, rewards: { messages: 8000, schemas: 18 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure'], description: 'Segments roll. Stay ahead.', baseMessageValue: 130 },
  { id: 'controller-election', name: 'Controller Election', cluster: 3, clusterName: 'The Broker', speed: 30, partitions: 5, lagAccel: 0.65, messageDensity: 70, length: 1600, rewards: { messages: 12000, schemas: 22 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'The controller changes mid-run.', baseMessageValue: 170 },

  // Cluster 4: The Stream Processor
  { id: 'join-streams', name: 'Join Streams', cluster: 4, clusterName: 'The Stream Processor', speed: 32, partitions: 5, lagAccel: 0.7, messageDensity: 70, length: 1700, rewards: { messages: 18000, schemas: 28 }, obstacles: ['poison-pill', 'tombstone', 'network-partition'], description: 'Two streams merge. Double the chaos.', baseMessageValue: 220 },
  { id: 'windowed-aggregation', name: 'Windowed Aggregation', cluster: 4, clusterName: 'The Stream Processor', speed: 34, partitions: 6, lagAccel: 0.75, messageDensity: 75, length: 1800, rewards: { messages: 25000, schemas: 35 }, obstacles: ['poison-pill', 'retention', 'compaction', 'network-partition'], description: 'Windows open and close. Time your collection.', baseMessageValue: 280 },
  { id: 'ktable-changelog', name: 'KTable Changelog', cluster: 4, clusterName: 'The Stream Processor', speed: 36, partitions: 6, lagAccel: 0.8, messageDensity: 80, length: 1900, rewards: { messages: 35000, schemas: 42 }, obstacles: ['poison-pill', 'tombstone', 'compaction', 'broker-failure'], description: 'The table materializes around you.', baseMessageValue: 350 },
  { id: 'state-store', name: 'State Store', cluster: 4, clusterName: 'The Stream Processor', speed: 38, partitions: 6, lagAccel: 0.85, messageDensity: 85, length: 2000, rewards: { messages: 50000, schemas: 50 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure', 'network-partition'], description: 'State persists. Mistakes too.', baseMessageValue: 420 },

  // Cluster 5: The Architect
  { id: 'multi-datacenter', name: 'Multi-Datacenter', cluster: 5, clusterName: 'The Architect', speed: 40, partitions: 6, lagAccel: 0.9, messageDensity: 85, length: 2200, rewards: { messages: 75000, schemas: 60 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'Data crosses continents.', baseMessageValue: 500 },
  { id: 'mirror-maker', name: 'MirrorMaker', cluster: 5, clusterName: 'The Architect', speed: 42, partitions: 7, lagAccel: 0.95, messageDensity: 90, length: 2400, rewards: { messages: 100000, schemas: 75 }, obstacles: ['poison-pill', 'tombstone', 'compaction', 'broker-failure', 'network-partition'], description: 'Mirror everything. Miss nothing.', baseMessageValue: 500 },
  { id: 'rack-awareness', name: 'Rack Awareness', cluster: 5, clusterName: 'The Architect', speed: 44, partitions: 7, lagAccel: 1.0, messageDensity: 90, length: 2600, rewards: { messages: 150000, schemas: 90 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition'], description: 'Racks fall. Replicas survive.', baseMessageValue: 500 },
  { id: 'tiered-storage', name: 'Tiered Storage', cluster: 5, clusterName: 'The Architect', speed: 46, partitions: 7, lagAccel: 1.05, messageDensity: 95, length: 2800, rewards: { messages: 200000, schemas: 110 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction', 'broker-failure', 'network-partition'], description: 'Cold and hot. Navigate both.', baseMessageValue: 500 },

  // Cluster 6: The Guardian
  { id: 'acl-maze', name: 'ACL Maze', cluster: 6, clusterName: 'The Guardian', speed: 48, partitions: 8, lagAccel: 1.1, messageDensity: 95, length: 3000, rewards: { messages: 300000, schemas: 140 }, obstacles: ['poison-pill', 'tombstone', 'broker-failure', 'network-partition', 'acl-gate'], description: 'Only the authorized pass.', baseMessageValue: 500 },
  { id: 'quota-management', name: 'Quota Management', cluster: 6, clusterName: 'The Guardian', speed: 50, partitions: 8, lagAccel: 1.15, messageDensity: 100, length: 3200, rewards: { messages: 500000, schemas: 180 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'broker-failure', 'network-partition', 'quota-throttle'], description: 'Quotas limit your speed. Upgrade or suffer.', baseMessageValue: 500 },
  { id: 'exactly-once-gauntlet', name: 'Exactly-Once Gauntlet', cluster: 6, clusterName: 'The Guardian', speed: 55, partitions: 8, lagAccel: 1.2, messageDensity: 100, length: 3500, rewards: { messages: 1000000, schemas: 250 }, obstacles: ['poison-pill', 'tombstone', 'retention', 'compaction', 'broker-failure', 'network-partition', 'acl-gate', 'quota-throttle'], description: 'The final run. Every message counts. Exactly once.', baseMessageValue: 500 },
];

export const CLUSTERS = [
  { id: 1, name: 'Getting Started', requiredCleared: 0 },
  { id: 2, name: 'The Producer', requiredCleared: 3 },
  { id: 3, name: 'The Broker', requiredCleared: 7 },
  { id: 4, name: 'The Stream Processor', requiredCleared: 11 },
  { id: 5, name: 'The Architect', requiredCleared: 15 },
  { id: 6, name: 'The Guardian', requiredCleared: 19 },
];
