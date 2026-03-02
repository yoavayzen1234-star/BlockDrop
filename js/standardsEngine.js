import { STANDARDS_CATALOG } from './standardsCatalog.js';

const HEBREW_FINALS = new Map([['ך', 'כ'], ['ם', 'מ'], ['ן', 'נ'], ['ף', 'פ'], ['ץ', 'צ']]);

function normalizeHebrew(input) {
  if (!input) return '';
  let s = String(input).toLowerCase()
    .replace(/["״]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/ממ["״]ד/g, 'ממד');
  s = Array.from(s).map(ch => (HEBREW_FINALS.get(ch) || ch)).join('');
  s = s.replace(/[^\p{L}\p{N}\s./-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function tokenize(input) {
  const s = normalizeHebrew(input);
  return s ? s.split(' ').filter(Boolean) : [];
}

function trigrams(s) {
  const n = normalizeHebrew(s).replace(/\s+/g, ' ');
  if (n.length < 3) return new Set([n]);
  const set = new Set();
  for (let i = 0; i < n.length - 2; i++) set.add(n.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlight(text, queryTokens) {
  if (!text) return '';
  const raw = String(text);
  if (!queryTokens || queryTokens.length === 0) return escapeHtml(raw);
  const tokens = queryTokens.map(t => t.trim()).filter(t => t.length >= 2).slice(0, 12);
  if (tokens.length === 0) return escapeHtml(raw);
  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return escapeHtml(raw).replace(re, '<mark>$1</mark>');
}

function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (typeof value !== 'number') return null;
  if (fromUnit === 'm' && toUnit === 'cm') return value * 100;
  if (fromUnit === 'cm' && toUnit === 'm') return value / 100;
  return null;
}

function formatRuleValue(rule, preferUnit = null) {
  const { value, unit, op } = rule;
  const u = preferUnit && (preferUnit === unit || convertUnit(1, unit, preferUnit) != null) ? preferUnit : unit;
  const fmtNumber = (n) => (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''));
  const fmtUnit = (uu) => (uu === 'm' ? "מ'" : uu === 'm2' ? 'מ"ר' : uu === 'cm' ? 'ס"מ' : uu);
  const fmtOp = (o) => (!o ? '' : o === '>=' ? 'מינ׳' : o === '<=' ? 'מקס׳' : o === 'range' ? 'טווח' : o);
  if (typeof value === 'number') {
    const converted = u === unit ? value : convertUnit(value, unit, u);
    const v = converted == null ? value : converted;
    return (fmtOp(op) ? fmtOp(op) + ': ' : '') + fmtNumber(v) + ' ' + fmtUnit(u);
  }
  if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
    const a = u === unit ? value.min : convertUnit(value.min, unit, u) ?? value.min;
    const b = u === unit ? value.max : convertUnit(value.max, unit, u) ?? value.max;
    return (fmtOp(op) ? fmtOp(op) + ': ' : '') + fmtNumber(a) + '–' + fmtNumber(b) + ' ' + fmtUnit(u);
  }
  if (value && typeof value === 'object' && 'w' in value && 'h' in value)
    return fmtNumber(value.w) + '×' + fmtNumber(value.h) + ' ' + fmtUnit(u);
  return escapeHtml(JSON.stringify(value));
}

function detectPreferredUnit(q) {
  const n = normalizeHebrew(q);
  if (/(ס"מ|סמ|cm)\b/.test(n)) return 'cm';
  if (/(מ"ר|m2)\b/.test(n)) return 'm2';
  if (/(מ'|מטר|m)\b/.test(n)) return 'm';
  return null;
}

function buildIndex(entries) {
  return entries.map(e => {
    const hay = [e.title, ...(e.aliases || []), ...(e.tags || []), e.text, ...(e.rules || []).map(r => r.label + ' ' + r.unit)].join(' | ');
    return { entry: e, normTitle: normalizeHebrew(e.title), normHay: normalizeHebrew(hay), triTitle: trigrams(e.title), triHay: trigrams(hay) };
  });
}

function scoreEntry(qTokens, qNorm, qTri, idx) {
  if (!qNorm) return 0;
  let score = 0;
  const tokenHits = qTokens.reduce((acc, t) => acc + (idx.normHay.includes(t) ? 1 : 0), 0);
  score += tokenHits * 8;
  const titleHits = qTokens.reduce((acc, t) => acc + (idx.normTitle.includes(t) ? 1 : 0), 0);
  score += titleHits * 18;
  if (idx.normTitle.includes(qNorm)) score += 60;
  if (idx.normHay.includes(qNorm)) score += 25;
  const sim = Math.max(jaccard(qTri, idx.triTitle), jaccard(qTri, idx.triHay));
  score += sim * 40;
  return score;
}

function parseQuickFactQuery(query, entries) {
  const q = normalizeHebrew(query);
  if (!q) return null;
  if (q === 'הכל' || q === 'כל התקנים' || q === 'כל התקנים הישראלים') return { kind: 'list_all' };
  const wants = {
    head_clearance: [{ test: /מזקף|גובה.*תקרה|תקרה.*מינימום/, key: 'stairsHeadClearanceM' }, { test: /מגורים|סלון/, key: 'livingRoomsM' }, { test: /מטבח.*קטן/, key: 'smallKitchenM' }, { test: /שירות.*גובה|מסדרון.*גובה/, key: 'bathCorridorM' }, { test: /מרתף/, key: 'basementM' }, { test: /ציבור|משרד/, key: 'publicOfficesM' }],
    corridor: [{ test: /מסדרון.*ציבור/, key: 'publicMinWidthM' }, { test: /משרד/, key: 'officeMinWidthM' }, { test: /נתיב.*מילוט|מילוט/, key: 'egressMinWidthM' }],
    doors: [{ test: /דלת.*ממ[דd]/, key: 'mmadDoorClearWidthM' }, { test: /דלת.*מילוט/, key: 'egressDoorClearWidthM' }, { test: /גובה.*דלת/, key: 'minHeightM' }],
    mmad: [{ test: /ממד.*שטח|שטח.*ממד/, key: 'minAreaM2' }, { test: /ממד.*רוחב/, key: 'minWidthM' }, { test: /ממד.*גובה|תקרה.*ממד/, key: 'minCeilingHeightM' }, { test: /קיר|בטון/, key: 'wallThicknessCm' }],
    stairs: [{ test: /מזקף.*מדרג|מדרג.*מזקף/, key: 'headClearanceM' }, { test: /רום/, key: 'maxRiserCm' }, { test: /שלח/, key: 'minTreadCm' }, { test: /רוחב.*מדרג/, key: 'minWidthM' }, { test: /מעקה/, key: 'handrailHeightCm' }],
    accessibility_wc: [{ test: /תא.*נגיש|שירותים.*נגיש/, key: 'minSizeM' }, { test: /סיבוב|קוטר/, key: 'turningDiameterM' }, { test: /דלת.*נגיש/, key: 'doorClearWidthM' }],
    accessible_parking: [{ test: /חניה.*נגיש|חניית.*נכה/, key: 'minWidthStandardM' }, { test: /מעלון/, key: 'minWidthWithLiftM' }],
    fire_access: [{ test: /רכב.*כיבוי|כיבוי|כבאים/, key: 'minWidthNetM' }]
  };
  const byId = Object.fromEntries(entries.map(e => [e.id, e]));
  for (const [id, rules] of Object.entries(wants)) {
    const entry = byId[id];
    if (!entry) continue;
    for (const w of rules) {
      if (w.test.test(q)) {
        const rule = (entry.rules || []).find(r => r.key === w.key);
        if (!rule) continue;
        return { kind: 'fact', entry, rule, preferUnit: detectPreferredUnit(query) };
      }
    }
  }
  return null;
}

export class StandardsEngine {
  constructor(entries) {
    this.entries = Array.isArray(entries) ? entries : [];
    this._index = buildIndex(this.entries);
  }
  listAll() { return this.entries.slice(); }
  exportCatalog() { return { version: 1, exportedAt: new Date().toISOString(), entries: this.entries }; }
  search(query, opts = {}) {
    const limit = Math.max(1, Math.min(50, opts.limit ?? 8));
    const qNorm = normalizeHebrew(query);
    const qTokens = tokenize(query);
    const qTri = trigrams(query);
    if (!qNorm) return [];
    return this._index
      .map(idx => ({ idx, score: scoreEntry(qTokens, qNorm, qTri, idx) }))
      .filter(x => x.score > 6)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => ({
        score: x.score,
        entry: x.idx.entry,
        highlights: {
          titleHtml: highlight(x.idx.entry.title, qTokens),
          textHtml: highlight(x.idx.entry.text, qTokens),
          tags: (x.idx.entry.tags || []).slice(0, 6)
        }
      }));
  }
  answer(query) {
    const q = String(query ?? '');
    const preferUnit = detectPreferredUnit(q);
    const quick = parseQuickFactQuery(q, this.entries);
    if (quick && quick.kind === 'list_all')
      return { kind: 'list_all', preferUnit, results: this.entries.map(e => ({ score: 100, entry: e, highlights: { titleHtml: escapeHtml(e.title), textHtml: escapeHtml(e.text), tags: (e.tags || []).slice(0, 6) } })) };
    if (quick && quick.kind === 'fact') {
      const factText = formatRuleValue(quick.rule, quick.preferUnit);
      return {
        kind: 'fact',
        preferUnit: quick.preferUnit,
        fact: { title: quick.entry.title, ruleKey: quick.rule.key, label: quick.rule.label, valueText: factText, note: quick.rule.note || null, citation: quick.entry.citation || null },
        results: this.search(q, { limit: 8 })
      };
    }
    return { kind: 'search', preferUnit, results: this.search(q, { limit: 8 }) };
  }
}

export function createStandardsEngine() { return new StandardsEngine(STANDARDS_CATALOG); }
export const _standardsUtils = { normalizeHebrew, tokenize, formatRuleValue, escapeHtml };
