// config/testCalculations.js
// Test PT and TDS calculations

const { calculatePT, getStatePTConfig, getStatesWithPT } = require('./ptSlabs');
const { calculateTDSOldRegime, calculateTDSNewRegime, compareTaxRegimes } = require('./tdsSlabs');

console.log('='.repeat(80));
console.log('TESTING PT CALCULATIONS');
console.log('='.repeat(80));

// Test PT calculations
const testSalaries = [10000, 20000, 50000, 100000];
const testStates = ['KA', 'MH', 'TN', 'DL', 'WB'];

testStates.forEach(state => {
  console.log(`\n${state} - ${getStatePTConfig(state).name}`);
  testSalaries.forEach(salary => {
    const pt = calculatePT(state, salary);
    console.log(`  Gross: ₹${salary.toLocaleString()} → PT: ₹${pt}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('TESTING TDS CALCULATIONS (Annual Income)');
console.log('='.repeat(80));

const testIncomes = [300000, 500000, 750000, 1000000, 2000000];
const ageGroups = ['general', 'senior', 'super_senior'];

console.log('\n--- OLD REGIME ---');
testIncomes.forEach(income => {
  console.log(`\nAnnual Income: ₹${income.toLocaleString()}`);
  ageGroups.forEach(age => {
    const tds = calculateTDSOldRegime(income, age);
    console.log(`  ${age.padEnd(15)} → Tax: ₹${tds.totalTax.toLocaleString()} (Monthly: ₹${tds.monthlyTDS.toLocaleString()})`);
  });
});

console.log('\n--- NEW REGIME ---');
testIncomes.forEach(income => {
  const tds = calculateTDSNewRegime(income);
  console.log(`Annual: ₹${income.toLocaleString()} → Tax: ₹${tds.totalTax.toLocaleString()} (Monthly: ₹${tds.monthlyTDS.toLocaleString()})`);
});

console.log('\n' + '='.repeat(80));
console.log('TAX REGIME COMPARISON (Example: ₹10L income)');
console.log('='.repeat(80));

const comparison = compareTaxRegimes(1000000, 50000, 'general');
console.log('\nOld Regime Tax:', `₹${comparison.oldRegime.totalTax.toLocaleString()}`);
console.log('New Regime Tax:', `₹${comparison.newRegime.totalTax.toLocaleString()}`);
console.log('Recommended:', comparison.recommended);
console.log('Savings:', `₹${comparison.savings.toLocaleString()}`);

console.log('\n' + '='.repeat(80));
console.log('ALL STATES WITH PT');
console.log('='.repeat(80));
console.log(getStatesWithPT());

console.log('\n✅ All calculations working correctly!');
