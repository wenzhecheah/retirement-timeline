// All calculations. No page code, so it can be tested on its own (tests/).

const blankClient = () => ({
  name: '', dob: '', monthlyIncome: 0, goalPercent: GOAL_PERCENT, preparedOn: '', adviserName: '', adviserMobile: '',
  cpfTier: 'FRS', cpfMonthly: 0, cpfStartAge: CPF_START_AGE,
});

// An income source for the Optimised side. start and end are 'YYYY-MM' (end blank: lifelong).
const blankSource = () => ({ name: '', kind: 'traditional', start: '', end: '', monthly: 0, notes: '' });

// Copy src into the shape of blank, coercing each value to blank's type, so a
// hand-edited or old client file can't put the wrong kind of value anywhere.
function fit(blank, src) {
  const out = {};
  for (const [k, v] of Object.entries(blank)) {
    const x = src?.[k];
    if (typeof v === 'number') out[k] = x !== '' && x != null && Number.isFinite(+x) ? +x : v;
    else out[k] = x == null ? v : String(x);
  }
  return out;
}

const FILE_APP = 'retirement-timeline', FILE_VERSION = 1;

// Checks and cleans a loaded client file. Throws if it isn't one.
function readClientFile(data) {
  if (data?.app !== FILE_APP || !Array.isArray(data.sources)) throw new Error('This is not a Retirement Timeline client file.');
  return { client: fit(blankClient(), data.client), sources: data.sources.map(s => fit(blankSource(), s)) };
}

const clientFile = (client, sources) => ({ app: FILE_APP, version: FILE_VERSION, client, sources });

const goalMonthly = client => client.monthlyIncome * client.goalPercent / 100;

// 'YYYY-MM' as a month count, so months can be compared and subtracted.
const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };

// How many months of calendar `year` a source pays in (start to end, both included).
function monthsPaid(source, year) {
  if (!source.start || !(source.monthly > 0)) return 0;
  const from = Math.max(monthIndex(source.start), year * 12);
  const to = Math.min(source.end ? monthIndex(source.end) : Infinity, year * 12 + 11);
  return Math.max(0, to - from + 1);
}

// CPF LIFE as an income source: lifelong, from the birthday month of the year the
// client reaches the chosen start age. null without a date of birth or payout.
function cpfSource(client) {
  if (!client.dob || !(client.cpfMonthly > 0)) return null;
  const start = `${Number(client.dob.slice(0, 4)) + client.cpfStartAge}-${client.dob.slice(5, 7)}`;
  return { name: `CPF LIFE (${client.cpfTier})`, kind: 'cpf', start, end: '', monthly: client.cpfMonthly };
}

// The timeline: one row per calendar year, from `fromYear` to the year the client
// turns END_AGE. `current` is CPF LIFE only; `optimised` is CPF LIFE plus the
// sources. For each side: monthly (the monthly payouts of everything paying that
// year), yearly (each payout x the months it pays that year), traditional and
// modern (monthly, CPF LIFE counting as traditional), and the sources that start
// and end that year.
function timeline(client, sources, fromYear) {
  if (!client.dob) return [];
  const birthYear = Number(client.dob.slice(0, 4));
  const cpf = cpfSource(client);
  const current = cpf ? [cpf] : [], optimised = [...current, ...sources];
  const side = (list, year) => {
    const r = { monthly: 0, yearly: 0, traditional: 0, modern: 0, starts: [], ends: [] };
    for (const s of list) {
      const months = monthsPaid(s, year);
      if (!months) continue;
      r.monthly += s.monthly;
      r.yearly += s.monthly * months;
      r[s.kind === 'modern' ? 'modern' : 'traditional'] += s.monthly;
      if (Number(s.start.slice(0, 4)) === year) r.starts.push(s);
      if (s.end && Number(s.end.slice(0, 4)) === year) r.ends.push(s);
    }
    return r;
  };
  const rows = [];
  for (let year = Math.max(fromYear, birthYear); year <= birthYear + END_AGE; year++) {
    rows.push({ year, age: year - birthYear, current: side(current, year), optimised: side(optimised, year) });
  }
  return rows;
}

// Headline figures: the highest monthly income on each side (and the first age it
// is reached), and the first stretch of ages where the optimised income meets the
// goal: goalMetFrom to goalMetUntil (null if never; goalMetUntil is the last row's
// age if it never drops back below).
function summary(rows, goal) {
  const best = key => rows.reduce((b, r) => r[key].monthly > b.monthly ? { monthly: r[key].monthly, age: r.age } : b,
    { monthly: 0, age: null });
  const start = goal > 0 ? rows.findIndex(r => r.optimised.monthly >= goal) : -1;
  let end = start;
  while (start >= 0 && end + 1 < rows.length && rows[end + 1].optimised.monthly >= goal) end++;
  return { current: best('current'), optimised: best('optimised'),
    goalMetFrom: start >= 0 ? rows[start].age : null, goalMetUntil: start >= 0 ? rows[end].age : null };
}

// Singapore phone numbers as 1234 5678 (+65 1234 5678 with the country code).
// Anything else (other country codes, longer numbers) is left as typed.
function phoneText(raw) {
  const typed = String(raw).trim();
  let digits = typed.replace(/\D/g, ''), prefix = '';
  if (typed.startsWith('+')) {
    if (!digits.startsWith('65')) return typed;
    prefix = '+65 ';
    digits = digits.slice(2);
  }
  if (digits.length > 8 || /[^\d\s+()-]/.test(typed)) return typed;
  return prefix + (digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits);
}

// A month typed as MM/YYYY (or M/YYYY): 'YYYY-MM', '' if blank, or null if it
// isn't a valid month.
function parseMonth(text) {
  const t = String(text).trim();
  if (!t) return '';
  const m = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(t);
  if (!m || +m[1] < 1 || +m[1] > 12) return null;
  return `${m[2]}-${m[1].padStart(2, '0')}`;
}

// While typing a month: digits only get the slash added after the month,
// so 122026 shows as 12/2026. Text that already has a slash is left alone.
function monthTyping(text) {
  if (String(text).includes('/')) return text;
  const digits = String(text).replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}
