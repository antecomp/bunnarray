import { Application, Assets, Container, Sprite, TilingSprite } from 'pixi.js';
import 'pixi.js/advanced-blend-modes';

import noise from './assets/noise.png'

import Them from './assets/chars/them.png';
import Them2 from './assets/chars/them2.png';
import Them3 from './assets/chars/them3.png';


import { createCrossfadingTextureDisplay, loadImageAsTexture } from './sprite';

async function main() {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: '#000000ff', resizeTo: window, useBackBuffer: true });

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

  for (const [,texture] of Object.entries(faceTextures)) {
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

  //const noiseTexture = await Assets.load(noise);
  const noiseTexture = await loadImageAsTexture(noise);
  const noiseOverlay = new TilingSprite({
    texture: noiseTexture,
    width: app.screen.width,
    height: app.screen.height
  });

  noiseOverlay.eventMode = "none";
  // noiseOverlay.alpha = 0.2;
  noiseOverlay.blendMode = 'hard-mix'
  overlayLayer.addChild(noiseOverlay);

  app.renderer.on('resize', () => {
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
  });
}

main();