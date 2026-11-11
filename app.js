// The page: reads the form, shows the report, saves and opens client files.
const byId = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const money = n => n.toLocaleString('en-SG', { style: 'currency', currency: 'SGD' }); // $1,234.56
const amount = n => n ? money(n) : '–';
// 'YYYY-MM-DD' as dd/mm/yyyy, and 'YYYY-MM' as mm/yyyy.
const dateLabel = s => { if (!s) return '–'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const monthLabel = s => { if (!s) return '–'; const [y, m] = s.split('-'); return `${m}/${y}`; };
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const kindLabel = key => SOURCE_KINDS.find(k => k.key === key)?.label.split(' (')[0] ?? 'Traditional';

const newClient = () => ({ ...blankClient(), preparedOn: today(), adviserName: ADVISER.name, adviserMobile: phoneText(ADVISER.mobile) });
let state = { client: newClient(), sources: [] };
let unsaved = false;
// The income source being entered or edited. It joins the list (and the report)
// only when added; `editing` is its index in the list when editing one.
let draft = blankSource(), editing = null, draftChanged = false;

// A form value, stored as the same kind of value as the blank one.
const parse = (blankValue, raw) => fit({ v: blankValue }, { v: raw }).v;
const shown = v => v === 0 || v === null ? '' : v;
// Amount fields (data-amount) take '$1,234.56' or '1234.56'; NaN if not a
// valid amount. They show as $x,xxx.xx once the user leaves the field.
const toAmount = raw => { const t = raw.replace(/[$,\s]/g, ''); return t === '' ? 0 : /^\d*\.?\d*$/.test(t) ? Number(t) : NaN; };
const amountText = n => n ? money(n) : '';

// ---- Form ----
byId('cpf-tier').innerHTML = CPF_TIERS.map(t => `<option>${esc(t)}</option>`).join('');

function fillClient() {
  for (const el of document.querySelectorAll('[data-client]')) {
    const v = state.client[el.dataset.client];
    el.value = 'amount' in el.dataset ? amountText(v) : 'phone' in el.dataset ? phoneText(v) : el.tagName === 'SELECT' ? v : shown(v);
  }
}

function sourceForm(s) {
  const options = (list, sel) => list.map(([v, label]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(label)}</option>`).join('');
  return `<div class="panel panel-optimised">
    <fieldset>
      <legend>${editing === null ? 'Optimised: add an income source' : `Edit income source ${editing + 1}`}</legend>
      <p class="hint">Each investment portfolio, annuity or pot that pays a monthly income. Key in its payout as shown in its
        own illustration. Traditional income (drawdown) pays for needs and comes first; Modern income (capital kept
        invested) pays for wants.</p>
      <div class="grid4">
        <label>Name <input type="text" data-field="name" autocomplete="off" value="${esc(s.name)}" placeholder="e.g. Annuity payout"></label>
        <label>Type <select data-field="kind">${options(SOURCE_KINDS.map(k => [k.key, k.label]), s.kind)}</select></label>
        <label>Payout starts <input type="text" inputmode="numeric" autocomplete="off" placeholder="MM/YYYY" maxlength="7" data-field="start" data-month value="${esc(s.start ? monthLabel(s.start) : '')}"></label>
        <label>Payout ends <span class="hint">(blank: lifelong)</span> <input type="text" inputmode="numeric" autocomplete="off" placeholder="MM/YYYY" maxlength="7" data-field="end" data-month value="${esc(s.end ? monthLabel(s.end) : '')}"></label>
        <label>Monthly payout <input type="text" inputmode="decimal" autocomplete="off" placeholder="$0.00" data-field="monthly" data-amount value="${esc(amountText(s.monthly))}"></label>
        <label>Notes <input type="text" data-field="notes" autocomplete="off" value="${esc(s.notes)}" placeholder="e.g. guaranteed"></label>
      </div>
      <p class="error" id="source-error" role="alert"></p>
      <div class="form-actions">
        <button type="button" data-action="save">${editing === null ? 'Add income source' : 'Save changes'}</button>
        ${editing === null ? '' : '<button type="button" class="secondary" data-action="cancel">Cancel</button>'}
      </div>
    </fieldset>
  </div>`;
}

const table = (head, rows, empty) =>
  `<thead><tr>${head.map(([label, cls = '']) => `<th class="${cls}">${label}</th>`).join('')}</tr></thead>
   <tbody>${rows || `<tr><td class="l" colspan="${head.length}">${empty}</td></tr>`}</tbody>`;

function sourceList() {
  const rows = state.sources.map((s, i) => `<tr${i === editing ? ' class="editing"' : ''}>
    <td>${i + 1}</td><td class="l">${esc(s.name)}</td><td class="l">${esc(kindLabel(s.kind))}</td>
    <td class="l">${monthLabel(s.start)}</td><td class="l">${s.end ? monthLabel(s.end) : 'Lifelong'}</td><td>${amount(s.monthly)}</td>
    <td class="row-actions"><button type="button" data-edit="${i}" aria-label="Edit ${esc(s.name)}">Edit</button>
      <button type="button" class="remove" data-remove="${i}" aria-label="Remove ${esc(s.name)}">Remove</button></td></tr>`).join('');
  return table([['#'], ['Name', 'l'], ['Type', 'l'], ['Starts', 'l'], ['Ends', 'l'], ['Monthly payout'], ['', 'l']], rows,
    'No income sources yet. Fill in the form above and press Add income source.');
}

function renderSources() {
  byId('source-form').innerHTML = sourceForm(draft);
  byId('source-list').innerHTML = sourceList();
}

function resetDraft() {
  draft = blankSource();
  editing = null;
  draftChanged = false;
}
const discardDraftOk = () => !draftChanged || confirm('Discard the income source in the form? It hasn\'t been added.');

byId('form').addEventListener('input', e => {
  const el = e.target;
  // Phone fields: space as 1234 5678 while typing at the end (not mid-edit, so the cursor doesn't jump).
  if ('phone' in el.dataset && el.selectionStart === el.value.length) el.value = phoneText(el.value);
  // Amount fields: flag anything that isn't an amount, and store 0 for it.
  let value = el.value;
  if ('amount' in el.dataset) {
    const n = toAmount(value);
    el.setAttribute('aria-invalid', String(Number.isNaN(n)));
    value = Number.isNaN(n) ? 0 : n;
  }
  // Month fields: typed as MM/YYYY (the slash added while typing at the end), stored as
  // YYYY-MM; anything that isn't a month is flagged and stored blank.
  if ('month' in el.dataset) {
    if (el.selectionStart === el.value.length) el.value = monthTyping(el.value);
    const ym = parseMonth(el.value);
    el.setAttribute('aria-invalid', String(ym === null));
    value = ym ?? '';
  }
  if (el.dataset.client) {
    state.client[el.dataset.client] = parse(blankClient()[el.dataset.client], value);
    unsaved = true;
    renderReport();
  } else if (el.dataset.field) {
    // The draft only reaches the report once it is added.
    draft[el.dataset.field] = parse(blankSource()[el.dataset.field], value);
    draftChanged = true;
  }
});

// Leaving an amount field shows it as $x,xxx.xx (unless it isn't a valid amount).
byId('form').addEventListener('focusout', e => {
  const el = e.target;
  if ('phone' in el.dataset) {
    el.value = phoneText(el.value);
    state.client[el.dataset.client] = el.value;
    renderReport();
  }
  if ('month' in el.dataset) {
    const ym = parseMonth(el.value);
    if (ym) el.value = monthLabel(ym); // 1/2030 shows as 01/2030
    return;
  }
  if (!('amount' in el.dataset)) return;
  const n = toAmount(el.value);
  if (!Number.isNaN(n)) el.value = amountText(n);
});

function sourceProblem(s) {
  if (!s.name.trim()) return ['name', 'Enter a name for the income source.'];
  const bad = byId('source-form').querySelector('[aria-invalid="true"]');
  if (bad && 'month' in bad.dataset) return [bad.dataset.field, 'Enter months as MM/YYYY, like 12/2026.'];
  if (bad) return ['monthly', 'Fix the monthly payout: use numbers only, like 1500.'];
  if (!(s.monthly > 0)) return ['monthly', 'Enter the monthly payout.'];
  if (!s.start) return ['start', 'Enter the month the payout starts.'];
  if (s.end && s.end < s.start) return ['end', 'The payout can\'t end before it starts.'];
  return null;
}

byId('source-form').addEventListener('click', e => {
  const action = e.target.dataset.action;
  if (action === 'save') {
    const problem = sourceProblem(draft);
    if (problem) {
      byId('source-error').textContent = problem[1];
      byId('source-form').querySelector(`[data-field="${problem[0]}"]`).focus();
      return;
    }
    if (editing === null) state.sources.push(draft);
    else state.sources[editing] = draft;
    unsaved = true;
  } else if (action !== 'cancel') return;
  resetDraft();
  renderSources();
  renderReport();
  byId('source-form').querySelector('input').focus();
});

byId('source-list').addEventListener('click', e => {
  const { edit, remove } = e.target.dataset;
  if (edit !== undefined) {
    if (!discardDraftOk()) return;
    draft = { ...state.sources[+edit] };
    editing = +edit;
    draftChanged = false;
    renderSources();
    byId('source-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    byId('source-form').querySelector('input').focus({ preventScroll: true });
  } else if (remove !== undefined) {
    const i = +remove;
    if (!confirm(`Remove ${state.sources[i].name}?`)) return;
    state.sources.splice(i, 1);
    if (editing === i) resetDraft();
    else if (editing > i) editing--;
    unsaved = true;
    renderSources();
    renderReport();
  }
});

// ---- Client files ----
const discardOk = () => !(unsaved || draftChanged) || confirm('The current client has unsaved changes. Discard them?');

function show(newState) {
  state = newState;
  unsaved = false;
  resetDraft();
  byId('file-error').textContent = '';
  fillClient();
  renderSources();
  renderReport();
}

byId('new-client').addEventListener('click', () => { if (discardOk()) show({ client: newClient(), sources: [] }); });
byId('open-client').addEventListener('click', () => { if (discardOk()) byId('open-file').click(); });

byId('open-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = ''; // so the same file can be opened again
  if (!file) return;
  try {
    show(readClientFile(JSON.parse(await file.text())));
  } catch (err) {
    byId('file-error').textContent = `Couldn't open ${file.name}: ${err instanceof SyntaxError ? 'it is not a client file.' : err.message}`;
  }
});

byId('save-client').addEventListener('click', () => {
  if (draftChanged && !confirm('The income source in the form hasn\'t been added, so it won\'t be in the file. Save anyway?')) return;
  const blob = new Blob([JSON.stringify(clientFile(state.client, state.sources), null, 2)], { type: 'application/json' });
  const slug = state.client.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `retirement-timeline-${slug}-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  unsaved = false;
});

byId('print').addEventListener('click', () => window.print());

window.addEventListener('beforeunload', e => { if (unsaved || draftChanged) e.preventDefault(); });

// ---- Report ----

// Monthly income by age: stacked bars (CPF LIFE, other Traditional, Modern) for the
// optimised side, with the goal as a dashed line.
function chartSVG(rows, goal) {
  const W = 1000, H = 300, L = 70, R = 10, T = 12, B = 34;
  const cpfOf = r => r.current.monthly;
  const max = Math.max(goal, ...rows.map(r => r.optimised.monthly), 1) * 1.1;
  const step = 10 ** Math.floor(Math.log10(max / 4)), tick = [1, 2, 2.5, 5, 10].map(m => m * step).find(t => max / t <= 6);
  const y = v => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - R) / rows.length;
  const grid = [];
  for (let v = 0; v <= max; v += tick) {
    grid.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${money(v).replace('.00', '')}</text>`);
  }
  const bars = rows.map((r, i) => {
    const x = L + i * bw + bw * 0.12, w = bw * 0.76;
    const cpf = cpfOf(r), trad = r.optimised.traditional - cpf, mod = r.optimised.modern;
    const seg = (cls, from, v) => v > 0 ? `<rect class="${cls}" x="${x}" y="${y(from + v)}" width="${w}" height="${y(from) - y(from + v)}"/>` : '';
    return `<g><title>Age ${r.age} (${r.year}): ${money(r.optimised.monthly)} a month</title>
      ${seg('c-cpf', 0, cpf)}${seg('c-trad', cpf, trad)}${seg('c-mod', cpf + trad, mod)}
      <rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>
      ${r.age % 5 === 0 ? `<text class="axis" x="${x + w / 2}" y="${H - B + 16}" text-anchor="middle">${r.age}</text>` : ''}</g>`;
  }).join('');
  const goalLine = goal > 0 ? `<line class="goal-line" x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}"/>
    <text class="goal-label" x="${W - R}" y="${y(goal) - 6}" text-anchor="end">Goal ${money(goal)}/mth</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly retirement income by age">${grid.join('')}${bars}${goalLine}
      <text class="axis" x="${(L + W) / 2}" y="${H - 2}" text-anchor="middle">Age</text></svg>
    <div class="legend"><span><i class="c-cpf"></i>CPF LIFE</span><span><i class="c-trad"></i>Other Traditional (needs)</span>
      <span><i class="c-mod"></i>Modern (wants)</span>${goal > 0 ? '<span><i class="c-goal"></i>Goal</span>' : ''}</div>`;
}

// What starts or ends in a year, e.g. "Annuity payout: +$2,000.00/mth".
const events = side => [
  ...side.starts.map(s => `<div>${esc(s.name)}: <strong>+${money(s.monthly)}/mth</strong>${s.notes ? ` <span class="tag">${esc(s.notes)}</span>` : ''}</div>`),
  ...side.ends.map(s => `<div>${esc(s.name)} ends: <strong>−${money(s.monthly)}/mth</strong> after ${monthLabel(s.end)}</div>`),
].join('');
const starts = side => [...side.starts.map(s => monthLabel(s.start)), ...side.ends.map(s => monthLabel(s.end))].join('<br>');

// The printed timeline, laid out like the Excel template's RETIREMENT TIMELINE sheet:
// CURRENT (yellow) and OPTIMISED (green) side by side, each with its own Age, Year,
// Policy Name, Payout Date, Lump Sum and Regular Payout columns, an "ADD $X/MTH"
// note beside each change, and the goal (pink) between them.
function excelSheet(rows, goal, client, peak, foot) {
  const cash = n => n ? money(n) : '-';
  // Numbered like the template: 1) CPF LIFE (FRS) 2) Last retirement pot.
  const names = side => [...side.starts.map(s => s.name), ...side.ends.map(s => `${s.name} ends`)]
    .map((n, i) => `<span class="x-pol">${i + 1}) ${esc(n)}</span>`).join('<br>') || '-';
  const dates = side => [...side.starts.map(s => monthLabel(s.start)), ...side.ends.map(s => monthLabel(s.end))].join('<br>') || '-';
  const notes = side => [...side.starts.map(s => `ADD ${money(s.monthly)}/MTH`), ...side.ends.map(s => `LESS ${money(s.monthly)}/MTH`)].join('<br>');
  const half = (side, cls) => `<td>${side.age}</td><td>${side.year}</td><td class="x-name ${cls}">${names(side.s)}</td>
    <td>${dates(side.s)}</td><td>-</td><td class="${cls}">${cash(side.s.yearly)}</td><td class="${cls}">${cash(side.s.monthly)}</td>
    <td class="x-note">${notes(side.s)}</td>`;
  const heads = ['Age', 'Year', 'Policy Name', 'Payout Date', 'Lump Sum Payout', 'Regular Payout (Yearly)', 'Regular Payout (Monthly)']
    .map(h => `<th class="x-head">${h}</th>`).join('');
  const pct = +client.goalPercent.toFixed(2);
  return `<p class="x-title">Retirement Timeline${client.name ? ` for ${esc(client.name)}` : ''}${client.preparedOn ? `\nPrepared on ${dateLabel(client.preparedOn)}` : ''}</p>
    <div class="x-retire">
      <span class="x-label">TRADITIONAL RETIREMENT (needs):</span><span class="x-value">${peak ? `${money(peak.optimised.traditional)}/MTH` : '-'}</span>
      <span class="x-label">MODERN RETIREMENT (wants):</span><span class="x-value">${peak ? `${money(peak.optimised.modern)}/MTH` : '-'}</span>
    </div>
    <table class="x-sheet">
      <thead>
        <tr><th class="x-current x-big" colspan="7">CURRENT</th><th colspan="2"></th><th class="x-optimised x-big" colspan="7">OPTIMISED</th><th></th></tr>
        <tr><th class="x-payout x-big" colspan="7">Retirement Payout</th>
          <th class="x-goal" colspan="2">THE GOAL (${pct}%) &rarr;<br>${goal ? `${money(goal)}/MTH` : '-'}</th>
          <th class="x-payout x-big" colspan="7">Retirement Payout</th><th></th></tr>
        <tr>${heads}<th></th><th></th>${heads}<th></th></tr>
      </thead>
      <tbody>${rows.map(r => `<tr>${half({ age: r.age, year: r.year, s: r.current }, 'x-cur')}<td class="x-gap"></td>
        ${half({ age: r.age, year: r.year, s: r.optimised }, 'x-opt')}</tr>`).join('')}</tbody>
    </table>
    <p class="x-foot">${esc(foot)}</p>`;
}

function renderReport() {
  const { client, sources } = state;
  const goal = goalMonthly(client);
  const rows = timeline(client, sources, new Date().getFullYear());
  const sum = summary(rows, goal);

  byId('report-title').textContent = `Retirement Timeline${client.name ? ` for ${client.name}` : ''}`;
  byId('report-date').textContent = client.preparedOn ? `Prepared on ${dateLabel(client.preparedOn)}` : '';

  const card = (label, value, cls = '') => `<div class="card ${cls}"><div class="card-label">${label}</div><div class="card-value">${value}</div></div>`;
  const best = b => b.monthly ? `${money(b.monthly)}/mth <span class="card-sub">from age ${b.age}</span>` : '–';
  byId('summary-cards').innerHTML = [
    card(`The goal (${+client.goalPercent.toFixed(2)}% of ${money(client.monthlyIncome)})`, goal ? `${money(goal)}/mth` : '–', 'goal'),
    card('Current: CPF LIFE', best(sum.current), 'current'),
    card('Optimised: highest', best(sum.optimised), 'optimised'),
    card('Goal met', !goal || !rows.length ? '–'
      : sum.goalMetFrom === null ? `Not yet: ${money(goal - sum.optimised.monthly)}/mth short at best`
      : sum.goalMetUntil === rows.at(-1).age ? `From age ${sum.goalMetFrom}`
      : `Age ${sum.goalMetFrom} to ${sum.goalMetUntil} <span class="card-sub">then short again</span>`,
      sum.goalMetFrom !== null ? 'met' : 'short'),
  ].join('');

  // Needs first: does Traditional income alone cover the client's needs?
  const peak = rows.find(r => r.age === sum.optimised.age);
  byId('needs-note').textContent = peak
    ? `At age ${peak.age}: Traditional income (needs) ${money(peak.optimised.traditional)}/mth, Modern income (wants) ${money(peak.optimised.modern)}/mth.`
    : '';

  byId('chart').innerHTML = rows.length
    ? chartSVG(rows, goal)
    : '<p class="hint">Enter the client\'s date of birth to see the timeline.</p>';

  // Current and Optimised side by side, as in the Excel template.
  const head = `<thead>
      <tr><th class="g-year" rowspan="2">Age</th><th class="g-year" rowspan="2">Year</th>
        <th class="g-current" colspan="4">Current</th><th class="g-optimised" colspan="7">Optimised</th></tr>
      <tr><th class="g-current">Income source</th><th class="g-current">Payout date</th><th class="g-current">Regular payout (yearly)</th><th class="g-current">Regular payout (monthly)</th>
        <th class="g-optimised">Income source</th><th class="g-optimised">Payout date</th><th class="g-optimised">Traditional (needs) / mth</th>
        <th class="g-optimised">Modern (wants) / mth</th><th class="g-optimised">Regular payout (yearly)</th><th class="g-optimised">Regular payout (monthly)</th>
        <th class="g-optimised">Vs goal${goal ? ` (${money(goal)}/mth)` : ''}</th></tr></thead>`;
  const vsGoal = m => !goal ? '–' : m >= goal ? '<span class="ok">Met</span>' : `<span class="short">${money(goal - m)} short</span>`;
  const body = rows.map(r => `<tr class="${r.optimised.starts.length || r.optimised.ends.length ? 'event' : ''}">
      <td>${r.age}</td><td>${r.year}</td>
      <td class="l src">${events(r.current)}</td><td>${starts(r.current)}</td><td>${amount(r.current.yearly)}</td><td>${amount(r.current.monthly)}</td>
      <td class="l src">${events(r.optimised)}</td><td>${starts(r.optimised)}</td><td>${amount(r.optimised.traditional)}</td>
      <td>${amount(r.optimised.modern)}</td><td>${amount(r.optimised.yearly)}</td><td><strong>${amount(r.optimised.monthly)}</strong></td>
      <td>${vsGoal(r.optimised.monthly)}</td></tr>`).join('');
  byId('timeline-table').innerHTML = head + `<tbody>${body || '<tr><td class="l" colspan="13">Enter the client\'s date of birth to see the timeline.</td></tr>'}</tbody>`
    + (rows.length ? '<tfoot><tr class="note"><td colspan="13"><div>Monthly: everything paying that year. Yearly: each payout for the months it pays that year, so a payout starting mid-year counts only from its first month.</div></td></tr></tfoot>' : '');

  const by = [client.adviserName, client.adviserMobile && `M: ${phoneText(client.adviserMobile)}`].filter(Boolean).join('\n');
  const foot = `${by ? `Prepared by:\n${by}\n\n` : ''}${DISCLAIMER}`;
  byId('report-foot').textContent = foot;
  byId('excel-sheet').innerHTML = rows.length ? excelSheet(rows, goal, client, peak, foot) : '';
}

fillClient();
renderSources();
renderReport();
