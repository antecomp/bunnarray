import { Application, Container, Texture, TextureSource } from 'pixi.js';
import pleased from './assets/chars/pleased.png';
import smile from './assets/chars/smile.png';
import weary from './assets/chars/weary.png';
import nice from './assets/nice.jpg';
import { createCrossfadingTextureDisplay, loadImageAsTexture } from './sprite';

const FACE_SOURCES = {
    pleased, smile, weary, nice
}

// TODO: Change to factory function so I don't have to deal with the async init thing?
export default class Faces {
    private app: Application;

    private FACE_TEXTURES: Record<string, Texture> = {}
    public container: Container | undefined;
    private changeTexture: ((texture: Texture<TextureSource<any>>, duration?: number) => Promise<void>) | undefined

    changeTo(face: keyof typeof FACE_SOURCES) {
        if (!this.container) throw new Error("Unable to change face, container not yet initialized. Please run init first.");
        if (!this.changeTexture) throw new Error("Unable to change face, changeFace not yet initialized. Please run init first.");
        this.changeTexture(this.FACE_TEXTURES[face]);
    }

    constructor(app: Application) {
        this.app = app;
    }

    async init() {
        for (const [key, src] of Object.entries(FACE_SOURCES)) {
            this.FACE_TEXTURES[key] = await loadImageAsTexture(src);
        }
        const { container, changeTexture } = await createCrossfadingTextureDisplay(this.app);
        this.container = container;
        this.changeTexture = changeTexture;
    }

    centerContainer() {
        if(!this.container) throw new Error("Cannot center container as it is not yet initialized. Run init first.")
        this.container.x = this.app.screen.width / 2;
        this.container.y = this.app.screen.height / 2;
    }
}