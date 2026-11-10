// Settings for your practice. Change them here; nothing else needs editing.

// Pre-fills "Prepared by" for every new client (it can still be changed per client).
const ADVISER = { name: '', mobile: '' };

// Printed at the bottom of every report.
const DISCLAIMER = 'This retirement timeline is an illustration for planning only, not a guarantee. ' +
  'CPF LIFE and investment payouts depend on their own terms, and non-guaranteed payouts may be higher or lower.';

// Voyage's ideal retirement income: this % of the client's current monthly income.
const GOAL_PERCENT = 75;

// CPF LIFE: the retirement sum tiers to choose from, and the default payout start age
// (CPF allows 65 to 70).
const CPF_TIERS = ['BRS', 'FRS', 'ERS', 'Other'];
const CPF_START_AGE = 65;

// The timeline runs to the year the client turns this age.
const END_AGE = 95;

// Kinds of income source. Traditional (drawdown) pays for needs and comes first;
// Modern (capital kept invested) pays for wants. CPF LIFE counts as Traditional.
const SOURCE_KINDS = [
  { key: 'traditional', label: 'Traditional (drawdown, for needs)' },
  { key: 'modern', label: 'Modern (capital kept, for wants)' },
];
