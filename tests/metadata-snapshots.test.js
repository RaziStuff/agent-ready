import test from "node:test";
import assert from "node:assert/strict";
import {
  readCommandsSnapshot,
  readRepoMapSnapshot,
  renderCommandsSnapshot,
  renderRepoMapSnapshot,
  SNAPSHOT_CASES
} from "./snapshot-utils.js";

for (const fixtureName of SNAPSHOT_CASES) {
  test(`generated repo-map.json matches ${fixtureName} snapshot`, async () => {
    const actual = await renderRepoMapSnapshot(fixtureName);
    const expected = await readRepoMapSnapshot(fixtureName);

    assert.equal(actual, expected);
  });

  test(`generated commands.json matches ${fixtureName} snapshot`, async () => {
    const actual = await renderCommandsSnapshot(fixtureName);
    const expected = await readCommandsSnapshot(fixtureName);

    assert.equal(actual, expected);
  });
}
