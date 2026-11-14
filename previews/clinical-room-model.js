import * as THREE from '../vendor/three/three.module.js';
import { experiences } from './clinical-data.js';

export const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export const READING_STOPS = [.56, .74, .92];
export const CLINICAL_FRACTION = .78;
export const PHONE_STOP = .96;

// A top-bound sheet lifts, curls over the clip, then settles over the desk edge.
// Coordinates are in the sheet's unrotated frame, with its top edge at y=.67.
export function clipboardPagePose(turn, along, across = 0, index = 0) {
  const lift = smooth(turn / .74), settle = smooth((turn - .74) / .26);
  const length = along * 1.34, edge = .425, drop = .105 - index * .007;
  const run = Math.hypot(edge, drop), radius = .06, slope = Math.atan2(drop, edge) * settle;
  let y = Math.min(length, run) * Math.cos(slope), z = -Math.min(length, run) * Math.sin(slope);
  if (length > run) {
    const arc = Math.min((length - run) / radius, (Math.PI / 2 - slope) * settle);
    const tail = Math.max(0, length - run - radius * arc);
    y += radius * (Math.sin(slope + arc) - Math.sin(slope)) + tail * Math.cos(slope + arc);
    z += radius * (Math.cos(slope + arc) - Math.cos(slope)) - tail * Math.sin(slope + arc);
  }
  const curl = Math.sin(Math.PI * lift) * (.17 * Math.sin(Math.PI * along) + .035 * across * along ** 2);
  return { angle: -Math.PI * lift, y: .67 - y, z: curl - z };
}

export function createClinicalRoom(variant, textureFactory = () => null, options = {}) {
  const group = new THREE.Group();
  const materials = [], textures = [], pages = [], readings = [];
  const mat = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .03, ...options });
    materials.push(material); return material;
  };
  const c = { wall: mat('#e4e9df'), trim: mat('#b6c3b3'), white: mat('#fdfcf8'), floor: mat('#d8d9cd'), wood: mat('#b69770'), sage: mat('#789c84'), green: mat('#28694b'), dark: mat('#303f37'), metal: mat('#97a7a2', { metalness: .7, roughness: .35 }), glass: mat('#c3ddda', { transparent: true, opacity: .62, roughness: .2 }), blue: mat('#82999e') };
  function mesh(parent, geometry, material, position = [0, 0, 0], name = '') {
    const item = new THREE.Mesh(geometry, material); item.position.set(...position); item.name = name;
    item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  const box = (parent, w, h, d, material, x, y, z, name) => mesh(parent, new THREE.BoxGeometry(w, h, d), material, [x, y, z], name);
  const cylinder = (parent, top, bottom, h, material, x, y, z) => mesh(parent, new THREE.CylinderGeometry(top, bottom, h, 40), material, [x, y, z]);
  function roundShape(w, h, radius = .08) {
    const shape = new THREE.Shape(), x = -w / 2, y = -h / 2, r = Math.min(radius, w / 2, h / 2);
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }
  function rounded(w, h, depth, radius = .08) {
    const shape = roundShape(w, h, radius);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2, steps: 1, curveSegments: 12 });
    geometry.translate(0, 0, -depth / 2); return geometry;
  }
  function textured(kind, index = -1) {
    const map = textureFactory(kind, index);
    if (map) textures.push(map);
    const material = new THREE.MeshBasicMaterial({ color: map ? '#ffffff' : '#fdfcf8', map, toneMapped: false });
    materials.push(material); return material;
  }
  function plaque(parent, kind, index, w, h, x, y, z) {
    return mesh(parent, new THREE.PlaneGeometry(w, h), textured(kind, index), [x, y, z]);
  }
  function table(x, z, width, depth, height = 1.35) {
    const top = box(group, width, .13, depth, c.white, x, height, z, 'worktop');
    box(group, width, .12, depth, c.wood, x, height - .1, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, .1, height - .15, .1, c.metal, x + sx * (width / 2 - .15), height / 2 - .1, z + sz * (depth / 2 - .15));
    return top;
  }
  function stool(x, z, color = c.sage) {
    cylinder(group, .37, .37, .12, color, x, .81, z); cylinder(group, .055, .055, .65, c.metal, x, .44, z);
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 2 / 5;
      const leg = box(group, .07, .07, .54, c.metal, x + Math.sin(angle) * .21, .13, z + Math.cos(angle) * .21); leg.rotation.y = angle;
      cylinder(group, .065, .065, .09, c.dark, x + Math.sin(angle) * .42, .07, z + Math.cos(angle) * .42);
    }
  }
  // Open front and right walls make a complete room readable in one cutaway.
  box(group, 12.2, .23, 8.4, c.white, 0, -.17, 0, 'room-plinth');
  box(group, 12, .08, 8.2, c.floor, 0, -.015, 0, 'room-floor');
  box(group, 12, 4.1, .16, c.wall, 0, 2.05, -4, 'back-wall');
  box(group, .16, 4.1, 8.2, c.wall, -6, 2.05, 0, 'left-wall');
  box(group, 12, .18, .08, c.trim, 0, .12, -3.88);
  box(group, .08, .18, 8, c.trim, -5.88, .12, 0);
  for (let x = -6; x <= 6; x += 1.5) box(group, .012, .003, 8.1, c.white, x, .03, 0);
  for (let z = -4; z <= 4; z += 1.5) box(group, 12, .003, .012, c.white, 0, .03, z);
  // Frosted daylight window, wall rail, sockets, and a flush entry door.
  box(group, 4.6, 1.75, .12, c.white, -2.8, 2.9, -3.85);
  box(group, 4.35, 1.5, .08, c.glass, -2.8, 2.9, -3.76);
  for (const x of [-3.9, -2.8, -1.7]) box(group, .045, 1.5, .09, c.white, x, 2.9, -3.7);
  box(group, 1.5, 2.8, .12, c.trim, 4.95, 1.45, -3.8);
  box(group, 1.32, 2.6, .08, c.white, 4.95, 1.45, -3.71);
  box(group, .17, .06, .1, c.metal, 4.48, 1.45, -3.62);
  box(group, 9, .055, .1, c.trim, -.8, 1.96, -3.78);
  for (const x of [-4.5, -.7, 2.8]) box(group, .18, .22, .07, c.white, x, 2.2, -3.75);
  plaque(group, variant === 'laboratory' ? 'lab-sign' : 'consultation-sign', -1, 2.9, .55, 1.6, 3.45, -3.85);
  // A wall clock and an indirect ceiling light establish the room's scale.
  const clock = cylinder(group, .32, .32, .08, c.white, -5.85, 3.1, 1.6); clock.rotation.z = Math.PI / 2;
  const light = box(group, 5, .08, .45, mat('#fffef4', { emissive: '#fff7d4', emissiveIntensity: .55 }), 0, 4.05, -1.4);
  box(group, .025, .5, .025, c.metal, -2, 4.33, -1.4); box(group, .025, .5, .025, c.metal, 2, 4.33, -1.4);

  let entrance, phone, clipboard;
  if (variant === 'laboratory') {
    table(-.5, -2.45, 9.9, 2.3, 1.4);
    for (const x of [-4.5, -.7, 3.1]) {
      box(group, 1.2, 1.12, 1.4, c.sage, x, .61, -2.7);
      for (const y of [.42, .82, 1.14]) { box(group, 1.13, .025, .02, c.trim, x, y, -1.98); box(group, .35, .035, .05, c.metal, x, y - .12, -1.93); }
      stool(x + .15, .45);
    }
    // A real, rigid microscope: specimen stage, objective turret, arm, body and ocular.
    const scope = new THREE.Group(); scope.position.set(-3.5, 1.49, -2.7); group.add(scope);
    mesh(scope, rounded(.9, .55, .13), c.white, [0, .05, .02]).rotation.x = -Math.PI / 2;
    const arm = box(scope, .2, 1.08, .23, c.white, .25, .63, -.22); arm.rotation.x = -.18;
    box(scope, .8, .07, .62, c.dark, 0, .53, .12, 'specimen-stage');
    const slide = box(scope, .4, .015, .15, c.glass, 0, .58, .15, 'specimen-slide');
    for (const x of [-.22, .2]) box(scope, .03, .025, .3, c.metal, x, .58, .15);
    cylinder(scope, .18, .18, .19, c.dark, 0, .93, .12);
    for (const x of [-.16, 0, .16]) cylinder(scope, .045, .035, .22, c.metal, x, .76, .14);
    const ocular = new THREE.Group(); ocular.position.set(0, 1.25, .1); ocular.rotation.x = -Math.atan2(.6, .8); scope.add(ocular);
    const barrel = cylinder(ocular, .19, .17, .52, c.white, 0, 0, -.23); barrel.rotation.x = Math.PI / 2;
    const rim = mesh(ocular, new THREE.TorusGeometry(.205, .045, 16, 64), c.dark, [0, 0, .05]);
    const glass = mesh(ocular, new THREE.CircleGeometry(.18, 64), textured('molecular'), [0, 0, .048], 'optical-field');
    const knob = cylinder(scope, .12, .12, .16, c.dark, .42, .5, -.18); knob.rotation.z = Math.PI / 2;
    entrance = { object: glass, width: .36, height: .36 };
    // The three experiences are printed on physical clipboards on the bench.
    experiences.forEach((item, index) => {
      const board = new THREE.Group(); board.position.set(-3.5 + index * 3.25, 1.72, -1.32); board.rotation.x = -Math.PI / 2 + .22; group.add(board);
      mesh(board, rounded(1.48, 1.98, .065), mat(item.color));
      const paper = plaque(board, 'experience', index, 1.32, 1.8, 0, -.025, .052);
      box(board, .45, .16, .07, c.metal, 0, .92, .08, 'clipboard-clip');
      cylinder(group, .027, .027, .4, c.metal, -3.5 + index * 3.25, 1.665, -2.1);
      readings.push({ object: board, paper, width: 1.48, height: 1.98, index });
      // Slide trays and sample racks remain behind each record.
      const tray = box(group, .85, .06, .5, c.white, -2.5 + index * 3.1, 1.51, -2.5);
      for (let n = 0; n < 4; n++) {
        const x = -2.8 + index * 3.1 + n * .18;
        cylinder(group, .045, .045, .26, c.glass, x, 1.67, -2.5);
        cylinder(group, .05, .05, .045, c.green, x, 1.82, -2.5);
      }
    });
    table(-5, 2.1, 1.5, 1.4, 1.35);
    box(group, .8, .13, .7, c.metal, -5, 1.45, 2.1);
    const tap = cylinder(group, .035, .035, .4, c.metal, -5, 1.69, 1.7);
    box(group, .04, .04, .28, c.metal, -5, 1.88, 1.82);
    box(group, .36, .35, .24, c.blue, -5.65, 1.55, 2.1);
  } else {
    table(1.5, -1.5, 6.2, 2.05, 1.3);
    stool(2.4, -2.8, c.dark); stool(.6, .7); stool(2.5, .8);
    // Examination couch and privacy screen, deliberately separate from the desk.
    box(group, 2.8, .23, 1.4, c.white, -3.7, .85, -1.9, 'examination-couch');
    const mattress = mesh(group, rounded(2.7, 1.3, .2, .12), c.sage, [-3.7, 1.04, -1.9]); mattress.rotation.x = -Math.PI / 2;
    const pillow = mesh(group, rounded(.55, 1.08, .16, .14), c.white, [-4.68, 1.2, -1.9]); pillow.rotation.x = -Math.PI / 2;
    for (const x of [-4.75, -2.65]) for (const z of [-2.4, -1.4]) box(group, .1, .75, .1, c.metal, x, .4, z);
    for (let n = 0; n < 17; n++) box(group, .14, 2.5, .1, n % 2 ? c.sage : c.trim, -5.45, 1.5, -.7 + n * .17);
    box(group, .04, 2.9, .04, c.metal, -5.45, 1.5, -.8); box(group, .04, 2.9, .04, c.metal, -5.45, 1.5, 2.15);
    box(group, .65, .06, .4, c.dark, -.35, 1.4, -2.2);
    box(group, .09, .38, .09, c.metal, -.35, 1.6, -2.2);
    mesh(group, rounded(2.02, 1.35, .12, .065), c.dark, [-.35, 2.25, -2.2]);
    const screen = plaque(group, 'molecular', -1, 1.86, 1.18, -.35, 2.25, -2.1);
    entrance = { object: screen, width: 1.86, height: 1.18 };
    box(group, 1.2, .035, .3, c.trim, -.35, 1.41, -1.3, 'keyboard');
    const board = new THREE.Group(); board.name = 'clinical-clipboard';
    board.position.set(1.45, 1.405, -1.45); board.rotation.x = -Math.PI / 2; group.add(board);
    mesh(board, rounded(1.15, 1.55, .05, .055), c.sage, [0, 0, 0], 'clipboard-body');
    box(board, .36, .12, .055, c.metal, 0, .714, .09, 'clipboard-clip');
    experiences.forEach((item, index) => {
      const hinge = new THREE.Group(); hinge.name = `clinical-page-${index + 1}`;
      hinge.position.set(0, .65, .068 - index * .004); board.add(hinge);
      const geometry = new THREE.PlaneGeometry(.99, 1.34, 8, 64);
      const paper = mesh(hinge, geometry, textured('experience', index), [0, -.67, 0], 'clinical-page-front');
      // Keep the printed text crisp while receiving the lifting sheet's shadow.
      const shadowMaterial = new THREE.ShadowMaterial({ color: '#24382a', opacity: .22, depthWrite: false }); materials.push(shadowMaterial);
      const shadow = mesh(hinge, geometry, shadowMaterial, [0, -.67, .0005], 'clinical-page-shadow'); shadow.castShadow = false; shadow.raycast = () => {};
      const backMaterial = mat('#f5f2e9', { side: THREE.BackSide, roughness: 1, metalness: 0 });
      const back = mesh(hinge, geometry, backMaterial, [0, -.67, 0], 'clinical-page-back');
      pages.push({ hinge, paper, back, geometry, turn: -1 });
      readings.push({ object: board, paper, width: 1.15, height: 1.55, index });
    });
    clipboard = { object: board, pages, width: 1.15, height: 1.55, activePage: 0 };
    // Accessories occupy the spaces between the computer, clipboard, and phone.
    cylinder(group, .11, .11, .25, c.white, 4.15, 1.51, -2.25);
    for (let n = 0; n < 3; n++) cylinder(group, .012, .012, .42, c.green, 4.10 + n * .05, 1.7, -2.25);
    cylinder(group, .19, .19, .04, c.metal, 2.65, 1.42, -2.25);
    cylinder(group, .018, .018, .65, c.metal, 2.65, 1.74, -2.25);
    const shade = cylinder(group, .15, .29, .23, c.white, 2.65, 2.08, -2.25); shade.rotation.z = -.3;
    box(group, .3, .5, .18, c.white, -5.83, 2.1, 3);
    if (options.includePhone) {
      // A smaller phone rests in the right-hand workspace, beside the clipboard.
      const device = new THREE.Group(); device.name = 'desk-iphone';
      device.position.set(3.65, 1.365 + .0475 * .68, -1.45); device.scale.setScalar(.68); device.rotation.x = -Math.PI / 2; group.add(device);
      mesh(device, rounded(.76, 1.61, .065, .13), c.dark, [0, 0, 0], 'phone-body');
      const screenMaterial = new THREE.MeshBasicMaterial({ color: '#17291f', toneMapped: false }); materials.push(screenMaterial);
      const glass = mesh(device, new THREE.ShapeGeometry(roundShape(.70, .70 * 780 / 360, .082)), screenMaterial, [0, 0, .054], 'phone-screen');
      box(device, .015, .22, .035, c.metal, .386, .22, 0, 'phone-power-button');
      for (const y of [.23, .43]) box(device, .015, .13, .035, c.metal, -.386, y, 0, 'phone-volume-button');
      box(device, .13, .012, .026, c.dark, 0, -.813, 0, 'phone-port');
      phone = { group: device, object: glass, width: .70, height: .70 * 780 / 360, bodyWidth: .76 * .68, bodyHeight: 1.61 * .68 };
    }
  }
  group.updateMatrixWorld(true);
  const worldFrame = (target, depth = .07) => {
    const position = target.object.localToWorld(new THREE.Vector3(0, 0, depth));
    const rotation = target.object.getWorldQuaternion(new THREE.Quaternion());
    return { position, normal: new THREE.Vector3(0, 0, 1).applyQuaternion(rotation), up: new THREE.Vector3(0, 1, 0).applyQuaternion(rotation) };
  };
  function clinicalPose(progress, aspect) {
    const fov = 42, tangent = Math.tan(fov * Math.PI / 360);
    const start = worldFrame(entrance, 0);
    // Begin inside the optical/screen image; all room objects remain stationary.
    const sourceDistance = options.matchEntrance ? Math.min(entrance.height / (2 * tangent), entrance.width / (2 * tangent * aspect))
      : variant === 'laboratory' ? entrance.width * .85 / (2 * tangent * Math.sqrt(1 + aspect * aspect)) : entrance.height * .78 / (2 * tangent);
    const source = { position: start.position.clone().addScaledVector(start.normal, sourceDistance), target: start.position, up: start.up };
    const target = new THREE.Vector3(0, 1.25, -.25);
    const factor = Math.max(1, 1.35 / aspect);
    const overview = { position: target.clone().add(new THREE.Vector3(11, 7.8, 13).multiplyScalar(factor * (clipboard ? .86 : 1))), target, up: new THREE.Vector3(0, 1, 0) };
    const closeups = readings.map(item => {
      const frame = worldFrame(item);
      const distance = (clipboard ? 1.18 : 1.16) * Math.max(item.height / (2 * tangent), item.width / (2 * tangent * aspect));
      const direction = clipboard ? frame.normal.clone().addScaledVector(frame.up, -.25).normalize() : frame.normal;
      return { position: frame.position.clone().addScaledVector(direction, distance), target: frame.position, up: frame.up };
    });
    const keys = [{ p: 0, view: source }, { p: .035, view: source }, { p: .34, view: overview }, { p: .4, view: overview }, { p: .56, view: closeups[0] }, { p: .61, view: closeups[0] }, { p: .74, view: closeups[1] }, { p: .79, view: closeups[1] }, { p: .92, view: closeups[2] }, { p: 1, view: closeups[2] }];
    let index = keys.findIndex(key => key.p >= progress); if (index < 1) index = 1;
    const from = keys[index - 1], to = keys[index], t = smooth((progress - from.p) / (to.p - from.p));
    return { position: from.view.position.clone().lerp(to.view.position, t), target: from.view.target.clone().lerp(to.view.target, t), up: from.view.up.clone().lerp(to.view.up, t).normalize(), fov };
  }
  function pose(progress, aspect) {
    if (!phone) return clinicalPose(progress, aspect);
    const clinical = clinicalPose(Math.min(1, progress / CLINICAL_FRACTION), aspect);
    if (progress <= CLINICAL_FRACTION) return clinical;
    const frame = worldFrame(phone, .01), tangent = Math.tan(42 * Math.PI / 360);
    const distance = 1.10 * Math.max(phone.bodyHeight / (2 * tangent), phone.bodyWidth / (2 * tangent * aspect));
    // Finish directly above the glass: an upright rectangle without perspective tilt.
    const position = frame.position.clone().addScaledVector(frame.normal, distance);
    const amount = smooth((progress - CLINICAL_FRACTION) / .16);
    return { position: clinical.position.lerp(position, amount), target: clinical.target.lerp(frame.position, amount), up: clinical.up.lerp(frame.up, amount).normalize(), fov: 42 };
  }
  function update(progress) {
    const clinical = phone ? Math.min(1, progress / CLINICAL_FRACTION) : progress;
    pages.forEach((page, index) => {
      const turn = index < 2 ? Math.max(0, Math.min(1, (clinical - (.61 + index * .18)) / .12)) : 0;
      page.hinge.rotation.x = clipboardPagePose(turn, 0).angle;
      if (turn !== page.turn) {
        const positions = page.geometry.attributes.position, uv = page.geometry.attributes.uv;
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = clipboardPagePose(turn, 1 - uv.getY(vertex), 2 * uv.getX(vertex) - 1, index);
          positions.setY(vertex, point.y);
          positions.setZ(vertex, point.z);
        }
        positions.needsUpdate = true; page.geometry.computeVertexNormals(); page.geometry.computeBoundingSphere(); page.geometry.computeBoundingBox();
        page.turn = turn;
      }
    });
    if (clipboard) clipboard.activePage = pages[1].turn >= .5 ? 2 : pages[0].turn >= .5 ? 1 : 0;
  }
  function dispose() {
    const geometries = new Set(); group.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
  }
  return { group, entrance, readings, clipboard, pages, phone, pose, update, dispose, textures };
}
