import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CREWBIT_VERSION } from "./version.js";

describe("CREWBIT_VERSION", () => {
  it("is a non-empty semver-shaped string baked in at build time", () => {
    assert.match(CREWBIT_VERSION, /^\d+\.\d+\.\d+/);
  });
});
