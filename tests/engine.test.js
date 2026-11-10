// Run with: node --test
// Loads the app's scripts as the browser does (shared top-level names).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
for (const f of ['config.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext(code, ctx);
// Results cross the vm boundary, so compare them as plain JSON.
const call = (fn, ...args) => JSON.parse(JSON.stringify(run(fn)(...args)));
const client = over => ({ ...run('blankClient')(), dob: '1973-06-15', monthlyIncome: 10000,
  cpfTier: 'FRS', cpfMonthly: 1890, cpfStartAge: 65, ...over });
const source = over => ({ ...run('blankSource')(), ...over });

test('months paid in a year count from the start month to the end month', () => {
  const s = source({ start: '2028-07', end: '2030-03', monthly: 100 });
  assert.equal(call('monthsPaid', s, 2027), 0);
  assert.equal(call('monthsPaid', s, 2028), 6);  // Jul-Dec
  assert.equal(call('monthsPaid', s, 2029), 12);
  assert.equal(call('monthsPaid', s, 2030), 3);  // Jan-Mar
  assert.equal(call('monthsPaid', s, 2031), 0);
  assert.equal(call('monthsPaid', source({ start: '2028-01', monthly: 100 }), 2090), 12); // lifelong
  assert.equal(call('monthsPaid', source({ start: '', monthly: 100 }), 2030), 0);
});

test('the goal is 75% of current monthly income', () => {
  assert.equal(call('goalMonthly', client()), 7500);
  assert.equal(call('goalMonthly', client({ goalPercent: 70 })), 7000);
});

test('current is CPF LIFE only; optimised stacks the sources by when they pay', () => {
  // Like the Excel example: $600/mth from 2028, an annuity $2,000/mth from 2033,
  // CPF FRS $1,890/mth from 65 (2038), and a modern pot $1,400/mth from 2038.
  const sources = [
    source({ name: 'Retirement pot', start: '2028-01', monthly: 600 }),
    source({ name: 'Annuity', start: '2033-01', monthly: 2000 }),
    source({ name: 'Last retirement pot', kind: 'modern', start: '2038-01', monthly: 1400 }),
  ];
  const rows = call('timeline', client(), sources, 2025);
  const at = year => rows.find(r => r.year === year);
  assert.equal(rows[0].year, 2025);
  assert.equal(rows[0].age, 52);
  assert.equal(rows.at(-1).age, run('END_AGE'));
  assert.equal(at(2027).optimised.monthly, 0);
  assert.equal(at(2028).optimised.monthly, 600);
  assert.equal(at(2033).optimised.monthly, 2600);
  assert.equal(at(2037).current.monthly, 0);
  // CPF LIFE starts in June 2038 (birthday month at 65): 7 months that year.
  assert.equal(at(2038).current.monthly, 1890);
  assert.equal(at(2038).current.yearly, 1890 * 7);
  assert.equal(at(2038).optimised.monthly, 1890 + 2000 + 600 + 1400);
  assert.equal(at(2038).optimised.traditional, 1890 + 2000 + 600);
  assert.equal(at(2038).optimised.modern, 1400);
  assert.deepEqual(at(2038).optimised.starts.map(s => s.name), ['CPF LIFE (FRS)', 'Last retirement pot']);
  assert.equal(at(2039).optimised.yearly, 12 * (1890 + 2000 + 600 + 1400));

  const sum = call('summary', rows, 7500);
  assert.deepEqual(sum.current, { monthly: 1890, age: 65 });
  assert.deepEqual(sum.optimised, { monthly: 5890, age: 65 });
  assert.equal(sum.goalMetFrom, null); // $5,890 never reaches $7,500
  assert.equal(call('summary', rows, 5000).goalMetFrom, 65);
  assert.equal(call('summary', rows, 5000).goalMetUntil, run('END_AGE')); // met for life
});

test('a source with an end date stops paying after it', () => {
  const rows = call('timeline', client(), [source({ name: 'Bond', start: '2030-01', end: '2034-12', monthly: 500 })], 2025);
  assert.equal(rows.find(r => r.year === 2034).optimised.monthly, 500);
  assert.equal(rows.find(r => r.year === 2035).optimised.monthly, 0);
  assert.deepEqual(rows.find(r => r.year === 2034).optimised.ends.map(s => s.name), ['Bond']);
  // Met only while the bond pays: ages 57 to 61 (2030 to 2034).
  const sum = call('summary', rows, 500);
  assert.equal(sum.goalMetFrom, 57);
  assert.equal(sum.goalMetUntil, 61);
});

test('no date of birth: no timeline; no CPF payout: nothing on the current side', () => {
  assert.deepEqual(call('timeline', client({ dob: '' }), [], 2025), []);
  assert.equal(call('timeline', client({ cpfMonthly: 0 }), [], 2025).every(r => r.current.monthly === 0), true);
});

test('client files round-trip and bad values are cleaned', () => {
  const file = call('clientFile', client({ name: 'Tan' }), [source({ name: 'Pot', monthly: 600 })]);
  const back = call('readClientFile', file);
  assert.equal(back.client.name, 'Tan');
  assert.equal(back.sources[0].monthly, 600);
  const messy = call('readClientFile', { app: 'retirement-timeline', client: { cpfMonthly: 'abc' },
    sources: [{ monthly: '250', name: 7, extra: 'x' }] });
  assert.equal(messy.client.cpfMonthly, 0);
  assert.equal(messy.client.goalPercent, run('GOAL_PERCENT'));
  assert.equal(messy.sources[0].monthly, 250);
  assert.equal(messy.sources[0].name, '7');
  assert.equal(messy.sources[0].extra, undefined);
  assert.throws(() => call('readClientFile', { sources: 'x' }), /not a Retirement Timeline/);
});

test('phone numbers are spaced as 1234 5678', () => {
  assert.equal(call('phoneText', '91234567'), '9123 4567');
  assert.equal(call('phoneText', '9123 4567'), '9123 4567');
  assert.equal(call('phoneText', '9123-4567'), '9123 4567');
  assert.equal(call('phoneText', '+6591234567'), '+65 9123 4567');
  assert.equal(call('phoneText', '+65 9123 4567'), '+65 9123 4567');
  assert.equal(call('phoneText', '91234'), '9123 4');   // while typing
  assert.equal(call('phoneText', '912'), '912');
  assert.equal(call('phoneText', ''), '');
  assert.equal(call('phoneText', '+60 12-345 6789'), '+60 12-345 6789'); // other countries: as typed
  assert.equal(call('phoneText', '0123456789'), '0123456789');           // too long: as typed
  assert.equal(call('phoneText', 'ext 123'), 'ext 123');
});
