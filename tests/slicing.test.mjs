import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FOODS,
  matchesDirection,
  comboTier,
  cutScore,
} from "../app/slicing.ts";
test("every food accepts its arrow and rejects reverse and cross directions", () => {
  for (const food of FOODS) {
    const [x, y] = food.direction;
    assert.equal(matchesDirection(x * 80, y * 80, food.direction), true);
    assert.equal(matchesDirection(-x * 80, -y * 80, food.direction), false);
    assert.equal(matchesDirection(y * 80, -x * 80, food.direction), false);
    assert.equal(matchesDirection(x * 10, y * 10, food.direction), false);
  }
});
test("continuous combo tiers and score progression", () => {
  assert.deepEqual(
    [0, 4, 5, 11, 12, 24, 25, 100].map(comboTier),
    [0, 0, 1, 1, 2, 2, 3, 3],
  );
  assert.ok(cutScore(12, true) > cutScore(5, true));
  assert.ok(cutScore(1, true) > cutScore(1, false));
  assert.equal(cutScore(500, false), cutScore(50, false));
});
test("Blender exports contain intact and both cut models with embedded materials", () => {
  for (const name of ["kitchen", "knife", "hand", ...FOODS.map((f) => f.id)]) {
    const file = readFileSync(
      new URL(`../public/models/${name}.glb`, import.meta.url),
    );
    assert.equal(file.readUInt32LE(0), 0x46546c67);
    const json = JSON.parse(
      file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
    );
    assert.ok(json.meshes.length);
    assert.ok(json.materials.length);
    if (FOODS.some((f) => f.id === name)) {
      const names = json.nodes.map((n) => n.name);
      for (const suffix of ["whole", "halfA", "halfB"])
        assert.ok(names.includes(`${name}_${suffix}`));
    }
  }
});
