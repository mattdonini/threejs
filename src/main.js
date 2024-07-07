import './styles/style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Canvas and Scene
const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();
scene.background = null;

// Sizes
const sizes = { width: window.innerWidth, height: window.innerHeight };

// Debounce function
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            requestAnimationFrame(() => func.apply(this, args));
        }, wait);
    };
};

// Resize event handling
window.addEventListener('resize', debounce(() => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(sizes.width, sizes.height);
    adjustModelScale();
}, 100));

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 2);
scene.add(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // Set background to transparent
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;

// GLTFLoader and TextureLoader instances
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
let model;
let currentModelUrl = ''; // Variable to keep track of the currently loaded model's URL

// Cache for pre-fetched models and textures
const modelCache = {};
const textureCache = {};

// Pre-fetch models and textures and cache them
const preFetchAssets = () => {
    // Pre-fetch models
    document.querySelectorAll('[data-3d-url]').forEach((element) => {
        const modelUrl = element.getAttribute('data-3d-url');
        if (modelUrl && !modelCache[modelUrl]) {
            loader.load(modelUrl, (gltf) => {
                modelCache[modelUrl] = gltf;
            });
        }
    });

    // Pre-fetch textures
    document.querySelectorAll('[data-texture-url]').forEach((element) => {
        const textureUrl = element.getAttribute('data-texture-url');
        if (textureUrl && !textureCache[textureUrl]) {
            textureLoader.load(textureUrl, (texture) => {
                textureCache[textureUrl] = texture;
            });
        }
    });
};

// Call pre-fetching function
preFetchAssets();

// Load model from cache or URL
const loadModel = (url, callback) => {
    if (modelCache[url]) {
        if (model) scene.remove(model);
        model = modelCache[url].scene.clone();
        updateModelTexture(currentTextureUrl); // Apply the current texture
        model.position.set(0, 0, 0);
        adjustModelScale();
        scene.add(model);
        currentModelUrl = url; // Update the current model URL
        if (callback) callback();
    } else {
        loader.load(url, (gltf) => {
            if (model) scene.remove(model);
            model = gltf.scene;
            updateModelTexture(currentTextureUrl); // Apply the current texture
            model.position.set(0, 0, 0);
            adjustModelScale();
            scene.add(model);
            currentModelUrl = url; // Update the current model URL
            if (callback) callback();
        }, undefined, console.error);
    }
};

// Variable to keep track of the currently loaded texture's URL
let currentTextureUrl = '';

// Function to update the model's texture
const updateModelTexture = (textureUrl) => {
    if (model && textureUrl) {
        const texture = textureCache[textureUrl] || textureLoader.load(textureUrl);
        texture.encoding = THREE.sRGBEncoding;
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshMatcapMaterial({ matcap: texture, transparent: true, opacity: 1.0 });
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        currentTextureUrl = textureUrl; // Update the current texture URL
    }
};

// Load initial model without pixelation effect
loadModel('https://uploads-ssl.webflow.com/6665a67f8e924fdecb7b36e5/6675c8cc5cc9e9c9c8156f5d_holographic_hodie.gltf.txt', () => {
    currentTextureUrl = 'https://uploads-ssl.webflow.com/6665a67f8e924fdecb7b36e5/6675a742ad653905eaedaea8_holographic-texture.webp';
    updateModelTexture(currentTextureUrl);
});

// Mouse move event listener
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
});

// Smooth interpolation function
const lerp = (start, end, amount) => (1 - amount) * start + amount * end;

// Variables to track model rotation velocity
let lastRotationX = 0, lastRotationY = 0;
let rotationVelocityX = 0, rotationVelocityY = 0;

// Post-processing shaders
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D tDiffuse;
uniform vec2 rotationVelocity;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    vec4 color = texture2D(tDiffuse, uv);

    // RGB offsets for chromatic aberration
    vec2 offsetR = rotationVelocity * 0.15; // Adjust the multiplier for noticeable effect
    vec2 offsetG = rotationVelocity * 0.10;
    vec2 offsetB = rotationVelocity * 0.12;
    vec4 colorR = texture2D(tDiffuse, uv + offsetR);
    vec4 colorG = texture2D(tDiffuse, uv - offsetG);
    vec4 colorB = texture2D(tDiffuse, uv + offsetB);

    // Smooth the edges by blending the channels slightly
    vec4 finalColor = vec4(
        mix(color.r, colorR.r, 0.5),
        mix(color.g, colorG.g, 0.5),
        mix(color.b, colorB.b, 0.5),
        color.a
    );

    gl_FragColor = finalColor; // Use the final color with RGB effect
}
`;

// Pixelation Displacement Shader
const pixelationVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const pixelationFragmentShader = `
uniform sampler2D tDiffuse;
uniform float pixelSize;
uniform vec2 resolution;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    // Pixelation effect
    if (pixelSize > 0.0) {
        uv = floor(uv / pixelSize) * pixelSize;
    }

    // Fetch the texture color
    vec4 color = texture2D(tDiffuse, uv);

    // Glitch effect: random offsets
    float glitchIntensity = 0.95 * pixelSize;
    vec2 glitchOffset = vec2(glitchIntensity * (fract(sin(dot(uv.xy ,vec2(12.9898,78.233))) * 43758.5453) - 0.5), 0.0);

    // RGB distortion effect
    vec2 offsetR = glitchOffset;
    vec2 offsetG = vec2(0.0);
    vec2 offsetB = -glitchOffset;

    vec4 colorR = texture2D(tDiffuse, uv + offsetR);
    vec4 colorG = texture2D(tDiffuse, uv + offsetG);
    vec4 colorB = texture2D(tDiffuse, uv + offsetB);

    // Combine the RGB channels with the glitch effect
    gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, color.a);
}
`;

// Noise Shader
const noiseFragmentShader = `
uniform sampler2D tDiffuse;
uniform float time;
uniform float noiseStrength;
varying vec2 vUv;

float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 color = texture2D(tDiffuse, vUv);
    float noise = random(vUv + time) * noiseStrength;
    color.rgb += noise * 0.15; // Adjust the multiplier for noise intensity
    gl_FragColor = color;
}
`;

// Glitch Shader
const glitchVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glitchFragmentShader = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float uAmount;
uniform float uChromAbb;
uniform float uGlitch;
uniform float uTime;

float random(in float x) {
    return fract(sin(x)*1e4);
}

void main() {
    vec2 uv = vUv;
    float time = floor(uTime * 0.5) * 2.;
    float size = uAmount * 0.2 * random(time + 0.001);
    float floorY = floor(uv.y / size);
    float floorX = floor(uv.x / size);
    float phase = 0.01 * 0.01;
    float phaseTime = phase + uTime;
    float chromab = uChromAbb * 0.75;
    float offset = 0.;
    float glitchMod = max(0., sign(random(sin(floorY + offset + phase)) - 0.5 - (1. - uGlitch*2.) / 2.));
    float offX = ((random(floorY + offset * glitchMod + phase)) * 0.01 - 0.01 / 2.) / 5.;
    uv.x = mix(uv.x, uv.x + offX * 2., glitchMod);
    float waveFreq = 30.0;
    float waveAmp = 0.005 * 0.00;
    float rogue = smoothstep(0., 2., sin((uv.y + 0.01) * waveFreq * (1. - uAmount) * 2. + uTime * 0.05) - 0.5) * 0.2 * 0.00;
    uv.x += sin(uv.y * waveFreq + uTime) * waveAmp + rogue;
    uv.y += sin(uv.x * waveFreq + uTime) * waveAmp;
    float waveX = sin(uv.y * waveFreq + uTime) * waveAmp + rogue * chromab * 0.2;
    vec4 color = texture(tDiffuse, uv);
    color.r = texture(tDiffuse, vec2(uv.x + (glitchMod * -offX * chromab - waveX), uv.y)).r;
    color.b = texture(tDiffuse, vec2(uv.x + (glitchMod * offX * chromab + waveX), uv.y)).b;
    gl_FragColor = color;
}
`;

// Blinds Shader
const blindsVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const blindsFragmentShader = `
precision mediump float;
uniform sampler2D tDiffuse;
uniform float uAmount;
uniform float uTime;
uniform vec2 uMousePos;
uniform vec2 uResolution;
varying vec2 vUv;

float ease (int easingFunc, float t) {
    return t;
}
const float STEPS = 10.0;
const float PI = 3.14159265359;
mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
}
vec2 scaleAspect(vec2 st, float aspectRatio) {
    return st * vec2(aspectRatio, 1.0);
}
vec2 unscaleAspect(vec2 st) {
    float aspectRatio = uResolution.x / uResolution.y;
    return st * vec2(1.0/aspectRatio, 1.0);
}
vec2 rotate(vec2 st, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    return rot * st;
}
struct StructFunc {
    vec2 st;
    vec3 distort;
};
StructFunc style0(vec2 st, vec2 pos, float divisions, float dist, float amount, vec3 first, vec3 second, vec3 third) {
    float segment = fract((st.y + 1. - pos.y - 1. + uTime * 0.01) * divisions);
    vec3 distort = mix(mix(first, second, segment * 2.), mix(second, third, (segment - 0.5) / (1. - 0.5)), step(0.5, segment));
    st.y -= pow(distort.r, dist) / 10. * amount;
    st.y += pow(distort.b, dist) / 10. * amount;
    st = rot(0.00 * 2. * PI) * (st - pos) + pos;
    st = unscaleAspect(st);
    return StructFunc(st, distort);
}
StructFunc getStyle(vec2 st, vec2 pos, float divisions, float dist, float amount, vec3 first, vec3 second, vec3 third) {
    return style0(st, pos, divisions, dist, amount, first, second, third);
}
vec4 blinds(vec2 st, float mDist) {
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 pos = vec2(0.5, 0.5) + mix(vec2(0), (uMousePos - 0.5), 0.00) * floor(1.00);
    pos = scaleAspect(pos, aspectRatio);
    st = scaleAspect(st, aspectRatio);
    st = rotate(st - pos, -0.00 * 2.0 * PI) + pos;
    vec3 first = vec3(1, 0, 0);
    vec3 second = vec3(0, 1, 0);
    vec3 third = vec3(0, 0, 1);
    float divisions = 2. + -30.00 * 30.;
    float dist = 1.00 * 4. + 1.;
    float amount = uAmount * mDist;
    StructFunc result = getStyle(st, pos, divisions, dist, amount, first, second, third);
    vec4 color = texture2D(tDiffuse, result.st);
    return color;
}

void main() {
    gl_FragColor = blinds(vUv, 1.0);
}
`;

// Diffuse Shader
const diffuseVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const diffuseFragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform float uTime;
uniform float xy;
uniform float amount; // New uniform for controlling amount
uniform vec2 uMousePos;
uniform vec2 uResolution;

float ease(int easingFunc, float t) { 
    return t; 
}

const float MAX_ITERATIONS = 24.0;
const float PI = 3.14159265;
const float TWOPI = 6.2831853;

float random(vec2 seed) { 
    seed.x *= uResolution.x / uResolution.y; 
    return fract(sin(dot(seed.xy, vec2(12.9898, 78.233))) * 43758.5453); 
}

void main() {
    vec2 uv = vUv;
    vec2 pos = vec2(0.5, 0.5) + mix(vec2(0), (uMousePos - 0.5), 0.00); 
    float aspectRatio = uResolution.x / uResolution.y;
    float delta = fract(floor(uTime) / 20.0);

    float angle, rotation, amp;
    float inner = distance(uv * vec2(aspectRatio, 1.0), pos * vec2(aspectRatio, 1.0));
    float outer = max(0.0, 1.0 - distance(uv * vec2(aspectRatio, 1.0), pos * vec2(aspectRatio, 1.0)));
    float amt = amount * ease(0, mix(inner, outer, 0.11)) * 2.0;
    vec2 mPos = vec2(0.5, 0.5) + mix(vec2(0), (uMousePos - 0.5), 0.00); 
    pos = vec2(0.5, 0.5);
    float dist = ease(0, max(0.0, 1.0 - distance(uv * vec2(aspectRatio, 1.0), mPos * vec2(aspectRatio, 1.0)) * 4.0 * (1.0 - 1.00)));
    amt *= dist;

    if (amt == 0.0) {
        vec4 color = texture2D(tDiffuse, uv);
        gl_FragColor = color;
        return;
    }

    vec4 result = vec4(0);
    float threshold = max(1.0 - 0.53, 2.0 / MAX_ITERATIONS);
    const float invMaxIterations = 1.0 / float(MAX_ITERATIONS);

    for (float i = 1.0; i <= MAX_ITERATIONS; i++) {
        float th = i * invMaxIterations;
        if (th > threshold) break;
        float random1 = random(uv + th + delta);
        float random2 = random(uv + th * 2.0 + delta);
        float random3 = random(uv + th * 3.0 + delta);
        vec2 ranPoint = vec2(random1 * 2.0 - 1.0, random2 * 2.0 - 1.0) * mix(1.0, random3, 0.8);
        vec2 offset = ranPoint * vec2(0.91, 1.0 - 0.91) * amt * 0.4;
        offset.x /= aspectRatio;
        result += texture2D(tDiffuse, uv + offset);
    }

    result /= floor(MAX_ITERATIONS * threshold);
    vec4 col = result;
    gl_FragColor = col;
}
`;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const customPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        rotationVelocity: { value: new THREE.Vector2() },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader
});
customPass.renderToScreen = true;
composer.addPass(customPass);

const pixelationPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        pixelSize: { value: 0.0 },
        resolution: { value: new THREE.Vector2(sizes.width, sizes.height) }
    },
    vertexShader: pixelationVertexShader,
    fragmentShader: pixelationFragmentShader
});
composer.addPass(pixelationPass);

// Noise Pass
const noisePass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        noiseStrength: { value: 0.0 }
    },
    vertexShader: vertexShader,
    fragmentShader: noiseFragmentShader
});
composer.addPass(noisePass);

// Glitch Pass
const glitchPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        uAmount: { value: 0.0 },
        uChromAbb: { value: 0.0 },
        uGlitch: { value: 0.0 },
        uTime: { value: 0.0 },
    },
    vertexShader: glitchVertexShader,
    fragmentShader: glitchFragmentShader
});
composer.addPass(glitchPass);

// Blinds Pass
const blindsPass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        uAmount: { value: 0.0 },
        uTime: { value: 0.0 },
        uMousePos: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(sizes.width, sizes.height) },
    },
    vertexShader: blindsVertexShader,
    fragmentShader: blindsFragmentShader
});
composer.addPass(blindsPass);

// Diffuse Pass
const diffusePass = new ShaderPass({
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        xy: { value: 0.0 },
        amount: { value: 0.13 }, // Set the amount to 0.13
        uMousePos: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(sizes.width, sizes.height) },
    },
    vertexShader: diffuseVertexShader,
    fragmentShader: diffuseFragmentShader
});
composer.addPass(diffusePass);

// Disable glitch, blinds, and diffuse pass initially
glitchPass.enabled = false;
blindsPass.enabled = false;
diffusePass.enabled = false;

// Adjust model scale based on window size
const adjustModelScale = () => {
    if (model) {
        const minScaleFactor = 2.0; // Minimum scale factor
        const maxScaleFactor = 2.5; // Maximum scale factor for larger screens

        // Determine if the device is mobile
        const isMobile = sizes.width < 768;

        // Calculate scale factors based on screen size
        const scaleFactorWidth = isMobile ? sizes.width / 1200 : sizes.width / 1500;
        const scaleFactorHeight = isMobile ? sizes.height / 1200 : sizes.height / 1500;

        // Determine the final scale factor
        let scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);

        // Ensure the scale factor is within the defined range
        scaleFactor = Math.max(minScaleFactor, Math.min(scaleFactor, maxScaleFactor));

        // Apply the scale factor to the model
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
};

// Custom easing function for ease-in-out
const easeInOutQuad = (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

// Animation loop
const animate = () => {
    requestAnimationFrame(animate);

    if (model) {
        model.position.set(0, 0, 0);

        // Increase the factors to make the rotation more noticeable
        const rotationFactorX = 0.2;
        const rotationFactorY = 0.2;

        model.rotation.x = lerp(model.rotation.x, mouse.y * rotationFactorX, 0.1);
        model.rotation.y = lerp(model.rotation.y, mouse.x * rotationFactorY, 0.1);

        rotationVelocityX = model.rotation.x - lastRotationX;
        rotationVelocityY = model.rotation.y - lastRotationY;
        lastRotationX = model.rotation.x;
        lastRotationY = model.rotation.y;
    }

    customPass.uniforms.rotationVelocity.value.set(rotationVelocityY, rotationVelocityX);

    // Update noise effect parameters
    noisePass.uniforms.time.value += 0.05; // Adjust the speed of the noise effect
    glitchPass.uniforms.uTime.value += 0.05; // Update time for glitch effect
    blindsPass.uniforms.uTime.value += 0.05; // Update time for blinds effect
    diffusePass.uniforms.uTime.value += 0.05; // Update time for diffuse effect

    composer.render();
};
animate();

// Add event listeners to the divs for model switching
document.querySelectorAll('[data-garment-id]').forEach((element) => {
    element.addEventListener('click', () => {
        const modelUrl = element.getAttribute('data-3d-url');
        if (modelUrl) {
            // Apply pixelation, noise, glitch, blinds, and diffuse effects during transition
            const duration = 350; // duration of the transition in milliseconds
            const glitchDuration = 450; // duration for the glitch effect in milliseconds
            const start = performance.now();

            // Enable glitch, blinds, and diffuse pass during transition
            glitchPass.enabled = true;
            blindsPass.enabled = true;
            diffusePass.enabled = true;

            const transitionOut = () => {
                const now = performance.now();
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeInOutQuad(progress);

                pixelationPass.uniforms.pixelSize.value = 0.006 * easedProgress;
                noisePass.uniforms.noiseStrength.value = 0.5 * easedProgress;
                glitchPass.uniforms.uAmount.value = 16 * easedProgress;
                glitchPass.uniforms.uChromAbb.value = 2 * easedProgress;
                glitchPass.uniforms.uGlitch.value = 4 * easedProgress;
                blindsPass.uniforms.uAmount.value = 0.2 * easedProgress;
                diffusePass.uniforms.xy.value = 1 * easedProgress;
                diffusePass.uniforms.amount.value = 0.12 * easedProgress;

                if (progress < 1) {
                    requestAnimationFrame(transitionOut);
                } else {
                    loadModel(modelUrl, transitionIn);
                }
            };

            const transitionIn = () => {
                const start = performance.now();
                const transition = () => {
                    const now = performance.now();
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / glitchDuration, 1);
                    const easedProgress = easeInOutQuad(1 - (elapsed / glitchDuration)); // Ease out for glitch effect

                    pixelationPass.uniforms.pixelSize.value = 0.010 * easedProgress;
                    noisePass.uniforms.noiseStrength.value = 0.5 * easedProgress;
                    glitchPass.uniforms.uAmount.value = 5 * easedProgress;
                    glitchPass.uniforms.uChromAbb.value = 3 * easedProgress;
                    glitchPass.uniforms.uGlitch.value = 6 * easedProgress;
                    blindsPass.uniforms.uAmount.value = 0.2 * easedProgress;
                    diffusePass.uniforms.xy.value = 2 * easedProgress;
                    diffusePass.uniforms.amount.value = 0.1 * easedProgress;

                    if (elapsed < glitchDuration) {
                        requestAnimationFrame(transition);
                    } else {
                        // Reset uniforms after transition
                        pixelationPass.uniforms.pixelSize.value = 0.0;
                        noisePass.uniforms.noiseStrength.value = 0.0;
                        glitchPass.uniforms.uAmount.value = 0.0;
                        glitchPass.uniforms.uChromAbb.value = 0.0;
                        glitchPass.uniforms.uGlitch.value = 0.0;
                        blindsPass.uniforms.uAmount.value = 0.0;
                        diffusePass.uniforms.xy.value = 0.0;
                        diffusePass.uniforms.amount.value = 0.0;
                        // Disable glitch, blinds, and diffuse pass after transition
                        glitchPass.enabled = false;
                        blindsPass.enabled = false;
                        diffusePass.enabled = false;
                    }
                };
                transition();
            };

            transitionOut();
        } else {
            console.error('No model URL found for this element');
        }
    });
});

// Add event listeners to the divs for texture switching
document.querySelectorAll('[data-threads-id]').forEach((element) => {
    element.addEventListener('click', () => {
        const textureUrl = element.getAttribute('data-texture-url');
        if (textureUrl) {
            updateModelTexture(textureUrl);
        } else {
            console.error('No texture URL found for this element');
        }
    });
});


// Handling switching between garments and textures
document.addEventListener('DOMContentLoaded', function() {
    // Garment items functionality
    handleItemSelection(
      '.garment_item',
      '.img.is-garment',
      '.garment_corner-wrap',
      true // Enable inner shadow
    );

    // Threads items functionality
    handleItemSelection(
      '.threads_trigger-item',
      '.img.is-threads',
      '.threads_corner',
      false, // Disable inner shadow on items
      true // Only update the top position
    );

    function handleItemSelection(itemSelector, imgSelector, cornerWrapSelector, enableShadow, onlyUpdateTop = false) {
      const divs = document.querySelectorAll(itemSelector);
      let activeDiv = divs[0]; // Initialize with the first div
      const cornerWrap = cornerWrapSelector ? document.querySelector(cornerWrapSelector) : null;
      let activeParagraph; // Variable to store the active paragraph

      function positionCornerWrap(targetDiv) {
        const rect = targetDiv.getBoundingClientRect();
        const parentRect = targetDiv.offsetParent.getBoundingClientRect();
        cornerWrap.style.top = `${rect.top - parentRect.top - 0.25 * window.innerWidth / 100}px`;
        if (!onlyUpdateTop) {
          cornerWrap.style.left = `${rect.left - parentRect.left - 0.25 * window.innerWidth / 100}px`;
        }
      }

      function updateParagraphIndicator(targetDiv) {
        const paragraph = targetDiv.querySelector('.paragraph.is-support-medium');
        if (paragraph && paragraph !== activeParagraph) {
          if (activeParagraph) {
            activeParagraph.classList.remove('active');
          }
          paragraph.classList.add('active');
          activeParagraph = paragraph;
        }
      }

      if (activeDiv) {
        const firstImg = activeDiv.querySelector(imgSelector);
        if (firstImg) {
          firstImg.style.opacity = '1';
        }
        if (enableShadow) {
          activeDiv.classList.add('inner-shadow');
        }
        activeDiv.classList.add('active');
        if (cornerWrap) {
          positionCornerWrap(activeDiv);
          cornerWrap.classList.add('inner-shadow'); // Add inner shadow to the corner wrap
        }
        updateParagraphIndicator(activeDiv);
      }

      divs.forEach(div => {
        const img = div.querySelector(imgSelector);
        if (!img) {
          console.error(`Image with class ${imgSelector} not found in div`, div);
          return;
        }

        div.addEventListener('mouseenter', function() {
          if (activeDiv !== div) {
            img.style.opacity = '0.8';
          }
        });

        div.addEventListener('mouseleave', function() {
          if (activeDiv !== div) {
            img.style.opacity = '0.5';
          }
        });

        div.addEventListener('click', function() {
          divs.forEach(d => {
            const otherImg = d.querySelector(imgSelector);
            if (otherImg) {
              otherImg.style.opacity = '0.5';
            }
            if (enableShadow) {
              d.classList.remove('inner-shadow');
            }
            d.classList.remove('active');
          });

          img.style.opacity = '1';
          if (enableShadow) {
            div.classList.add('inner-shadow');
          }
          div.classList.add('active');
          activeDiv = div;

          if (cornerWrap) {
            positionCornerWrap(activeDiv);
            cornerWrap.classList.add('inner-shadow'); // Add inner shadow to the corner wrap
          }
          updateParagraphIndicator(activeDiv);
        });
      });

      // Ensure the active paragraph remains active even when clicking outside
      document.addEventListener('click', function(event) {
        const isThreadItem = event.target.closest(itemSelector);
        if (!isThreadItem && activeParagraph) {
          activeParagraph.classList.add('active');
        }
      });
    }

    // Add the same functionality for threads_img elements
    handleItemSelection(
      '.threads_img',
      '.img.is-threads',
      null, // No corner wrap for threads_img
      false // Disable inner shadow
    );
});
