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
        timeout = setTimeout(() => func.apply(this, args), wait);
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
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x000000, 0);

// GLTFLoader instance
const loader = new GLTFLoader();
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
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(textureUrl, (texture) => {
                textureCache[textureUrl] = texture;
            });
        }
    });
};

// Call pre-fetching function
preFetchAssets();

// Load model from cache or URL
const loadModel = (url) => {
    if (currentModelUrl === url) {
        return;
    }

    if (modelCache[url]) {
        if (model) scene.remove(model);
        model = modelCache[url].scene.clone();
        updateModelTexture(currentTextureUrl); // Apply the current texture
        model.position.set(0, 0, 0);
        adjustModelScale();
        scene.add(model);
        currentModelUrl = url; // Update the current model URL
    } else {
        loader.load(url, (gltf) => {
            if (model) scene.remove(model);
            model = gltf.scene;
            updateModelTexture(currentTextureUrl); // Apply the current texture
            model.position.set(0, 0, 0);
            adjustModelScale();
            scene.add(model);
            currentModelUrl = url; // Update the current model URL
        }, undefined, console.error);
    }
};

// Variable to keep track of the currently loaded texture's URL
let currentTextureUrl = '';

// Function to update the model's texture
const updateModelTexture = (textureUrl) => {
    if (model && textureUrl) {
        const texture = textureCache[textureUrl] || new THREE.TextureLoader().load(textureUrl);
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

// Load initial model
loadModel('https://uploads-ssl.webflow.com/6665a67f8e924fdecb7b36e5/6675c8cc5cc9e9c9c8156f5d_holographic_hodie.gltf.txt');
currentTextureUrl = 'https://uploads-ssl.webflow.com/6665a67f8e924fdecb7b36e5/6675a742ad653905eaedaea8_holographic-texture.webp';
updateModelTexture(currentTextureUrl);

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
    const int samples = 5; // Increase the number of samples for a smoother blur
    vec4 blurredColor = vec4(0.0);
    float totalWeight = 0.0;
    
    for (int i = 0; i < samples; i++) {
        float t = float(i) / float(samples - 1);
        vec2 offset = rotationVelocity * t * 0.1; // Adjust the multiplier to control the length of the blur
        blurredColor += texture2D(tDiffuse, uv + offset) * (1.0 - t);
        totalWeight += (1.0 - t);
    }
    
    blurredColor /= totalWeight;
    
    // RGB offsets for chromatic aberration
    vec2 offsetR = rotationVelocity * 0.75; // Adjust the multiplier for noticeable effect
    vec2 offsetG = rotationVelocity * 0.25;
    vec2 offsetB = rotationVelocity * 0.35;
    vec4 colorR = texture2D(tDiffuse, uv + offsetR);
    vec4 colorG = texture2D(tDiffuse, uv - offsetG);
    vec4 colorB = texture2D(tDiffuse, uv + offsetB);

    // Smooth the edges by blending the channels slightly
    vec4 finalColor = vec4(
        mix(blurredColor.r, colorR.r, 0.5),
        mix(blurredColor.g, colorG.g, 0.5),
        mix(blurredColor.b, colorB.b, 0.5),
        blurredColor.a
    );

    gl_FragColor = mix(finalColor, blurredColor, 0.5); // Blend the RGB effect with the motion blur effect
}
`;

// Post-processing setup
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

// Adjust model scale based on window size
const adjustModelScale = () => {
    if (model) {
        const minScaleFactor = 2.0; // Minimum scale factor
        const maxScaleFactor = 2.5; // Maximum scale factor for larger screens

        // Determine if the device is mobile
        const isMobile = sizes.width < 768;

        // Calculate scale factors based on screen size
        const scaleFactorWidth = isMobile ? sizes.width / 600 : sizes.width / 900;
        const scaleFactorHeight = isMobile ? sizes.height / 500 : sizes.height / 700;

        // Determine the final scale factor
        let scaleFactor = Math.min(scaleFactorWidth, scaleFactorHeight);

        // Ensure the scale factor is within the defined range
        scaleFactor = Math.max(minScaleFactor, Math.min(scaleFactor, maxScaleFactor));

        // Apply the scale factor to the model
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
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

    composer.render();
};
animate();

// Add event listeners to the divs for model switching
document.querySelectorAll('[data-garment-id]').forEach((element) => {
    element.addEventListener('click', () => {
        const modelUrl = element.getAttribute('data-3d-url');
        if (modelUrl) {
            loadModel(modelUrl);
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
