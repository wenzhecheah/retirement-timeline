# Retirement Timeline

A Voyage Wealth Advisory tool that lays out a client's retirement income year by
year, side by side: **Current** (CPF LIFE only) and **Optimised** (CPF LIFE plus
every investment portfolio, annuity or pot that pays a monthly income), against
the goal of 75% of current monthly income.

Open `index.html` in a browser. There is no install or build step, and nothing
entered leaves the browser unless you save the client file.

## How it works

- **Traditional retirement (drawdown)** pays for **needs**: a sum that is drawn
  down with every payout, like CPF LIFE or an annuity. It comes first.
- **Modern retirement (capital kept)** pays for **wants**: investments or
  dividends that pay a monthly income while the capital stays invested.

## How to use it

1. Enter the client's details and current monthly income. The goal is 75% of
   it (change the % per client, or the default in `config.js`).
2. **Current: CPF LIFE**: the retirement sum tier, the monthly payout (from
   CPF's Monthly Payout Estimator or the CPF Forecast Calculator) and the age
   payouts start. It appears on both sides.
3. **Optimised**: add each income source one at a time: name, Traditional or
   Modern, the month its payout starts and ends as MM/YYYY (blank end:
   lifelong) and the
   monthly payout as shown in its own illustration. Edit or remove them in the
   list.
4. The report shows the goal, the highest income on each side, the ages the
   goal is met, a chart of monthly income by age (CPF LIFE, other Traditional,
   Modern, and the goal line), and the year-by-year timeline.
5. **Print / Save as PDF** (A4 landscape): the summary and chart, then the
   timeline in the Excel template's colours.
6. **Save client file** / **Open client file** to keep a client and update it at
   the next review. Keep these files private: they hold the client's personal data.

Each row is a calendar year. Monthly is everything paying that year; yearly
counts each payout only for the months it pays that year. CPF LIFE starts in the
client's birthday month in the year they reach the start age.

## Settings

Edit `config.js`: `ADVISER` (your name and mobile for every new client),
`DISCLAIMER`, `GOAL_PERCENT`, `CPF_TIERS`, `CPF_START_AGE`, `END_AGE` (the
timeline's last age) and `SOURCE_KINDS`.

## Code

- `engine.js`: all calculations (no page code), tested in `tests/`.
- `app.js`: the form, the report and chart, and saving and opening client files.
- `style.css`: the shared VWA styles, with Retirement Timeline additions at the end.

Run the tests (Node 18 or later):

```
node --test
```

## Limits

An illustration, not advice. Payouts are taken as keyed in (no inflation or
investment growth is applied), and lump sums aren't included.
