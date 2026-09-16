"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPayrollScope } = require("./payrollScope");

const ids = {
  orgId: "64b000000000000000000001",
  companyId: "64b000000000000000000002",
  unitId: "64b000000000000000000003",
};

test("unit users are restricted by org, company, and unit", () => {
  const scope = buildPayrollScope({ ...ids, role: "hr_manager" });

  assert.equal(String(scope.org_id), ids.orgId);
  assert.equal(String(scope.company_id), ids.companyId);
  assert.equal(String(scope.unit_id), ids.unitId);
});

test("company admins are restricted by org and company", () => {
  const scope = buildPayrollScope({ ...ids, role: "company_admin" });

  assert.equal(String(scope.org_id), ids.orgId);
  assert.equal(String(scope.company_id), ids.companyId);
  assert.equal(scope.unit_id, undefined);
});

test("org admins cannot see another organization", () => {
  const scope = buildPayrollScope({ ...ids, role: "org_admin" });

  assert.equal(String(scope.org_id), ids.orgId);
  assert.equal(scope.company_id, undefined);
  assert.equal(scope.unit_id, undefined);
});