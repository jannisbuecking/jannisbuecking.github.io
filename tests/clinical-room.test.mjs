import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, READING_STOPS } from '../previews/clinical-room-model.js';

test('Clinic uses one clipboard that fits the desk, with bound pages that turn in both directions', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    const board = room.clipboard.object, phone = room.phone.group;
    assert.equal(room.pages.length, 3);
    assert.ok(room.readings.every(reading => reading.object === board));
    const desk = new THREE.Box3().setFromObject(room.group.getObjectByName('worktop'));
    const bounds = new THREE.Box3().setFromObject(board);
    assert.ok(bounds.min.x > desk.min.x && bounds.max.x < desk.max.x && bounds.min.z > desk.min.z && bounds.max.z < desk.max.z);
    assert.ok(Math.abs(bounds.min.y - desk.max.y) < 1e-5, 'the clipboard rests on the tabletop');
    assert.ok(room.entrance.object.getWorldPosition(new THREE.Vector3()).x < board.position.x && board.position.x < phone.position.x, 'computer, clipboard, phone are ordered left to right');
    const anchors = room.pages.map(page => page.paper.localToWorld(new THREE.Vector3(0, .67, 0)));
    const fixed = board.matrix.clone();
    for (const progress of [0, .56, .675, .74, .855, .92, .855, .74, .675, .56, 0]) {
      room.update(progress * .78); room.group.updateMatrixWorld(true);
      assert.ok(board.matrix.equals(fixed));
      room.pages.forEach((page, index) => assert.ok(page.paper.localToWorld(new THREE.Vector3(0, .67, 0)).distanceTo(anchors[index]) < 1e-6, 'the turning sheet stays attached to the clip'));
    }
    READING_STOPS.forEach((progress, index) => {
      room.update(progress * .78);
      assert.equal(room.clipboard.activePage, index);
      assert.equal(room.pages.findIndex(page => page.hinge.visible), index);
    });
    room.update(READING_STOPS[0] * .78); assert.equal(room.clipboard.activePage, 0);
    assert.ok(room.pages[0].hinge.visible);
  } finally { room.dispose(); }
});

for (const variant of ['laboratory', 'consultation']) {
  test(`${variant}: optical entry and clinical pages are unobstructed and fit desktop/mobile cameras`, () => {
    const room = createClinicalRoom(variant);
    try {
      assert.equal(room.readings.length, 3);
      const camera = new THREE.PerspectiveCamera(42, 1, .003, 180), ray = new THREE.Raycaster();
      function setCamera(progress, aspect) {
        const view = room.pose(progress, aspect);
        camera.aspect = aspect; camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target);
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); room.update(progress); room.group.updateMatrixWorld(true);
        return view;
      }
      for (const aspect of [1.44, 390 / 844]) {
        const source = setCamera(0, aspect);
        ray.set(source.position, source.target.clone().sub(source.position).normalize());
        assert.equal(ray.intersectObject(room.group, true)[0].object, room.entrance.object, 'the first view reaches the actual optical/screen image');
        READING_STOPS.forEach((progress, index) => {
          const view = setCamera(progress, aspect), item = room.readings[index];
          const paperCenter = item.paper.getWorldPosition(new THREE.Vector3());
          ray.set(view.position, paperCenter.clone().sub(view.position).normalize());
          assert.equal(ray.intersectObject(room.group, true)[0].object, item.paper, 'the record stays readable on the clipboard');
          for (const x of [-item.width / 2, item.width / 2]) for (const y of [-item.height / 2, item.height / 2]) {
            const point = item.object.localToWorld(new THREE.Vector3(x, y, .07)).project(camera);
            assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1, 'the whole record fits inside the viewport');
          }
        });
      }
    } finally { room.dispose(); }
  });
  test(`${variant}: scrolling and reversing move the camera and clipboard pages, never the furniture or clipboard`, () => {
    const room = createClinicalRoom(variant);
    try {
      const original = room.readings.map(item => item.object.matrix.clone());
      const entrance = room.entrance.object.matrixWorld.clone();
      for (const progress of [0, .34, .56, .74, .92, .74, .56, .34, 0]) {
        room.update(progress); room.group.updateMatrixWorld(true);
        room.readings.forEach((item, index) => assert.ok(item.object.matrix.equals(original[index])));
        assert.ok(room.entrance.object.matrixWorld.equals(entrance));
        const view = room.pose(progress, 1.44);
        assert.ok(view.position.distanceTo(view.target) > .01);
        assert.ok(Math.abs(view.up.length() - 1) < 1e-9);
      }
      room.pages.forEach(page => assert.ok(Math.abs(page.hinge.rotation.x) < 1e-12));
    } finally { room.dispose(); }
  });
}

test('integrated monitor matches the exact outgoing viewport with its image contained on the screen', () => {
  const room = createClinicalRoom('consultation', undefined, { matchEntrance: true });
  try {
    for (const aspect of [1.104, 342 / 844, 1.8]) {
      const view = room.pose(0, aspect), camera = new THREE.PerspectiveCamera(42, aspect, .01, 180);
      camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
      const w = Math.min(room.entrance.width, room.entrance.height * aspect), h = w / aspect;
      for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) {
        const point = room.entrance.object.localToWorld(new THREE.Vector3(x, y, 0)).project(camera);
        assert.ok(Math.abs(Math.abs(point.x) - 1) < 1e-9 && Math.abs(Math.abs(point.y) - 1) < 1e-9, 'the captured RNA image fills the viewport without shifting or stretching');
      }
    }
  } finally { room.dispose(); }
});
