"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { calculatePolicyOvertime } = require("./overtimeCalculator");

test("does not credit overtime when policy is disabled", () => {
  assert.equal(calculatePolicyOvertime(2, { enabled: false }), 0);
});

test("enforces the policy minimum before crediting overtime", () => {
  const policy = { enabled: true, minimumMinutes: 45, maxHoursPerDay: 4 };

  assert.equal(calculatePolicyOvertime(0.5, policy), 0);
  assert.equal(calculatePolicyOvertime(0.75, policy), 0.75);
});

test("caps credited overtime using the attendance policy", () => {
  const policy = { enabled: true, minimumMinutes: 30, maxHoursPerDay: 2 };

  assert.equal(calculatePolicyOvertime(3.5, policy), 2);
});

test("detects overtime for both salary and comp-off compensation", () => {
  assert.equal(
    calculatePolicyOvertime(1.25, { enabled: true, minimumMinutes: 30, maxHoursPerDay: 4, compensationType: "salary" }),
    1.25
  );
  assert.equal(
    calculatePolicyOvertime(1.25, { enabled: true, minimumMinutes: 30, maxHoursPerDay: 4, compensationType: "comp_off" }),
    1.25
  );
});