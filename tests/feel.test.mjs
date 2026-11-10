import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { gripPosition } from "../app/held-knife.ts";
import { synthesizeSlice } from "../app/sound-design.ts";

test("knife grip projects to the finger at different smartphone sizes", () => {
  for (const [width, height] of [
    [390, 844],
    [390, 700],
    [320, 568],
  ]) {
    const camera = new PerspectiveCamera(43, width / height, 0.05, 30);
    camera.updateMatrixWorld();
    for (const [x, y] of [
      [width * 0.5, height * 0.5],
      [24, 80],
      [width - 12, height - 30],
    ]) {
      const projected = new Vector3(
        ...gripPosition(width, height, camera.fov, 1.25, x, y),
      ).project(camera);
      assert.ok(Math.abs((projected.x * 0.5 + 0.5) * width - x) < 1e-8);
      assert.ok(Math.abs((-0.5 * projected.y + 0.5) * height - y) < 1e-8);
    }
  }
});
test("each food sound has an audible attack, bounded peaks and a quiet tail", () => {
  for (const rate of [44100, 48000])
    for (const food of ["cucumber", "carrot", "salmon", "melon"]) {
      const data = synthesizeSlice(rate, food);
      let peak = 0,
        energy = 0,
        tail = 0;
      for (let i = 0; i < data.length; i++) {
        assert.ok(Number.isFinite(data[i]));
        peak = Math.max(peak, Math.abs(data[i]));
        energy += data[i] ** 2;
        if (i > data.length - rate * 0.02) tail += data[i] ** 2;
      }
      assert.ok(peak > 0.2 && peak <= 0.841, `${food} peak ${peak}`);
      assert.ok(
        Math.sqrt(energy / data.length) > 0.02,
        `${food} must be audible`,
      );
      assert.ok(
        Math.sqrt(tail / (rate * 0.02)) < 0.005,
        `${food} must leave room for next cut`,
      );
      assert.equal(data[0], 0);
    }
});
test("foods and repeated cuts have different sound textures", () => {
  const a = synthesizeSlice(44100, "carrot", 0),
    b = synthesizeSlice(44100, "salmon", 0),
    c = synthesizeSlice(44100, "carrot", 1);
  const distance = (x, y) =>
    Math.sqrt(
      x.reduce((sum, value, i) => sum + (value - y[i]) ** 2, 0) / x.length,
    );
  assert.ok(distance(a, b) > 0.04);
  assert.ok(distance(a, c) > 0.03);
  assert.deepEqual(a, synthesizeSlice(44100, "carrot", 0));
});
