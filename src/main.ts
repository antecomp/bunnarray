import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';
import createDialogueRunner from './dialogue';


const CRYSTAL_BALL_RADIUS = 290;

const TEXT_STYLE = new TextStyle({
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
  face.changeTo('smile');

  (window as any)['yeah'] = face.changeTo;

  const noiseFilter = createNoiseFilter(app);

  const displacementFilter = createDisplacementFilter(app, 4);

  face.container.filters = [displacementFilter, noiseFilter];

  const crystalBall = createCrystalBallOverlay(app, CRYSTAL_BALL_RADIUS);
  crystalBall.ball.filters = [displacementFilter, noiseFilter];

  const responseText = createCrossFadingTextDisplay(app, TEXT_STYLE, true);
  // responseText.changeText("Initial Text");
  // setTimeout(() => responseText.changeText("Jeg tilintetgjør haterne mine ved å bli venn med dem."), 2000);

  const dialogueRunner = createDialogueRunner(undefined, {changeFace: face.changeTo, changeText: responseText.changeText});

  crystalBall.ball.on('pointertap', dialogueRunner.proceed);

  responseText.centerText(true, true, {x: 0, y: CRYSTAL_BALL_RADIUS / 1.5});

  responseText.container.filters = [noiseFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
    responseText.centerText(true, true, {x: 0, y: CRYSTAL_BALL_RADIUS / 1.5})
  });
}

main();