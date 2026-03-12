import { Application, Assets, Container, defaultFilterVert, Filter, GlProgram, passthroughFrag, Sprite, TilingSprite, vertexGlTemplate } from 'pixi.js';
import 'pixi.js/advanced-blend-modes';

import noise from './assets/noise.png'

import filterFrag from './filter.glsl';


import Them from './assets/chars/them.png';
import Them2 from './assets/chars/them2.png';
import Them3 from './assets/chars/them3.png';

import vertex from './passvert.glsl';

import { createCrossfadingTextureDisplay, loadImageAsTexture } from './sprite';

async function main() {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({
    background: '#744a4aff', resizeTo: window, useBackBuffer: true,
    resolution: window.devicePixelRatio,
    antialias: false, roundPixels: true
  });

  // Append the application canvas to the document body
  document.body.appendChild(app.canvas);

  // Create and add a container to the stage
  // const container = new Container();

  // app.stage.addChild(container);

  // // Move the container to the center
  // container.x = app.screen.width / 2;
  // container.y = app.screen.height / 2;


  const faceTextures = {
    x: await loadImageAsTexture(Them),
    y: await loadImageAsTexture(Them2),
    z: await loadImageAsTexture(Them3)
  }

  for (const [, texture] of Object.entries(faceTextures)) {
    texture.source.scaleMode = 'nearest';
  }

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
        uDimensions: {value: [container.width, container.height], type: 'vec2<f32>'}
      },
    },
  });

  console.log(customFilter.resources.timeUniforms.uniforms.uDimensions);

  // Apply the filter
  container.filters = [customFilter];

  // Update uniform
  app.ticker.add((ticker) => {
    customFilter.resources.timeUniforms.uniforms.uTime += 0.04 * ticker.deltaTime;
    customFilter.resources.timeUniforms.uniforms.uDimensions = [container.width, container.height]

  });

  // TODO: Make an init/attacher to just do this automatically.
  app.renderer.on('resize', () => {
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
    // noiseOverlay.width = app.screen.width;
    // noiseOverlay.height = app.screen.height;
  });
}

main();