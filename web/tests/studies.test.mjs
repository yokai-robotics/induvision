import assert from "node:assert/strict";
import test from "node:test";
import { STUDIES_KEY, parseStudies, serializeStudies, repairReferences, mergeImportedStudies, writeStudies } from "../lib/studies.ts";

const study = {
  id: "study-1", name: "Contrôle dimensionnel", objectTravelAxis: "horizontal",
  detectionWidthMm: 120, detectionHeightMm: 80, workingDistanceMm: 300,
  objectSpeedMmS: 0.45, minDetailMm: 0.35, pixelsPerDetailTarget: 4,
  requiredFps: 40, exposureUs: 500, maxMotionBlurPx: 1,
  objectWidthCm: null, objectHeightCm: 10, objectLengthCm: 30,
  fpsMin: null, fpsMax: null, resolutionMpMin: null, resolutionMpMax: null,
  selectedCameraId: "camera-1", selectedLensId: "lens-1",
  sensorFormats: '["2/3\\\""]', comparisonPairs: '[{"cameraId":"camera-1","lensId":"lens-1"}]'
};

test("export/import preserves numeric nulls, filters and comparison pairs", () => {
  assert.deepEqual(parseStudies(serializeStudies([study])), [study]);
});

test("invalid imports fail before touching existing studies", () => {
  for (const payload of ["{", '{"version":2,"studies":[]}', JSON.stringify({ version: 1, studies: [{ ...study, requiredFps: "40" }] }), JSON.stringify({ version: 1, studies: [study, study] }), JSON.stringify({ version: 1, studies: [{ ...study, sensorFormats: "{}" }] })]) {
    assert.throws(() => parseStudies(payload));
  }
});

test("removed models get a fallback and invalid comparison pairs are removed", () => {
  const repaired = repairReferences(study, [{ id: "camera-2" }], [{ id: "lens-1" }]);
  assert.equal(repaired.selectedCameraId, "camera-2");
  assert.equal(repaired.selectedLensId, "lens-1");
  assert.equal(repaired.comparisonPairs, "[]");
  assert.equal(study.selectedCameraId, "camera-1");
});

test("importing an existing identifier creates a copy without overwriting", () => {
  const merged = mergeImportedStudies([study], [study], () => "copy-1");
  assert.deepEqual(merged.map((item) => item.id), ["copy-1", "study-1"]);
  assert.equal(merged[1], study);
});

test("saving can reload studies and protects concurrent edits", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const snapshot = writeStudies(storage, [study], null);
  assert.deepEqual(parseStudies(storage.getItem(STUDIES_KEY)), [study]);
  storage.setItem(STUDIES_KEY, "other tab");
  assert.throws(() => writeStudies(storage, [], snapshot), /autre onglet/);
  assert.equal(storage.getItem(STUDIES_KEY), "other tab");
});

test("quota failures propagate without deleting saved data", () => {
  const original = serializeStudies([study]);
  const storage = { getItem: () => original, setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.throws(() => writeStudies(storage, [], original), /QuotaExceededError/);
  assert.equal(storage.getItem(STUDIES_KEY), original);
});
