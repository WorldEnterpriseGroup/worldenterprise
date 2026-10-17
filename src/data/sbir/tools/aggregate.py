#!/usr/bin/env python3 -I
"""Build-time aggregation for /sbir-sttr/ (WP-34, #83).

Reads the public SBIR.gov award data download (no-abstract CSV) and the NIH RePORTER success-rate table, and writes the small
aggregate module src/data/sbir/aggregates.ts. The raw files are NOT committed (they hold contact details); only counts, sums and
medians are kept. Run:  python3 -I aggregate.py <award_data_no_abstract.csv> <nih_table_215.xlsx> <out aggregates.ts> <retrieved-date>
"""
import csv, json, re, statistics, sys, collections, datetime

csv.field_size_limit(10**9)
SRC, NIH, OUT, RETRIEVED = sys.argv[1:5]

AGENCY_SHORT = {
    'Department of Defense': 'DoD',
    'Department of Health and Human Services': 'HHS',
    'National Aeronautics and Space Administration': 'NASA',
    'Department of Energy': 'DOE',
    'National Science Foundation': 'NSF',
    'Department of Agriculture': 'USDA',
    'Environmental Protection Agency': 'EPA',
    'Department of Commerce': 'DOC',
    'Department of Education': 'ED',
    'Department of Transportation': 'DOT',
    'Department of Homeland Security': 'DHS',
}
LAST_FULL_YEAR = 2025  # FY2025 is the last complete award year; FY2026 is partial in the file

def norm(name: str) -> str:
    n = re.sub(r'[^A-Z0-9 ]', '', name.upper())
    n = re.sub(r'\b(INC|LLC|CORP|CORPORATION|LTD|CO|COMPANY|LP|LLP|PLLC)\b', '', n)
    return re.sub(r'\s+', ' ', n).strip()

rows = []
with open(SRC, encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f):
        try:
            amt = float(r['Award Amount'])
            yr = int(r['Award Year'])
        except ValueError:
            continue
        uei = (r['UEI'] or '').strip()
        key = ('U' + uei) if uei else ('N' + norm(r['Company']))
        rows.append({
            'year': yr, 'amt': amt, 'agency': r['Agency'], 'phase': r['Phase'], 'prog': r['Program'],
            'key': key, 'name': 'N' + norm(r['Company']), 'date': r['Proposal Award Date'], 'state': r['State'].strip(),
        })

# Identify a company across name/UEI changes by name as well as UEI: first-seen year uses the earliest of either key.
first_year = {}
for r in rows:
    for k in (r['key'], r['name']):
        if k not in first_year or r['year'] < first_year[k]:
            first_year[k] = r['year']

out = {'retrieved': RETRIEVED, 'records': len(rows)}

# A. awards by year
by_year = collections.defaultdict(lambda: [0, 0.0])
for r in rows:
    if r['year'] <= LAST_FULL_YEAR:
        by_year[r['year']][0] += 1
        by_year[r['year']][1] += r['amt']
out['byYear'] = [{'year': y, 'awards': c, 'usdMillions': round(a / 1e6, 1)} for y, (c, a) in sorted(by_year.items())]

# B. agencies, FY2020-2024 pooled
lo, hi = 2020, 2024
ag = collections.defaultdict(lambda: {'n': 0, 'amt': 0.0, 'p1': [], 'p2': [], 'n1': 0, 'n2': 0, 'sttr': 0})
for r in rows:
    if r['agency'] in AGENCY_SHORT and lo <= r['year'] <= hi:
        a = ag[AGENCY_SHORT[r['agency']]]
        a['n'] += 1
        a['amt'] += r['amt']
        if r['prog'] == 'STTR':
            a['sttr'] += 1
        if r['phase'] == 'Phase I':
            a['p1'].append(r['amt']); a['n1'] += 1
        elif r['phase'].startswith('Phase II'):
            a['p2'].append(r['amt']); a['n2'] += 1
out['agencies'] = {'from': lo, 'to': hi, 'rows': sorted([
    {'agency': k, 'awards': v['n'], 'usdMillions': round(v['amt'] / 1e6, 1),
     'phase1Awards': v['n1'], 'phase2Awards': v['n2'], 'sttrAwards': v['sttr'],
     'phase1MedianUsd': round(statistics.median(v['p1'])) if v['p1'] else None,
     'phase2MedianUsd': round(statistics.median(v['p2'])) if v['p2'] else None}
    for k, v in ag.items()], key=lambda x: -x['usdMillions'])}

# B2. DoD/HHS/etc shares by year for the stacked trend (2015-2025)
trend = collections.defaultdict(lambda: collections.defaultdict(float))
for r in rows:
    if r['agency'] in AGENCY_SHORT and 2015 <= r['year'] <= LAST_FULL_YEAR:
        trend[r['year']][AGENCY_SHORT[r['agency']]] += r['amt']
out['agencyTrend'] = [{'year': y, 'usdMillions': {k: round(v / 1e6, 1) for k, v in sorted(d.items())}} for y, d in sorted(trend.items())]

# C. first-time awardees: share of Phase I awards in a year to a company whose first award (any phase) is that year
c = collections.defaultdict(lambda: [0, 0])
for r in rows:
    if r['phase'] == 'Phase I' and 2000 <= r['year'] <= LAST_FULL_YEAR:
        fy = min(first_year[r['key']], first_year[r['name']])
        c[r['year']][0] += 1
        if fy == r['year']:
            c[r['year']][1] += 1
out['firstTime'] = [{'year': y, 'phase1Awards': t, 'toFirstTime': f, 'percent': round(100 * f / t, 1)} for y, (t, f) in sorted(c.items())]

# D. states, FY2015-2024 pooled
st = collections.defaultdict(lambda: [0, 0.0])
for r in rows:
    if 2015 <= r['year'] <= 2024 and r['state']:
        st[r['state']][0] += 1
        st[r['state']][1] += r['amt']
tot_n = sum(v[0] for v in st.values())
STATES_LISTED = 25
ranked = sorted(st.items(), key=lambda kv: -kv[1][0])
listed = [{'state': k, 'awards': v[0], 'usdMillions': round(v[1] / 1e6, 1)} for k, v in ranked[:STATES_LISTED]]
rest = ranked[STATES_LISTED:]
listed.append({'state': 'All other states and territories', 'awards': sum(v[0] for _, v in rest), 'usdMillions': round(sum(v[1] for _, v in rest) / 1e6, 1)})
out['states'] = {'from': 2015, 'to': 2024, 'total': tot_n, 'distinct': len(st), 'listed': STATES_LISTED, 'rows': listed}

# E. time from a company's first Phase I to its first Phase II (months), companies with both, first Phase I 2000-2018
p1 = {}; p2 = {}
for r in rows:
    if not r['date'] or r['phase'] == 'Phase II – Direct to Phase II':
        continue
    k = r['name']
    if r['phase'] == 'Phase I':
        if k not in p1 or r['date'] < p1[k]: p1[k] = r['date']
    elif r['phase'] == 'Phase II':
        if k not in p2 or r['date'] < p2[k]: p2[k] = r['date']
def months(a, b):
    da = datetime.date.fromisoformat(a[:10]); db = datetime.date.fromisoformat(b[:10])
    return (db - da).days / 30.4375
gaps = []
cohort_n = 0
for k, d1 in p1.items():
    if '2010' <= d1[:4] <= '2019':
        cohort_n += 1
        if k in p2 and p2[k] >= d1:
            gaps.append(months(d1, p2[k]))
buckets = [('Within 1 year', 0, 12), ('1 to 2 years', 12, 24), ('2 to 3 years', 24, 36), ('3 to 5 years', 36, 60), ('More than 5 years', 60, 10**6)]
out['phaseGap'] = {
    'cohortFrom': 2010, 'cohortTo': 2019, 'companiesWithPhaseI': cohort_n, 'companiesWithLaterPhaseII': len(gaps),
    'medianMonths': round(statistics.median(gaps), 1),
    'buckets': [{'label': l, 'companies': sum(1 for g in gaps if lo_ <= g < hi_)} for l, lo_, hi_ in buckets]}

# F. companies by number of awards (all years) and share of dollars
cnt = collections.Counter(); money = collections.defaultdict(float)
for r in rows:
    cnt[r['name']] += 1; money[r['name']] += r['amt']
groups = [('1 award', 1, 1), ('2 to 4 awards', 2, 4), ('5 to 9 awards', 5, 9), ('10 or more awards', 10, 10**6)]
total_money = sum(money.values())
out['repeat'] = {'companies': len(cnt), 'rows': [
    {'label': l, 'companies': sum(1 for k, n in cnt.items() if a <= n <= b),
     'dollarSharePercent': round(100 * sum(money[k] for k, n in cnt.items() if a <= n <= b) / total_money, 1)} for l, a, b in groups]}

# G. monthly awards, by Proposal Award Date, Jan 2024 onward
m = collections.Counter()
for r in rows:
    if r['date'] >= '2024-01':
        m[r['date'][:7]] += 1
out['monthly'] = [{'month': k, 'awards': v} for k, v in sorted(m.items())]

# H. NIH success rates
import openpyxl
ws = openpyxl.load_workbook(NIH, data_only=True)['Table #215']
acc = collections.defaultdict(lambda: {'p1': [0, 0], 'p2': [0, 0]})
for row in ws.iter_rows(min_row=3, values_only=True):
    fy, prog, phase, rev, awd = row[:5]
    if not isinstance(fy, int) or prog not in ('SBIR', 'STTR'):
        continue
    if phase == 'Phase I':
        acc[fy]['p1'][0] += rev; acc[fy]['p1'][1] += awd
    elif phase == 'Phase II - Regular':
        acc[fy]['p2'][0] += rev; acc[fy]['p2'][1] += awd
out['nih'] = [{'fy': fy, 'phase1Reviewed': v['p1'][0], 'phase1Awarded': v['p1'][1],
               'phase1Percent': round(100 * v['p1'][1] / v['p1'][0], 1),
               'phase2Reviewed': v['p2'][0] or None, 'phase2Awarded': v['p2'][1] or None,
               'phase2Percent': round(100 * v['p2'][1] / v['p2'][0], 1) if v['p2'][0] else None}
              for fy, v in sorted(acc.items())]

# totals
out['cumulative'] = {'awards': sum(x['awards'] for x in out['byYear']), 'usdBillions': round(sum(x['usdMillions'] for x in out['byYear']) / 1000, 1),
                     'fromYear': out['byYear'][0]['year'], 'toYear': LAST_FULL_YEAR}
with open(OUT, 'w') as f:
    f.write("// Generated by tools/aggregate.py from the SBIR.gov award data and NIH Table 215. Do not edit by hand.\n")
    f.write("import type { Aggregates } from './types.ts';\n\n")
    f.write('export const AGGREGATES: Aggregates = ' + json.dumps(out, indent=2) + ';\n')
print('wrote', OUT, len(rows), 'records')
