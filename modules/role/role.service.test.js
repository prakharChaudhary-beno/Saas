"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Role = require("./role.model");
const User = require("../auth/models/user.model");
const roleService = require("./role.service");

test("org admins count role holders only within their organization", async (testContext) => {
  const orgId = "64b000000000000000000001";
  const roleId = "64b000000000000000000002";
  const countFilters = [];

  testContext.mock.method(Role, "find", () => ({
    populate: () => ({
      lean: async () => [{ _id: roleId, name: "Org Admin" }],
    }),
  }));
  testContext.mock.method(User, "countDocuments", async (filter) => {
    countFilters.push(filter);
    return 7;
  });

  const roles = await roleService.getRoles({
    role: "org_admin",
    level: "org",
    orgId,
    companyId: null,
    unitId: null,
  });

  assert.equal(roles[0].holderCount, 7);
  assert.deepEqual(countFilters, [{
    roleId,
    is_deleted: false,
    org_id: orgId,
  }]);
});