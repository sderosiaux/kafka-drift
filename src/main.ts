import './style.css';
import { Engine } from './engine/SceneManager';
import { DriftScene } from './drift/DriftScene';
import { HubScene } from './hub/HubScene';
import { gameState } from './state/GameState';
import { audio } from './audio/AudioManager';
import { Transition } from './effects/Transition';
import { MainMenu } from './ui/MainMenu';
import { LoadingScreen } from './ui/LoadingScreen';

// Loading screen
const loading = new LoadingScreen();
loading.setProgress(20);

const container = document.getElementById('game')!;
const engine = new Engine(container);
loading.setProgress(40);

const transition = new Transition();
const hubScene = new HubScene(engine.canvas);
loading.setProgress(60);

const driftScene = new DriftScene(engine.canvas);
driftScene.initPostProcessing(engine.renderer);
loading.setProgress(80);

engine.register('hub', hubScene);
engine.register('drift', driftScene);

// Auto-save interval
setInterval(() => gameState.save(), 30000);

// Wire hub → drift flow
hubScene.setOnLaunch(async (topicId) => {
  await transition.fadeOut();
  audio.enterDrift();
  engine.switchTo('drift');
  engine.setComposer(driftScene.postProcessing?.composer ?? null);
  driftScene.startRun(topicId, async (cleared) => {
    if (cleared) audio.onLevelUp();
    // Wait for end screen, then go back to hub
    setTimeout(async () => {
      await transition.fadeOut();
      audio.enterHub();
      engine.setComposer(null);
      engine.switchTo('hub');
      await transition.fadeIn();
    }, 3200);
  });
  await transition.fadeIn();
});

// Mute toggle
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    audio.toggleMute();
  }
});

loading.setProgress(100);
loading.hide();

// Main menu
const mainMenu = new MainMenu();
const idleEarned = gameState.calcIdleIncome();

mainMenu.show(idleEarned, () => {
  audio.enterHub();
  engine.switchTo('hub');
  engine.start();
});
