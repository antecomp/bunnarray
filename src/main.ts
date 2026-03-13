import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';
import createDialogueRunner from './dialogue';
import compileDialogue, { traceCompiledDialogue } from './dialogue-parse/compileDialogue';


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

const input = `
Hello, friend. <face:smile>
How are you?
{
?: Doing well!
That is great to hear.
?: Doing bad.
Sorry to hear that.
-> elsewhere
?: Meh.
-> elsewhere
}
Fallback, we continue here.
Then we keep going.

@elsewhere
We jumped here via goto.
And continue from this tag.
`;

const root = compileDialogue(input);
traceCompiledDialogue(root);

main();