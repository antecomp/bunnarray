import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';

import input from './dialogues/testbranch.bny?raw'
import { compileBnyDialogue } from './dialogue/compilebny';
import createDialogueRunner from './dialogue/runner';
import createOptionsOverlay from './options';


const CRYSTAL_BALL_RADIUS = 290;

export const TEXT_STYLE = new TextStyle({
  fontFamily: ['Georgia', 'serif'],
  fontSize: 28,
  fill: 0xffffff,
  align: 'center',
  wordWrap: true,
  wordWrapWidth: CRYSTAL_BALL_RADIUS * 1.25
});

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

  responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 });
  responseText.container.filters = [noiseFilter]

  const PLACEHOLDERFUNCS: Record<string, () => string> = {
    test: () => "a",
    testb: () => "b",
    testx: () => "x"
  }

  const runner = createDialogueRunner(root, { responseText, optionsOverlay, face }, PLACEHOLDERFUNCS, { name: 'Omni' });
  crystalBall.ball.on('pointertap', runner.proceed);
  runner.addSignalListener('hitend', () => console.log('Hit end detected in main!'));
  runner.addSignalListener('bonus', function bonus() {
    console.log("This should only run once!");
    runner.setVar('name', 'buddy');
    runner.removeSignalListener('bonus', bonus);
  })
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