# Kafka Drift

3D first-person hoverboard game built with Three.js. Surf through Kafka topic corridors in a synthwave aesthetic, collect messages, dodge obstacles, and outrun the consumer lag wave.

**[Play now](https://sderosiaux.github.io/kafka-drift/)**

## Local dev

```bash
npm install
npm run dev
```

## Controls

| Key | Action |
|---|---|
| WASD | Move (hub) |
| Mouse | Look around |
| A/D | Switch lanes (drift) |
| Space | Jump |
| Shift | Speed boost |
| F | Interact with stations |
| E | Use power-up |
| M | Toggle mute |
| ESC | Pause / Close menu |

## Game Loop

**Broker Hub** — 3D room with interactive stations:
- **Topic Map** — select a topic to run
- **Launch Portal** — press F to pick a topic and launch
- **Tech Tree** — spend currencies on upgrades across 4 branches (Speed, Data, Infra, Mastery)
- **Consumer Machines** — assign to cleared topics for idle message income
- **Pipeline Table** — connect topics for passive throughput multipliers
- **Stats Wall** — real-time stats and progress

**Drift Run** — FPS hoverboard through a corridor:
- Collect messages — normal pink cubes, large high-value cubes (3x), tiny bursts (clusters of small ones), compressed purple dodecahedrons (2x)
- Grab golden schemas (rare Avro/Protobuf currency)
- Dodge red spiky poison pills, dark tombstones, broker failures, network partitions
- Choose partition lanes at corridor forks (safe/normal/risky paths)
- Collect power-ups: Compaction Burst, Compression Wave, Exactly-Once Shield, Rewind
- Hit checkpoints for respawn charges
- Outrun the lag wave — it accelerates over time

**Progression** — 24 topics across 6 clusters, unlocked by clearing previous topics. Difficulty scales with speed, partition count, obstacle types, and lag acceleration.

## Currencies

- **Messages** — main currency, collected during runs + idle income
- **Throughput** — global score / network capacity
- **Schemas** — rare currency from Avro/Protobuf messages, for advanced upgrades

## Tech Stack

- Three.js — 3D rendering
- TypeScript + Vite — build tooling
- Web Audio API — procedural synthwave audio
- localStorage — save state (no backend)

## Build

```bash
npm run build    # Production build to dist/
npm run preview  # Preview production build
```
