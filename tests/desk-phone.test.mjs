import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, READING_STOPS, CLINICAL_FRACTION, PHONE_STOP } from '../previews/clinical-room-model.js';
import { phoneTransform } from '../phone-geometry.js';

test('the iPhone rests inside the existing desk and stays fixed while folders close', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    const desk = new THREE.Box3().setFromObject(room.group.getObjectByName('worktop'));
    const bounds = new THREE.Box3().setFromObject(room.phone.group);
    assert.ok(bounds.min.x >= desk.min.x && bounds.max.x <= desk.max.x);
    assert.ok(bounds.min.z >= desk.min.z && bounds.max.z <= desk.max.z);
    assert.ok(Math.abs(bounds.min.y - desk.max.y) < .001, 'the phone rests on the tabletop');
    const fixed = room.phone.object.matrixWorld.clone();
    for (const progress of [0, .5, .8, PHONE_STOP, .8, 0]) {
      room.update(progress); room.group.updateMatrixWorld(true);
      assert.ok(room.phone.object.matrixWorld.equals(fixed));
    }
    room.update(PHONE_STOP);
    assert.ok(room.folders.every(cover => Math.abs(cover.rotation.y) < 1e-9));
  } finally { room.dispose(); }
});

test('the new phone chapter preserves the approved clinical camera path', () => {
  const previous = createClinicalRoom('consultation', undefined, { matchEntrance: true });
  const room = createClinicalRoom('consultation', undefined, { matchEntrance: true, includePhone: true });
  try {
    for (const progress of [0, .035, .36, ...READING_STOPS, 1]) {
      const a = previous.pose(progress, 1.104), b = room.pose(progress * CLINICAL_FRACTION, 1.104);
      assert.ok(a.position.distanceTo(b.position) < 1e-9 && a.target.distanceTo(b.target) < 1e-9 && a.up.distanceTo(b.up) < 1e-9);
    }
  } finally { previous.dispose(); room.dispose(); }
});

test('the phone is unobstructed and its real HTML screen matches the projected glass on desktop and mobile', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    room.update(PHONE_STOP); room.group.updateMatrixWorld(true);
    const phone = room.phone, ray = new THREE.Raycaster();
    for (const aspect of [1.104, 342 / 844]) {
      const view = room.pose(PHONE_STOP, aspect), camera = new THREE.PerspectiveCamera(42, aspect, .01, 180);
      camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
      const project = (x,y) => phone.object.localToWorld(new THREE.Vector3(x * phone.width, y * phone.height, 0)).project(camera);
      for (const [x,y] of [[0,0],[-.34,.34],[.34,.34],[.34,-.34],[-.34,-.34]]) {
        const point = phone.object.localToWorld(new THREE.Vector3(x * phone.width, y * phone.height, 0));
        ray.set(view.position, point.sub(view.position).normalize());
        assert.equal(ray.intersectObject(room.group, true)[0].object, phone.object, 'no folder or lamp covers the screen');
      }
      const size = { w: aspect * 844, h: 844 };
      const quad = [[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].map(([x,y]) => {
        const p = project(x,y); assert.ok(Math.abs(p.x) < .92 && Math.abs(p.y) < .92);
        return { x: (p.x + 1) * size.w / 2, y: (1 - p.y) * size.h / 2 };
      });
      const matrix = phoneTransform(quad, 360, 780);
      for (const [x,y] of [[0,0],[360,0],[360,780],[0,780],[180,390]]) {
        const divisor = matrix[3] * x + matrix[7] * y + 1;
        const actual = { x: (matrix[0]*x + matrix[4]*y + matrix[12]) / divisor, y: (matrix[1]*x + matrix[5]*y + matrix[13]) / divisor };
        const p = project(x / 360 - .5, .5 - y / 780);
        assert.ok(Math.hypot(actual.x - (p.x+1)*size.w/2, actual.y - (1-p.y)*size.h/2) < 1e-7, 'click targets stay aligned with the glass');
      }
    }
  } finally { room.dispose(); }
});

test('the screen projection rejects an edge-on or collapsed surface', () => {
  assert.equal(phoneTransform([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}],360,780),null);
});
