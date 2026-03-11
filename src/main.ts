import { Application, Assets, Container, Sprite, TilingSprite } from 'pixi.js';
import 'pixi.js/advanced-blend-modes';

import noise from './assets/noise.png'

async function main() {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: '#1099bb', resizeTo: window, useBackBuffer: true });

  // Append the application canvas to the document body
  document.body.appendChild(app.canvas);

  // Create and add a container to the stage
  const container = new Container();

  app.stage.addChild(container);

  // Load the bunny texture
  const texture = await Assets.load('https://pixijs.com/assets/bunny.png');

  // Create a 5x5 grid of bunnies in the container
  for (let i = 0; i < 25; i++) {
    const bunny = new Sprite(texture);

    bunny.x = (i % 5) * 40;
    bunny.y = Math.floor(i / 5) * 40;
    container.addChild(bunny);
  }

  // Move the container to the center
  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;

  // Center the bunny sprites in local container coordinates
  container.pivot.x = container.width / 2;
  container.pivot.y = container.height / 2;

  const overlayLayer = new Container();
  app.stage.addChild(overlayLayer);

  const noiseTexture = await Assets.load(noise);
  const noiseOverlay = new TilingSprite({
    texture: noiseTexture,
    width: app.screen.width,
    height: app.screen.height
  });

  noiseOverlay.eventMode = "none";
  // noiseOverlay.alpha = 0.2;
  noiseOverlay.blendMode = 'hard-mix'
  overlayLayer.addChild(noiseOverlay);

  app.ticker.add((time) => {
    // Continuously rotate the container!
    // * use delta to create frame-independent transform *
    container.rotation -= 0.01 * time.deltaTime;
  });

  app.renderer.on('resize', () => {
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;
  })
}

main();