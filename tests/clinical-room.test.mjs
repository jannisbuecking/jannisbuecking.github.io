import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, clipboardPagePose, PAGE_LENGTH, BINDING_HEIGHT, BINDING_Y, READING_STOPS } from '../previews/clinical-room-model.js';

test('table aprons sit below and inside the worktops without overlapping side faces', () => {
  for (const variant of ['consultation', 'laboratory']) {
    const room = createClinicalRoom(variant);
    try {
      const tops = room.group.getObjectsByProperty('name', 'worktop');
      const aprons = room.group.getObjectsByProperty('name', 'table-apron');
      assert.equal(aprons.length, tops.length);
      tops.forEach((top, index) => {
        const surface = new THREE.Box3().setFromObject(top), apron = new THREE.Box3().setFromObject(aprons[index]);
        assert.ok(apron.max.y <= surface.min.y + 1e-9, 'the table layers do not intersect');
        assert.ok(apron.min.x > surface.min.x && apron.max.x < surface.max.x && apron.min.z > surface.min.z && apron.max.z < surface.max.z, 'the side faces cannot occupy the same planes');
      });
    } finally { room.dispose(); }
  }
});

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
      assert.ok(room.pages.every(page => page.hinge.visible && page.back.material.opacity === 1));
      assert.equal(room.pages.findIndex(page => page.turn === 0), index);
    });
    room.update(READING_STOPS[0] * .78); assert.equal(room.clipboard.activePage, 0);
    assert.ok(room.pages[0].hinge.visible);
  } finally { room.dispose(); }
});

test('sheets clear the board, stay bound, and land flat on a visible rear stack', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    const board = room.clipboard.object;
    const desk = new THREE.Box3().setFromObject(room.group.getObjectByName('worktop'));
    assert.equal(board.getObjectsByProperty('name', 'raised-binding-ring').length, 2);
    const cameraPose = room.pose(.56 * .78, 1.54);
    for (let step = 0; step <= 100; step++) {
      const turn = step / 100;
      room.update((.61 + turn * .12) * .78); room.group.updateMatrixWorld(true);
      assert.ok(room.pages.every(page => page.hinge.visible && page.back.visible && page.back.material.opacity === 1));
      const pose = room.pose((.61 + turn * .12) * .78, 1.54);
      assert.ok(pose.position.distanceTo(cameraPose.position) < 1e-9 && pose.target.distanceTo(cameraPose.target) < 1e-9, 'the reading camera stays still during the turn');
      for (const index of [0, 1, 2]) {
        const anchor = clipboardPagePose(turn, 0, 0, index);
        assert.ok(Math.abs(anchor.y - PAGE_LENGTH / 2) < 1e-9 && Math.abs(anchor.z) < 1e-9);
        for (const across of [-1, 0, 1]) for (let sample = 0; sample <= 100; sample++) {
          const along = sample / 100, point = clipboardPagePose(turn, along, across, index);
          const local = new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z);
          if (Math.abs(local.y) <= .775) assert.ok(local.z > .055, 'the sheet clears the complete clipboard surface');
          const world = board.localToWorld(local.clone());
          assert.ok(world.y > desk.max.y + .005, 'paper never enters or drapes below the tabletop');
          assert.ok(world.x > desk.min.x && world.x < desk.max.x && world.z > desk.min.z && world.z < desk.max.z, 'the full sheet stays above its landing area');
          const next = clipboardPagePose(Math.min(1, turn + 1e-6), along, across, index);
          assert.ok(Math.hypot(point.y - next.y, point.z - next.z) < .00004, 'the sheet has no motion discontinuities');
        }
      }
      for (const aspect of [1512 / 982, 390 / 844]) {
        const view = room.pose((.61 + turn * .12) * .78, aspect), camera = new THREE.PerspectiveCamera(42, aspect, .05, 180);
        camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
        for (const along of [0, .25, .5, .75, 1]) for (const across of [-1, 1]) {
          const point = clipboardPagePose(turn, along, across);
          const projected = board.localToWorld(new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z)).project(camera);
          assert.ok(Math.abs(projected.x) < .98 && Math.abs(projected.y) < .94, 'the moving sheet stays visible in desktop and phone framing');
        }
        for (const along of [.08, .2, .5, .8, .98]) for (const across of [-.7, 0, .7]) {
          const point = clipboardPagePose(turn, along, across);
          const world = board.localToWorld(new THREE.Vector3(across * .495, BINDING_Y + point.y - PAGE_LENGTH / 2, BINDING_HEIGHT + point.z));
          const ray = new THREE.Raycaster(view.position, world.clone().sub(view.position).normalize());
          const hits = ray.intersectObject(room.group, true);
          assert.ok(hits.length && [room.pages[0].paper, room.pages[0].back].includes(hits[0].object), 'room fixtures cannot obscure the turning sheet or its landing stack');
        }
      }
    }
    for (const turn of [0, .2, .5, .8, 1]) {
      let length = 0, previous = clipboardPagePose(turn, 0);
      for (let sample = 1; sample <= 1000; sample++) {
        const point = clipboardPagePose(turn, sample / 1000);
        length += Math.hypot(point.y - previous.y, point.z - previous.z); previous = point;
      }
      assert.ok(Math.abs(length - PAGE_LENGTH) < .0003, 'curling preserves the physical sheet length');
    }
    for (const index of [0, 1]) {
      const a = clipboardPagePose(1, .7, 0, index), b = clipboardPagePose(1, 1, 0, index);
      assert.ok(Math.abs(a.z - b.z) < 1e-9, 'finished sheets rest flat behind the binding');
      assert.ok(BINDING_Y + a.y - PAGE_LENGTH / 2 > .775, 'the stack is behind the clipboard');
    }
    room.update(.74 * .78); const folded = room.pages[0].geometry.attributes.position.array.slice();
    room.update(.56 * .78); room.update(.74 * .78);
    assert.deepEqual(room.pages[0].geometry.attributes.position.array, folded, 'reversing the turn restores the same geometry');
  } finally { room.dispose(); }
});

test('the Clinic overview stays fourteen percent closer while keeping the desktop items in frame', () => {
  const room = createClinicalRoom('consultation', undefined, { includePhone: true });
  try {
    for (const aspect of [1.104, 342 / 844]) {
      const view = room.pose(.36 * .78, aspect);
      const previousDistance = new THREE.Vector3(11, 7.8, 13).length() * Math.max(1, 1.35 / aspect);
      assert.ok(Math.abs(view.position.distanceTo(view.target) / previousDistance - .86) < 1e-9);
      const camera = new THREE.PerspectiveCamera(42, aspect, .003, 180);
      camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target); camera.updateMatrixWorld(true);
      for (const object of [room.entrance.object, room.clipboard.object, room.phone.object]) {
        const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
        assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1);
      }
    }
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
