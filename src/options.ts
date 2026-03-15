import { Application, Container } from "pixi.js";
import createDialogueRunner from "./dialogue/runner";
import { createTextWithBackground } from "./text";
import { TEXT_STYLE } from "./main";

function getOptionSlots(count: number, radius: number, gapX = 150, gapY = 90) {
    const sideX = radius + gapX;

    switch (count) {
        case 1:
            return [{ x: -sideX, y: 0 }];

        case 2:
            return [
                { x: -sideX, y: 0 },
                { x: sideX, y: 0 },
            ];

        case 3:
            return [
                { x: -sideX, y: 0 },
                { x: sideX, y: -gapY / 2 },
                { x: sideX, y: gapY / 2 },
            ];

        case 4:
            return [
                { x: -sideX, y: -gapY / 2 },
                { x: -sideX, y: gapY / 2 },
                { x: sideX, y: -gapY / 2 },
                { x: sideX, y: gapY / 2 },
            ];

        default:
            throw new Error("Too many options to render with this layout!");
    }
}


export default function createOptionsOverlay(app: Application, ballRadius: number) {
    const con = new Container();

    app.stage.addChild(con);

    function centerContainer() {
        con.x = app.screen.width / 2;
        con.y = app.screen.height / 2
    }

    // Please make a type definition for this, what am I looking at?
    async function render(optionData: ReturnType<(ReturnType<typeof createDialogueRunner>['proceed'])>, fadeDur = 60) {
        //con.removeChildren();
        
        await new Promise<void>(resolve => {
            if(con.children.length == 0) resolve();
            let elapsed = 0;
            con.children.forEach(child => {
                app.ticker.add(function fade(ticker) {
                    elapsed += ticker.deltaTime;
                    const t = Math.min(elapsed / fadeDur, 1);
                    child.alpha = 1 - t;

                    if (t >= 1) {
                        app.ticker.remove(fade);
                        con.removeChild(child) // <- code smell.
                        child.destroy();

                        resolve();
                    }
                })
            })
        })

        if (!optionData) return;

        const layout = getOptionSlots(optionData.length, ballRadius);

        optionData.forEach(async (op, i) => {
            const text = createTextWithBackground(op.text, TEXT_STYLE, true);
            text.eventMode = 'static';
            text.cursor = 'pointer'
            text.x = layout[i].x;
            text.y = layout[i].y;

            text.alpha = 0;

            con.addChild(text);
            await new Promise<void>(resolve => {
                let elapsed = 0;
                app.ticker.add(function fadeIn(ticker) {
                    elapsed += ticker.deltaTime;
                    const t = Math.min(elapsed / fadeDur, 1);
                    text.alpha = t;

                    if(t >= 1) {
                        app.ticker.remove(fadeIn);
                        resolve();
                    }
                })
            });

            text.on('pointertap', () => {
                render(op.run())
            });
        });


    }

    centerContainer();
    return { con, centerContainer, render }
}
