import './styles/style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Set pixel ratio
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


@@ -604,295 +605,277 @@
};
animate();

// Set up ScrollTrigger for pinning and unpinning the canvas
ScrollTrigger.create({
    trigger: '.section.is-material',
    start: 'top top',
    endTrigger: '.section.is-garment',
    end: 'bottom top',
    pin: canvas,
    pinSpacing: false,
    scrub: true,
    onUpdate: (self) => {
        // Update the model's position or other properties based on scroll progress
        if (model) {
            const progress = self.progress;
            // Update model properties based on progress, e.g., rotation
            model.rotation.y = progress * Math.PI * 2; // Full rotation over scroll
        }
    },
<<<<<<< HEAD
=======
    onEnter: () => console.log('Entered .section.is-material'),
    onLeave: () => console.log('Left .section.is-material'),
    onEnterBack: () => console.log('Entered back .section.is-material'),
    onLeaveBack: () => console.log('Left back .section.is-material')
>>>>>>> parent of 06343ec (main.js)
});

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

let currentActiveGarment = null;
let currentActiveThread = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the first garment as active by default
    const defaultGarment = document.querySelector('.garment_item');
    if (defaultGarment) {
        currentActiveGarment = defaultGarment;
        currentActiveGarment.classList.add('active');
        currentActiveGarment.classList.add('inner-shadow'); // Add inner-shadow class to default garment
        setGarmentImageOpacity(currentActiveGarment, '1');
    }

    handleItemSelection(
        '.garment_item',
        '.img.is-garment, .img.is-garment-2, .img.is-garment-3',
        '.garment_corner-wrap',
        true // Enable inner shadow
    );

    handleItemSelection(
        '.threads_trigger-item',
        '.img.is-threads',
        '.threads_corner',
        false, // Disable inner shadow on items
        true // Only update the top position
    );

    handleItemSelection(
        '.threads_img',
        '.img.is-threads',
        null, // No corner wrap for threads_img
        false // Disable inner shadow
    );

    // Add event listeners to the divs for texture switching
    document.querySelectorAll('[data-threads-id]').forEach((element, index) => {
        element.addEventListener('click', () => {
            const textureUrl = element.getAttribute('data-texture-url');
            if (textureUrl) {
                updateModelTexture(textureUrl);
            } else {
                console.error('No texture URL found for this element');
            }

            // Handle showing the appropriate garment images
            displayGarmentImages(index);
        });
    });

    function setGarmentImageOpacity(garmentDiv, opacity) {
        garmentDiv.querySelectorAll('.img.is-garment, .img.is-garment-2, .img.is-garment-3').forEach(img => {
            img.style.opacity = opacity;
        });
    }

    function displayGarmentImages(index) {
        // Hide all garment images first
        document.querySelectorAll('.img.is-garment, .img.is-garment-2, .img.is-garment-3').forEach(img => {
            img.style.display = 'none';
        });

        // Show the selected garment image based on the index for all garments
        const garmentClass = `.img.is-garment${index === 0 ? '' : '-' + (index + 1)}`;
        document.querySelectorAll(garmentClass).forEach(selectedImg => {
            selectedImg.style.display = 'block';
        });

        // Set the opacity of the active garment images
        if (currentActiveGarment) {
            setGarmentImageOpacity(currentActiveGarment, '1');
        }
    }

    function handleItemSelection(itemSelector, imgSelector, cornerWrapSelector, enableShadow, onlyUpdateTop = false) {
        const items = document.querySelectorAll(itemSelector);
        const cornerWrap = cornerWrapSelector ? document.querySelector(cornerWrapSelector) : null;
        let activeParagraph = null; // Variable to store the active paragraph

        function positionCornerWrap(targetItem) {
            if (cornerWrap) {
                const rect = targetItem.getBoundingClientRect();
                const parentRect = targetItem.offsetParent.getBoundingClientRect();
                cornerWrap.style.top = `${rect.top - parentRect.top - 0.25 * window.innerWidth / 100}px`;
                if (!onlyUpdateTop) {
                    cornerWrap.style.left = `${rect.left - parentRect.left - 0.25 * window.innerWidth / 100}px`;
                }
            }
        }

        function updateParagraphIndicator(targetItem) {
            const paragraph = targetItem.querySelector('.paragraph.is-support-medium');
            if (paragraph && paragraph !== activeParagraph) {
                if (activeParagraph) {
                    activeParagraph.classList.remove('active');
                }
                paragraph.classList.add('active');
                activeParagraph = paragraph;
            }
        }

        items.forEach(item => {
            const imgs = item.querySelectorAll(imgSelector);
            if (imgs.length === 0) {
                console.error(`Image with class ${imgSelector} not found in item`, item);
                return;
            }

            item.addEventListener('mouseenter', function() {
                if (itemSelector === '.garment_item' && currentActiveGarment !== item) {
                    imgs.forEach(img => {
                        img.style.opacity = '0.8';
                    });
                    item.classList.add('hover-inner-shadow'); // Add hover inner shadow for garments
                } else if (itemSelector === '.threads_trigger-item' && currentActiveThread !== item) {
                    imgs.forEach(img => {
                        img.style.opacity = '0.8';
                    });
                }
            });

            item.addEventListener('mouseleave', function() {
                if (itemSelector === '.garment_item' && currentActiveGarment !== item) {
                    imgs.forEach(img => {
                        img.style.opacity = '0.5';
                    });
                    item.classList.remove('hover-inner-shadow'); // Remove hover inner shadow for garments
                } else if (itemSelector === '.threads_trigger-item' && currentActiveThread !== item) {
                    imgs.forEach(img => {
                        img.style.opacity = '0.5';
                    });
                }
            });

            item.addEventListener('click', function() {
                items.forEach(d => {
                    const otherImgs = d.querySelectorAll(imgSelector);
                    otherImgs.forEach(otherImg => {
                        otherImg.style.opacity = '0.5';
                    });
                    if (enableShadow) {
                        d.classList.remove('inner-shadow');
                    }
                    d.classList.remove('hover-inner-shadow'); // Remove hover inner shadow when another item is clicked
                    d.classList.remove('active');
                });

                imgs.forEach(img => {
                    img.style.opacity = '1';
                });
                if (enableShadow) {
                    item.classList.add('inner-shadow');
                }
                item.classList.add('active');

                if (itemSelector === '.garment_item') {
                    currentActiveGarment = item;
                } else {
                    currentActiveThread = item;
                }

                if (cornerWrap) {
                    positionCornerWrap(item);
                    cornerWrap.classList.add('inner-shadow'); // Add inner shadow to the corner wrap
                }
                updateParagraphIndicator(item);
            });
        });

        // Ensure the active paragraph remains active even when clicking outside
        document.addEventListener('click', function(event) {
            const isItem = event.target.closest(itemSelector);
            if (!isItem && activeParagraph) {
                activeParagraph.classList.add('active');
            }
        });
    }

    // Display the first set of garment images by default after everything is set up
    displayGarmentImages(0);

    // Ensure the first garment image is set to full opacity by default
    const firstGarmentImg = document.querySelector('.garment_item .img.is-garment');
    if (firstGarmentImg) {
        firstGarmentImg.style.opacity = '1';
    }



})