import { Container, DisplacementFilter, Filter, GlProgram, Graphics, Sprite } from 'pixi.js';
import 'pixi.js/advanced-blend-modes';

import filterFrag from './filter.glsl';
import vertex from './passvert.glsl';

import { createNoiseTexture } from './noise';
import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';

async function main() {
  const app = await initializeApp();

  const face = await createFacesContainer(app);
  const container = face.container; // change later to just face.container around.
  face.centerContainer();
  face.changeTo('smile');

  (window as any)['yeah'] = face.changeTo;

  const customFilter = new Filter({
    glProgram: new GlProgram({
      fragment: filterFrag,
      vertex: vertex,
    }),
    resources: {
      timeUniforms: {
        uTime: { value: 0.0, type: 'f32' },
        uDimensions: { value: [container.width, container.height], type: 'vec2<f32>' }
      },
    },
  });

  console.log(customFilter.resources.timeUniforms.uniforms.uDimensions);

  // Apply the filter
  //container.filters = [customFilter];

  // Update uniform
  app.ticker.add((ticker) => {
    customFilter.resources.timeUniforms.uniforms.uTime += 0.04 * ticker.deltaTime;
    // this is lazy, fix later.
    customFilter.resources.timeUniforms.uniforms.uDimensions = [container.width, container.height]
    displacementSprite.x += 0.5;
    displacementSprite.y += 0.3;
  });

  const noiseTexture = createNoiseTexture(512, 512);
  const displacementSprite = new Sprite(noiseTexture);
  displacementSprite.texture.source.addressMode = 'repeat';
  app.stage.addChild(displacementSprite);

  const displacementFilter = new DisplacementFilter(displacementSprite);
  displacementFilter.scale.x = 8;
  displacementFilter.scale.y = 8;

  container.filters = [displacementFilter, customFilter];

  const crystalBall = createCrystalBallOverlay(app, container.height / 2);
  crystalBall.ball.filters = [displacementFilter, customFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
  });
}

main();