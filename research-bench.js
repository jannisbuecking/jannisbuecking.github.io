import * as THREE from './vendor/three/three.module.js';

// Tools lie on the same work surface as the rotor. They never rotate with it.
export function createResearchBench(colors) {
  const group = new THREE.Group(); group.name = 'research-and-clinic-bench';
  const materials = [];
  const material = (color, options = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .57, metalness: .03, transparent: true, ...options });
    materials.push({ mat, opacity: mat.opacity }); return mat;
  };
  const white = material('#edf0e9'), sage = material(colors.accent), metal = material('#9aa9a5', { metalness: .8, roughness: .24 });
  const dark = material('#283f36', { roughness: .88 }), blue = material('#83afbc'), yellow = material('#d4be77');
  const clear = material('#c9e1dc', { opacity: .32, depthWrite: false, metalness: 0 });
  const mount = (parent, geometry, mat, x = 0, y = 0, z = 0, name = '') => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.name = name; parent.add(mesh); return mesh;
  };
  const box = (parent, w, h, depth, mat, x, y, z, name) => mount(parent, new THREE.BoxGeometry(w, h, depth), mat, x, y, z, name);
  const roundBox = (parent, w, h, depth, mat, x, y, z, radius = .1) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + radius, -h / 2); shape.lineTo(w / 2 - radius, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius); shape.lineTo(w / 2, h / 2 - radius);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2); shape.lineTo(-w / 2 + radius, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius); shape.lineTo(-w / 2, -h / 2 + radius);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 2, curveSegments: 8 });
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
    pipette.position.set(x, .7 + (index === 1 ? .14 : 0), .18); pipette.rotation.z = (index - 1) * -.09; lab.add(pipette);
    mount(pipette, new THREE.CapsuleGeometry(.16, 1.15, 6, 16), white, 0, .65, 0);
    box(pipette, .48, .12, .22, white, .06, 1.28, 0);
    mount(pipette, new THREE.CylinderGeometry(.055, .055, .4, 16), metal, 0, 1.55, 0);
    mount(pipette, new THREE.CylinderGeometry(.21, .21, .13, 24), [blue, sage, yellow][index], 0, 1.79, 0);
    box(pipette, .185, .43, .025, dark, 0, .68, .165, 'pipette-display');
    for (let line = 0; line < 3; line++) box(pipette, .105, .024, .01, white, 0, .79 - line * .1, .183);
    mount(pipette, new THREE.CylinderGeometry(.075, .035, 1.04, 20), white, 0, -.58, 0);
    mount(pipette, new THREE.CylinderGeometry(.041, .006, .48, 20), [blue, sage, yellow][index], 0, -1.34, 0);
  });
  roundBox(lab, 2.65, 1.45, .18, blue, 0, -2.15, 0, .12).name = 'pipette-tip-rack';
  roundBox(lab, 2.47, 1.27, .035, white, 0, -2.15, .2, .07);
  const tipGeometry = new THREE.CylinderGeometry(.046, .027, .14, 10); tipGeometry.rotateX(Math.PI / 2);
  const tips = new THREE.InstancedMesh(tipGeometry, yellow, 96); tips.name = 'ninety-six-pipette-tips';
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 96; index++) {
    matrix.makeTranslation((index % 12 - 5.5) * .19, -2.15 + (Math.floor(index / 12) - 3.5) * .15, .27);
    tips.setMatrixAt(index, matrix);
  }
  lab.add(tips);
  disc(lab, .39, .07, clear, -.86, -3.3, .055, 'petri-dish');
  const dishRim = mount(lab, new THREE.TorusGeometry(.375, .025, 8, 40), clear, -.86, -3.3, .1);
  dishRim.rotation.z = .2;
  disc(lab, .23, .18, white, .76, -3.28, .1, 'reagent-bottle');
  disc(lab, .19, .07, sage, .76, -3.28, .24);

  // Binaural metal ear tubes join the flexible Y tubing and a single looped hose.
  for (const side of [-1, 1]) {
    tube(clinic, [[0, .3, .16], [side * .4, .67, .16], [side * .64, 1.25, .16], [side * .66, 1.63, .16]], .074, dark, 'stethoscope-y-tube');
    tube(clinic, [[side * .66, 1.6, .16], [side * .64, 1.98, .16], [side * .49, 2.29, .16], [side * .29, 2.4, .16]], .045, metal, 'stethoscope-ear-tube');
    const ear = mount(clinic, new THREE.CapsuleGeometry(.085, .12, 4, 12), dark, side * .24, 2.4, .16, 'stethoscope-ear-tip'); ear.rotation.z = Math.PI / 2;
  }
  tube(clinic, [[0, .3, .16], [-.16, -.25, .14], [-.84, -.93, .12], [-1.02, -1.86, .12], [-.6, -2.64, .12], [.4, -2.76, .12], [1.1, -2.12, .12], [.98, -1.3, .12], [.4, -.98, .12], [.12, -1.48, .15]], .075, dark, 'stethoscope-hose');
  disc(clinic, .36, .12, metal, .12, -1.57, .19, 'stethoscope-chestpiece');
  disc(clinic, .285, .025, white, .12, -1.57, .265);
  disc(clinic, .07, .028, sage, .12, -1.57, .28);
  const hammer = new THREE.Group(); hammer.name = 'reflex-hammer'; hammer.position.set(1.38, .45, .1); hammer.rotation.z = -.18; clinic.add(hammer);
  mount(hammer, new THREE.CylinderGeometry(.037, .055, 1.85, 20), metal);
  const hammerShape = new THREE.Shape(); hammerShape.moveTo(-.29, .94); hammerShape.lineTo(.29, .94); hammerShape.lineTo(.05, 1.4); hammerShape.quadraticCurveTo(0, 1.47, -.05, 1.4); hammerShape.closePath();
  mount(hammer, new THREE.ExtrudeGeometry(hammerShape, { depth: .12, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2 }), material('#a78168'));
  const pen = new THREE.Group(); pen.name = 'clinical-penlight'; pen.position.set(-1.22, .66, .1); pen.rotation.z = .18; clinic.add(pen);
  mount(pen, new THREE.CylinderGeometry(.085, .085, 1.45, 24), metal);
  mount(pen, new THREE.CylinderGeometry(.092, .092, .2, 24), dark, 0, .72, 0);
  box(pen, .025, .5, .04, dark, .07, .34, .06);

  // Soft contact shading anchors the tools without a separate image asset.
  for (const frame of [lab, clinic]) {
    for (let layer = 0; layer < 5; layer++) {
      const shade = material('#24382a', { opacity: .012, depthWrite: false, metalness: 0 });
      const shadow = mount(frame, new THREE.CircleGeometry(1, 40), shade, 0, -.4, -.02 - layer * .001);
      shadow.scale.set(1.4 + layer * .07, 3.12 + layer * .07, 1);
    }
  }
  function update(amount, aspect) {
    group.visible = amount > .001;
    const compact = aspect < 1.1;
    lab.position.x = compact ? -3.9 : -6.05; clinic.position.x = compact ? 3.9 : 6.05;
    lab.position.z = compact ? -4.7 : 0; clinic.position.z = compact ? 4.7 : 0;
    lab.scale.setScalar(compact ? .65 : 1); clinic.scale.setScalar(compact ? .65 : 1);
    for (const { mat, opacity } of materials) mat.opacity = opacity * amount;
  }
  function dispose() {
    group.traverse(object => object.geometry?.dispose());
    materials.forEach(({ mat }) => mat.dispose());
  }
  update(1, 1.8);
  return { group, lab, clinic, update, dispose };
}
