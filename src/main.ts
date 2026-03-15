import 'pixi.js/advanced-blend-modes';

import initializeApp from './init';
import createFacesContainer from './faces';
import createCrystalBallOverlay from './ball';
import { createDisplacementFilter, createNoiseFilter } from './filters';
import { TextStyle } from 'pixi.js';
import { createCrossFadingTextDisplay } from './text';
import createDialogueRunner, { DialogueNode } from './dialogue';
import compileDialogue, { traceCompiledDialogue } from './dialogue-parse/compileDialogue';

import input from './dialogues/test.bny?raw'
import { DialogueParser } from './assets/dialogue/parser';
import { DialogueLexer } from './assets/dialogue/lexer';

import test from './assets/dialogue/test';

test();

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

  const dialogueRunner = createDialogueRunner(root as DialogueNode, { changeFace: face.changeTo, changeText: responseText.changeText });
  const buttonContainer = document.querySelector('#test_button_con')!;

  function renderOptions(optionData?: ReturnType<typeof dialogueRunner.proceed>) {
    buttonContainer.innerHTML = "";

    if (!optionData) return;

    optionData.forEach((op) => {
      const btn = document.createElement('button');
      btn.onclick = () => renderOptions(op.run());
      btn.textContent = op.text;
      buttonContainer.appendChild(btn);
    });
  }

  crystalBall.ball.on('pointertap', () => {
    renderOptions(dialogueRunner.proceed());
  });

  responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 });

  responseText.container.filters = [noiseFilter]

  app.renderer.on('resize', () => {
    face.centerContainer();
    crystalBall.redraw();
    responseText.centerText(true, true, { x: 0, y: CRYSTAL_BALL_RADIUS / 1.5 })
  });
}

const root = compileDialogue(input);
//traceCompiledDialogue(root);



// const parser = new DialogueParser();

// function testParse(input: string) {
//   const lexResult = DialogueLexer.tokenize(input);
//   console.log(lexResult.tokens.map(t => ({
//     type: t.tokenType.name,
//     image: t.image
//   })));
//   parser.input = lexResult.tokens;
//   const cst = parser.dialogue();

//   if (parser.errors.length > 0) {
//     console.error("Parse errors:", parser.errors);
//     return;
//   }

//   console.log(JSON.stringify(cst, null, 2));
// }

// testParse(`
//   @start
// Hello, friend.
// How are you? {
//     ?: Doing well!
//         That is great to hear.
//     ?: Doing bad.
//         Sorry to hear that.
//         -> elsewhere
// }
// Fallback here.
// `);

main();
