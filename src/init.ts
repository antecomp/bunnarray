import { Application } from "pixi.js";

export default async function initializeApp(): Promise<Application> {
    const app = new Application();
    await app.init({
        background: '#000000ff', resizeTo: window, useBackBuffer: true,
        resolution: 1,
        autoDensity: true,
        antialias: false, roundPixels: true,
    });

    app.canvas.style.imageRendering = 'pixelated'

    document.body.appendChild(app.canvas);

    return app;
}