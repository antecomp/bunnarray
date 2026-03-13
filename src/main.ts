import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';

const TEXT_STYLE = new TextStyle({
    fontFamily: ['Georgia', 'serif'],
    fontSize: 32,
    fill: 0xffffff,
    align: 'center',
});

const CRYSTAL_BALL_RADIUS = 290;

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
  crystalBall.ball.filters = [displacementFilter, noiseFilter]

  const responseText = createCrossFadingTextDisplay(app, TEXT_STYLE, true);
  responseText.changeText("Initial Text");
  setTimeout(() => responseText.changeText("Jeg tilintetgjør haterne mine ved å bli venn med dem."), 2000);
  responseText.centerText(true, true, {x: 0, y: -CRYSTAL_BALL_RADIUS - TEXT_STYLE.fontSize});

  responseText.container.filters = [noiseFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
    responseText.centerText(true, true, {x: 0, y: -CRYSTAL_BALL_RADIUS - TEXT_STYLE.fontSize})
  });
}

main();