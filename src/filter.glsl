precision highp float;

in vec2 vTextureCoord;
in vec4 vColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
}

void main(void) {

    float intensity = uIntensity > 0.0 ? uIntensity : 4.0;

    vec2 uvs = vTextureCoord.xy;

    vec4 color = texture2D(uTexture, uvs);
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    float thr = brightness > intensity * rand(uvs) ? 1.0 : 0.0;

    gl_FragColor = vec4(vec3(thr), color.a);
}