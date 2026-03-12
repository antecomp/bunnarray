import { Application, Container, Sprite, Texture } from 'pixi.js';


// Force the image to fully decode through a standard Image element first, then create the PixiJS texture from that
// this guarantees WebGL gets valid, decoded bitmap data.
// WebkitGTK is the antichrist.
export function loadImageAsTexture(url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.decode()
            .then(() => resolve(Texture.from(img)))
            .catch(reject);
    });
}

export async function createCrossfadingTextureDisplay(app: Application, center = true) {
    const container = new Container();
    app.stage.addChild(container);

    let current: Sprite | null = null;
    let next: Sprite | null = null;

    let transitioning = false;

    async function changeTexture(texture: Texture, duration = 30) {
        if (transitioning) throw new Error("Cannot change texture while transition already occuring.");
        transitioning = true;

        next = new Sprite(texture);
        next.alpha = 0;
        if(center) next.anchor.set(0.5);
        container.addChild(next);

        let elapsed = 0;
        await new Promise<void>(resolve => {
            app.ticker.add(function fade(time) { // so it can self-ref
                elapsed += time.deltaTime;
                const opp = Math.min(elapsed / duration, 1);
                next!.alpha = opp;
                // if (current) current.alpha = 1 - opp;

                if (opp >= 1) {
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

    return {container, changeTexture}
}