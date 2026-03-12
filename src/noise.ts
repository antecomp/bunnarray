import { Texture } from "pixi.js";

// Create a canvas with perlin-ish noise, then use it as a texture
export function createNoiseTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if(!ctx) throw new Error("Unable to get canvas context");

  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const val = Math.random() * 255;
    imageData.data[i] = val;     // R (controls X displacement)
    imageData.data[i+1] = val;   // G (controls Y displacement)
    imageData.data[i+2] = 128;
    imageData.data[i+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  
  return Texture.from(canvas);
}