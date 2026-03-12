import { Container, DisplacementFilter, Filter, GlProgram, Graphics, Sprite } from 'pixi.js';
import 'pixi.js/advanced-blend-modes';


import filterFrag from './filter.glsl';


import Them from './assets/chars/them.png';
import Them2 from './assets/chars/them2.png';
import Them3 from './assets/chars/them3.png';
import nice from './assets/nice.jpg';

import vertex from './passvert.glsl';

import { createCrossfadingTextureDisplay, loadImageAsTexture } from './sprite';
import { createNoiseTexture } from './noise';
import initializeApp from './init';

async function main() {
  const app = await initializeApp();

  const faceTextures = {
    x: await loadImageAsTexture(Them),
    y: await loadImageAsTexture(Them2),
    z: await loadImageAsTexture(Them3),
    a: await loadImageAsTexture(nice)
  }

  // for (const [, texture] of Object.entries(faceTextures)) {
  //   texture.source.scaleMode = 'nearest';
  // }

  const { container, changeTexture } = await createCrossfadingTextureDisplay(app);
  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;
  container.pivot.x = container.width / 2;
  container.pivot.y = container.height / 2;

  changeTexture(faceTextures.x)

  setTimeout(() => {
    changeTexture(faceTextures.y)
  }, 2000)

  setTimeout(() => {
    changeTexture(faceTextures.z)
  }, 4000);

  (window as any).yeah = (key: 'x' | 'y' | 'z') => changeTexture(faceTextures[key]);


  // Overlay

  const overlayLayer = new Container();
  app.stage.addChild(overlayLayer);

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

  // TODO: Make an init/attacher to just do this automatically.
  app.renderer.on('resize', () => {
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
    // noiseOverlay.width = app.screen.width;
    // noiseOverlay.height = app.screen.height;
  });

  // this is dumb lol - 
  // TODO: How do redraw on resize?
  const crystalBallCover = new Graphics()
    .rect(0, 0, app.screen.width, app.screen.height)
    .fill(0x000000)
    .circle(app.screen.width / 2, app.screen.height / 2, container.height /2)
    .cut()

  const crystalBall = new Graphics()
    .circle(app.screen.width / 2, app.screen.height / 2, container.height /2)
    .stroke({width: 5, color: 0xffffff})
    
  
    app.stage.addChild(crystalBallCover);
    app.stage.addChild(crystalBall);
    crystalBall.filters = [displacementFilter, customFilter]
}

main();