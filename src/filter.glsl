precision highp float;

in vec2 vTextureCoord;
in vec4 vColor;

uniform sampler2D uTexture;
uniform float uTime;

uniform vec4 filterArea;
uniform vec2 uDimensions;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
}

void main(void) {
    vec2 uvs = vTextureCoord.xy;

    vec4 color = texture2D(uTexture, uvs);
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    color.r = uvs.y + sin(uTime);

    gl_FragColor = color;

    // if((uvs.y * uDimensions.y) > 1.0) {
    //     gl_FragColor = vec4(rand(uvs));
    // }

    // gl_FragColor = vec4(vec3(brightness), 1.0);

    float thr = brightness > 4.0 * rand(uvs) ? 1.0 : 0.0;

    gl_FragColor = vec4(vec3(thr), 1.0);


}

// I will devour the next thing that moves.