import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const loading = $('loading');
const loadingTitle = $('loadingTitle');
const loadingMessage = $('loadingMessage');
const progressBar = $('progressBar');
const toastNode = $('toast');
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInAppBrowser = /WhatsApp|FBAN|FBAV|Instagram|Line\/|TikTok|GSA\//i.test(navigator.userAgent);
const EXTERIOR_USDZ = './architecture-exterior.usdz';
const INTERIOR_USDZ = './architecture-interior.usdz';
let toastTimer = 0;
function toast(message, duration=3200) {
  toastNode.textContent = message;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), duration);
}

const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17201b);
scene.fog = new THREE.Fog(0x17201b, 7, 20);
const camera = new THREE.PerspectiveCamera(37, 1, 0.01, 100);
camera.position.set(2.6, 1.8, 3.2);
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x17201b, 1);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
renderer.domElement.setAttribute('aria-label', 'Drag to inspect the architectural model');
renderer.domElement.style.touchAction = 'pan-y';
viewport.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xf3f3e9, 0x424a43, 1.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedcf, 3.0);
sun.position.set(4, 6, 3);
sun.castShadow = !isMobile;
sun.shadow.mapSize.set(768, 768);
sun.shadow.camera.left = -2.3;
sun.shadow.camera.right = 2.3;
sun.shadow.camera.top = 2.5;
sun.shadow.camera.bottom = -2.3;
sun.shadow.bias = -0.00025;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xd8e4dc, 1.25);
fill.position.set(-3, 2.5, -2.5);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x777d78, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.015;
ground.receiveShadow = true;
scene.add(ground);
const placementRoot = new THREE.Group();
placementRoot.name = 'AR_PLACEMENT_ROOT';
scene.add(placementRoot);
let loadedModel = null;
let roofNode = null;
let normalizedScale = 1;
let originalRoofY = null;
let currentState = 'exterior';
let selectedColor = '#f4f1e9';
const originalMaterialColors = new Map();
const workingMaterials = new Set();
let currentHour = 10;
let tween = null;
let activeSession = null;
let viewerReferenceSpace = null;
let hitTestSource = null;
let latestHit = null;
let isPlaced = false;
let pendingAR = false;
const arReticle = new THREE.Mesh(
  new THREE.RingGeometry(0.095, 0.112, 36),
  new THREE.MeshBasicMaterial({ color: 0xa4c4a9, side: THREE.DoubleSide })
);
arReticle.rotation.x = -Math.PI / 2;
arReticle.matrixAutoUpdate = false;
arReticle.visible = false;
scene.add(arReticle);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.06;
orbit.minDistance = 1;
orbit.maxDistance = 7;
orbit.maxPolarAngle = Math.PI * 0.485;
const defaultCameraPosition = new THREE.Vector3();
const defaultTarget = new THREE.Vector3();

function setStatus(text, ready=false) {
  $('statusText').textContent = text;
  $('statusDot').style.background = ready ? '#b9d8c0' : '#d8b77c';
}
function setModelColor(color) {
  selectedColor = color;
  for (const material of workingMaterials) {
    if (material.color) material.color.set(color);
    material.needsUpdate = true;
  }
  $('customColor').value = color;
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('selected', s.dataset.color.toLowerCase() === color.toLowerCase()));
  if (loadedModel) renderer.render(scene, camera);
}
function easeRoof(state, duration=650) {
  if (!roofNode) return;
  const from = roofNode.position.y;
  const lift = 0.38 / Math.max(normalizedScale, 0.0001);
  const to = originalRoofY + (state === 'interior' ? lift : 0);
  tween = { start: performance.now(), duration, from, to };
}
function setInterior(state) {
  currentState = state === 'interior' ? 'interior' : 'exterior';
  easeRoof(currentState);
  $('modeLabel').textContent = currentState.toUpperCase();
  $('interiorLabel').textContent = currentState === 'interior' ? 'Close roof' : 'Reveal interior';
  $('interiorBtn').classList.toggle('active', currentState === 'interior');
  $('iosARLink').href = currentState === 'interior' ? INTERIOR_USDZ : EXTERIOR_USDZ;
}
function setSunlight(value) {
  currentHour = Math.max(0, Math.min(24, Number(value)));
  $('sunTime').value = String(currentHour);
  const mins = Math.round(currentHour * 60) % (24 * 60);
  $('sunTimeOutput').textContent = `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
  const t = currentHour >= 24 ? 0 : currentHour;
  const daytime = t >= 6 && t <= 18;
  const strength = daytime ? Math.max(0, Math.sin(Math.PI * (t - 6) / 12)) : 0;
  const az = (t - 6) * Math.PI / 12;
  sun.position.set(Math.cos(az) * 4, 1 + strength * 5.5, Math.sin(az) * 4);
  sun.intensity = 0.12 + strength * 3.1;
  sun.castShadow = !isMobile && strength > 0.04;
  sun.color.set(daytime && (t < 8 || t > 16) ? 0xffd2a0 : (daytime ? 0xfff0d6 : 0x8b9ab8));
  hemi.intensity = 0.55 + strength * 1.3;
  fill.intensity = 0.25 + strength * 0.7;
  $('sunCaption').textContent = t < 5.5 || t >= 19 ? 'NIGHT / LOW AMBIENT LIGHT' : t < 8 ? 'SUNRISE / WARM LIGHT' : t < 11 ? 'MORNING LIGHT' : t < 14 ? 'MIDDAY / SHORT SHADOWS' : t < 17 ? 'AFTERNOON / LONGER SHADOWS' : 'SUNSET / WARM LIGHT';
  if (loadedModel) renderer.render(scene, camera);
}
function panelToggle(panelId, buttonId) {
  const panel = $(panelId), button = $(buttonId), open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  button.classList.toggle('active', open);
}

async function loadModel() {
  loadingMessage.textContent = 'Loading architectural geometry…';
  progressBar.style.width = '8%';
  const loader = new FBXLoader();
  const source = await loader.loadAsync('./house-model.fbx', event => {
    if (event.total > 0) progressBar.style.width = `${Math.min(68, 8 + event.loaded / event.total * 60)}%`;
  });
  // Strip imported camera/light objects and fit the model to a human-scale AR footprint.
  const discard = [];
  source.traverse(o => { if (o.isCamera || o.isLight) discard.push(o); });
  discard.forEach(o => o.parent?.remove(o));
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  normalizedScale = 1.35 / Math.max(size.x, size.z, 0.001);
  source.scale.setScalar(normalizedScale);
  source.position.set(-center.x * normalizedScale, -box.min.y * normalizedScale, -center.z * normalizedScale);
  placementRoot.add(source);
  loadedModel = source;

  const materialReplacements = [];
  source.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = !isMobile;
    object.receiveShadow = !isMobile;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const materials = sourceMaterials.map(m => {
      if (!m) return new THREE.MeshStandardMaterial({color:selectedColor, roughness:0.86});
      const standard = new THREE.MeshStandardMaterial({
        name: m.name || 'Architectural finish',
        color: m.color ? m.color.clone() : new THREE.Color(selectedColor),
        map: m.map || null,
        normalMap: m.normalMap || null,
        alphaMap: m.alphaMap || null,
        roughness: 0.86,
        metalness: 0,
        transparent: !!m.transparent,
        opacity: m.opacity ?? 1,
        side: THREE.DoubleSide
      });
      standard.color.set(selectedColor);
      originalMaterialColors.set(standard, standard.color.clone());
      workingMaterials.add(standard);
      return standard;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
    // Subtle silhouette edges only on desktop; mobile keeps lower GPU cost.
    if (!isMobile && object.geometry && !object.userData.edgeAdded) {
      const edgeGeo = new THREE.EdgesGeometry(object.geometry, 38);
      if (edgeGeo.attributes.position?.count) {
        const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({color:0x4f5a52, transparent:true, opacity:0.22, depthWrite:false}));
        edge.name = '__edge_accent';
        object.add(edge);
      }
      object.userData.edgeAdded = true;
    }
  });
  roofNode = null;
  source.traverse(o => { if (!roofNode && (o.name || '').toLowerCase().includes('roof1')) roofNode = o; });
  if (roofNode) originalRoofY = roofNode.position.y;
  const worldBox = new THREE.Box3().setFromObject(placementRoot);
  const worldSize = new THREE.Vector3(); worldBox.getSize(worldSize);
  const targetY = Math.max(0.2, worldSize.y * 0.42);
  orbit.target.set(0, targetY, 0);
  const offset = Math.max(1.65, Math.max(worldSize.x, worldSize.z) * 1.8);
  camera.position.set(offset * 0.78, targetY + Math.max(worldSize.y * 0.42, 0.3), offset);
  orbit.minDistance = Math.max(0.55, offset * 0.38);
  orbit.maxDistance = Math.max(5, offset * 3.8);
  orbit.update();
  defaultCameraPosition.copy(camera.position);
  defaultTarget.copy(orbit.target);
  $('interiorBtn').disabled = !roofNode;
  $('resetBtn').disabled = false;
  progressBar.style.width = '100%';
  loadingMessage.textContent = 'Ready';
  setStatus('MODEL READY', true);
  setTimeout(() => loading.classList.add('done'), 250);
}

function isARInIOSInAppBrowser() {
  return isIOS && isInAppBrowser;
}
function setupARChoices() {
  if (isIOS) {
    $('iosARLink').hidden = false;
    $('webXRButton').hidden = true;
    $('browserWarning').hidden = false;
    $('gestureHint').textContent = 'Drag to orbit · Tap the image to open AR';
  } else {
    $('iosARLink').hidden = true;
    $('webXRButton').hidden = false;
    $('gestureHint').textContent = 'Drag to orbit · Pinch to zoom';
  }
}

async function startWebXR() {
  if (pendingAR || activeSession) { toast('AR is already active. Close the AR view before starting again.'); return; }
  if (!loadedModel) return;
  pendingAR = true;
  const btn = $('webXRButton');
  try {
    const supported = !!(window.isSecureContext && navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'));
    if (!supported) {
      $('compatModal').hidden = false;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'STARTING AR…';
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay','local-floor'], domOverlay: {root: document.body}
    });
    activeSession = session;
    const originalEnd = () => endWebXR();
    session.addEventListener('end', originalEnd, {once:true});
    loadedModel.visible = true;
    placementRoot.visible = false;
    ground.visible = false;
    scene.background = null;
    scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    document.body.classList.add('in-ar');
    $('arHint').hidden = false;
    $('placeAgainButton').hidden = true;
    const viewerSpace = await session.requestReferenceSpace('viewer');
    viewerReferenceSpace = await session.requestReferenceSpace('local');
    hitTestSource = await session.requestHitTestSource({space:viewerSpace});
    session.addEventListener('select', () => {
      if (isPlaced || !latestHit) return;
      const m = new THREE.Matrix4().fromArray(latestHit);
      m.decompose(placementRoot.position, placementRoot.quaternion, new THREE.Vector3());
      placementRoot.visible = true;
      isPlaced = true;
      arReticle.visible = false;
      $('arHint').textContent = 'MODEL PLACED · Explore the layers below';
      $('placeAgainButton').hidden = false;
    });
    await renderer.xr.setSession(session);
    toast('Move the phone slowly. Tap when the green ring appears.', 4200);
  } catch (error) {
    console.error('WebXR failed:', error);
    toast(`AR could not start: ${error.message || 'unsupported browser or device'}`, 5200);
    if (activeSession) { try { await activeSession.end(); } catch {} }
    endWebXR();
  } finally {
    pendingAR = false;
    btn.disabled = false;
    btn.innerHTML = 'VIEW IN AR <span>↗</span>';
  }
}
function endWebXR() {
  activeSession = null;
  hitTestSource = null;
  viewerReferenceSpace = null;
  latestHit = null;
  isPlaced = false;
  placementRoot.visible = true;
  ground.visible = true;
  scene.background = new THREE.Color(0x17201b);
  scene.fog = new THREE.Fog(0x17201b, 7, 20);
  renderer.setClearColor(0x17201b, 1);
  document.body.classList.remove('in-ar');
  $('arHint').hidden = true;
  $('placeAgainButton').hidden = true;
  arReticle.visible = false;
  $('webXRButton').innerHTML = 'VIEW IN AR <span>↗</span>';
}
function render(now, frame) {
  if (frame && activeSession && hitTestSource && viewerReferenceSpace) {
    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length && !isPlaced) {
      const pose = hits[0].getPose(viewerReferenceSpace);
      if (pose) {
        latestHit = Array.from(pose.transform.matrix);
        arReticle.matrix.fromArray(latestHit);
        arReticle.matrixWorldNeedsUpdate = true;
        arReticle.visible = true;
      }
    } else if (!isPlaced) {
      latestHit = null;
      arReticle.visible = false;
    }
  }
  if (tween && roofNode) {
    const f = Math.min(1, (now - tween.start) / tween.duration);
    const e = f*f*(3-2*f);
    roofNode.position.y = tween.from + (tween.to - tween.from) * e;
    if (f >= 1) tween = null;
  }
  orbit.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(render);
function resize() {
  const width = viewport.clientWidth || window.innerWidth;
  const height = viewport.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(viewport);
window.addEventListener('orientationchange', resize, {passive:true});

$('interiorBtn').addEventListener('click', () => setInterior(currentState === 'interior' ? 'exterior' : 'interior'));
$('lightBtn').addEventListener('click', () => panelToggle('lightPanel','lightBtn'));
$('finishBtn').addEventListener('click', () => panelToggle('finishPanel','finishBtn'));
$('sunTime').addEventListener('input', e => setSunlight(e.target.value));
$('customColor').addEventListener('input', e => setModelColor(e.target.value));
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => setModelColor(button.dataset.color)));
$('resetBtn').addEventListener('click', () => {
  setInterior('exterior'); setModelColor('#f4f1e9'); setSunlight(10);
  $('lightPanel').hidden = true; $('finishPanel').hidden = true;
  $('lightBtn').classList.remove('active'); $('finishBtn').classList.remove('active');
  $('lightBtn').setAttribute('aria-expanded','false'); $('finishBtn').setAttribute('aria-expanded','false');
  orbit.enabled = true; camera.position.copy(defaultCameraPosition); orbit.target.copy(defaultTarget); orbit.update();
  toast('View reset.');
});
$('webXRButton').addEventListener('click', startWebXR);
$('placeAgainButton').addEventListener('click', () => {
  if (!activeSession) return;
  isPlaced = false; placementRoot.visible = false; latestHit = null; arReticle.visible = false;
  $('arHint').textContent = 'Move the phone slowly to find a surface, then tap to place.';
  $('placeAgainButton').hidden = true;
});
$('closeModal').addEventListener('click', () => $('compatModal').hidden = true);
$('compatModal').addEventListener('click', e => { if (e.target === $('compatModal')) $('compatModal').hidden = true; });

setupARChoices();
setSunlight(10);
resize();
try {
  await loadModel();
  setInterior('exterior');
} catch (error) {
  console.error(error);
  loadingTitle.textContent = 'The model did not load';
  loadingMessage.textContent = 'Check that house-model.fbx is beside index.html and the site is hosted over HTTPS.';
  progressBar.style.background = '#d79f8a';
}
