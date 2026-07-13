// config/ptSlabs.js
// Professional Tax Slabs for All Indian States
// Updated for FY 2026-27

"use strict";

/**
 * Professional Tax slabs by state
 * Structure: Array of { minGross, maxGross, monthlyAmount }
 * - minGross: Minimum monthly gross salary
 * - maxGross: Maximum monthly gross salary (null = no upper limit)
 * - monthlyAmount: PT amount per month
 */

const PT_SLABS = {
  // Karnataka
  KA: {
    name: 'Karnataka',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 100 },
      { minGross: 25001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Maharashtra
  MH: {
    name: 'Maharashtra',
    slabs: [
      { minGross: 0, maxGross: 7500, monthlyAmount: 0 },
      { minGross: 7501, maxGross: 10000, monthlyAmount: 175 },
      { minGross: 10001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2500, // Extra ₹200 in Feb for individuals > ₹10K
    februaryExtra: true,
  },

  // Tamil Nadu
  TN: {
    name: 'Tamil Nadu',
    slabs: [
      { minGross: 0, maxGross: 21000, monthlyAmount: 0 },
      { minGross: 21001, maxGross: 30000, monthlyAmount: 135 },
      { minGross: 30001, maxGross: 45000, monthlyAmount: 315 },
      { minGross: 45001, maxGross: 60000, monthlyAmount: 690 },
      { minGross: 60001, maxGross: 75000, monthlyAmount: 1025 },
      { minGross: 75001, maxGross: null, monthlyAmount: 1250 },
    ],
    maxAnnual: 15000,
  },

  // West Bengal
  WB: {
    name: 'West Bengal',
    slabs: [
      { minGross: 0, maxGross: 10000, monthlyAmount: 0 },
      { minGross: 10001, maxGross: 15000, monthlyAmount: 110 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 130 },
      { minGross: 25001, maxGross: 40000, monthlyAmount: 150 },
      { minGross: 40001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Delhi (No Professional Tax)
  DL: {
    name: 'Delhi',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
    note: 'Delhi does not levy Professional Tax',
  },

  // Gujarat
  GJ: {
    name: 'Gujarat',
    slabs: [
      { minGross: 0, maxGross: 5999, monthlyAmount: 0 },
      { minGross: 6000, maxGross: 8999, monthlyAmount: 80 },
      { minGross: 9000, maxGross: 11999, monthlyAmount: 150 },
      { minGross: 12000, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Madhya Pradesh
  MP: {
    name: 'Madhya Pradesh',
    slabs: [
      { minGross: 0, maxGross: 13750, monthlyAmount: 0 },
      { minGross: 13751, maxGross: 18333, monthlyAmount: 125 },
      { minGross: 18334, maxGross: 22917, monthlyAmount: 167 },
      { minGross: 22918, maxGross: 27500, monthlyAmount: 208 },
      { minGross: 27501, maxGross: 36667, monthlyAmount: 250 },
      { minGross: 36668, maxGross: 45833, monthlyAmount: 292 },
      { minGross: 45834, maxGross: 55000, monthlyAmount: 333 },
      { minGross: 55001, maxGross: 64167, monthlyAmount: 375 },
      { minGross: 64168, maxGross: 73333, monthlyAmount: 417 },
      { minGross: 73334, maxGross: 82500, monthlyAmount: 458 },
      { minGross: 82501, maxGross: 100000, monthlyAmount: 500 },
      { minGross: 100001, maxGross: null, monthlyAmount: 1000 },
    ],
    maxAnnual: 12000,
    note: 'Higher slab for professionals',
  },

  // Punjab
  PB: {
    name: 'Punjab',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
    note: 'Uniform ₹200 for all employees',
  },

  // Rajasthan
  RJ: {
    name: 'Rajasthan',
    slabs: [
      { minGross: 0, maxGross: 18000, monthlyAmount: 0 },
      { minGross: 18001, maxGross: 25000, monthlyAmount: 166 },
      { minGross: 25001, maxGross: 33333, monthlyAmount: 208 },
      { minGross: 33334, maxGross: null, monthlyAmount: 250 },
    ],
    maxAnnual: 3000,
  },

  // Kerala (Kerala Professional Tax Act)
  KL: {
    name: 'Kerala',
    slabs: [
      { minGross: 0, maxGross: 19999, monthlyAmount: 0 },
      { minGross: 20000, maxGross: 29999, monthlyAmount: 100 },
      { minGross: 30000, maxGross: 44999, monthlyAmount: 167 },
      { minGross: 45000, maxGross: 59999, monthlyAmount: 250 },
      { minGross: 60000, maxGross: 74999, monthlyAmount: 333 },
      { minGross: 75000, maxGross: 99999, monthlyAmount: 417 },
      { minGross: 100000, maxGross: null, monthlyAmount: 500 },
    ],
    maxAnnual: 6000,
  },

  // Andhra Pradesh
  AP: {
    name: 'Andhra Pradesh',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: 20000, monthlyAmount: 150 },
      { minGross: 20001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Telangana
  TG: {
    name: 'Telangana',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: 20000, monthlyAmount: 150 },
      { minGross: 20001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Odisha
  OD: {
    name: 'Odisha',
    slabs: [
      { minGross: 0, maxGross: 13332, monthlyAmount: 0 },
      { minGross: 13333, maxGross: 25000, monthlyAmount: 125 },
      { minGross: 25001, maxGross: 41667, monthlyAmount: 208 },
      { minGross: 41668, maxGross: null, monthlyAmount: 250 },
    ],
    maxAnnual: 3000,
  },

  // Assam
  AS: {
    name: 'Assam',
    slabs: [
      { minGross: 0, maxGross: 10000, monthlyAmount: 0 },
      { minGross: 10001, maxGross: 15000, monthlyAmount: 150 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 175 },
      { minGross: 25001, maxGross: null, monthlyAmount: 208 },
    ],
    maxAnnual: 2496,
  },

  // Bihar
  BR: {
    name: 'Bihar',
    slabs: [
      { minGross: 0, maxGross: 25000, monthlyAmount: 0 },
      { minGross: 25001, maxGross: 41667, monthlyAmount: 167 },
      { minGross: 41668, maxGross: null, monthlyAmount: 208 },
    ],
    maxAnnual: 2500,
  },

  // Chhattisgarh
  CT: {
    name: 'Chhattisgarh',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 150 },
      { minGross: 25001, maxGross: 33333, monthlyAmount: 208 },
      { minGross: 33334, maxGross: null, monthlyAmount: 250 },
    ],
    maxAnnual: 3000,
  },

  // Jharkhand
  JH: {
    name: 'Jharkhand',
    slabs: [
      { minGross: 0, maxGross: 25000, monthlyAmount: 0 },
      { minGross: 25001, maxGross: 41667, monthlyAmount: 167 },
      { minGross: 41668, maxGross: null, monthlyAmount: 208 },
    ],
    maxAnnual: 2500,
  },

  // Uttar Pradesh
  UP: {
    name: 'Uttar Pradesh',
    slabs: [
      { minGross: 0, maxGross: 40000, monthlyAmount: 0 },
      { minGross: 40001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
    note: 'Only for professionals/business owners, employees exempt for salary < ₹40K',
  },

  // Haryana (No Professional Tax from Apr 2025)
  HR: {
    name: 'Haryana',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
    note: 'Haryana abolished Professional Tax from Apr 2025',
  },

  // Uttarakhand
  UT: {
    name: 'Uttarakhand',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 125 },
      { minGross: 25001, maxGross: null, monthlyAmount: 208 },
    ],
    maxAnnual: 2400,
  },

  // Goa
  GA: {
    name: 'Goa',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Tripura
  TR: {
    name: 'Tripura',
    slabs: [
      { minGross: 0, maxGross: 10000, monthlyAmount: 0 },
      { minGross: 10001, maxGross: 15000, monthlyAmount: 125 },
      { minGross: 15001, maxGross: 20000, monthlyAmount: 167 },
      { minGross: 20001, maxGross: 25000, monthlyAmount: 208 },
      { minGross: 25001, maxGross: 50000, monthlyAmount: 250 },
      { minGross: 50001, maxGross: null, monthlyAmount: 333 },
    ],
    maxAnnual: 3996,
  },

  // Meghalaya
  ML: {
    name: 'Meghalaya',
    slabs: [
      { minGross: 0, maxGross: 4000, monthlyAmount: 0 },
      { minGross: 4001, maxGross: 6000, monthlyAmount: 17 },
      { minGross: 6001, maxGross: 10000, monthlyAmount: 25 },
      { minGross: 10001, maxGross: 15000, monthlyAmount: 42 },
      { minGross: 15001, maxGross: 25000, monthlyAmount: 58 },
      { minGross: 25001, maxGross: null, monthlyAmount: 83 },
    ],
    maxAnnual: 1000,
  },

  // Manipur
  MN: {
    name: 'Manipur',
    slabs: [
      { minGross: 0, maxGross: 20000, monthlyAmount: 0 },
      { minGross: 20001, maxGross: 30000, monthlyAmount: 83 },
      { minGross: 30001, maxGross: 40000, monthlyAmount: 125 },
      { minGross: 40001, maxGross: 50000, monthlyAmount: 166 },
      { minGross: 50001, maxGross: null, monthlyAmount: 208 },
    ],
    maxAnnual: 2500,
  },

  // Mizoram
  MZ: {
    name: 'Mizoram',
    slabs: [
      { minGross: 0, maxGross: 25000, monthlyAmount: 0 },
      { minGross: 25001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Nagaland
  NL: {
    name: 'Nagaland',
    slabs: [
      { minGross: 0, maxGross: 12000, monthlyAmount: 0 },
      { minGross: 12001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Sikkim (No Professional Tax)
  SK: {
    name: 'Sikkim',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Arunachal Pradesh (No Professional Tax)
  AR: {
    name: 'Arunachal Pradesh',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Himachal Pradesh (No Professional Tax)
  HP: {
    name: 'Himachal Pradesh',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Jammu & Kashmir (No Professional Tax)
  JK: {
    name: 'Jammu & Kashmir',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Chandigarh (UT)
  CH: {
    name: 'Chandigarh',
    slabs: [
      { minGross: 0, maxGross: 15000, monthlyAmount: 0 },
      { minGross: 15001, maxGross: null, monthlyAmount: 200 },
    ],
    maxAnnual: 2400,
  },

  // Puducherry
  PY: {
    name: 'Puducherry',
    slabs: [
      { minGross: 0, maxGross: 25000, monthlyAmount: 0 },
      { minGross: 25001, maxGross: 33332, monthlyAmount: 83 },
      { minGross: 33333, maxGross: 50000, monthlyAmount: 167 },
      { minGross: 50001, maxGross: null, monthlyAmount: 250 },
    ],
    maxAnnual: 3000,
  },

  // Andaman & Nicobar (No PT)
  AN: {
    name: 'Andaman & Nicobar Islands',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Dadra & Nagar Haveli and Daman & Diu
  DN: {
    name: 'Dadra & Nagar Haveli and Daman & Diu',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Lakshadweep (No PT)
  LD: {
    name: 'Lakshadweep',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },

  // Ladakh (No PT)
  LA: {
    name: 'Ladakh',
    slabs: [
      { minGross: 0, maxGross: null, monthlyAmount: 0 },
    ],
    maxAnnual: 0,
  },
};

/**
 * Get Professional Tax amount for a given state and gross salary
 * @param {string} stateCode - State code (e.g., 'KA', 'MH')
 * @param {number} grossSalary - Monthly gross salary
 * @returns {number} - Monthly PT amount
 */
function calculatePT(stateCode, grossSalary) {
  const statePT = PT_SLABS[stateCode];
  
  if (!statePT) {
    console.warn(`Unknown state code: ${stateCode}`);
    return 0;
  }
  
  for (const slab of statePT.slabs) {
    if (grossSalary >= slab.minGross && (slab.maxGross === null || grossSalary <= slab.maxGross)) {
      return slab.monthlyAmount;
    }
  }
  
  return 0;
}

/**
 * Get state PT configuration
 * @param {string} stateCode - State code
 * @returns {object} - PT configuration for the state
 */
function getStatePTConfig(stateCode) {
  return PT_SLABS[stateCode] || null;
}

/**
 * Get all states with PT
 * @returns {Array} - List of state codes with PT
 */
function getStatesWithPT() {
  return Object.keys(PT_SLABS).filter(code => PT_SLABS[code].maxAnnual > 0);
}

/**
 * Get all state configurations
 * @returns {object} - All PT slabs
 */
function getAllPTSlabs() {
  return PT_SLABS;
}

module.exports = {
  PT_SLABS,
  calculatePT,
  getStatePTConfig,
  getStatesWithPT,
  getAllPTSlabs,
};
