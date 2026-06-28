import test from "node:test";
import assert from "node:assert/strict";
import { readSnapshot, renderAgentsMdSnapshot, SNAPSHOT_CASES } from "./snapshot-utils.js";

for (const fixtureName of SNAPSHOT_CASES) {
  test(`generated AGENTS.md matches ${fixtureName} snapshot`, async () => {
    const actual = await renderAgentsMdSnapshot(fixtureName);
    const expected = await readSnapshot(fixtureName);

    assert.equal(actual, expected);
  });
}
