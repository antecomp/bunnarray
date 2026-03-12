import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';

async function main() {
  const app = await initializeApp();

  const face = await createFacesContainer(app);
  face.centerContainer();
  face.changeTo('smile');

  (window as any)['yeah'] = face.changeTo;

  const noiseFilter = createNoiseFilter(app);

  const displacementFilter = createDisplacementFilter(app, 4);

  face.container.filters = [displacementFilter, noiseFilter];

  const crystalBall = createCrystalBallOverlay(app, face.container.height / 2);
  crystalBall.ball.filters = [displacementFilter, noiseFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
  });
}

main();