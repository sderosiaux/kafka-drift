# Kafka Drift — Design Document

## Concept

3D first-person hoverboard game in Three.js. The player surfs through Kafka topic corridors in a synthwave/vaporwave aesthetic, collecting messages, dodging obstacles, and outrunning a "consumer lag" wave. Between runs, the player manages a 3D Broker Hub where they upgrade a tech tree, deploy auto-consumers (idle income), and build pipelines.

Target: both Kafka-savvy devs (deep metaphors) and general audience (intuitive visual gameplay). Sessions: 10-20 min. Production-ready, shareable.

## Core Game Loop

```
BROKER HUB (3D room)
  -> Choose topic from Topic Map (globe)
  -> Launch via Portal
DRIFT RUN (FPS hoverboard in corridor)
  -> Collect messages (currency)
  -> Dodge poison pills, tombstones
  -> Choose partition lanes at forks
  -> Use power-ups (compaction, compression, exactly-once shield)
  -> Outrun the LAG wave
  -> Reach end = topic cleared / Lag catches = partial rewards
BACK TO HUB
  -> Spend messages/schemas on Tech Tree
  -> Assign Consumer Machines to cleared topics (idle income)
  -> Build Pipelines (topic-to-topic transforms = multiplier)
  -> Unlock next cluster of topics
  -> Repeat
```

## Currencies

- **Messages** — main currency, collected during runs + idle income
- **Throughput** — global score representing network capacity
- **Schemas** — rare currency from Avro/Protobuf special messages, for advanced upgrades

## Drift Run Mechanics

### Controls
- Mouse: look/orient
- A/D or arrows: change lane (partition)
- Space: jump (catch high messages, dodge floor obstacles)
- Shift: speed boost (consumes throughput)
- E: activate equipped power-up

### Elements

| Element | Visual | Effect |
|---|---|---|
| Normal messages | Glowing pink/cyan cubes | +messages |
| Avro/Proto messages | Golden stars, rare | +schemas |
| Poison pills | Red glitch cubes | Slow down, avoid |
| Partition fork | Corridor splits 2-3 ways | Each lane = different risk/reward |
| Retention timer | Fading halo on messages | Message disappears if not collected in time |
| Compaction zone | Messages merge visually | Fewer messages but x5 value |
| Tombstone | Black stone on floor | Destroys a message ahead |
| Lag wave | Purple/magenta wall behind | Accelerates over time. Game over on contact |
| Checkpoint (offset) | Luminous ring | Saves position on death |
| ISR sync rings | Golden aligned rings | 3 consecutive = combo multiplier |

### Difficulty Progression
- Early topics: slow, few partitions, slow lag
- Mid topics: faster, more forks, aggressive lag
- Late topics: network partitions (floor holes), broker failures (collapsing corridor sections)

## Broker Hub — 3D Interactive Room

### 5 Interactive Stations

**1. Tech Tree (central hologram)**
- 3D floating tree, expands on approach
- 4 branches, ~30 nodes total:
  - SPEED: Board Speed I/II/III, Partition Lanes +1/+2, Boost Duration+, Air Control, Magnetic Collect
  - DATA: Schema Registry, Avro Decoder, Protobuf Decoder, Header Reader, Compression LZ4, Compaction View, SerDe
  - INFRA: Replication x2/x3, Multi-broker, Rack Awareness, Tiered Storage, Controller HA, MirrorMaker
  - MASTERY: Idempotent Producer, Exactly-once Shield, Transactions, ACL Passkeys, Quota Bypass, Consumer Isolation

**2. Topic Map (3D globe)**
- Holographic globe showing all topics
- Locked = greyed out, unlocked = colored by difficulty
- Click topic = preview (speed, obstacles, rewards)
- Topics organized in 6 clusters

**3. Pipeline Table**
- Miniature view of pipelines
- Connect topics with visual flows
- Topic A -> Transform -> Topic B = auto-conversion
- Each pipeline generates passive throughput (idle)

**4. Consumer Machines**
- Physical machines in room, one per consumer group
- Buy new ones, assign to cleared topics
- Visibly spinning, messages flowing out as currency
- Upgradeable: speed, partition count

**5. Stats Wall**
- Neon screens with real-time stats
- Messages/sec, total throughput, topics cleared, time played
- Animated synthwave charts

### Hub Ambiance
- Dim purple/pink lighting
- Lo-fi synthwave ambient music
- Floating data particles
- Retro grid floor, data cascade walls (Matrix-style but pink)
- Windows showing permanent vaporwave sunset

## Topic Clusters (24 topics)

### Cluster 1: "Getting Started"
- topic-hello-world (tutorial)
- topic-first-messages
- topic-basic-partitions
- topic-consumer-basics

### Cluster 2: "The Producer"
- topic-key-value-pairs
- topic-serialization
- topic-batch-compression
- topic-acks-reliability

### Cluster 3: "The Broker"
- topic-replication
- topic-isr-dance
- topic-log-segments
- topic-controller-election

### Cluster 4: "The Stream Processor"
- topic-join-streams
- topic-windowed-aggregation
- topic-ktable-changelog
- topic-state-store

### Cluster 5: "The Architect"
- topic-multi-datacenter
- topic-mirror-maker
- topic-rack-awareness
- topic-tiered-storage

### Cluster 6: "The Guardian"
- topic-acl-maze
- topic-quota-management
- topic-exactly-once-gauntlet

## Idle System

- Cleared topics can have Consumer Machines assigned
- Machines have levels (I-V), upgradeable
- More partitions assigned = more throughput
- Pipelines connecting topics = x2 multiplier
- Idle income accumulates offline (localStorage)

## Audio

- Synthwave/lo-fi ambient tracks in hub
- Run music intensifies with speed (BPM scales)
- SFX: collect = pling, combo = whoosh crescendo, level up = synth chord
- Lag wave: deep menacing drone that rises

## Visual Effects

- Bloom/glow on all luminous elements
- Chromatic aberration when lag is close
- Speed lines on boost
- Data particles flowing on corridor walls
- Vaporwave sunset backdrop (hub windows + corridor background)
- Post-processing: light scanlines, vignette

## Tech Stack

- Three.js for 3D rendering
- Vite + TypeScript
- localStorage for save state
- Static hosting (no backend needed)
- Web Audio API for procedural sound

## Design Resolutions

Decided during review, these override any conflicting earlier sections:

- **Dynamic corridor width**: corridor widens with partition count (width = (partitions+1) * LANE_WIDTH)
- **Free look FPS**: full PointerLockControls during drift, not fixed camera
- **Real geometric forks**: corridor physically splits into 2-3 branches at partition forks, each with different risk/reward
- **Combo = multiplicateur**: combo multiplies message value, cap x10, resets on poison pill or 2s timeout
- **Checkpoints = 1 respawn**: offset rings grant 1 respawn charge, lag catch with charge = respawn instead of game over
- **Power-up drops**: rare drops during runs (Compaction Burst, Compression Wave, Exactly-Once Shield, Rewind), 3 slots, E to use
- **Message value scales**: each topic has baseMessageValue (1-500), prevents late-game grind
- **Hub interaction**: proximity + F to open station UI, Escape to close, pointer lock/unlock flow
- **getEffect modes**: sum/set/multiply per effect type for correct tech tree aggregation
- **Obstacle spawning**: DriftScene spawns obstacles based on topicConfig.obstacles[] with type-specific visuals
- **CSS via Vite imports**: no runtime `<link>` injection
