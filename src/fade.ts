import { Application, Container } from "pixi.js";

export function fadeTo(app: Application, object: Container, target: number, duration: number): Promise<void> {
    const startAlpha = object.alpha;
    return new Promise<void>(resolve => {
        let elapsed = 0;
        app.ticker.add(function tick(ticker) {
            elapsed += ticker.deltaTime;
            const t = Math.min(elapsed / duration, 1);
            object.alpha = startAlpha + (target - startAlpha) * t;

            if (t >= 1) {
                app.ticker.remove(tick);
                resolve();
            }
        });
    });
}