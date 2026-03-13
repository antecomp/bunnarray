import { Application, Container, TextStyle, Text } from "pixi.js";

export function createCrossFadingTextDisplay(app: Application, style: TextStyle, center = true) {
    const container = new Container();
    app.stage.addChild(container);

    let current: Text | null = null;
    let next: Text | null = null;
    let transitioning = false;

    async function changeText(value: string, duration = 30) {
        if (transitioning) throw new Error("Cannot change text during transition!");
        transitioning = true;

        next = new Text({ text: value, style });
        next.alpha = 0;
        if (center) next.anchor.set(0.5);
        container.addChild(next);

        let elapsed = 0;
        await new Promise<void>(resolve => {
            app.ticker.add(function fade(ticker) {
                elapsed += ticker.deltaTime;
                const t = Math.min(elapsed / duration, 1);

                next!.alpha = t;
                if (current) current.alpha = 1 - t;

                if (t >= 1) {
                    app.ticker.remove(fade);

                    if (current) {
                        container.removeChild(current);
                        current.destroy();
                    }

                    current = next;
                    next = null;
                    transitioning = false;
                    resolve();
                }
            })
        })
    }

    function centerText(horizontal = true, vertical = true, offset?: { x: number, y: number }) {
        if (horizontal) container.x = (app.screen.width / 2) + (offset?.x ?? 0);
        if (vertical)   container.y = (app.screen.height / 2) + (offset?.y ?? 0);
    }

    return { container, changeText, centerText }
}