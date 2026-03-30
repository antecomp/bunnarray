import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';

import input from './dialogues/main.bny?raw'
import { compileBnyDialogue } from './dialogue/compilebny';
import createDialogueRunner from './dialogue/runner';
import createOptionsOverlay from './options';
import pickRandom from './utils';


export const CRYSTAL_BALL_RADIUS = 290;

const DEFAULT_FLAGS = {
  nameshared: false as boolean,
  cafementioned: false as boolean,
  windowreason: false as boolean,
  houseconfront: false as boolean
} satisfies Record<string, string | boolean | number> // Only use primitives to make reset easy.

export const TEXT_STYLE = new TextStyle({
  fontFamily: ['Georgia', 'serif'],
  fontSize: 28,
  fill: 0xffffff,
  align: 'center',
  wordWrap: true,
  wordWrapWidth: CRYSTAL_BALL_RADIUS * 1.25
});

export const OPTION_STYLE = new TextStyle({
  fontFamily: ['Georgia', 'serif'],
  fontSize: 28,
  fill: 0xffffff,
  align: 'center',
  wordWrap: true,
  wordWrapWidth: CRYSTAL_BALL_RADIUS * 0.75
});

const NAMES = ["Jasmine", "Ana", "Anaya", "Amy", "Lucy"]

async function main() {
  const app = await initializeApp();

  const face = await createFacesContainer(app);
  face.centerContainer();
  // (window as any)['debug_changeface'] = face.changeTo;

  const noiseFilter = createNoiseFilter(app);

  const displacementFilter = createDisplacementFilter(app, 4);

  face.container.filters = [displacementFilter, noiseFilter];

  const crystalBall = createCrystalBallOverlay(app, CRYSTAL_BALL_RADIUS);
  crystalBall.ball.filters = [displacementFilter, noiseFilter];

  const responseText = createCrossFadingTextDisplay(app, TEXT_STYLE, true);

  const optionsOverlay = createOptionsOverlay(app, CRYSTAL_BALL_RADIUS);

  responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.6 });
  responseText.container.filters = [noiseFilter]

  const VARS: Record<string, string> = {
    hername: pickRandom(NAMES)
  }

  let flags = { ...DEFAULT_FLAGS };

  const MATCHES: Record<string, () => string> = {
    name_shared: () => String(flags.nameshared),
    cafe_mentioned: () => String(flags.cafementioned),
    window_reason_given: () => String(flags.windowreason),
    house_confronted: () => String(flags.houseconfront)
  }

  function reloadGame() {
    // Avoid using the same name twice on restart.
    const previousName = runner.readVar('hername')!;
    runner.setVar('hername', pickRandom(NAMES.filter(n => n !== previousName)));

    // Reset flags.
    flags = { ...DEFAULT_FLAGS }
  }

  const runner = createDialogueRunner(
    root,
    { responseText, optionsOverlay, face },
    MATCHES,
    VARS
  );

  // Signals that flip boolean switches. This is kinda messy, but doing it this way to save time.
  runner.addSignalListener('set_name_shared', () => { flags.nameshared = true })
  runner.addSignalListener('set_cafe_mentioned', () => { flags.cafementioned = true })
  runner.addSignalListener('set_window_reason', () => { flags.windowreason = true })
  runner.addSignalListener('set_house_confronted', () => { flags.houseconfront = true })

  // Reset game state on gameover or game end.
  runner.addSignalListener('gameover', reloadGame);
  runner.addSignalListener('ending', reloadGame);

  crystalBall.ball.on('pointertap', runner.proceed);
  runner.start();

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
    responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 });
    optionsOverlay.centerContainer();
  });
}

const root = compileBnyDialogue(input)!;

main();