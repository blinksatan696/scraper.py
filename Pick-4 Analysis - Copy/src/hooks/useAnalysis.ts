import { useMemo } from 'react';
import type { DrawEntry } from './useMarketData';

export interface DigitFrequency {
  digit: number;
  count: number;
  percentage: number;
}

export interface PositionFrequency {
  digit: number;
  counts: [number, number, number, number];
}

export interface PairFrequency {
  pair: string;
  count: number;
}

export interface LastSeenInfo {
  digit: number;
  lastIndex: number;
  gap: number;
}

export interface OddEvenPattern {
  pattern: string;
  count: number;
}

export interface SumEntry {
  sum: number;
  count: number;
}

export interface TrendWindow {
  label: string;
  freqs: number[];
}

export interface Prediction {
  digits: [number, number, number, number];
  method: string;
  methodIcon: string;
  confidence: number;
  reasoning: string;
}

export interface DeltaEntry {
  index: number;
  date: string;
  deltas: [number, number, number, number];
  absDeltaSum: number;
}

export interface DigitalRootEntry {
  root: number;
  count: number;
  percentage: number;
}

export interface MirrorPair {
  digit: number;
  mirror: number;
  digitCount: number;
  mirrorCount: number;
  combined: number;
}

export interface FollowUpEntry {
  afterDigits: string;
  nextResults: string[];
  mostCommonNext: string;
  count: number;
}

export interface RundownResult {
  method: string;
  base: [number, number, number, number];
  results: [number, number, number, number][];
}

export interface CyclePattern {
  digit: number;
  avgGap: number;
  expectedNext: number;
  isOverdue: boolean;
  confidence: number;
}

export interface HighLowAnalysis {
  pattern: string;
  count: number;
}

export interface SumRootTrend {
  index: number;
  date: string;
  sum: number;
  root: number;
}

// ====== NEW TYPES FOR 9 FEATURES ======

export interface MarkovTransition {
  from: number;
  to: number;
  count: number;
  probability: number;
}

export interface MarkovDigitRow {
  digit: number;
  transitions: { to: number; count: number; probability: number }[];
  totalFrom: number;
  topNext: number;
  topNextProb: number;
}

export interface GapDetail {
  digit: number;
  currentGap: number;
  avgGap: number;
  maxGap: number;
  minGap: number;
  allGaps: number[];
  isOverdue: boolean;
  overdueRatio: number; // currentGap / avgGap
  status: 'hot' | 'warm' | 'normal' | 'overdue' | 'very_overdue';
}

export interface TrendMomentum {
  digit: number;
  recentFreq: number; // last N/2 draws
  olderFreq: number;  // first N/2 draws
  momentum: number;   // positive = trending up
  direction: 'rising' | 'falling' | 'stable';
  strength: number;   // 0-100
}

export interface PatternTypeEntry {
  type: string;
  typeCode: string;
  count: number;
  percentage: number;
  examples: string[];
}

export interface SkipHitEntry {
  digit: number;
  pattern: ('hit' | 'skip')[]; // last N draws
  hitRate: number;
  currentStreak: number;
  streakType: 'hit' | 'skip';
  longestHitStreak: number;
  longestSkipStreak: number;
}

export interface PositionCorrelation {
  pos1: number;
  pos2: number;
  correlations: { d1: number; d2: number; count: number }[];
  topPair: { d1: number; d2: number; count: number };
  strength: number;
}

export interface RepeatAnalysisEntry {
  index: number;
  date: string;
  digits: [number, number, number, number];
  prevDigits: [number, number, number, number];
  repeatedDigits: number[];
  repeatCount: number;
  exactPositionRepeats: number;
}

export interface SmartGenConfig {
  useHot: boolean;
  useCold: boolean;
  useOverdue: boolean;
  useMarkov: boolean;
  useMomentum: boolean;
  usePatternType: string;
  targetSum: [number, number];
  targetRoot: number | null;
  excludeDigits: number[];
  maxRepeats: number;
}

export interface BacktestResult {
  method: string;
  methodIcon: string;
  totalTests: number;
  exactMatch: number;
  threeMatch: number;
  twoMatch: number;
  oneMatch: number;
  zeroMatch: number;
  anyOrderMatch: number;
  avgDigitsMatched: number;
  accuracy: number; // weighted score
  grade: string;
}

export type AnalysisPeriod = 'all' | '30' | '20' | '10' | '7' | '5' | '3';

export function filterDrawsByPeriod(
  draws: DrawEntry[],
  period: AnalysisPeriod
): DrawEntry[] {
  if (period === 'all') return draws;

  const count = parseInt(period, 10);

  if (draws.length <= count) return draws;

  // draws sudah tersusun:
  // terbaru → tertua
  //
  // Maka periode harus mengambil N data pertama.
  return draws.slice(0, count);
}

export function filterDrawsUpToDate(draws: DrawEntry[], cutoffDate: string): DrawEntry[] {
  return draws.filter(d => d.date <= cutoffDate);
}

function digitalRoot(n: number): number {
  if (n === 0) return 0;
  return 1 + ((n - 1) % 9);
}

function mirrorDigit(d: number): number {
  return (d + 5) % 10;
}

export function useAnalysis(draws: DrawEntry[]) {
    // ============================================================
  // DATA CONTRACT
  // ------------------------------------------------------------
  // draws dari useMarketData:
  //   index 0 = TERBARU
  //   index terakhir = TERTUA
  //
  // Mesin analisis membutuhkan:
  //   index 0 = TERTUA
  //   index terakhir = TERBARU
  //
  // Karena itu analisis menggunakan salinan terbalik.
  // Data asli "draws" TIDAK diubah.
  // ============================================================
  const analysisDraws = useMemo(
    () => [...draws].reverse(),
    [draws]
  );
  const overallFrequency = useMemo((): DigitFrequency[] => {
    const counts = Array(10).fill(0);
    analysisDraws.forEach(d => d.digits.forEach(digit => counts[digit]++));
    const total = analysisDraws.length * 4;
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: total > 0 ? (counts[i] / total) * 100 : 0,
    }));
  }, [draws]);

  const positionFrequency = useMemo((): PositionFrequency[] => {
    const counts: number[][] = Array.from({ length: 10 }, () => [0, 0, 0, 0]);
    draws.forEach(d => {
      d.digits.forEach((digit, pos) => {
        counts[digit][pos]++;
      });
    });
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      counts: counts[i] as [number, number, number, number],
    }));
  }, [draws]);

  const pairFrequency = useMemo((): PairFrequency[] => {
    const pairMap: Record<string, number> = {};
    draws.forEach(d => {
      for (let i = 0; i < 3; i++) {
        const pair = `${d.digits[i]}${d.digits[i + 1]}`;
        pairMap[pair] = (pairMap[pair] || 0) + 1;
      }
    });
    return Object.entries(pairMap)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [draws]);

  const { hotNumbers, coldNumbers, warmNumbers } = useMemo(() => {
    const sorted = [...overallFrequency].sort((a, b) => b.count - a.count);
    return {
      hotNumbers: sorted.slice(0, 3),
      warmNumbers: sorted.slice(3, 7),
      coldNumbers: sorted.slice(7),
    };
  }, [overallFrequency]);

  const sumAnalysis = useMemo((): SumEntry[] => {
    const sums: Record<number, number> = {};
    draws.forEach(d => {
      const sum = d.digits.reduce((a, b) => a + b, 0);
      sums[sum] = (sums[sum] || 0) + 1;
    });
    return Object.entries(sums)
      .map(([sum, count]) => ({ sum: Number(sum), count }))
      .sort((a, b) => b.count - a.count);
  }, [draws]);

  const oddEvenAnalysis = useMemo((): OddEvenPattern[] => {
    const patterns: Record<string, number> = {};
    draws.forEach(d => {
      const pattern = d.digits.map(x => x % 2 === 0 ? 'E' : 'O').join('');
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });
    return Object.entries(patterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [draws]);

  const lastSeen = useMemo((): LastSeenInfo[] => {
    const result: LastSeenInfo[] = [];
    for (let d = 0; d <= 9; d++) {
      let lastIdx = -1;
      for (let i = analysisDraws.length - 1; i >= 0; i--) {
        if (analysisDraws[i].digits.includes(d)) {
          lastIdx = i;
          break;
        }
      }
      result.push({
        digit: d,
        lastIndex: lastIdx,
        gap: lastIdx === -1 ? draws.length : draws.length - 1 - lastIdx,
      });
    }
    return result.sort((a, b) => b.gap - a.gap);
  }, [draws]);

  const trendData = useMemo((): TrendWindow[] => {
    const windowSize = 5;
    const windows: TrendWindow[] = [];
    for (let i = 0; i < draws.length; i += windowSize) {
      const slice = draws.slice(i, i + windowSize);
      const freqs = Array(10).fill(0);
      slice.forEach(d => d.digits.forEach(digit => freqs[digit]++));
      windows.push({ label: `#${i + 1}-${Math.min(i + windowSize, draws.length)}`, freqs });
    }
    return windows;
  }, [draws]);

  const maxFreq = useMemo(() => Math.max(...overallFrequency.map(f => f.count), 1), [overallFrequency]);

  const repeatingAnalysis = useMemo(() => {
    const types: Record<string, number> = {
      'All Different': 0, 'One Pair': 0, 'Two Pairs': 0,
      'Three of a Kind': 0, 'Four of a Kind': 0,
    };
    draws.forEach(d => {
      const freq: Record<number, number> = {};
      d.digits.forEach(x => freq[x] = (freq[x] || 0) + 1);
      const vals = Object.values(freq).sort((a, b) => b - a);
      if (vals[0] === 4) types['Four of a Kind']++;
      else if (vals[0] === 3) types['Three of a Kind']++;
      else if (vals[0] === 2 && vals[1] === 2) types['Two Pairs']++;
      else if (vals[0] === 2) types['One Pair']++;
      else types['All Different']++;
    });
    return Object.entries(types).map(([type, count]) => ({ type, count }));
  }, [draws]);

  const consecutiveAnalysis = useMemo(() => {
    let hasConsecutive = 0;
    draws.forEach(d => {
      const sorted = [...d.digits].sort((a, b) => a - b);
      for (let i = 0; i < 3; i++) {
        if (sorted[i + 1] - sorted[i] === 1) { hasConsecutive++; break; }
      }
    });
    return {
      withConsecutive: hasConsecutive,
      withoutConsecutive: draws.length - hasConsecutive,
      percentage: draws.length > 0 ? (hasConsecutive / draws.length * 100).toFixed(1) : '0',
    };
  }, [draws]);

  // Delta Analysis
const deltaAnalysis = useMemo((): DeltaEntry[] => {
  if (analysisDraws.length < 2) return [];

  const deltas: DeltaEntry[] = [];

  for (let i = 1; i < analysisDraws.length; i++) {
    const prev = analysisDraws[i - 1].digits;
    const curr = analysisDraws[i].digits;

    const d: [number, number, number, number] = [
      (curr[0] - prev[0] + 10) % 10,
      (curr[1] - prev[1] + 10) % 10,
      (curr[2] - prev[2] + 10) % 10,
      (curr[3] - prev[3] + 10) % 10,
    ];

    deltas.push({
      index: i,
      date: analysisDraws[i].date,
      deltas: d,
      absDeltaSum: d.reduce((a, b) => a + b, 0),
    });
  }

  return deltas;
}, [analysisDraws]);

  const deltaFrequency = useMemo(() => {
    const posFreqs: number[][] = Array.from({ length: 4 }, () => Array(10).fill(0));
    deltaAnalysis.forEach(da => { da.deltas.forEach((d, pos) => { posFreqs[pos][d]++; }); });
    return posFreqs;
  }, [deltaAnalysis]);

  const topDeltaPatterns = useMemo(() => {
    const patterns: Record<string, number> = {};
    deltaAnalysis.forEach(da => { const key = da.deltas.join(','); patterns[key] = (patterns[key] || 0) + 1; });
    return Object.entries(patterns).map(([pattern, count]) => ({ pattern, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [deltaAnalysis]);

  const digitalRootAnalysis = useMemo((): DigitalRootEntry[] => {
    const rootCounts = Array(10).fill(0);
    draws.forEach(d => { const sum = d.digits.reduce((a, b) => a + b, 0); rootCounts[digitalRoot(sum)]++; });
    const total = draws.length;
    return Array.from({ length: 10 }, (_, i) => ({
      root: i, count: rootCounts[i], percentage: total > 0 ? (rootCounts[i] / total) * 100 : 0,
    })).filter(r => r.count > 0);
  }, [draws]);

  const sumRootTrend = useMemo((): SumRootTrend[] => {
    return draws.map((d, i) => {
      const sum = d.digits.reduce((a, b) => a + b, 0);
      return { index: i, date: d.date, sum, root: digitalRoot(sum) };
    });
  }, [draws]);

  const mirrorAnalysis = useMemo((): MirrorPair[] => {
    const counts = Array(10).fill(0);
    draws.forEach(d => d.digits.forEach(digit => counts[digit]++));
    const pairs: MirrorPair[] = [];
    for (let i = 0; i < 5; i++) {
      const m = mirrorDigit(i);
      pairs.push({ digit: i, mirror: m, digitCount: counts[i], mirrorCount: counts[m], combined: counts[i] + counts[m] });
    }
    return pairs.sort((a, b) => b.combined - a.combined);
  }, [draws]);

  const followUpAnalysis = useMemo((): FollowUpEntry[] => {
    if (draws.length < 2) return [];
    const digitFollow: Record<string, Record<string, number>> = {};
    for (let i = 0; i < analysisDraws.length - 1; i++) {
      const uniqueDigits = [...new Set(analysisDraws[i].digits)];
      const nextStr = analysisDraws[i + 1].digits.join('');
      uniqueDigits.forEach(d => {
        const key = `digit_${d}`;
        if (!digitFollow[key]) digitFollow[key] = {};
        digitFollow[key][nextStr] = (digitFollow[key][nextStr] || 0) + 1;
      });
    }
    const results: FollowUpEntry[] = [];
    for (let d = 0; d <= 9; d++) {
      const key = `digit_${d}`;
      if (digitFollow[key]) {
        const entries = Object.entries(digitFollow[key]).sort(([, a], [, b]) => b - a);
        if (entries.length > 0) {
          results.push({
            afterDigits: `After digit ${d} appears`,
            nextResults: entries.slice(0, 5).map(([r]) => r),
            mostCommonNext: entries[0][0],
            count: entries[0][1],
          });
        }
      }
    }
    return results.sort((a, b) => b.count - a.count);
  }, [draws]);

  const cycleAnalysis = useMemo((): CyclePattern[] => {
    if (draws.length < 5) return [];
    const cycles: CyclePattern[] = [];
    for (let d = 0; d <= 9; d++) {
      const appearances: number[] = [];
      draws.forEach((draw, i) => { if (draw.digits.includes(d)) appearances.push(i); });
      if (appearances.length < 2) {
        cycles.push({ digit: d, avgGap: draws.length, expectedNext: draws.length, isOverdue: true, confidence: 10 });
        continue;
      }
      const gaps: number[] = [];
      for (let i = 1; i < appearances.length; i++) gaps.push(appearances[i] - appearances[i - 1]);
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const lastAppearance = appearances[appearances.length - 1];
      const currentGap = draws.length - 1 - lastAppearance;
      const isOverdue = currentGap >= avgGap;
      const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
      const stdDev = Math.sqrt(variance);
      const consistency = avgGap > 0 ? Math.max(0, 100 - (stdDev / avgGap * 100)) : 0;
      cycles.push({ digit: d, avgGap: Math.round(avgGap * 10) / 10, expectedNext: lastAppearance + Math.round(avgGap), isOverdue, confidence: Math.round(consistency) });
    }
    return cycles.sort((a, b) => { if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1; return b.confidence - a.confidence; });
  }, [draws]);

  const highLowAnalysis = useMemo((): HighLowAnalysis[] => {
    const patterns: Record<string, number> = {};
    draws.forEach(d => { const pattern = d.digits.map(x => x <= 4 ? 'L' : 'H').join(''); patterns[pattern] = (patterns[pattern] || 0) + 1; });
    return Object.entries(patterns).map(([pattern, count]) => ({ pattern, count })).sort((a, b) => b.count - a.count);
  }, [draws]);

  const rundownResults = useMemo((): RundownResult[] => {
    if (draws.length === 0) return [];
  
    // draws[0] = hasil TERBARU
    const lastDraw = draws[0].digits;
  
    const rundowns: RundownResult[] = [];
  
    const makeRundown = (
      name: string,
      fn: (c: number[], step: number) => number[]
    ) => {
      const results: [number, number, number, number][] = [];
  
      let current = [...lastDraw];
  
      for (let step = 0; step < 5; step++) {
        current = fn(current, step);
  
        results.push(
          [...current] as [number, number, number, number]
        );
      }
  
      rundowns.push({
        method: name,
        base: lastDraw as [number, number, number, number],
        results,
      });
    };
  
    makeRundown(
      '+1 Rundown',
      c => c.map(d => (d + 1) % 10)
    );
  
    makeRundown(
      '+2 Rundown',
      c => c.map(d => (d + 2) % 10)
    );
  
    makeRundown(
      'Mirror Rundown',
      c => c.map(d => mirrorDigit(d))
    );
  
    makeRundown(
      '1-2-3-4 Rundown',
      c => [
        (c[0] + 1) % 10,
        (c[1] + 2) % 10,
        (c[2] + 3) % 10,
        (c[3] + 4) % 10,
      ]
    );
  
    if (deltaAnalysis.length > 0) {
      // deltaAnalysis dibangun dari tertua → terbaru
      const lastDelta =
        deltaAnalysis[deltaAnalysis.length - 1].deltas;
  
      makeRundown(
        `Last Delta (${lastDelta.join(',')})`,
        c => c.map(
          (d, i) => (d + lastDelta[i]) % 10
        )
      );
    }
  
    return rundowns;
  }, [draws, deltaAnalysis]);

  const workoutNumbers = useMemo(() => {
    if (draws.length < 3) return [];
    const scores: number[][] = Array.from({ length: 4 }, () => Array(10).fill(0));
    positionFrequency.forEach(pf => { pf.counts.forEach((count, pos) => { scores[pos][pf.digit] += count * 3; }); });
    hotNumbers.forEach(h => { for (let pos = 0; pos < 4; pos++) scores[pos][h.digit] += 2; });
    lastSeen.slice(0, 3).forEach(ls => { for (let pos = 0; pos < 4; pos++) scores[pos][ls.digit] += ls.gap * 2; });
    cycleAnalysis.forEach(c => { if (c.isOverdue) for (let pos = 0; pos < 4; pos++) scores[pos][c.digit] += Math.round(c.confidence / 10) * 2; });
    if (deltaAnalysis.length > 0 && draws.length > 0) {
      const ld = draws[0].digits;
      deltaFrequency.forEach((posFreq, pos) => {
        const topDelta = posFreq.indexOf(Math.max(...posFreq));
        scores[pos][(ld[pos] + topDelta) % 10] += 5;
      });
    }
    return scores.map(posScores => posScores.map((score, digit) => ({ digit, score })).sort((a, b) => b.score - a.score).slice(0, 3));
  }, [draws, positionFrequency, hotNumbers, lastSeen, cycleAnalysis, deltaAnalysis, deltaFrequency]);

  // ====== 9 NEW FEATURES ======

  // 1. MARKOV CHAIN — Transition probabilities
const markovChain = useMemo((): MarkovDigitRow[] => {
  if (analysisDraws.length < 2) return [];

  // Track: for each position, after digit X appears,
  // what digit Y appears next at the same position
  const posTransitions: number[][][] = Array.from(
    { length: 4 },
    () => Array.from({ length: 10 }, () => Array(10).fill(0))
  );

  for (let i = 0; i < analysisDraws.length - 1; i++) {
    for (let pos = 0; pos < 4; pos++) {
      const from = analysisDraws[i].digits[pos];
      const to = analysisDraws[i + 1].digits[pos];

      posTransitions[pos][from][to]++;
    }
  }

  // Aggregate across positions
  const combined: number[][] = Array.from(
    { length: 10 },
    () => Array(10).fill(0)
  );

  for (let pos = 0; pos < 4; pos++) {
    for (let from = 0; from < 10; from++) {
      for (let to = 0; to < 10; to++) {
        combined[from][to] += posTransitions[pos][from][to];
      }
    }
  }

  const rows: MarkovDigitRow[] = [];

  for (let from = 0; from < 10; from++) {
    const totalFrom = combined[from].reduce((a, b) => a + b, 0);

    const transitions = combined[from]
      .map((count, to) => ({
        to,
        count,
        probability: totalFrom > 0 ? count / totalFrom : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topNext = transitions[0]?.to ?? 0;
    const topNextProb = transitions[0]?.probability ?? 0;

    rows.push({
      digit: from,
      transitions,
      totalFrom,
      topNext,
      topNextProb,
    });
  }

  return rows;
}, [analysisDraws]);

  // Markov position-specific transitions
  const markovPositionTransitions = useMemo(() => {
    if (draws.length < 2) return [];
    const result: { pos: number; transitions: number[][] }[] = [];
    for (let pos = 0; pos < 4; pos++) {
      const trans: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
      for (let i = 0; i < analysisDraws.length - 1; i++) {
        trans[
          analysisDraws[i].digits[pos]
        ][
          analysisDraws[i + 1].digits[pos]
        ]++;
      }
      result.push({ pos, transitions: trans });
    }
    return result;
  }, [analysisDraws]);

  // 2. GAP / INTERVAL ANALYSIS — Detailed overdue info
  const gapAnalysis = useMemo((): GapDetail[] => {
    if (draws.length < 3) return [];
    const details: GapDetail[] = [];
    for (let d = 0; d <= 9; d++) {
      const appearances: number[] = [];
      draws.forEach((draw, i) => { if (draw.digits.includes(d)) appearances.push(i); });
      if (appearances.length === 0) {
        details.push({ digit: d, currentGap: draws.length, avgGap: draws.length, maxGap: draws.length, minGap: draws.length, allGaps: [draws.length], isOverdue: true, overdueRatio: 999, status: 'very_overdue' });
        continue;
      }
      const gaps: number[] = [];
      if (appearances[0] > 0) gaps.push(appearances[0]);
      for (let i = 1; i < appearances.length; i++) gaps.push(appearances[i] - appearances[i - 1]);
      const currentGap = draws.length - 1 - appearances[appearances.length - 1];
      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const maxGap = Math.max(...gaps, currentGap);
      const minGap = Math.min(...gaps);
      const overdueRatio = avgGap > 0 ? currentGap / avgGap : 0;
      const isOverdue = overdueRatio >= 1;
      let status: GapDetail['status'] = 'normal';
      if (currentGap === 0) status = 'hot';
      else if (overdueRatio < 0.5) status = 'warm';
      else if (overdueRatio < 1) status = 'normal';
      else if (overdueRatio < 2) status = 'overdue';
      else status = 'very_overdue';
      details.push({ digit: d, currentGap, avgGap: Math.round(avgGap * 10) / 10, maxGap, minGap, allGaps: gaps, isOverdue, overdueRatio: Math.round(overdueRatio * 100) / 100, status });
    }
    return details.sort((a, b) => b.overdueRatio - a.overdueRatio);
  }, [analysisDraws]);

  // 3. TREND MOMENTUM — Rising/Falling/Stable per digit
  const trendMomentum = useMemo((): TrendMomentum[] => {
    if (draws.length < 6) return [];
    const half = Math.floor(draws.length / 2);
    const firstHalf = analysisDraws.slice(0, half);
    const secondHalf = analysisDraws.slice(half);
    const results: TrendMomentum[] = [];
    for (let d = 0; d <= 9; d++) {
      let olderCount = 0, recentCount = 0;
      firstHalf.forEach(draw => { if (draw.digits.includes(d)) olderCount++; });
      secondHalf.forEach(draw => { if (draw.digits.includes(d)) recentCount++; });
      const olderFreq = firstHalf.length > 0 ? olderCount / firstHalf.length : 0;
      const recentFreq = secondHalf.length > 0 ? recentCount / secondHalf.length : 0;
      const momentum = recentFreq - olderFreq;
      let direction: TrendMomentum['direction'] = 'stable';
      if (momentum > 0.05) direction = 'rising';
      else if (momentum < -0.05) direction = 'falling';
      const strength = Math.min(100, Math.round(Math.abs(momentum) * 200));
      results.push({ digit: d, recentFreq: Math.round(recentFreq * 1000) / 10, olderFreq: Math.round(olderFreq * 1000) / 10, momentum: Math.round(momentum * 1000) / 10, direction, strength });
    }
    return results.sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));
  }, [draws]);

  // 4. PATTERN TYPE — All unique, one pair, two pairs, triple, quad
  const patternTypeAnalysis = useMemo((): PatternTypeEntry[] => {
    if (draws.length === 0) return [];
    const typeMap: Record<string, { count: number; examples: string[] }> = {};
    const classify = (digits: number[]): { code: string } => {
      const freq: Record<number, number> = {};
      digits.forEach(d => freq[d] = (freq[d] || 0) + 1);
      const vals = Object.values(freq).sort((a, b) => b - a);
      if (vals[0] === 4) return { code: 'quad' };
      if (vals[0] === 3) return { code: 'triple' };
      if (vals[0] === 2 && vals[1] === 2) return { code: 'double_pair' };
      if (vals[0] === 2) return { code: 'single_pair' };
      return { code: 'all_unique' };
    };
    draws.forEach(d => {
      const { code } = classify([...d.digits]);
      if (!typeMap[code]) typeMap[code] = { count: 0, examples: [] };
      typeMap[code].count++;
      if (typeMap[code].examples.length < 3) typeMap[code].examples.push(d.digits.join(''));
    });
    const orderedTypes = [
      { code: 'all_unique', type: 'All Unique (ABCD)' },
      { code: 'single_pair', type: 'Single Pair (AABC)' },
      { code: 'double_pair', type: 'Double Pair (AABB)' },
      { code: 'triple', type: 'Triple (AAAB)' },
      { code: 'quad', type: 'Quad (AAAA)' },
    ];
    return orderedTypes.map(ot => {
      const data = typeMap[ot.code] || { count: 0, examples: [] };
      return { type: ot.type, typeCode: ot.code, count: data.count, percentage: draws.length > 0 ? (data.count / draws.length) * 100 : 0, examples: data.examples };
    });
  }, [draws]);

  // 5. SKIP & HIT — Visual pattern per digit
  const skipHitAnalysis = useMemo((): SkipHitEntry[] => {
    if (draws.length === 0) return [];
    const results: SkipHitEntry[] = [];
    const lookback = Math.min(draws.length, 30);
    const recentDraws = analysisDraws.slice(-lookback);
    for (let d = 0; d <= 9; d++) {
      const pattern: ('hit' | 'skip')[] = recentDraws.map(draw => draw.digits.includes(d) ? 'hit' : 'skip');
      const hits = pattern.filter(p => p === 'hit').length;
      const hitRate = pattern.length > 0 ? (hits / pattern.length) * 100 : 0;
      // Current streak
      let streak = 0;
      const streakType = pattern[pattern.length - 1] || 'skip';
      for (let i = pattern.length - 1; i >= 0; i--) {
        if (pattern[i] === streakType) streak++;
        else break;
      }
      // Longest streaks
      let longestHit = 0, longestSkip = 0, currentHit = 0, currentSkip = 0;
      pattern.forEach(p => {
        if (p === 'hit') { currentHit++; currentSkip = 0; longestHit = Math.max(longestHit, currentHit); }
        else { currentSkip++; currentHit = 0; longestSkip = Math.max(longestSkip, currentSkip); }
      });
      results.push({ digit: d, pattern, hitRate: Math.round(hitRate * 10) / 10, currentStreak: streak, streakType, longestHitStreak: longestHit, longestSkipStreak: longestSkip });
    }
    return results.sort((a, b) => b.hitRate - a.hitRate);
  }, [draws]);

  // 6. POSITION CORRELATION — Relationships between positions
  const positionCorrelation = useMemo((): PositionCorrelation[] => {
    if (draws.length < 5) return [];
    const results: PositionCorrelation[] = [];
    const pairs: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    pairs.forEach(([p1, p2]) => {
      const comboCounts: Record<string, number> = {};
      draws.forEach(d => {
        const key = `${d.digits[p1]}-${d.digits[p2]}`;
        comboCounts[key] = (comboCounts[key] || 0) + 1;
      });
      const correlations = Object.entries(comboCounts)
        .map(([key, count]) => {
          const [d1, d2] = key.split('-').map(Number);
          return { d1, d2, count };
        })
        .sort((a, b) => b.count - a.count);
      const topPair = correlations[0] || { d1: 0, d2: 0, count: 0 };
      // Calculate correlation strength: how much the top pair deviates from expected
      const expected = draws.length / 100; // 10*10 = 100 possible combos
      const strength = expected > 0 ? Math.min(100, Math.round(((topPair.count / expected) - 1) * 50)) : 0;
      results.push({ pos1: p1, pos2: p2, correlations: correlations.slice(0, 5), topPair, strength: Math.max(0, strength) });
    });
    return results.sort((a, b) => b.strength - a.strength);
  }, [draws]);

  // 7. REPEAT ANALYSIS — How many digits repeat from previous draw
  const repeatFromPrevious = useMemo((): RepeatAnalysisEntry[] => {
    if (draws.length < 2) return [];
    const results: RepeatAnalysisEntry[] = [];
    for (let i = 1; i < analysisDraws.length; i++) {
      const prev = analysisDraws[i - 1].digits;
      const curr = analysisDraws[i].digits;
      const prevSet = new Set(prev);
      const repeatedDigits = [...new Set(curr.filter(d => prevSet.has(d)))];
      let exactPositionRepeats = 0;
      for (let pos = 0; pos < 4; pos++) {
        if (curr[pos] === prev[pos]) exactPositionRepeats++;
      }
      results.push({
        index: i,
        date: analysisDraws[i].date,
        digits: curr as [number, number, number, number],
        prevDigits: prev as [number, number, number, number],
        repeatedDigits, repeatCount: repeatedDigits.length, exactPositionRepeats,
      });
    }
    return results;
  }, [draws]);

  const repeatStats = useMemo(() => {
    if (repeatFromPrevious.length === 0) return { avgRepeat: 0, avgExact: 0, distribution: [] as { repeats: number; count: number; pct: number }[] };
    const totalRepeats = repeatFromPrevious.reduce((s, r) => s + r.repeatCount, 0);
    const totalExact = repeatFromPrevious.reduce((s, r) => s + r.exactPositionRepeats, 0);
    const distMap: Record<number, number> = {};
    repeatFromPrevious.forEach(r => { distMap[r.repeatCount] = (distMap[r.repeatCount] || 0) + 1; });
    const distribution = [0, 1, 2, 3, 4].map(n => ({
      repeats: n,
      count: distMap[n] || 0,
      pct: repeatFromPrevious.length > 0 ? ((distMap[n] || 0) / repeatFromPrevious.length) * 100 : 0,
    }));
    return {
      avgRepeat: Math.round((totalRepeats / repeatFromPrevious.length) * 100) / 100,
      avgExact: Math.round((totalExact / repeatFromPrevious.length) * 100) / 100,
      distribution,
    };
  }, [repeatFromPrevious]);

  // 8. BACKTEST ACCURACY — Test each prediction method historically
  const backtestResults = useMemo((): BacktestResult[] => {
    if (draws.length < 10) return [];
    const testCount = Math.min(
      Math.floor(analysisDraws.length * 0.5),
      30
    );
    
    const startIdx = analysisDraws.length - testCount;
    const methods: { name: string; icon: string; predict: (hist: DrawEntry[]) => [number, number, number, number] | null }[] = [
      {
        name: 'Position Frequency', icon: '📍',
        predict: (hist) => {
          if (hist.length < 3) return null;
          const pf: number[][] = Array.from({ length: 10 }, () => [0, 0, 0, 0]);
          hist.forEach(d => d.digits.forEach((dig, pos) => pf[dig][pos]++));
          const result: number[] = [];
          for (let pos = 0; pos < 4; pos++) {
            let maxC = 0, maxD = 0;
            for (let d = 0; d < 10; d++) { if (pf[d][pos] > maxC) { maxC = pf[d][pos]; maxD = d; } }
            result.push(maxD);
          }
          return result as [number, number, number, number];
        }
      },
      {
        name: 'Hot Numbers', icon: '🔥',
        predict: (hist) => {
          if (hist.length < 3) return null;
          const counts = Array(10).fill(0);
          hist.forEach(d => d.digits.forEach(dig => counts[dig]++));
          const sorted = counts.map((c, i) => ({ d: i, c })).sort((a, b) => b.c - a.c);
          return [sorted[0].d, sorted[1].d, sorted[2].d, sorted[3].d] as [number, number, number, number];
        }
      },
      {
        name: 'Overdue Numbers', icon: '⏰',
        predict: (hist) => {
          if (hist.length < 3) return null;
          const lastSeenArr: { digit: number; gap: number }[] = [];
          for (let d = 0; d <= 9; d++) {
            let li = -1;
            for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].digits.includes(d)) { li = i; break; } }
            lastSeenArr.push({ digit: d, gap: li === -1 ? hist.length : hist.length - 1 - li });
          }
          lastSeenArr.sort((a, b) => b.gap - a.gap);
          return [lastSeenArr[0].digit, lastSeenArr[1].digit, lastSeenArr[2].digit, lastSeenArr[3].digit] as [number, number, number, number];
        }
      },
      {
        name: 'Delta System', icon: '📐',
        predict: (hist) => {
          if (hist.length < 3) return null;
          const pFreqs: number[][] = Array.from({ length: 4 }, () => Array(10).fill(0));
          for (let i = 1; i < hist.length; i++) {
            for (let pos = 0; pos < 4; pos++) {
              pFreqs[pos][(hist[i].digits[pos] - hist[i - 1].digits[pos] + 10) % 10]++;
            }
          }
          const lastD = hist[hist.length - 1].digits;
          return pFreqs.map((pf, pos) => (lastD[pos] + pf.indexOf(Math.max(...pf))) % 10) as [number, number, number, number];
        }
      },
      {
        name: 'Mirror System', icon: '🪞',
        predict: (hist) => {
          if (hist.length < 1) return null;
          return hist[hist.length - 1].digits.map(d => mirrorDigit(d)) as [number, number, number, number];
        }
      },
      {
        name: 'Markov Chain', icon: '🔗',
        predict: (hist) => {
          if (hist.length < 5) return null;
          const result: number[] = [];
          for (let pos = 0; pos < 4; pos++) {
            const trans: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
            for (let i = 0; i < hist.length - 1; i++) trans[hist[i].digits[pos]][hist[i + 1].digits[pos]]++;
            const lastDigit = hist[hist.length - 1].digits[pos];
            const row = trans[lastDigit];
            result.push(row.indexOf(Math.max(...row)));
          }
          return result as [number, number, number, number];
        }
      },
      {
        name: 'Momentum Rising', icon: '📈',
        predict: (hist) => {
          if (hist.length < 6) return null;
          const halfLen = Math.floor(hist.length / 2);
          const first = hist.slice(0, halfLen);
          const second = hist.slice(halfLen);
          const momentums: { digit: number; m: number }[] = [];
          for (let d = 0; d <= 9; d++) {
            const f1 = first.filter(dr => dr.digits.includes(d)).length / first.length;
            const f2 = second.filter(dr => dr.digits.includes(d)).length / second.length;
            momentums.push({ digit: d, m: f2 - f1 });
          }
          momentums.sort((a, b) => b.m - a.m);
          return [momentums[0].digit, momentums[1].digit, momentums[2].digit, momentums[3].digit] as [number, number, number, number];
        }
      },
      {
        name: 'Workout System', icon: '💪',
        predict: (hist) => {
          if (hist.length < 5) return null;
          const pf: number[][] = Array.from({ length: 10 }, () => [0, 0, 0, 0]);
          hist.forEach(d => d.digits.forEach((dig, pos) => pf[dig][pos]++));
          const scores: number[][] = Array.from({ length: 4 }, () => Array(10).fill(0));
          for (let d = 0; d < 10; d++) for (let p = 0; p < 4; p++) scores[p][d] += pf[d][p] * 3;
          const counts = Array(10).fill(0);
          hist.forEach(d => d.digits.forEach(dig => counts[dig]++));
          const hot = counts.map((c, i) => ({ d: i, c })).sort((a, b) => b.c - a.c).slice(0, 3);
          hot.forEach(h => { for (let p = 0; p < 4; p++) scores[p][h.d] += 2; });
          return scores.map(ps => ps.indexOf(Math.max(...ps))) as [number, number, number, number];
        }
      },
      {
        name: 'Balanced Strategy', icon: '⚖️',
        predict: (hist) => {
          if (hist.length < 5) return null;
          const counts = Array(10).fill(0);
          hist.forEach(d => d.digits.forEach(dig => counts[dig]++));
          const sorted = counts.map((c, i) => ({ d: i, c })).sort((a, b) => b.c - a.c);
          const lastSeenArr: { digit: number; gap: number }[] = [];
          for (let d = 0; d <= 9; d++) {
            let li = -1;
            for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].digits.includes(d)) { li = i; break; } }
            lastSeenArr.push({ digit: d, gap: li === -1 ? hist.length : hist.length - 1 - li });
          }
          lastSeenArr.sort((a, b) => b.gap - a.gap);
          return [sorted[0].d, lastSeenArr[0].digit, lastSeenArr[1].digit, sorted[sorted.length - 1].d] as [number, number, number, number];
        }
      },
    ];

        return methods.map(method => {
      let exactMatch = 0;
      let threeMatch = 0;
      let twoMatch = 0;
      let oneMatch = 0;
      let zeroMatch = 0;
      let anyOrderMatch = 0;

      let totalDigitsMatched = 0;
      let validTests = 0;

      for (let i = startIdx; i < analysisDraws.length; i++) {
        const history = analysisDraws.slice(0, i);
        const prediction = method.predict(history);

        if (!prediction) continue;

        validTests++;

        const actual = analysisDraws[i].digits;

        // Exact position matches
        let posMatches = 0;

        for (let p = 0; p < 4; p++) {
          if (prediction[p] === actual[p]) {
            posMatches++;
          }
        }

        // Any order matches
        const predCopy = [...prediction];
        const actCopy = [...actual];

        let anyMatch = 0;

        actCopy.forEach(a => {
          const idx = predCopy.indexOf(a);

          if (idx !== -1) {
            anyMatch++;
            predCopy.splice(idx, 1);
          }
        });

        totalDigitsMatched += posMatches;

        if (posMatches === 4) {
          exactMatch++;
        } else if (posMatches === 3) {
          threeMatch++;
        } else if (posMatches === 2) {
          twoMatch++;
        } else if (posMatches === 1) {
          oneMatch++;
        } else {
          zeroMatch++;
        }

        if (anyMatch === 4) {
          anyOrderMatch++;
        }
      }

      const avgDigitsMatched =
        validTests > 0
          ? totalDigitsMatched / validTests
          : 0;

      // Weighted accuracy score:
      // exact = 100
      // three = 75
      // two = 50
      // one = 25
      // zero = 0
      const accuracy =
        validTests > 0
          ? (
              exactMatch * 100 +
              threeMatch * 75 +
              twoMatch * 50 +
              oneMatch * 25
            ) / validTests
          : 0;

      let grade = 'F';

      if (accuracy >= 60) {
        grade = 'A';
      } else if (accuracy >= 50) {
        grade = 'B';
      } else if (accuracy >= 40) {
        grade = 'C';
      } else if (accuracy >= 30) {
        grade = 'D';
      }

      return {
        method: method.name,
        methodIcon: method.icon,
        totalTests: validTests,
        exactMatch,
        threeMatch,
        twoMatch,
        oneMatch,
        zeroMatch,
        anyOrderMatch,
        avgDigitsMatched: Math.round(avgDigitsMatched * 100) / 100,
        accuracy: Math.round(accuracy * 10) / 10,
        grade,
      };
    }).sort((a, b) => b.accuracy - a.accuracy);
  }, [analysisDraws]);

  return {
    overallFrequency,
    positionFrequency,
    pairFrequency,
    hotNumbers,
    coldNumbers,
    warmNumbers,
    sumAnalysis,
    oddEvenAnalysis,
    lastSeen,
    trendData,
    maxFreq,
    repeatingAnalysis,
    consecutiveAnalysis,
    deltaAnalysis,
    deltaFrequency,
    topDeltaPatterns,
    digitalRootAnalysis,
    sumRootTrend,
    mirrorAnalysis,
    followUpAnalysis,
    cycleAnalysis,
    highLowAnalysis,
    rundownResults,
    workoutNumbers,

    // NEW 9 features
    markovChain,
    markovPositionTransitions,
    gapAnalysis,
    trendMomentum,
    patternTypeAnalysis,
    skipHitAnalysis,
    positionCorrelation,
    repeatFromPrevious,
    repeatStats,
    backtestResults,
  };
}

export function usePredictions(
  draws: DrawEntry[],
  overallFrequency: DigitFrequency[],
  positionFrequency: PositionFrequency[],
  hotNumbers: DigitFrequency[],
  warmNumbers: DigitFrequency[],
  lastSeen: LastSeenInfo[],
  cycleAnalysis: CyclePattern[],
  deltaFrequency: number[][],
  _mirrorAnalysis: MirrorPair[],
  digitalRootAnalysis: DigitalRootEntry[],
  workoutNumbers: { digit: number; score: number }[][],
  markovPositionTransitions: { pos: number; transitions: number[][] }[],
  trendMomentum: TrendMomentum[],
  backtestResults: BacktestResult[],
  predictionCount: number,
): Prediction[] {
  return useMemo(() => {
    if (draws.length < 3) return [];

    const results: Prediction[] = [];

    // Build confidence map from backtest results
    const backtestConfidence: Record<string, number> = {};
    backtestResults.forEach(bt => {
      backtestConfidence[bt.method] = Math.round(bt.accuracy);
    });

    // Method 1: Position Frequency
    const posDigits: number[] = [];
    for (let pos = 0; pos < 4; pos++) {
      let maxCount = 0, maxDigit = 0;
      for (let d = 0; d <= 9; d++) { if (positionFrequency[d].counts[pos] > maxCount) { maxCount = positionFrequency[d].counts[pos]; maxDigit = d; } }
      posDigits.push(maxDigit);
    }
    results.push({
      digits: posDigits as [number, number, number, number],
      method: 'Position Frequency', methodIcon: '📍',
      confidence: backtestConfidence['Position Frequency'] || 75,
      reasoning: 'Most frequently appearing digit at each position.',
    });

    // Method 2: Hot Numbers
    const hotDigits = hotNumbers.map(h => h.digit);
    const warmDigits = warmNumbers.map(w => w.digit);
    results.push({
      digits: [hotDigits[0] ?? 0, hotDigits[1] ?? 1, hotDigits[2] ?? 2, warmDigits[0] ?? 3] as [number, number, number, number],
      method: 'Hot Numbers', methodIcon: '🔥',
      confidence: backtestConfidence['Hot Numbers'] || 65,
      reasoning: '3 hottest digits + 1 warm digit.',
    });

    // Method 3: Overdue
    const overdueDigits = lastSeen.slice(0, 4).map(l => l.digit);
    results.push({
      digits: overdueDigits as [number, number, number, number],
      method: 'Overdue Numbers', methodIcon: '⏰',
      confidence: backtestConfidence['Overdue Numbers'] || 55,
      reasoning: 'Digits that haven\'t appeared for the longest time.',
    });

    // Method 4: Workout System
    if (workoutNumbers.length === 4) {
      results.push({
        digits: workoutNumbers.map(pos => pos[0].digit) as [number, number, number, number],
        method: 'Workout System', methodIcon: '💪',
        confidence: backtestConfidence['Workout System'] || 80,
        reasoning: 'Multi-factor weighted scoring: pos freq + hot + overdue + cycle + delta.',
      });
    }

    // Method 5: Delta System
    if (deltaFrequency.length === 4 && draws.length > 0) {
      const lastDraw = draws[0].digits;
      const deltaPick = deltaFrequency.map((posFreq, pos) => {
        const topDelta = posFreq.indexOf(Math.max(...posFreq));
        return (lastDraw[pos] + topDelta) % 10;
      }) as [number, number, number, number];
      results.push({
        digits: deltaPick, method: 'Delta System', methodIcon: '📐',
        confidence: backtestConfidence['Delta System'] || 70,
        reasoning: 'Applies most common delta per position to last result.',
      });
    }

    // Method 6: Markov Chain (NEW)
    if (markovPositionTransitions.length === 4 && draws.length > 3) {
      const lastDraw = draws[0].digits;
      const markovPick = markovPositionTransitions.map((pt, pos) => {
        const row = pt.transitions[lastDraw[pos]];
        return row.indexOf(Math.max(...row));
      }) as [number, number, number, number];
      results.push({
        digits: markovPick, method: 'Markov Chain', methodIcon: '🔗',
        confidence: backtestConfidence['Markov Chain'] || 72,
        reasoning: 'Predicts based on highest transition probability from last digit at each position.',
      });
    }

    // Method 7: Momentum Rising (NEW)
    if (trendMomentum.length > 0) {
      const rising = trendMomentum.filter(t => t.direction === 'rising').sort((a, b) => b.strength - a.strength);
      if (rising.length >= 4) {
        results.push({
          digits: [rising[0].digit, rising[1].digit, rising[2].digit, rising[3].digit] as [number, number, number, number],
          method: 'Momentum Rising', methodIcon: '📈',
          confidence: backtestConfidence['Momentum Rising'] || 60,
          reasoning: 'Top 4 digits with increasing frequency trend (momentum).',
        });
      }
    }

    // Method 8: Cycle Overdue
    const overdueByConf = cycleAnalysis.filter(c => c.isOverdue).sort((a, b) => b.confidence - a.confidence);
    if (overdueByConf.length >= 4) {
      results.push({
        digits: overdueByConf.slice(0, 4).map(c => c.digit) as [number, number, number, number],
        method: 'Cycle Overdue', methodIcon: '🔄',
        confidence: Math.round(overdueByConf.slice(0, 4).reduce((s, c) => s + c.confidence, 0) / 4),
        reasoning: 'Digits exceeding their average cycle gap.',
      });
    }

    // Method 9: Mirror
    if (draws.length > 0) {
      const last = draws[0].digits;
      results.push({
        digits: last.map(d => mirrorDigit(d)) as [number, number, number, number],
        method: 'Mirror System', methodIcon: '🪞',
        confidence: backtestConfidence['Mirror System'] || 45,
        reasoning: 'Mirror digits of last result (0↔5, 1↔6, 2↔7, 3↔8, 4↔9).',
      });
    }

    // Method 10: Digital Root Match
    if (digitalRootAnalysis.length > 0) {
      const sortedRoots = [...digitalRootAnalysis].sort((a, b) => b.count - a.count);
      const topRoot = sortedRoots[0].root;
      const rootPick: number[] = [];
      for (let pos = 0; pos < 4; pos++) {
        const sorted = Array.from({ length: 10 }, (_, d) => ({ digit: d, count: positionFrequency[d].counts[pos] })).sort((a, b) => b.count - a.count);
        rootPick.push(sorted[0].digit);
      }
      const currentSum = rootPick.reduce((a, b) => a + b, 0);
      const currentRoot = digitalRoot(currentSum);
      if (currentRoot !== topRoot) {
        const diff = (topRoot - currentRoot + 9) % 9;
        rootPick[3] = (rootPick[3] + diff) % 10;
      }
      results.push({
        digits: rootPick as [number, number, number, number],
        method: 'Digital Root Match', methodIcon: '🔢',
        confidence: 60,
        reasoning: `Targets digital root ${topRoot} with high-freq position digits.`,
      });
    }

    // Method 11: Balanced Strategy
    {
      const hotPick = hotNumbers[0]?.digit ?? 0;
      const coldPick = [...overallFrequency].sort((a, b) => a.count - b.count)[0]?.digit ?? 5;
      const overduePick = lastSeen[0]?.digit ?? 3;
      const cyclePick = cycleAnalysis.find(c => c.isOverdue)?.digit ?? 7;
      results.push({
        digits: [hotPick, overduePick, cyclePick, coldPick] as [number, number, number, number],
        method: 'Balanced Strategy', methodIcon: '⚖️',
        confidence: backtestConfidence['Balanced Strategy'] || 62,
        reasoning: '1 hot + 1 overdue + 1 cycle-due + 1 cold for balance.',
      });
    }

    // Sort by backtest-adjusted confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // Fill remaining with weighted random
    for (let i = 0; results.length < predictionCount; i++) {
      const totalCount = overallFrequency.reduce((s, f) => s + f.count, 0);
      const weightedPick = (): number => {
        if (totalCount === 0) return Math.floor(Math.random() * 10);
        let r = Math.random() * totalCount;
        for (const f of overallFrequency) { r -= f.count; if (r <= 0) return f.digit; }
        return Math.floor(Math.random() * 10);
      };
      results.push({
        digits: [weightedPick(), weightedPick(), weightedPick(), weightedPick()] as [number, number, number, number],
        method: `Weighted Random #${i + 1}`, methodIcon: '🎲',
        confidence: Math.floor(20 + Math.random() * 20),
        reasoning: 'Random selection weighted by overall frequency.',
      });
    }

    return results.slice(0, predictionCount);
  }, [draws, overallFrequency, positionFrequency, hotNumbers, warmNumbers, lastSeen, cycleAnalysis, deltaFrequency, _mirrorAnalysis, digitalRootAnalysis, workoutNumbers, markovPositionTransitions, trendMomentum, backtestResults, predictionCount]);
}
