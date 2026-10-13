import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCatalog, validateEntry } from "../scripts/catalog.mjs";
import { simulateConfiguration } from "../app/calculations.ts";

test("the complete catalogue passes validation", async () => {
  const catalog = await generateCatalog();
  assert.ok(catalog.cameras.length > 0 && catalog.lenses.length > 0);
});

test("invalid pixel dimensions and unknown numeric values fail validation", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/catalog.generated.json", import.meta.url)));
  const camera = catalog.cameras.find((item) => item.pixelSizeUm && item.resolutionWidth && item.sensorWidthMm);
  assert.throws(() => validateEntry({ ...camera, sensorWidthMm: 1000 }, "cameras"), /incohérent/);
  assert.throws(() => validateEntry({ ...camera, maxFps: "60" }, "cameras"), /nombre positif/);
  assert.throws(() => validateEntry({ ...camera, sourceUrl: "javascript:alert(1)" }, "cameras"), /HTTP/);
});

test("simulation retains field of view, detail, blur and compatibility results", () => {
  const config = { detectionWidthMm: 80, detectionHeightMm: 60, workingDistanceMm: 300, objectSpeedMmS: 0.45, minDetailMm: 0.35, pixelsPerDetailTarget: 4, requiredFps: 40, exposureUs: 500, maxMotionBlurPx: 8, objectWidthCm: 20, objectHeightCm: 10, objectLengthCm: 30, objectTravelAxis: "horizontal" };
  const camera = { sensorWidthMm: 8.45, sensorHeightMm: 7.07, resolutionWidth: 2448, maxFps: 75, lensMount: "C-mount", sensorFormat: '2/3"' };
  const lens = { focalLengthMm: 25, maxSensorDiagonalMm: 11, mount: "C-mount", sensorFormat: '2/3"', minWorkingDistanceMm: 150 };
  const result = simulateConfiguration(config, camera, lens);
  assert.ok(Math.abs(result.coveredWidthMm - 101.4) < 1e-10);
  assert.ok(Math.abs(result.coveredHeightMm - 84.84) < 1e-10);
  assert.ok(Math.abs(result.motionBlurMm - 0.225) < 1e-10);
  assert.ok(result.pixelsOnDetail > 8);
  assert.equal(result.score, 100);
  assert.equal(result.level, "compatible");
});
