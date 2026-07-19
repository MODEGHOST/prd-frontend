import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hasPermission, isRequesterPersona } from "../src/utils/access.js";
import { unwrapList, unwrapPage } from "../src/services/api.js";

const layoutSource = await readFile(
  new URL("../src/layouts/AppLayout.jsx", import.meta.url),
  "utf8",
);

test("manage_all grants resource-specific frontend actions", () => {
  const user = { permissions: ["projects.manage_all"] };
  assert.equal(hasPermission(user, "projects.status.update"), true);
  assert.equal(hasPermission(user, "issues.update"), false);
});

test("requester persona does not collapse read-all or auditor users", () => {
  assert.equal(isRequesterPersona({
    roles: ["requester"],
    permissions: ["issues.create"],
  }), true);
  assert.equal(isRequesterPersona({
    roles: ["requester", "auditor"],
    permissions: ["issues.read_all"],
  }), false);
  assert.equal(isRequesterPersona({
    roles: ["auditor"],
    permissions: ["audit.read"],
  }), false);
});

test("API list normalizers tolerate legacy and malformed responses", () => {
  assert.deepEqual(unwrapList([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(unwrapList({ items: [{ id: 2 }] }), [{ id: 2 }]);
  assert.deepEqual(unwrapList(null), []);

  assert.deepEqual(unwrapPage({ items: [{ id: 3 }], total: "1", page: "2" }), {
    items: [{ id: 3 }],
    total: 1,
    page: 2,
    limit: 0,
    hasMore: false,
  });
});

test("company selector is based on active company count, not permission", () => {
  assert.match(layoutSource, /\(session\.companies \|\| \[\]\)\.length > 1/);
  assert.doesNotMatch(
    layoutSource,
    /permissions\.has\("company\.switch"\)[\s\S]{0,80}companies/,
  );
});
