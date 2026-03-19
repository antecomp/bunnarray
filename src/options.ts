import { Application, Container } from "pixi.js";
import { createTextWithBackground } from "./text";
import { TEXT_STYLE } from "./main";
import { fadeTo } from "./fade";
import { DialogueOption } from "./dialogue/types";
import { createNoiseFilter } from "./filters";

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
        con.y = app.screen.height / 2;
    }

    async function hide(fadeDur = 15) {
        await Promise.all(Array.from(con.children).map(child =>
            fadeTo(app, child, 0, fadeDur)
        ));
        con.removeChildren().forEach(c => c.destroy());
    }

    async function show(
        options: DialogueOption[],
        onChoose: (index: number) => void,
        fadeDur = 15
    ) {
        const layout = getOptionSlots(options.length, ballRadius);

        const nodes = options.map((op, i) => {
            const text = createTextWithBackground(op.text, TEXT_STYLE, true);

            const normalNoise = createNoiseFilter(app);
            const lightNoise = createNoiseFilter(app, 1.0);

            text.filters = [normalNoise];

            text.eventMode = 'static';
            text.cursor = 'pointer';
            text.alpha = 0;
            text.x = layout[i].x;
            text.y = layout[i].y;
            text.on('pointertap', () => onChoose(i));
            text.on('pointerover', () => {text.filters = [lightNoise]});
            text.on('pointerleave', () => {text.filters = [normalNoise]});
            con.addChild(text);
            return text;
        });

        await Promise.all(nodes.map(n => fadeTo(app, n, 1, fadeDur)));
    }

    centerContainer();
    return { con, centerContainer, show, hide };
}
