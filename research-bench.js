import * as THREE from './vendor/three/three.module.js';

// Tools lie on the same work surface as the rotor. They never rotate with it.
export function createResearchBench(colors) {
  const group = new THREE.Group(); group.name = 'research-and-clinic-bench';
  const materials = [];
  const material = (color, options = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .57, metalness: .03, ...options });
    materials.push(mat); return mat;
  };
  const white = material('#edf0e9'), sage = material(colors.accent), metal = material('#9aa9a5', { metalness: .8, roughness: .24 });
  const dark = material('#283f36', { roughness: .88 }), blue = material('#83afbc'), yellow = material('#d4be77');
  const clear = material('#c9e1dc', { transparent: true, opacity: .45, depthWrite: false, metalness: 0 });
  const mount = (parent, geometry, mat, x = 0, y = 0, z = 0, name = '') => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.name = name; parent.add(mesh); return mesh;
  };
  const box = (parent, w, h, depth, mat, x, y, z, name) => mount(parent, new THREE.BoxGeometry(w, h, depth), mat, x, y, z, name);
  const roundedShape = (w, h, radius = .1) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + radius, -h / 2); shape.lineTo(w / 2 - radius, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius); shape.lineTo(w / 2, h / 2 - radius);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2); shape.lineTo(-w / 2 + radius, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius); shape.lineTo(-w / 2, -h / 2 + radius);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
    return shape;
  };
  const roundBox = (parent, w, h, depth, mat, x, y, z, radius = .1) => {
    const geometry = new THREE.ExtrudeGeometry(roundedShape(w, h, radius), { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 2, curveSegments: 8 });
    return mount(parent, geometry, mat, x, y, z);
  };
  const disc = (parent, radius, depth, mat, x, y, z, name = '') => {
    const mesh = mount(parent, new THREE.CylinderGeometry(radius, radius, depth, 40), mat, x, y, z, name);
    mesh.rotation.x = Math.PI / 2; return mesh;
  };
  const tube = (parent, points, radius, mat, name) => mount(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 64, radius, 10, false), mat, 0, 0, 0, name);
  function station(name) {
    const frame = new THREE.Group(); frame.name = name;
    frame.rotation.x = -Math.PI / 2; frame.position.y = -2.29; group.add(frame); return frame;
  }
  const lab = station('laboratory-tools');
  const clinic = station('clinical-instruments');

  // Three adjustable micropipettes: plunger, finger rest, body, display, shaft, tip.
  [-.85, 0, .85].forEach((x, index) => {
    const pipette = new THREE.Group(); pipette.name = 'micropipette';
    pipette.position.set(x, 1 + (index === 1 ? .14 : 0), .18); pipette.rotation.z = (index - 1) * -.09; lab.add(pipette);
    mount(pipette, new THREE.CapsuleGeometry(.16, 1.15, 6, 16), white, 0, .65, 0);
    box(pipette, .48, .12, .22, white, .06, 1.28, 0);
    mount(pipette, new THREE.CylinderGeometry(.055, .055, .4, 16), metal, 0, 1.55, 0);
    mount(pipette, new THREE.CylinderGeometry(.21, .21, .13, 24), [blue, sage, yellow][index], 0, 1.79, 0);
    box(pipette, .185, .43, .025, dark, 0, .68, .165, 'pipette-display');
    for (let line = 0; line < 3; line++) box(pipette, .105, .024, .01, white, 0, .79 - line * .1, .183);
    mount(pipette, new THREE.CylinderGeometry(.075, .035, 1.04, 20), white, 0, -.58, 0);
    mount(pipette, new THREE.CylinderGeometry(.041, .006, .48, 20), [blue, sage, yellow][index], 0, -1.34, 0);
  });
  // A transparent six-well culture plate, with six actual openings and media.
  const plate = new THREE.Group(); plate.name = 'six-well-plate'; plate.position.set(0, -1.85, 0); lab.add(plate);
  const deck = roundedShape(2.65, 1.8, .12);
  const medium = material('#d8a7a3', { transparent: true, opacity: .8, metalness: 0, depthWrite: false });
  const wellRim = material('#b9cfc8', { transparent: true, opacity: .8, metalness: .08, depthWrite: false });
  for (const y of [-.42, .42]) for (const x of [-.82, 0, .82]) {
    const hole = new THREE.Path(); hole.absarc(x, y, .335, 0, Math.PI * 2, true); deck.holes.push(hole);
    disc(plate, .315, .025, medium, x, y, .1, 'culture-well');
    mount(plate, new THREE.TorusGeometry(.335, .02, 10, 40), wellRim, x, y, .19);
  }
  roundBox(plate, 2.65, 1.8, .035, clear, 0, 0, .015, .12);
  mount(plate, new THREE.ExtrudeGeometry(deck, { depth: .14, bevelEnabled: false, curveSegments: 40 }), clear, 0, 0, .045, 'plate-frame');

  // Agar and raised cream colonies make this visibly a growing bacterial culture.
  const culture = new THREE.Group(); culture.name = 'bacterial-culture-plate'; culture.position.set(0, -3.52, .02); lab.add(culture);
  disc(culture, .64, .045, clear, 0, 0, .02, 'culture-dish-base');
  disc(culture, .58, .025, material('#d6b46d', { metalness: 0, roughness: .85 }), 0, 0, .065, 'agar');
  const wall = mount(culture, new THREE.CylinderGeometry(.62, .62, .14, 48, 1, true), clear, 0, 0, .07, 'culture-dish-wall'); wall.rotation.x = Math.PI / 2;
  mount(culture, new THREE.TorusGeometry(.62, .025, 10, 48), wellRim, 0, 0, .15);
  const colonies = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), material('#f0dfb0', { roughness: .86, metalness: 0 }), 64);
  colonies.name = 'bacterial-colonies';
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  for (let index = 0; index < colonies.count; index++) {
    const radius = .51 * Math.sqrt((index + .5) / colonies.count), angle = index * 2.39996323;
    const size = .017 + .022 * (.5 + .5 * Math.sin(index * 8.71)) ** 2;
    matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, .084), rotation, new THREE.Vector3(size, size, .007 + size * .25));
    colonies.setMatrixAt(index, matrix);
  }
  culture.add(colonies);

  // Neurological examination kit: ring-headed hammer, tuning fork, light, filament.
  const hammer = new THREE.Group(); hammer.name = 'neurology-reflex-hammer'; hammer.position.set(-.86, .45, .14); hammer.rotation.z = -.09; clinic.add(hammer);
  mount(hammer, new THREE.CylinderGeometry(.034, .045, 2.6, 20), metal, 0, .12, 0);
  mount(hammer, new THREE.CapsuleGeometry(.085, .77, 6, 16), dark, 0, -1.41, 0);
  disc(hammer, .38, .17, dark, 0, 1.66, .015, 'rubber-hammer-head');
  disc(hammer, .23, .175, metal, 0, 1.66, .015);
  disc(hammer, .07, .18, sage, 0, 1.66, .015);

  const fork = new THREE.Group(); fork.name = 'neurology-tuning-fork'; fork.position.set(.82, .82, .12); fork.rotation.z = .08; clinic.add(fork);
  for (const x of [-.24, .24]) {
    box(fork, .11, 1.65, .12, metal, x, 1.18, 0, 'tuning-fork-prong');
    roundBox(fork, .23, .27, .17, metal, x, 1.91, -.08, .035);
  }
  tube(fork, [[-.24, .42, 0], [-.23, .16, 0], [0, .015, 0], [.23, .16, 0], [.24, .42, 0]], .055, metal, 'tuning-fork-bow');
  mount(fork, new THREE.CylinderGeometry(.055, .055, .78, 20), metal, 0, -.39, 0);
  mount(fork, new THREE.CapsuleGeometry(.07, .1, 4, 16), metal, 0, -.78, 0);

  const pen = new THREE.Group(); pen.name = 'neurological-penlight'; pen.position.set(.88, -2.3, .1); pen.rotation.z = -.18; clinic.add(pen);
  mount(pen, new THREE.CylinderGeometry(.085, .085, 1.45, 24), metal);
  mount(pen, new THREE.CylinderGeometry(.092, .092, .2, 24), dark, 0, .72, 0);
  box(pen, .025, .5, .04, dark, .07, .34, .06);

  const filament = new THREE.Group(); filament.name = 'sensory-monofilament'; filament.position.set(-.75, -2.85, .1); filament.rotation.z = .2; clinic.add(filament);
  mount(filament, new THREE.CapsuleGeometry(.095, .72, 6, 16), yellow);
  tube(filament, [[0, .45, 0], [0, .76, 0], [.08, 1.02, 0], [.29, 1.15, 0]], .015, dark, 'sensory-filament');

  // Soft contact shading anchors the tools without a separate image asset.
  for (const frame of [lab, clinic]) {
    for (let layer = 0; layer < 5; layer++) {
      const shade = material('#24382a', { transparent: true, opacity: .012, depthWrite: false, metalness: 0 });
      const shadow = mount(frame, new THREE.CircleGeometry(1, 40), shade, 0, -.4, -.02 - layer * .001);
      shadow.scale.set(1.4 + layer * .07, 3.12 + layer * .07, 1);
    }
  }
  function update(aspect) {
    const compact = aspect < 1.1;
    lab.position.x = compact ? -3.9 : -6.05; clinic.position.x = compact ? 3.9 : 6.05;
    lab.position.z = compact ? -4.7 : 0; clinic.position.z = compact ? 4.7 : 0;
    lab.scale.setScalar(compact ? .65 : 1); clinic.scale.setScalar(compact ? .65 : 1);
  }
  function dispose() {
    group.traverse(object => object.geometry?.dispose());
    materials.forEach(mat => mat.dispose());
  }
  update(1.8);
  return { group, lab, clinic, update, dispose };
}
