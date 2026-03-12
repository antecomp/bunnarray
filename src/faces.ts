import { Application, Texture } from 'pixi.js';
import pleased from './assets/chars/pleased.png';
import smile from './assets/chars/smile.png';
import weary from './assets/chars/weary.png';
import nice from './assets/nice.jpg';
import what from './assets/chars/what.jpg';

import { createCrossfadingTextureDisplay, loadImageAsTexture } from './sprite';

const FACE_SOURCES = {
    pleased, smile, weary, nice, what
}

export default async function createFacesContainer(app: Application) {
    const FACE_TEXTURES: Record<string, Texture> = {};

    for (const [key, src] of Object.entries(FACE_SOURCES)) {
        FACE_TEXTURES[key] = await loadImageAsTexture(src);
    }

    const {container, changeTexture} = await createCrossfadingTextureDisplay(app);

    function changeTo(face: keyof typeof FACE_SOURCES) {
        changeTexture(FACE_TEXTURES[face]);
    }

    function centerContainer() {
        container.x = app.screen.width / 2;
        container.y = app.screen.height / 2;
    }

    return {container, changeTo, centerContainer}
}