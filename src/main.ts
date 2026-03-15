import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';

import input from './dialogues/simple.bny?raw'
import { compileBnyDialogue } from './dialogue/compilebny';
import createDialogueRunner, { DialogueState } from './dialogue/runner';
import { DialogueNode } from "./dialogue/types";
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
  // face.changeTo('smile');

  (window as any)['yeah'] = face.changeTo;

  const noiseFilter = createNoiseFilter(app);

  const displacementFilter = createDisplacementFilter(app, 4);

  face.container.filters = [displacementFilter, noiseFilter];

  const crystalBall = createCrystalBallOverlay(app, CRYSTAL_BALL_RADIUS);
  crystalBall.ball.filters = [displacementFilter, noiseFilter];

  const responseText = createCrossFadingTextDisplay(app, TEXT_STYLE, true);

  let busy = false;
  const runner = createDialogueRunner(root as DialogueNode);
  async function advance(state: DialogueState) {
    if (busy) return;
    busy = true;

    await optionsOverlay.hide();

    if (state.face) face.changeTo(state.face);
    await responseText.changeText(state.text);

    if (state.options) {
      await optionsOverlay.show(state.options, (index) => {
        if (busy) return;
        advance(runner.choose(index));
      });
    }

    busy = false;
  }

  crystalBall.ball.on('pointertap', () => {
    const state = runner.currentState();
    if (state.options || state.ended) return;
    if (busy) return;  // guard BEFORE calling proceed
    advance(runner.proceed());
  });

  const optionsOverlay = createOptionsOverlay(app, CRYSTAL_BALL_RADIUS);
  optionsOverlay.con.filters = [noiseFilter]

  responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 });

  responseText.container.filters = [noiseFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
    responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 });
    optionsOverlay.centerContainer();
  });

  await advance(runner.currentState());
}

const root = compileBnyDialogue(input);

main();