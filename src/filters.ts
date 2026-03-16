import { Application, DisplacementFilter, Filter, GlProgram, Sprite } from "pixi.js";
import filterFrag from './filter.glsl';
import passVert from './passvert.glsl';
import { createNoiseTexture } from "./noise";

export function createNoiseFilter(app: Application, intensity?: number) {
    const filter = new Filter({
        glProgram: new GlProgram({
            fragment: filterFrag,
            vertex: passVert
        }),
        resources: {
            timeUniforms: {
                uTime: { value: 0.0, type: 'f32' },
                uIntensity: { value: intensity, type: 'f32' }
            }
        }
    });

    app.ticker.add(ticker => {
        filter.resources.timeUniforms.uniforms.uTime += 0.04 * ticker.deltaTime;
    });

    return filter;
}

export function createDisplacementFilter(app: Application, scale = 8) {
    // Might want to change this to turbulent noise instead of value noise.
    const noiseTexture = createNoiseTexture(512, 512);
    const displacementSprite = new Sprite(noiseTexture);
    displacementSprite.texture.source.addressMode = 'repeat';
    app.stage.addChild(displacementSprite);

    const displacementFilter = new DisplacementFilter(displacementSprite);
    displacementFilter.scale.set(scale);

    app.ticker.add(_ => {
        displacementSprite.x += 0.5;
        displacementSprite.y += 0.5;
    });

    return displacementFilter;
}