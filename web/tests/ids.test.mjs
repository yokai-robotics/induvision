import assert from "node:assert/strict";
import test from "node:test";
import { createStudyId } from "../lib/ids.ts";
import { mergeImportedStudies } from "../lib/studies.ts";

test("native UUID generation keeps the crypto receiver", () => {
  const crypto = { randomUUID() { assert.equal(this, crypto); return "native-id"; } };
  assert.equal(createStudyId(crypto), "native-id");
});

test("missing randomUUID falls back to getRandomValues with valid UUID bits", () => {
  const crypto = { getRandomValues(bytes) { assert.equal(this, crypto); return bytes.fill(255); } };
  assert.equal(createStudyId(crypto), "ffffffff-ffff-4fff-bfff-ffffffffffff");
});

test("studies and imported copies get distinct IDs without any Web Crypto", () => {
  const ids = Array.from({ length: 1000 }, () => createStudyId(null));
  assert.equal(new Set(ids).size, ids.length);
  const existing = [{ id: ids[0], name: "Original" }];
  const imported = mergeImportedStudies(existing, existing, () => createStudyId(null));
  assert.notEqual(imported[0].id, existing[0].id);
  assert.equal(imported[1].id, existing[0].id);
});
