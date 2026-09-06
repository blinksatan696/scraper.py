import { useState, useCallback, useMemo, useRef } from 'react';
import { MARKETS, getMarketById } from './data/markets';
import { useMarketData } from './hooks/useMarketData';
import { useAnalysis, usePredictions, filterDrawsByPeriod } from './hooks/useAnalysis';
import type { AnalysisPeriod, SmartGenConfig } from './hooks/useAnalysis';

type TabKey = 'frequency' | 'position' | 'pairs' | 'trend' | 'delta' | 'systems' | 'markov' | 'momentum' | 'skipHit' | 'backtest' | 'prediction';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayStr(): string { 
  return new Date().toISOString().split('T')[0]; 
}

function getYesterdayStr(): string { 
  const d = new Date(); d.setDate(d.getDate() - 1); 
  return d.toISOString().split('T')[0]; 
}

function isToday(dateStr: string): boolean { return dateStr === getTodayStr(); }
function isYesterday(dateStr: string): boolean { return dateStr === getYesterdayStr(); }

function getRelativeDay(dateStr: string): string {
  if (!dateStr) return '';
  if (isToday(dateStr)) return 'Today'; if (isYesterday(dateStr)) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00'); const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 7) return `${diff} days ago`; return '';
}
function mirrorDigit(d: number): number { return (d + 5) % 10; }

const PERIOD_OPTIONS: { key: AnalysisPeriod; label: string; shortLabel: string; desc: string; icon: string }[] = [
  { key: 'all', label: 'Full Result', shortLabel: 'All', desc: 'All available data', icon: '📊' },
  { key: '30', label: '30 Days', shortLabel: '30D', desc: 'Last 30 results', icon: '📅' },
  { key: '20', label: '20 Days', shortLabel: '20D', desc: 'Last 20 results', icon: '📅' },
  { key: '10', label: '10 Days', shortLabel: '10D', desc: 'Last 10 results', icon: '🔟' },
  { key: '7', label: '7 Days', shortLabel: '7D', desc: 'Last 7 results', icon: '📆' },
  { key: '5', label: '5 Days', shortLabel: '5D', desc: 'Last 5 results', icon: '5️⃣' },
  { key: '3', label: '3 Days', shortLabel: '3D', desc: 'Last 3 results', icon: '3️⃣' },
];

const DEFAULT_SMART_GEN: SmartGenConfig = {
  useHot: true, useCold: false, useOverdue: true, useMarkov: true, useMomentum: true,
  usePatternType: 'any', targetSum: [10, 26], targetRoot: null, excludeDigits: [], maxRepeats: 2,
};

const getSessionSlots = (marketId: string) => {
  if (marketId === 'oregon') {
    return [
      { key: '1pm' as const, label: '1:00 PM', icon: '🕐' },
      { key: '4pm' as const, label: '4:00 PM', icon: '🕓' },
      { key: '7pm' as const, label: '7:00 PM', icon: '🕖' },
      { key: '10pm' as const, label: '10:00 PM', icon: '🕙' },
    ];
  }
  if (marketId === 'texas') {
    return [
      { key: 'morning' as const, label: 'Morning (10 AM)', icon: '🌅' },
      { key: 'day' as const, label: 'Day (12:27 PM)', icon: '☀️' },
      { key: 'evening' as const, label: 'Evening (6 PM)', icon: '🌇' },
      { key: 'night' as const, label: 'Night (10:12 PM)', icon: '🌙' },
    ];
  }
  if (marketId === 'california') {
    return [{ key: 'evening' as const, label: 'Daily', icon: '⭐' }];
  }
  return [
    { key: 'midday' as const, label: 'Midday', icon: '☀️' },
    { key: 'evening' as const, label: 'Evening', icon: '🌙' },
  ];
};

const getSessionBadge = (session: string) => {
  switch (session) {
    case 'morning':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">🌅 Morning</span>;
    case 'day':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">☀️ Day</span>;
    case 'evening':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">🌇 Evening</span>;
    case 'night':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">🌙 Night</span>;
    case '1pm':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">🕐 1 PM</span>;
    case '4pm':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">🕓 4 PM</span>;
    case '7pm':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">🕖 7 PM</span>;
    case '10pm':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">🕙 10 PM</span>;
    case 'midday':
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">☀️ Midday</span>;
    default:
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⏰ {session}</span>;
  }
};

function App() {
  const [selectedMarketId, setSelectedMarketId] = useState('california');
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const [searchMarket, setSearchMarket] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('frequency');
  const [predictionCount, setPredictionCount] = useState(8);
  const [showHistory, setShowHistory] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDigits, setEditDigits] = useState(['', '', '', '']);
  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('all');
  const [inputMode, setInputMode] = useState<'quick' | 'date' | 'bulk'>('quick');
  const [inputDigit1, setInputDigit1] = useState('');
  const [inputDigit2, setInputDigit2] = useState('');
  const [inputDigit3, setInputDigit3] = useState('');
  const [inputDigit4, setInputDigit4] = useState('');
  const [inputDate, setInputDate] = useState('');
  const [inputSession, setInputSession] = useState<'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm'>('evening');
  const [bulkInput, setBulkInput] = useState('');
  const [inputSuccess, setInputSuccess] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const [showCalendar, setShowCalendar] = useState(false);
  const [smartGen, setSmartGen] = useState<SmartGenConfig>(DEFAULT_SMART_GEN);
  const [smartGenResults, setSmartGenResults] = useState<[number, number, number, number][]>([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState(() => localStorage.getItem('github_token') || '');
  const [, setSyncStatus] = useState<'idle' | 'saved'>('idle');

  const digit1Ref = useRef<HTMLInputElement>(null);
  const digit2Ref = useRef<HTMLInputElement>(null);
  const digit3Ref = useRef<HTMLInputElement>(null);
  const digit4Ref = useRef<HTMLInputElement>(null);
  const editDigit1Ref = useRef<HTMLInputElement>(null);
  const editDigit2Ref = useRef<HTMLInputElement>(null);
  const editDigit3Ref = useRef<HTMLInputElement>(null);
  const editDigit4Ref = useRef<HTMLInputElement>(null);

  const market = getMarketById(selectedMarketId) || MARKETS[0];
  const isCalifornia = selectedMarketId === 'california';
  
  const { draws = [], addDraw, addBulkDraws, removeDraw, updateDraw, clearAll, loadSampleData } = useMarketData(selectedMarketId, market.sampleData);

  const handleSaveToken = () => {
    localStorage.setItem('github_token', githubTokenInput.trim());
    setShowTokenModal(false);
    setSyncStatus('saved');
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  const getDrawByDateSession = useCallback((date: string, session: any) => {
    return draws.find((d: any) => d.date === date && d.session === session);
  }, [draws]);

  const getDatesWithDraws = useCallback(() => {
    return new Set(draws.map((d: any) => d.date));
  }, [draws]);

  const displayDraws = useMemo(() => {
    if (!draws || draws.length === 0) return [];
    if (!isCalifornia) return draws;
    const byDate = new Map<string, typeof draws[number]>();
    for (const d of draws) {
      const existing = byDate.get(d.date);
      if (!existing || d.session === 'evening') byDate.set(d.date, d);
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [draws, isCalifornia]);

  const analysisDraws = useMemo(() => filterDrawsByPeriod(displayDraws, analysisPeriod), [displayDraws, analysisPeriod]);

  const getDisplayDrawByDate = useCallback((date: string) => {
    if (!isCalifornia) return undefined;
    return displayDraws.find(d => d.date === date);
  }, [displayDraws, isCalifornia]);

  const analysis = useAnalysis(analysisDraws);
  const predictions = usePredictions(
    analysisDraws, analysis.overallFrequency, analysis.positionFrequency,
    analysis.hotNumbers, analysis.warmNumbers, analysis.lastSeen,
    analysis.cycleAnalysis, analysis.deltaFrequency, analysis.mirrorAnalysis,
    analysis.digitalRootAnalysis, analysis.workoutNumbers,
    analysis.markovPositionTransitions, analysis.trendMomentum, analysis.backtestResults,
    predictionCount
  );

  const periodInfo = useMemo(() => {
    const option = PERIOD_OPTIONS.find(p => p.key === analysisPeriod) || PERIOD_OPTIONS[0];
    const totalDraws = displayDraws.length;
    const usedDraws = analysisDraws.length;
    const dateRange = analysisDraws.length > 0 ? `${formatDateShort(analysisDraws[0].date)} — ${formatDateShort(analysisDraws[analysisDraws.length - 1].date)}` : 'No data';
    return { ...option, totalDraws, usedDraws, dateRange };
  }, [analysisPeriod, displayDraws.length, analysisDraws]);

  const filteredMarkets = useMemo(() => { const q = searchMarket.toLowerCase(); if (!q) return MARKETS; return MARKETS.filter(m => m.name.toLowerCase().includes(q) || m.state.toLowerCase().includes(q) || m.country.toLowerCase().includes(q)); }, [searchMarket]);
  const groupedMarkets = useMemo(() => { const groups: Record<string, typeof MARKETS> = {}; filteredMarkets.forEach(m => { if (!groups[m.country]) groups[m.country] = []; groups[m.country].push(m); }); return groups; }, [filteredMarkets]);
  const filteredDraws = useMemo(() => {
    if (isCalifornia || historyFilter === 'all') return [...displayDraws];
    return displayDraws.filter(d => d.session === historyFilter);
  }, [displayDraws, historyFilter, isCalifornia]);

  const calendarData = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1); const lastDay = new Date(year, month, 0);
    const startPad = firstDay.getDay(); const totalDays = lastDay.getDate();
    const today = getTodayStr(); const datesWithDraws = isCalifornia ? new Set(displayDraws.map(d => d.date)) : getDatesWithDraws();
    const cells: { date: string; day: number; isCurrentMonth: boolean; hasData: boolean; isToday: boolean; isFuture: boolean; midday?: [number, number, number, number]; evening?: [number, number, number, number] }[] = [];
    for (let i = 0; i < startPad; i++) { const d = new Date(year, month - 1, -startPad + i + 1); const dateStr = d.toISOString().split('T')[0]; cells.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, hasData: datesWithDraws.has(dateStr), isToday: false, isFuture: false }); }
    for (let day = 1; day <= totalDays; day++) { const d = new Date(year, month - 1, day); const dateStr = d.toISOString().split('T')[0]; const midEntry = isCalifornia ? undefined : getDrawByDateSession(dateStr, 'midday'); const eveEntry = isCalifornia ? getDisplayDrawByDate(dateStr) : getDrawByDateSession(dateStr, 'evening'); cells.push({ date: dateStr, day, isCurrentMonth: true, hasData: datesWithDraws.has(dateStr), isToday: dateStr === today, isFuture: dateStr > today, midday: midEntry?.digits, evening: eveEntry?.digits }); }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) { const d = new Date(year, month, i); const dateStr = d.toISOString().split('T')[0]; cells.push({ date: dateStr, day: d.getDate(), isCurrentMonth: false, hasData: datesWithDraws.has(dateStr), isToday: false, isFuture: dateStr > today }); }
    return cells;
  }, [calendarMonth, displayDraws, isCalifornia, getDatesWithDraws, getDrawByDateSession, getDisplayDrawByDate]);

  const getFullInputValue = (): string => `${inputDigit1}${inputDigit2}${inputDigit3}${inputDigit4}`;
  const clearInputDigits = () => { setInputDigit1(''); setInputDigit2(''); setInputDigit3(''); setInputDigit4(''); digit1Ref.current?.focus(); };

  const handleDigitInput = (value: string, position: 1 | 2 | 3 | 4) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 1);
    switch (position) {
      case 1: setInputDigit1(cleaned); if (cleaned) digit2Ref.current?.focus(); break;
      case 2: setInputDigit2(cleaned); if (cleaned) digit3Ref.current?.focus(); break;
      case 3: setInputDigit3(cleaned); if (cleaned) digit4Ref.current?.focus(); break;
      case 4: setInputDigit4(cleaned); break;
    }
  };

  const handleDigitKeyDown = (e: React.KeyboardEvent, position: 1 | 2 | 3 | 4) => {
    if (e.key === 'Backspace') {
      const currentVal = position === 1 ? inputDigit1 : position === 2 ? inputDigit2 : position === 3 ? inputDigit3 : inputDigit4;
      if (!currentVal && position > 1) {
        switch (position) { case 2: digit1Ref.current?.focus(); setInputDigit1(''); break; case 3: digit2Ref.current?.focus(); setInputDigit2(''); break; case 4: digit3Ref.current?.focus(); setInputDigit3(''); break; }
      }
    } else if (e.key === 'Enter') handleAddDraw();
  };

  const handleEditDigitInput = (value: string, position: number) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 1);
    setEditDigits(prev => { const n = [...prev]; n[position] = cleaned; return n; });
    if (cleaned) { const refs = [editDigit1Ref, editDigit2Ref, editDigit3Ref, editDigit4Ref]; if (position < 3) refs[position + 1].current?.focus(); }
  };

  const handleEditDigitKeyDown = (e: React.KeyboardEvent, position: number) => {
    if (e.key === 'Backspace' && !editDigits[position] && position > 0) { const refs = [editDigit1Ref, editDigit2Ref, editDigit3Ref, editDigit4Ref]; refs[position - 1].current?.focus(); setEditDigits(prev => { const n = [...prev]; n[position - 1] = ''; return n; }); }
    else if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') setEditingId(null);
  };

  const showSuccessMessage = (msg: string) => { setInputSuccess(msg); setTimeout(() => setInputSuccess(''), 3000); };

  const handleAddDraw = useCallback(() => {
    const fullVal = `${inputDigit1}${inputDigit2}${inputDigit3}${inputDigit4}`;
    if (fullVal.length !== 4 || !/^\d{4}$/.test(fullVal)) { alert('Please enter all 4 digits (0-9)'); return; }
    const digits = fullVal.split('').map(Number) as [number, number, number, number];
    const date = inputDate || getYesterdayStr();
    if (date > getTodayStr()) { alert('Cannot enter results for future dates!'); return; }
    const existing = isCalifornia
      ? getDisplayDrawByDate(date)
      : getDrawByDateSession(date, inputSession);
    if (isCalifornia) {
      if (existing) updateDraw(existing.id, digits);
      else addDraw(digits, date, 'evening');
    } else {
      addDraw(digits, date, inputSession);
    }
    const sessionLabel = isCalifornia ? '' : ` ${inputSession}`;
    const dateLabel = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : formatDate(date);
    showSuccessMessage(existing ? `✅ Updated${sessionLabel} result for ${dateLabel}: ${fullVal}` : `✅ Added${sessionLabel} result for ${dateLabel}: ${fullVal}`);
    setInputDigit1(''); setInputDigit2(''); setInputDigit3(''); setInputDigit4('');
    digit1Ref.current?.focus();
  }, [inputDigit1, inputDigit2, inputDigit3, inputDigit4, inputDate, inputSession, isCalifornia, addDraw, updateDraw, getDisplayDrawByDate, getDrawByDateSession]);

  const handleBulkAdd = useCallback(() => {
    const lines = bulkInput.split('\n').filter(l => l.trim().length > 0);
    const entries: { digits: [number, number, number, number]; date: string; session: any }[] = [];
    const today = getTodayStr();
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const parts = line.trim().split(/[,\t;|]+/).map(p => p.trim());
      if (parts.length === 1) { const cleaned = parts[0].replace(/\s/g, ''); if (cleaned.length === 4 && /^\d{4}$/.test(cleaned)) { const d = new Date(); d.setDate(d.getDate() - lineNum); entries.push({ digits: cleaned.split('').map(Number) as [number, number, number, number], date: d.toISOString().split('T')[0], session: 'evening' }); } }
      else if (parts.length === 2) { const [dateOrDigits, digitsOrSession] = parts; if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrDigits) && /^\d{4}$/.test(digitsOrSession) && dateOrDigits <= today) entries.push({ digits: digitsOrSession.split('').map(Number) as [number, number, number, number], date: dateOrDigits, session: 'evening' }); }
      else if (parts.length >= 3) { const [datePart, sessionPart, digitsPart] = parts; if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && /^\d{4}$/.test(digitsPart) && datePart <= today) entries.push({ digits: digitsPart.split('').map(Number) as [number, number, number, number], date: datePart, session: sessionPart as any }); }
    }
    if (entries.length > 0) { addBulkDraws(entries); setBulkInput(''); showSuccessMessage(`✅ Added/updated ${entries.length} draw results!`); }
    else alert('No valid data found.');
  }, [bulkInput, addBulkDraws]);

  const handleClearAll = () => { if (confirm(`Delete all data for ${market.state}?`)) clearAll(); };
  const handleCalendarClick = (date: string, isFuture: boolean) => { if (isFuture) return; setInputDate(date); setInputMode('date'); setShowCalendar(false); digit1Ref.current?.focus(); };
  const handleStartEdit = (id: number, digits: [number, number, number, number]) => { setEditingId(id); setEditDigits(digits.map(String)); setTimeout(() => editDigit1Ref.current?.focus(), 50); };
  const handleSaveEdit = () => {
    if (editingId === null) return;
    const fullVal = editDigits.join('');
    if (fullVal.length !== 4 || !/^\d{4}$/.test(fullVal)) { alert('Please enter exactly 4 digits'); return; }
    updateDraw(editingId, fullVal.split('').map(Number) as [number, number, number, number]);
    setEditingId(null); setEditDigits(['', '', '', '']); showSuccessMessage('✅ Result updated!');
  };

  const generateSmart = useCallback(() => {
    const results: [number, number, number, number][] = [];
    const maxAttempts = 10000;
    const targetCount = 5;

    for (let attempt = 0; attempt < maxAttempts && results.length < targetCount; attempt++) {
      const pick: number[] = [];
      for (let pos = 0; pos < 4; pos++) {
        const weights = Array(10).fill(1);
        if (smartGen.useHot && analysis.hotNumbers) analysis.hotNumbers.forEach(h => { weights[h.digit] += 3; });
        if (smartGen.useOverdue && analysis.lastSeen) analysis.lastSeen.slice(0, 3).forEach(l => { weights[l.digit] += l.gap; });
        if (smartGen.useMarkov && analysis.markovPositionTransitions?.length > 0 && analysisDraws.length > 0) {
          const lastD = analysisDraws[analysisDraws.length - 1].digits[pos];
          const trans = analysis.markovPositionTransitions[pos]?.transitions[lastD];
          if (trans) trans.forEach((c, d) => { weights[d] += c * 2; });
        }
        if (smartGen.useMomentum && analysis.trendMomentum) analysis.trendMomentum.filter(t => t.direction === 'rising').forEach(t => { weights[t.digit] += t.strength / 20; });
        if (smartGen.useCold && analysis.coldNumbers) analysis.coldNumbers.forEach(c => { weights[c.digit] += 2; });
        smartGen.excludeDigits.forEach(d => { weights[d] = 0; });
        const total = weights.reduce((a, b) => a + b, 0);
        if (total === 0) { pick.push(Math.floor(Math.random() * 10)); continue; }
        let r = Math.random() * total;
        for (let d = 0; d < 10; d++) { r -= weights[d]; if (r <= 0) { pick.push(d); break; } }
        if (pick.length <= pos) pick.push(0);
      }
      const result = pick as [number, number, number, number];
      const sum = result.reduce((a, b) => a + b, 0);
      if (sum < smartGen.targetSum[0] || sum > smartGen.targetSum[1]) continue;
      if (smartGen.targetRoot !== null) {
        const root = sum === 0 ? 0 : 1 + ((sum - 1) % 9);
        if (root !== smartGen.targetRoot) continue;
      }
      const freq: Record<number, number> = {};
      result.forEach(d => freq[d] = (freq[d] || 0) + 1);
      if (Math.max(...Object.values(freq)) > smartGen.maxRepeats) continue;
      if (smartGen.usePatternType !== 'any') {
        const vals = Object.values(freq).sort((a, b) => b - a);
        let pType = 'all_unique';
        if (vals[0] === 4) pType = 'quad';
        else if (vals[0] === 3) pType = 'triple';
        else if (vals[0] === 2 && vals[1] === 2) pType = 'double_pair';
        else if (vals[0] === 2) pType = 'single_pair';
        if (pType !== smartGen.usePatternType) continue;
      }
      const key = result.join('');
      if (results.some(r => r.join('') === key)) continue;
      results.push(result);
    }
    setSmartGenResults(results);
  }, [smartGen, analysis, analysisDraws]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'frequency', label: '📊 Freq' },
    { key: 'position', label: '📍 Pos' },
    { key: 'pairs', label: '🔗 Pairs' },
    { key: 'trend', label: '📈 Trend' },
    { key: 'delta', label: '📐 Delta' },
    { key: 'systems', label: '🧮 Systems' },
    { key: 'markov', label: '🔗 Markov' },
    { key: 'momentum', label: '📈 Momentum' },
    { key: 'skipHit', label: '🎯 Skip/Hit' },
    { key: 'backtest', label: '🧪 Backtest' },
    { key: 'prediction', label: '🔮 Predict' },
  ];

  const accentGradient = `bg-gradient-to-r ${market.colorFrom} ${market.colorTo}`;
  const currentDateLabel = inputDate ? (isToday(inputDate) ? `Today (${formatDateShort(inputDate)})` : isYesterday(inputDate) ? `Yesterday (${formatDateShort(inputDate)})` : formatDate(inputDate)) : `Yesterday (${formatDateShort(getYesterdayStr())})`;

  const renderEditRow = (refs: React.RefObject<HTMLInputElement | null>[]) => (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      <span className="text-[10px] text-blue-400">Edit:</span>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((pos) => (
          <input key={pos} ref={refs[pos]} type="text" inputMode="numeric" value={editDigits[pos]}
            onChange={(e) => handleEditDigitInput(e.target.value, pos)}
            onKeyDown={(e) => handleEditDigitKeyDown(e, pos)}
            onFocus={(e) => e.target.select()} maxLength={1}
            className={`w-9 h-9 text-center text-base font-bold font-mono bg-black/40 border-2 rounded-lg focus:outline-none transition ${editDigits[pos] ? 'border-blue-500/50 text-white' : 'border-white/20 text-gray-300'}`}
            placeholder="–" />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={handleSaveEdit} disabled={editDigits.join('').length !== 4}
          className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs border border-green-500/30 hover:bg-green-500/30 transition disabled:opacity-30">✓ Save</button>
        <button onClick={() => setEditingId(null)}
          className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs border border-white/10 hover:bg-white/10 transition">✕</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 text-white">
      {/* Modal Pilih Market */}
      {showMarketSelector && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 px-4" onClick={() => setShowMarketSelector(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">🌎 Select Market</h2>
                <button onClick={() => setShowMarketSelector(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
              </div>
              <input type="text" value={searchMarket} onChange={e => setSearchMarket(e.target.value)} placeholder="Search state or market name..."
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" autoFocus />
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-4 space-y-6">
              {Object.entries(groupedMarkets).map(([country, markets]) => (
                <div key={country}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{country}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {markets.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMarketId(m.id); setShowMarketSelector(false); setSearchMarket(''); setActiveTab('frequency'); setAnalysisPeriod('all'); }}
                        className={`text-left p-3 rounded-xl border transition hover:scale-[1.02] active:scale-[0.98] ${m.id === selectedMarketId ? 'bg-white/10 border-white/30 ring-2 ring-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                        <div className="flex items-center gap-3"><span className="text-2xl">{m.flag}</span><div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{m.state}</div><div className="text-xs text-gray-400 truncate">{m.name}</div></div><div className={`w-3 h-3 rounded-full bg-gradient-to-r ${m.colorFrom} ${m.colorTo}`} /></div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Kalender */}
      {showCalendar && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 px-4" onClick={() => setShowCalendar(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">📅 Select Draw Date</h2><button onClick={() => setShowCalendar(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button></div>
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { const [y, m] = calendarMonth.split('-').map(Number); const prev = new Date(y, m - 2, 1); setCalendarMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`); }} className="px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20 transition text-sm">◀</button>
                <span className="font-semibold">{new Date(calendarMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => { const [y, m] = calendarMonth.split('-').map(Number); const next = new Date(y, m, 1); setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`); }} className="px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20 transition text-sm">▶</button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (<div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>))}</div>
              <div className="grid grid-cols-7 gap-1">
                {calendarData.map((cell, i) => (
                  <button key={i} onClick={() => handleCalendarClick(cell.date, cell.isFuture)} disabled={cell.isFuture}
                    className={`relative p-1 rounded-lg text-center transition text-xs min-h-[48px] flex flex-col items-center justify-start ${cell.isFuture ? 'opacity-30 cursor-not-allowed' : cell.isToday ? 'bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30' : cell.hasData ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20' : cell.isCurrentMonth ? 'bg-white/5 hover:bg-white/10 border border-transparent' : 'opacity-30 border border-transparent'}`}>
                    <span className={`font-medium ${cell.isToday ? 'text-blue-400' : cell.isCurrentMonth ? 'text-white' : 'text-gray-600'}`}>{cell.day}</span>
                    {isCalifornia ? (cell.evening && <span className="text-[7px] text-yellow-400 font-mono leading-none mt-0.5">{cell.evening.join('')}</span>) : (<>
                      {cell.midday && <span className="text-[7px] text-yellow-400 font-mono leading-none mt-0.5">{cell.midday.join('')}</span>}
                      {cell.evening && <span className="text-[7px] text-purple-400 font-mono leading-none mt-0.5">{cell.evening.join('')}</span>}
                    </>)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfigurasi GitHub Token */}
      {showTokenModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTokenModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">🔑 Konfigurasi GitHub Token</h2>
              <button onClick={() => setShowTokenModal(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Masukkan Personal Access Token (PAT) GitHub Anda agar aplikasi dapat melakukan auto-sync data market langsung ke repositori Anda secara otomatis.
            </p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">GitHub Token (ghp_...)</label>
              <input 
                type="password" 
                value={githubTokenInput} 
                onChange={e => setGithubTokenInput(e.target.value)} 
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" 
                className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTokenModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition">Batal</button>
              <button onClick={handleSaveToken} className={`px-5 py-2 ${accentGradient} text-white font-bold rounded-xl text-sm shadow-lg hover:opacity-90 transition`}>Simpan Token</button>
            </div>
          </div>
        </div>
      )}

      {/* Header Utama */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${accentGradient} rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg flex-shrink-0`}>4</div>
              <div className="min-w-0"><h1 className="text-lg font-bold truncate">Pick 4 Pro Analyzer</h1><p className="text-xs text-gray-400 truncate">Advanced Multi-Market Analysis & Prediction</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTokenModal(true)} 
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-semibold transition border border-white/10"
                title="GitHub Settings"
              >
                <span>🔑</span>
                <span className="hidden sm:inline">GitHub Token</span>
              </button>
              <button onClick={() => setShowMarketSelector(true)} className={`flex items-center gap-2 px-3 py-2 ${accentGradient} text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-lg active:scale-95`}>
                <span>{market.flag}</span><span className="hidden sm:inline">{market.state}</span><span className="text-xs opacity-70">▼</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <div className={`bg-gradient-to-r ${market.colorFrom}/10 ${market.colorTo}/10 rounded-2xl border border-white/10 p-4`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{market.flag}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg truncate">{market.state} — {market.name}</h2>
                  {localStorage.getItem('github_token') ? (
                    <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">🟢 GitHub Synced</span>
                  ) : (
                    <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">⚠️ Local Only (No Token)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{market.schedule} · {market.drawTimes}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-medium border border-white/10">{displayDraws.length} draws</span>
              <button onClick={() => setShowInfo(!showInfo)} className="text-xs text-gray-400 hover:text-white underline underline-offset-2">{showInfo ? 'Hide' : 'Show'} Info</button>
            </div>
          </div>
          {showInfo && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs mb-1">Format</p><p className="font-medium">{market.format}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">Digit Range</p><p className="font-medium">{market.digitRange}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">Play Types</p><p className="font-medium text-xs">{market.notes}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">Country</p><p className="font-medium">{market.country}</p></div>
            </div>
          )}
        </div>
            
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><span className="text-xl">✏️</span> Enter Draw Results</h2>
              <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg">
                {([{ key: 'quick' as const, label: '⚡ Quick' }, { key: 'date' as const, label: '📅 By Date' }, { key: 'bulk' as const, label: '📋 Bulk' }]).map(mode => (
                  <button key={mode.key} onClick={() => setInputMode(mode.key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${inputMode === mode.key ? `${accentGradient} text-white shadow` : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{mode.label}</button>
                ))}
              </div>
            </div>
            {inputSuccess && <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400 flex items-center gap-2 animate-pulse">{inputSuccess}</div>}
          </div>

          {inputMode === 'quick' && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                {getSessionSlots(selectedMarketId).map(session => {
                  const targetDate = getYesterdayStr();
                  const existingDraw = getDrawByDateSession(targetDate, session.key);

                  return (
                    <div key={session.key} className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                          <span>{session.icon}</span>
                          <span>{session.label}</span>
                        </span>
                        <span className="text-[10px] text-gray-500">{targetDate}</span>
                      </div>

                      {existingDraw ? (
                        <div className="flex items-center justify-between bg-white/5 px-2 py-1.5 rounded-lg">
                          <div className="flex gap-1 font-mono font-bold text-green-400">
                            {existingDraw.digits.map((digit, idx) => (
                              <span key={idx} className="w-5 h-5 bg-black/40 rounded flex items-center justify-center text-xs">{digit}</span>
                            ))}
                          </div>
                          <button onClick={() => handleStartEdit(existingDraw.id, existingDraw.digits)} className="text-[10px] text-amber-400 hover:underline">Edit</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setInputDate(targetDate); setInputSession(session.key); setInputMode('date'); }}
                          className="w-full py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                        >
                          <span>+ Add</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 flex-wrap text-xs">
                <button onClick={() => setShowCalendar(true)} className="text-blue-300 hover:text-blue-200 underline underline-offset-2">📅 Calendar</button><span className="text-gray-700">|</span>
                <button onClick={() => setInputMode('bulk')} className="text-blue-300 hover:text-blue-200 underline underline-offset-2">📋 Bulk Import</button><span className="text-gray-700">|</span>
                <button onClick={handleClearAll} className="text-red-400 hover:text-red-300 underline underline-offset-2">🗑️ Clear All</button>
                {draws.length === 0 && market.sampleData.length > 0 && (<><span className="text-gray-700">|</span><button onClick={loadSampleData} className="text-green-400 hover:text-green-300 underline underline-offset-2">📦 Load Sample</button></>)}
              </div>
            </div>
          )}

          {inputMode === 'date' && (
            <div className="px-5 pb-5">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1"><label className="text-xs text-gray-400 mb-1 block">Draw Date</label><div className="flex gap-2"><input type="date" value={inputDate || getYesterdayStr()} onChange={e => setInputDate(e.target.value)} max={getTodayStr()} className="flex-1 bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" /><button onClick={() => setShowCalendar(true)} className="px-3 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition text-sm">📅</button></div></div>
                {!isCalifornia && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Session</label>
                    <select 
                      value={inputSession} 
                      onChange={e => setInputSession(e.target.value as any)}
                      className="bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {getSessionSlots(selectedMarketId).map(s => (
                        <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="bg-black/20 rounded-xl p-3 mb-4 flex items-center justify-between">
                <div><span className="text-xs text-gray-400">For: </span><span className="text-sm font-semibold text-white">{currentDateLabel}</span>{!isCalifornia && <span className="text-xs ml-2">Session: {inputSession}</span>}</div>
                {(isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession)) && <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full">⚠️ Will update</span>}
              </div>
              {(isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession)) && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-yellow-400 mb-2">Current result:</p><div className="flex gap-2">{(isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession))?.digits?.map((d, j) => (<span key={j} className={`w-10 h-10 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded-lg text-lg font-bold text-white font-mono`}>{d}</span>))}</div></div>
                    <button onClick={() => { const ex = isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession); if (ex) handleStartEdit(ex.id, ex.digits); }} className="px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-xs border border-blue-500/20 hover:bg-blue-500/20 transition">✏️ Edit</button>
                  </div>
                  {editingId !== null && (isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession))?.id === editingId && (
                    <div className="mt-3 pt-3 border-t border-yellow-500/20">{renderEditRow([editDigit1Ref, editDigit2Ref, editDigit3Ref, editDigit4Ref])}</div>
                  )}
                </div>
              )}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block">Enter 4 Digits</label>
                <div className="flex items-center gap-3 justify-center">
                  {[{ ref: digit1Ref, val: inputDigit1, pos: 1 as const }, { ref: digit2Ref, val: inputDigit2, pos: 2 as const }, { ref: digit3Ref, val: inputDigit3, pos: 3 as const }, { ref: digit4Ref, val: inputDigit4, pos: 4 as const }].map((d) => (
                    <div key={d.pos} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500">P{d.pos}</span>
                      <input ref={d.ref} type="text" inputMode="numeric" value={d.val} onChange={(e) => handleDigitInput(e.target.value, d.pos)} onKeyDown={(e) => handleDigitKeyDown(e, d.pos)} onFocus={(e) => e.target.select()} maxLength={1}
                        className={`w-14 h-14 text-center text-2xl font-bold font-mono bg-black/40 border-2 rounded-xl focus:outline-none transition ${d.val ? 'border-green-500/50 text-white' : 'border-white/20 text-gray-300 focus:border-blue-500/50'}`} placeholder="–" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={clearInputDigits} className="px-4 py-2.5 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition text-sm">Clear</button>
                <button onClick={handleAddDraw} disabled={getFullInputValue().length !== 4} className={`px-8 py-2.5 ${accentGradient} text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg active:scale-95 disabled:opacity-30 text-sm`}>
                  {(isCalifornia ? getDisplayDrawByDate(inputDate || getYesterdayStr()) : getDrawByDateSession(inputDate || getYesterdayStr(), inputSession)) ? '🔄 Update' : '➕ Add'}
                </button>
              </div>
              <div className="flex gap-2 flex-wrap text-xs mt-4 justify-center"><button onClick={() => setInputMode('quick')} className="text-gray-400 hover:text-white underline underline-offset-2">← Quick Input</button></div>
            </div>
          )}

          {inputMode === 'bulk' && (
            <div className="px-5 pb-5">
              <div className="bg-black/30 rounded-xl p-3 mb-4 text-xs font-mono text-gray-400 space-y-1">
                <p className="text-gray-300 font-sans font-semibold mb-2">Formats:</p>
                <p><span className="text-green-400">1234</span> — digits only</p>
                <p><span className="text-green-400">2024-01-15,1234</span> — date + digits</p>
                <p><span className="text-green-400">2024-01-15,1pm,1234</span> — date + session + digits</p>
              </div>
              <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder="Paste results here, one per line..." rows={6}
                className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => setInputMode('quick')} className="px-4 py-2 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20">← Back</button>
                <button onClick={handleBulkAdd} disabled={!bulkInput.trim()} className={`px-6 py-2 ${accentGradient} text-white font-semibold rounded-lg text-sm hover:opacity-90 shadow-lg active:scale-95 disabled:opacity-30`}>📥 Import</button>
              </div>
            </div>
          )}
        </section>

        {displayDraws.length > 0 && (
          <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><span className="text-xl">📋</span> History <span className="text-xs text-gray-500 font-normal">({draws.length})</span></h2>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg">
                  {isCalifornia ? (
                    <button onClick={() => setHistoryFilter('all')} className="px-2 py-1 rounded text-xs transition bg-white/15 text-white">All</button>
                  ) : (
                    getSessionSlots(selectedMarketId).map(slot => (
                      <button key={slot.key} onClick={() => setHistoryFilter(slot.key)} className={`px-2 py-1 rounded text-xs transition ${historyFilter === slot.key ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}>{slot.icon} {slot.label}</button>
                    ))
                  )}
                  {historyFilter !== 'all' && (
                    <button onClick={() => setHistoryFilter('all')} className="px-2 py-1 rounded text-xs text-blue-400 hover:underline">Reset</button>
                  )}
                </div>
                <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-gray-400 hover:text-white">{showHistory ? '▲ Hide' : '▼ Show'}</button>
              </div>
            </div>
            {showHistory && (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {filteredDraws.map((d) => (
                  <div key={d.id} className="bg-black/20 rounded-xl border border-white/5 hover:border-white/15 transition overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-[100px]"><div className="text-xs font-medium">{formatDateShort(d.date)}{getRelativeDay(d.date) && <span className="text-[10px] text-blue-400 ml-1">({getRelativeDay(d.date)})</span>}</div><div className="text-[10px] text-gray-500">{d.date}</div></div>
                      {!isCalifornia && getSessionBadge(d.session)}
                      <div className="flex items-center gap-1 flex-1">{d.digits.map((digit, j) => (<span key={j} className={`w-7 h-7 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded text-sm font-bold font-mono text-white`}>{digit}</span>))}<span className="text-[10px] text-gray-600 ml-2 font-mono">Σ{d.digits.reduce((a, b) => a + b, 0)}</span></div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { if (editingId === d.id) setEditingId(null); else handleStartEdit(d.id, d.digits); }} className={`w-7 h-7 flex items-center justify-center rounded transition text-xs ${editingId === d.id ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10'}`}>✏️</button>
                        <button onClick={() => { if (confirm(`Delete ${d.digits.join('')} from ${formatDateShort(d.date)}?`)) { removeDraw(d.id); if (editingId === d.id) setEditingId(null); } }} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-400 rounded hover:bg-red-500/10 transition text-xs">🗑️</button>
                      </div>
                    </div>
                    {editingId === d.id && (
                      <div className="px-3 pb-3 pt-1 border-t border-blue-500/20 bg-blue-500/5">
                        {renderEditRow([editDigit1Ref, editDigit2Ref, editDigit3Ref, editDigit4Ref])}
                        <div className="text-center mt-1"><span className="text-[10px] text-gray-600">Was: {d.digits.join('')} → New: {editDigits.join('') || '----'}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {displayDraws.length > 0 && (
          <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-4"><span className="text-xl">⏱️</span> Analysis Period</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
              {PERIOD_OPTIONS.map((option) => {
                const baseCount = displayDraws.length;
                const isActive = analysisPeriod === option.key;
                const count = option.key === 'all' ? baseCount : Math.min(parseInt(option.key, 10), baseCount);
                const isDisabled = option.key !== 'all' && baseCount < parseInt(option.key, 10);
                return (
                  <button key={option.key} onClick={() => !isDisabled && setAnalysisPeriod(option.key)} disabled={isDisabled}
                    className={`relative p-3 rounded-xl border-2 transition-all text-center ${isActive ? `${accentGradient} border-transparent text-white shadow-lg ring-2 ring-white/20` : isDisabled ? 'bg-black/20 border-white/5 text-gray-600 cursor-not-allowed opacity-40' : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                    <div className="text-lg mb-1">{option.icon}</div><div className="text-sm font-bold">{option.label}</div><div className="text-[10px] mt-0.5">{count} results</div>
                    {isActive && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center"><span className="text-[8px] text-black font-bold">✓</span></div>}
                  </button>
                );
              })}
            </div>
            <div className={`bg-gradient-to-r ${market.colorFrom}/5 ${market.colorTo}/5 rounded-xl border border-white/10 p-3`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-sm"><span className="text-gray-400">Analyzing </span><span className="font-bold text-white">{periodInfo.label}</span><span className="text-xs text-gray-500 ml-2">({periodInfo.usedDraws}/{periodInfo.totalDraws} draws · {periodInfo.dateRange})</span></div>
                {analysisPeriod !== 'all' && <button onClick={() => setAnalysisPeriod('all')} className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2">Full Result →</button>}
              </div>
            </div>
          </section>
        )}

        {analysisDraws.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl border border-red-500/20 p-4"><p className="text-xs text-gray-400 mb-1">🔥 Hot</p><div className="flex gap-1">{(analysis.hotNumbers || []).map(h => (<span key={h.digit} className="w-8 h-8 flex items-center justify-center bg-red-500/30 rounded-lg font-bold text-red-300 font-mono">{h.digit}</span>))}</div></div>
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl border border-blue-500/20 p-4"><p className="text-xs text-gray-400 mb-1">❄️ Cold</p><div className="flex gap-1">{(analysis.coldNumbers || []).map(c => (<span key={c.digit} className="w-8 h-8 flex items-center justify-center bg-blue-500/30 rounded-lg font-bold text-blue-300 font-mono">{c.digit}</span>))}</div></div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl border border-purple-500/20 p-4"><p className="text-xs text-gray-400 mb-1">⏰ Overdue</p><div className="flex gap-1">{(analysis.lastSeen || []).slice(0, 3).map(l => (<span key={l.digit} className="w-8 h-8 flex items-center justify-center bg-purple-500/30 rounded-lg font-bold text-purple-300 font-mono">{l.digit}</span>))}</div></div>
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl border border-green-500/20 p-4"><p className="text-xs text-gray-400 mb-1">📊 Top Sum</p><div className="flex items-center gap-2"><span className="text-2xl font-bold text-green-300 font-mono">{analysis.sumAnalysis?.[0]?.sum ?? '-'}</span><span className="text-xs text-gray-400">({analysis.sumAnalysis?.[0]?.count ?? 0}x)</span></div></div>
          </div>
        )}

        {analysisDraws.length > 0 && (<>
          <div className="flex gap-1 bg-black/30 p-1 rounded-xl border border-white/10 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 min-w-fit px-2 py-2.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${activeTab === tab.key ? `${accentGradient} text-white shadow-lg` : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{tab.label}</button>
            ))}
          </div>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <div className="mb-4 flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 border border-white/10 text-xs w-fit">
              <span>{periodInfo.icon}</span><span className="font-medium text-gray-300">{periodInfo.label}</span><span className="text-gray-500">({periodInfo.usedDraws} draws)</span>
            </div>

            {activeTab === 'frequency' && (
              <div>
                <h2 className="text-base font-semibold mb-5">📊 Digit Frequency</h2>
                <div className="space-y-2.5">
                  {(analysis.overallFrequency || []).map(f => (
                    <div key={f.digit} className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg font-bold font-mono flex-shrink-0">{f.digit}</span>
                      <div className="flex-1"><div className="h-8 bg-black/30 rounded-lg overflow-hidden relative">
                        <div className={`h-full rounded-lg transition-all duration-700 ${analysis.hotNumbers?.find(h => h.digit === f.digit) ? 'bg-gradient-to-r from-red-500 to-orange-500' : analysis.coldNumbers?.find(c => c.digit === f.digit) ? 'bg-gradient-to-r from-blue-600 to-blue-500' : `bg-gradient-to-r ${market.colorFrom} ${market.colorTo}`}`}
                          style={{ width: `${analysis.maxFreq > 0 ? (f.count / analysis.maxFreq) * 100 : 0}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{f.count}x ({f.percentage.toFixed(1)}%)</span>
                      </div></div>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🎲 Pattern Type Distribution</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {(analysis.patternTypeAnalysis || []).map(pt => (
                      <div key={pt.typeCode} className={`bg-black/30 rounded-xl border p-3 text-center ${pt.count > 0 ? 'border-white/10' : 'border-white/5 opacity-40'}`}>
                        <p className="text-xs font-semibold text-gray-300 mb-1">{pt.type.split(' (')[0]}</p>
                        <p className="text-[10px] text-gray-500 mb-2">{pt.type.match(/\((.+)\)/)?.[1]}</p>
                        <p className="text-xl font-bold text-white">{pt.count}</p>
                        <p className="text-xs text-gray-500">{pt.percentage.toFixed(1)}%</p>
                        {pt.examples?.length > 0 && <p className="text-[9px] text-gray-600 mt-1 font-mono">{pt.examples.join(', ')}</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-8 grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-gray-300">Odd/Even Patterns</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(analysis.oddEvenAnalysis || []).slice(0, 6).map(oe => (
                        <div key={oe.pattern} className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                          <div className="flex justify-center gap-0.5 mb-1">{oe.pattern.split('').map((c, i) => (<span key={i} className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${c === 'O' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-cyan-500/30 text-cyan-300'}`}>{c}</span>))}</div>
                          <p className="text-sm font-bold">{oe.count}x</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-gray-300">High/Low <span className="text-[10px] text-gray-500">(0-4=L, 5-9=H)</span></h3>
                    <div className="grid grid-cols-2 gap-2">
                      {(analysis.highLowAnalysis || []).slice(0, 6).map(hl => (
                        <div key={hl.pattern} className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                          <div className="flex justify-center gap-0.5 mb-1">{hl.pattern.split('').map((c, i) => (<span key={i} className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${c === 'H' ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'}`}>{c}</span>))}</div>
                          <p className="text-sm font-bold">{hl.count}x</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🔄 Repeat from Previous Draw</h3>
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    {(analysis.repeatStats?.distribution || []).map(d => (
                      <div key={d.repeats} className={`bg-black/30 rounded-xl border p-3 text-center ${d.repeats === 0 ? 'border-blue-500/20' : d.repeats >= 3 ? 'border-red-500/20' : 'border-white/5'}`}>
                        <p className="text-xs text-gray-400">{d.repeats} repeats</p>
                        <p className="text-lg font-bold">{d.count}</p>
                        <p className="text-[10px] text-gray-500">{d.pct.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Average digits repeated: <span className="text-white font-bold">{analysis.repeatStats?.avgRepeat}</span> | Exact position: <span className="text-white font-bold">{analysis.repeatStats?.avgExact}</span></p>
                </div>
              </div>
            )}

            {activeTab === 'position' && (
              <div>
                <h2 className="text-base font-semibold mb-5">📍 Position Analysis</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-2 text-gray-400">Digit</th><th className="text-center py-3 px-2 text-yellow-400">P1</th><th className="text-center py-3 px-2 text-green-400">P2</th><th className="text-center py-3 px-2 text-blue-400">P3</th><th className="text-center py-3 px-2 text-purple-400">P4</th><th className="text-center py-3 px-2 text-gray-400">Total</th></tr></thead>
                    <tbody>{(analysis.positionFrequency || []).map(pf => {
                      const total = pf.counts.reduce((a, b) => a + b, 0); const maxInRow = Math.max(...pf.counts); return (
                        <tr key={pf.digit} className="border-b border-white/5 hover:bg-white/5"><td className="py-2 px-2"><span className="w-8 h-8 inline-flex items-center justify-center bg-white/10 rounded-lg font-bold font-mono">{pf.digit}</span></td>
                          {pf.counts.map((count, i) => (<td key={i} className="text-center py-2 px-2"><span className={`inline-flex w-10 h-10 items-center justify-center rounded-lg font-bold font-mono text-sm ${count === maxInRow && count > 0 ? 'bg-yellow-500/30 text-yellow-300 ring-1 ring-yellow-500/50' : count > 0 ? 'bg-white/5 text-gray-300' : 'text-gray-600'}`}>{count}</span></td>))}
                          <td className="text-center py-2 px-2 font-bold">{total}</td></tr>);
                    })}</tbody>
                  </table>
                </div>
                <div className="mt-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🔗 Position Correlation</h3>
                  <p className="text-xs text-gray-400 mb-3">Which digit pairs appear together most at specific position combinations.</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(analysis.positionCorrelation || []).map(pc => (
                      <div key={`${pc.pos1}-${pc.pos2}`} className="bg-black/30 rounded-xl border border-white/5 p-3">
                        <p className="text-xs text-gray-400 mb-2">P{pc.pos1 + 1} ↔ P{pc.pos2 + 1} <span className="text-[10px] text-gray-600">(strength: {pc.strength}%)</span></p>
                        {(pc.correlations || []).slice(0, 3).map((c, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            <span className={`w-6 h-6 flex items-center justify-center ${i === 0 ? `bg-gradient-to-br ${market.colorFrom} ${market.colorTo} text-white` : 'bg-white/10'} rounded text-xs font-bold font-mono`}>{c.d1}</span>
                            <span className="text-gray-600">-</span>
                            <span className={`w-6 h-6 flex items-center justify-center ${i === 0 ? `bg-gradient-to-br ${market.colorFrom} ${market.colorTo} text-white` : 'bg-white/10'} rounded text-xs font-bold font-mono`}>{c.d2}</span>
                            <span className="text-xs text-gray-500">{c.count}x</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pairs' && (
              <div>
                <h2 className="text-base font-semibold mb-5">🔗 Pairs & Gap</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                  {(analysis.pairFrequency || []).slice(0, 10).map((pf, i) => (
                    <div key={pf.pair} className={`bg-black/30 rounded-xl border p-4 text-center ${i < 3 ? 'border-yellow-500/30' : 'border-white/5'}`}>
                      {i < 3 && <span className="text-xs">{['🥇', '🥈', '🥉'][i]}</span>}
                      <div className="flex justify-center gap-1 mt-1">{pf.pair.split('').map((d, j) => (<span key={j} className={`w-9 h-9 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded-lg text-base font-bold font-mono text-white`}>{d}</span>))}</div>
                      <p className="text-sm font-bold mt-2">{pf.count}x</p>
                    </div>
                  ))}
                </div>
                <h3 className="text-sm font-semibold mb-3 text-gray-300">📏 Detailed Gap Analysis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(analysis.gapAnalysis || []).map(g => (
                    <div key={g.digit} className={`bg-black/30 rounded-xl border p-3 text-center ${g.status === 'very_overdue' ? 'border-red-500/40 bg-red-500/5' : g.status === 'overdue' ? 'border-yellow-500/30' : g.status === 'hot' ? 'border-green-500/30' : 'border-white/5'}`}>
                      <span className="w-8 h-8 inline-flex items-center justify-center bg-white/10 rounded-lg font-bold font-mono">{g.digit}</span>
                      <p className={`text-lg font-bold mt-1 ${g.status === 'very_overdue' ? 'text-red-400' : g.status === 'overdue' ? 'text-yellow-400' : g.status === 'hot' ? 'text-green-400' : 'text-gray-300'}`}>{g.currentGap}</p>
                      <p className="text-[10px] text-gray-500">gap now</p>
                      <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-500 space-y-0.5">
                        <p>Avg: {g.avgGap} | Max: {g.maxGap}</p>
                        <p>Ratio: <span className={g.overdueRatio >= 2 ? 'text-red-400 font-bold' : g.overdueRatio >= 1 ? 'text-yellow-400' : 'text-green-400'}>{g.overdueRatio}x</span></p>
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium ${g.status === 'very_overdue' ? 'bg-red-500/20 text-red-300' : g.status === 'overdue' ? 'bg-yellow-500/20 text-yellow-300' : g.status === 'hot' ? 'bg-green-500/20 text-green-300' : g.status === 'warm' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-400'}`}>{g.status.toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'trend' && (
              <div>
                <h2 className="text-base font-semibold mb-5">📈 Trend & Heatmap</h2>
                {analysis.trendData?.length > 0 ? (<>
                  <div className="overflow-x-auto mb-8">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-white/10"><th className="text-left py-3 px-2 text-gray-400">Period</th>{Array.from({ length: 10 }, (_, i) => <th key={i} className="text-center py-3 px-1 text-gray-400 font-mono">{i}</th>)}</tr></thead>
                      <tbody>{analysis.trendData.map((w, wi) => (<tr key={wi} className="border-b border-white/5 hover:bg-white/5"><td className="py-2 px-2 text-xs text-gray-400 whitespace-nowrap">{w.label}</td>{w.freqs.map((count, di) => { const maxInRow = Math.max(...w.freqs); return (<td key={di} className="text-center py-2 px-1"><span className={`inline-flex w-8 h-8 items-center justify-center rounded text-xs font-bold ${count === maxInRow && count > 0 ? 'bg-yellow-500/30 text-yellow-300' : count > 0 ? 'bg-white/5 text-gray-300' : 'text-gray-700'}`}>{count}</span></td>); })}</tr>))}</tbody>
                    </table>
                  </div>
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🔢 Sum & Root Trend</h3>
                  <div className="overflow-x-auto">
                    <div className="flex gap-1 items-end min-w-[300px]" style={{ height: '120px' }}>
                      {(analysis.sumRootTrend || []).slice(-20).map((sr) => (<div key={sr.index} className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-[20px]" title={`${formatDateShort(sr.date)} — Sum:${sr.sum} Root:${sr.root}`}><span className="text-[8px] text-gray-500">{sr.root}</span><div className={`w-full rounded-t bg-gradient-to-t ${market.colorFrom} ${market.colorTo}`} style={{ height: `${(sr.sum / 36) * 100}%`, minHeight: '4px' }} /><span className="text-[7px] text-gray-600">{sr.sum}</span></div>))}
                    </div>
                  </div>
                </>) : <p className="text-gray-400 text-center py-8">Not enough data.</p>}
              </div>
            )}

            {activeTab === 'delta' && (
              <div>
                <h2 className="text-base font-semibold mb-2">📐 Delta System Analysis</h2>
                <p className="text-xs text-gray-400 mb-5">Differences between consecutive draws.</p>
                {analysis.deltaAnalysis?.length > 0 ? (<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {(analysis.deltaFrequency || []).map((posFreq, pos) => {
                      const topDelta = posFreq.indexOf(Math.max(...posFreq));
                      const colors = ['text-yellow-300', 'text-green-300', 'text-blue-300', 'text-purple-300'];
                      return (<div key={pos} className="bg-black/30 rounded-xl border border-white/5 p-4 text-center"><p className="text-xs text-gray-400 mb-1">Position {pos + 1}</p><p className={`text-2xl font-bold font-mono ${colors[pos]}`}>+{topDelta}</p><p className="text-xs text-gray-500">{Math.max(...posFreq)}x</p></div>);
                    })}
                  </div>
                  {analysisDraws.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20 p-4 mb-6">
                      <h3 className="text-sm font-semibold mb-3 text-indigo-300">🎯 Delta Prediction</h3>
                      <div className="flex items-center gap-4 justify-center flex-wrap">
                        <div className="text-center"><p className="text-[10px] text-gray-400 mb-1">Last</p><div className="flex gap-1">{analysisDraws[analysisDraws.length - 1].digits.map((d, i) => (<span key={i} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded font-bold font-mono text-sm">{d}</span>))}</div></div>
                        <span className="text-gray-500 text-lg">+</span>
                        <div className="text-center"><p className="text-[10px] text-gray-400 mb-1">Delta</p><div className="flex gap-1">{(analysis.deltaFrequency || []).map((pf, i) => (<span key={i} className="w-8 h-8 flex items-center justify-center bg-indigo-500/20 text-indigo-300 rounded font-bold font-mono text-sm">+{pf.indexOf(Math.max(...pf))}</span>))}</div></div>
                        <span className="text-gray-500 text-lg">=</span>
                        <div className="text-center"><p className="text-[10px] text-green-400 mb-1">Predicted</p><div className="flex gap-1">{(analysis.deltaFrequency || []).map((pf, pos) => { const predicted = (analysisDraws[analysisDraws.length - 1].digits[pos] + pf.indexOf(Math.max(...pf))) % 10; return <span key={pos} className={`w-8 h-8 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded font-bold font-mono text-sm text-white`}>{predicted}</span>; })}</div></div>
                      </div>
                    </div>
                  )}
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">Recent Delta History</h3>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {(analysis.deltaAnalysis || []).slice(-10).reverse().map((da) => (
                      <div key={da.index} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-500 w-20">{formatDateShort(da.date)}</span>
                        <div className="flex gap-1">{(da.deltas || []).map((d, j) => (<span key={j} className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold font-mono ${d === 0 ? 'bg-gray-500/20 text-gray-400' : d <= 3 ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>+{d}</span>))}</div>
                        <span className="text-[10px] text-gray-600">Σ{da.absDeltaSum}</span>
                      </div>
                    ))}
                  </div>
                </>) : <p className="text-gray-400 text-center py-8">Need at least 2 draws.</p>}
              </div>
            )}

            {activeTab === 'systems' && (
              <div>
                <h2 className="text-base font-semibold mb-5">🧮 Pro Systems</h2>
                <div className="mb-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🪞 Mirror Numbers <span className="text-[10px] text-gray-500">(0↔5, 1↔6, 2↔7, 3↔8, 4↔9)</span></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {(analysis.mirrorAnalysis || []).map(mp => (
                      <div key={mp.digit} className="bg-black/30 rounded-xl border border-white/5 p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <span className={`w-9 h-9 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded-lg text-base font-bold font-mono text-white`}>{mp.digit}</span>
                          <span className="text-gray-500">↔</span>
                          <span className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg text-base font-bold font-mono text-white">{mp.mirror}</span>
                        </div>
                        <div className="flex justify-center gap-4 text-xs">
                          <span className="text-gray-400">{mp.digit}: <span className="text-white font-bold">{mp.digitCount}x</span></span>
                          <span className="text-gray-400">{mp.mirror}: <span className="text-white font-bold">{mp.mirrorCount}x</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🔢 Digital Root Distribution</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                    {[...(analysis.digitalRootAnalysis || [])].sort((a, b) => a.root - b.root).map(dr => (
                      <div key={dr.root} className={`bg-black/30 rounded-xl border p-3 text-center ${dr.count === Math.max(...(analysis.digitalRootAnalysis || []).map(d => d.count)) ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5'}`}>
                        <p className="text-2xl font-bold text-yellow-300 font-mono">{dr.root}</p><p className="text-sm font-bold">{dr.count}x</p><p className="text-[10px] text-gray-500">{dr.percentage.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">📜 Rundown Systems</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(analysis.rundownResults || []).map((rd) => (
                      <div key={rd.method} className="bg-black/30 rounded-xl border border-white/5 p-4">
                        <p className="text-xs font-semibold text-gray-300 mb-2">{rd.method}</p>
                        <div className="flex items-center gap-2 mb-3"><span className="text-[10px] text-gray-500">Base:</span><div className="flex gap-0.5">{rd.base.map((d, i) => (<span key={i} className="w-6 h-6 flex items-center justify-center bg-white/10 rounded text-xs font-bold font-mono">{d}</span>))}</div></div>
                        <div className="space-y-1">{rd.results.map((r, i) => (<div key={i} className="flex items-center gap-2"><span className="text-[10px] text-gray-500 w-6">#{i + 1}</span><div className="flex gap-0.5">{r.map((d, j) => (<span key={j} className={`w-7 h-7 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded text-xs font-bold font-mono text-white`}>{d}</span>))}</div></div>))}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {analysis.workoutNumbers?.length === 4 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-gray-300">💪 Workout System</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {analysis.workoutNumbers.map((posScores, pos) => {
                        const colors = ['text-yellow-300', 'text-green-300', 'text-blue-300', 'text-purple-300'];
                        return (<div key={pos} className="bg-black/30 rounded-xl border border-white/5 p-4 text-center"><p className="text-xs text-gray-400 mb-2">Position {pos + 1}</p>{posScores.map((ds, i) => (<div key={ds.digit} className={`flex items-center justify-center gap-2 mb-1 ${i === 0 ? '' : 'opacity-60'}`}><span className={`${i === 0 ? 'w-10 h-10 text-lg' : 'w-7 h-7 text-sm'} flex items-center justify-center ${i === 0 ? `bg-gradient-to-br ${market.colorFrom} ${market.colorTo} text-white` : 'bg-white/10'} rounded-lg font-bold font-mono`}>{ds.digit}</span><span className={`text-xs ${i === 0 ? colors[pos] : 'text-gray-500'}`}>{ds.score}pts</span></div>))}</div>);
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'markov' && (
              <div>
                <h2 className="text-base font-semibold mb-2">🔗 Markov Chain Analysis</h2>
                <p className="text-xs text-gray-400 mb-5">Transition probabilities: after digit X appears, what digit Y most likely appears next? Based on historical transitions across all positions.</p>
                {analysis.markovChain?.length > 0 ? (<>
                  <h3 className="text-sm font-semibold mb-3 text-gray-300">Transition Matrix (Combined All Positions)</h3>
                  <div className="overflow-x-auto mb-8">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/10"><th className="py-2 px-1 text-gray-500">From↓ To→</th>{Array.from({ length: 10 }, (_, i) => <th key={i} className="py-2 px-1 text-center text-gray-400 font-mono">{i}</th>)}<th className="py-2 px-1 text-gray-500">Top</th></tr></thead>
                      <tbody>{analysis.markovChain.map(row => {
                        const maxCount = Math.max(...row.transitions.map(t => t.count));
                        return (
                          <tr key={row.digit} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-1.5 px-1"><span className="w-7 h-7 inline-flex items-center justify-center bg-white/10 rounded font-bold font-mono">{row.digit}</span></td>
                            {Array.from({ length: 10 }, (_, to) => {
                              const t = row.transitions.find(tr => tr.to === to);
                              const count = t?.count || 0;
                              const isMax = count === maxCount && count > 0;
                              return (<td key={to} className="py-1.5 px-1 text-center"><span className={`inline-flex w-7 h-7 items-center justify-center rounded font-mono text-[10px] ${isMax ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500/50 font-bold' : count > 0 ? 'bg-white/5 text-gray-400' : 'text-gray-700'}`}>{count || '·'}</span></td>);
                            })}
                            <td className="py-1.5 px-1 text-center"><span className={`inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r ${market.colorFrom} ${market.colorTo} rounded-lg text-white font-bold`}>{row.topNext} <span className="text-[9px] opacity-70">{(row.topNextProb * 100).toFixed(0)}%</span></span></td>
                          </tr>);
                      })}</tbody>
                    </table>
                  </div>

                  <h3 className="text-sm font-semibold mb-3 text-gray-300">Per-Position Transition (Most Likely Next)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {(analysis.markovPositionTransitions || []).map(pt => {
                      const colors = ['text-yellow-300', 'text-green-300', 'text-blue-300', 'text-purple-300'];
                      const lastDigit = analysisDraws.length > 0 ? analysisDraws[analysisDraws.length - 1].digits[pt.pos] : null;
                      return (
                        <div key={pt.pos} className="bg-black/30 rounded-xl border border-white/5 p-4">
                          <p className={`text-xs font-semibold ${colors[pt.pos]} mb-3`}>Position {pt.pos + 1}</p>
                          {lastDigit !== null && (
                            <div className="bg-black/30 rounded-lg p-2 mb-3">
                              <p className="text-[10px] text-gray-500 mb-1">Last digit: <span className="text-white font-bold">{lastDigit}</span> → Next likely:</p>
                              <div className="flex gap-1 flex-wrap">
                                {(pt.transitions[lastDigit] || []).map((count, to) => ({ to, count })).sort((a, b) => b.count - a.count).slice(0, 3).map((t, i) => (
                                  <div key={t.to} className={`flex items-center gap-1 px-2 py-1 rounded ${i === 0 ? `bg-gradient-to-r ${market.colorFrom} ${market.colorTo}` : 'bg-white/5'}`}>
                                    <span className="font-bold font-mono">{t.to}</span>
                                    <span className="text-[9px] opacity-70">{t.count}x</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {analysisDraws.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-xl border border-green-500/20 p-4">
                      <h3 className="text-sm font-semibold mb-3 text-green-300">🎯 Markov Prediction</h3>
                      <div className="flex items-center gap-4 justify-center flex-wrap">
                        <div className="text-center"><p className="text-[10px] text-gray-400 mb-1">Last Draw</p><div className="flex gap-1">{analysisDraws[analysisDraws.length - 1].digits.map((d, i) => (<span key={i} className="w-8 h-8 flex items-center justify-center bg-white/10 rounded font-bold font-mono text-sm">{d}</span>))}</div></div>
                        <span className="text-gray-500 text-lg">→</span>
                        <div className="text-center"><p className="text-[10px] text-green-400 mb-1">Most Likely Next</p><div className="flex gap-1">{(analysis.markovPositionTransitions || []).map((pt, pos) => { const lastD = analysisDraws[analysisDraws.length - 1].digits[pos]; const row = pt.transitions[lastD] || []; const topNext = row.indexOf(Math.max(...row)); return <span key={pos} className={`w-8 h-8 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded font-bold font-mono text-sm text-white`}>{topNext}</span>; })}</div></div>
                      </div>
                    </div>
                  )}
                </>) : <p className="text-gray-400 text-center py-8">Need at least 2 draws.</p>}
              </div>
            )}

            {activeTab === 'momentum' && (
              <div>
                <h2 className="text-base font-semibold mb-2">📈 Trend Momentum</h2>
                <p className="text-xs text-gray-400 mb-5">Compares digit frequency in the first half vs second half of selected period.</p>
                {analysis.trendMomentum?.length > 0 ? (<>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
                    {analysis.trendMomentum.map(tm => (
                      <div key={tm.digit} className={`bg-black/30 rounded-xl border p-4 text-center ${tm.direction === 'rising' ? 'border-green-500/30' : tm.direction === 'falling' ? 'border-red-500/30' : 'border-white/5'}`}>
                        <span className="w-8 h-8 inline-flex items-center justify-center bg-white/10 rounded-lg font-bold font-mono mb-2">{tm.digit}</span>
                        <p className={`text-lg font-bold ${tm.direction === 'rising' ? 'text-green-400' : tm.direction === 'falling' ? 'text-red-400' : 'text-gray-400'}`}>
                          {tm.direction === 'rising' ? '📈' : tm.direction === 'falling' ? '📉' : '➡️'} {tm.momentum > 0 ? '+' : ''}{tm.momentum}%
                        </p>
                        <p className="text-[10px] text-gray-500">Strength: {tm.strength}%</p>
                        <div className="mt-2 flex justify-center gap-2 text-[10px]">
                          <span className="text-gray-500">Old: {tm.olderFreq}%</span>
                          <span className="text-gray-500">New: {tm.recentFreq}%</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${tm.direction === 'rising' ? 'bg-green-500' : tm.direction === 'falling' ? 'bg-red-500' : 'bg-gray-500'}`} style={{ width: `${Math.min(100, tm.strength)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-sm font-semibold mb-3 text-gray-300">🔄 Repeat from Previous Draw — Last 10</h3>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {(analysis.repeatFromPrevious || []).slice(-10).reverse().map((r) => (
                      <div key={r.index} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-gray-500 w-20">{formatDateShort(r.date)}</span>
                        <div className="flex gap-0.5">{(r.prevDigits || []).map((d, j) => (<span key={j} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-[10px] font-mono text-gray-500">{d}</span>))}</div>
                        <span className="text-gray-600">→</span>
                        <div className="flex gap-0.5">{(r.digits || []).map((d, j) => {
                          const isRepeated = r.repeatedDigits?.includes(d);
                          const isExactPos = r.prevDigits?.[j] === d;
                          return (<span key={j} className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold font-mono ${isExactPos ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500/50' : isRepeated ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/5 text-gray-400'}`}>{d}</span>);
                        })}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.repeatCount >= 3 ? 'bg-red-500/20 text-red-300' : r.repeatCount >= 2 ? 'bg-yellow-500/20 text-yellow-300' : r.repeatCount === 1 ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-500'}`}>{r.repeatCount}rep</span>
                        <span className="text-[10px] text-gray-600">{r.exactPositionRepeats}exact</span>
                      </div>
                    ))}
                  </div>
                </>) : <p className="text-gray-400 text-center py-8">Need at least 6 draws.</p>}
              </div>
            )}

            {activeTab === 'skipHit' && (
              <div>
                <h2 className="text-base font-semibold mb-2">🎯 Skip & Hit Pattern</h2>
                <p className="text-xs text-gray-400 mb-5">Visual hit/miss pattern for each digit over the last {Math.min(analysisDraws.length, 30)} draws. Green = Hit, Red = Skip.</p>
                {analysis.skipHitAnalysis?.length > 0 ? (
                  <div className="space-y-3">
                    {analysis.skipHitAnalysis.map(sh => (
                      <div key={sh.digit} className="bg-black/20 rounded-xl border border-white/5 p-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg font-bold font-mono flex-shrink-0">{sh.digit}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-[2px] flex-wrap mb-1">
                              {(sh.pattern || []).map((p, i) => (
                                <div key={i} className={`w-3 h-5 rounded-sm ${p === 'hit' ? 'bg-green-500' : 'bg-red-500/40'}`} title={`Draw ${i + 1}: ${p}`} />
                              ))}
                            </div>
                            <div className="flex items-center gap-3 text-[10px]">
                              <span className="text-gray-400">Hit Rate: <span className={`font-bold ${sh.hitRate > 50 ? 'text-green-400' : sh.hitRate > 30 ? 'text-yellow-400' : 'text-red-400'}`}>{sh.hitRate}%</span></span>
                              <span className="text-gray-400">Streak: <span className={`font-bold ${sh.streakType === 'hit' ? 'text-green-400' : 'text-red-400'}`}>{sh.currentStreak} {sh.streakType}</span></span>
                              <span className="text-gray-500">Best Hit: {sh.longestHitStreak}</span>
                              <span className="text-gray-500">Worst Skip: {sh.longestSkipStreak}</span>
                            </div>
                          </div>
                          <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-xs font-bold ${sh.streakType === 'skip' && sh.currentStreak >= 3 ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40' : sh.streakType === 'hit' && sh.currentStreak >= 3 ? 'bg-green-500/20 text-green-300 ring-1 ring-green-500/40' : 'bg-white/5 text-gray-400'}`}>
                            {sh.streakType === 'skip' && sh.currentStreak >= 3 ? '🔴' : sh.streakType === 'hit' && sh.currentStreak >= 3 ? '🟢' : '⚪'}<br />{sh.currentStreak}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 justify-center mt-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1"><div className="w-3 h-5 bg-green-500 rounded-sm" /> Hit (appeared)</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-5 bg-red-500/40 rounded-sm" /> Skip (absent)</div>
                    </div>
                  </div>
                ) : <p className="text-gray-400 text-center py-8">Not enough data.</p>}
              </div>
            )}

            {activeTab === 'backtest' && (
              <div>
                <h2 className="text-base font-semibold mb-2">🧪 Backtest Accuracy</h2>
                <p className="text-xs text-gray-400 mb-5">Each prediction method is tested against historical data. Methods are ranked by weighted accuracy score. This determines the confidence level shown in predictions.</p>
                {analysis.backtestResults?.length > 0 ? (<>
                  <div className="space-y-3 mb-8">
                    {analysis.backtestResults.map((bt, i) => (
                      <div key={bt.method} className={`bg-black/20 rounded-xl border p-4 ${i === 0 ? 'border-yellow-500/30 bg-yellow-500/5' : i === 1 ? 'border-gray-400/20' : i === 2 ? 'border-amber-600/20' : 'border-white/5'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{bt.methodIcon}</span>
                            <div>
                              <p className="text-sm font-semibold">{i < 3 && ['🥇', '🥈', '🥉'][i]} {bt.method}</p>
                              <p className="text-[10px] text-gray-500">{bt.totalTests} tests</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`text-2xl font-bold ${bt.grade === 'A' ? 'text-green-400' : bt.grade === 'B' ? 'text-blue-400' : bt.grade === 'C' ? 'text-yellow-400' : 'text-red-400'}`}>{bt.grade}</div>
                            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${bt.accuracy >= 50 ? 'bg-green-500/20 text-green-400' : bt.accuracy >= 35 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{bt.accuracy}pts</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                          <div className="bg-green-500/10 rounded-lg p-2"><p className="text-[10px] text-green-400">4/4 Exact</p><p className="text-sm font-bold text-green-300">{bt.exactMatch}</p></div>
                          <div className="bg-blue-500/10 rounded-lg p-2"><p className="text-[10px] text-blue-400">3/4 Match</p><p className="text-sm font-bold text-blue-300">{bt.threeMatch}</p></div>
                          <div className="bg-yellow-500/10 rounded-lg p-2"><p className="text-[10px] text-yellow-400">2/4 Match</p><p className="text-sm font-bold text-yellow-300">{bt.twoMatch}</p></div>
                          <div className="bg-orange-500/10 rounded-lg p-2"><p className="text-[10px] text-orange-400">1/4 Match</p><p className="text-sm font-bold text-orange-300">{bt.oneMatch}</p></div>
                          <div className="bg-red-500/10 rounded-lg p-2"><p className="text-[10px] text-red-400">0/4 Miss</p><p className="text-sm font-bold text-red-300">{bt.zeroMatch}</p></div>
                          <div className="bg-purple-500/10 rounded-lg p-2"><p className="text-[10px] text-purple-400">Avg Digits</p><p className="text-sm font-bold text-purple-300">{bt.avgDigitsMatched}</p></div>
                        </div>
                        <div className="mt-2 h-2 bg-black/30 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bt.accuracy >= 50 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : bt.accuracy >= 35 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`} style={{ width: `${Math.min(100, bt.accuracy)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-500/20 p-5">
                    <h3 className="text-sm font-semibold mb-4 text-purple-300">🧠 Smart Generator</h3>
                    <p className="text-xs text-gray-400 mb-4">Generate numbers with intelligent filters based on analysis.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { key: 'useHot', label: '🔥 Hot Numbers', val: smartGen.useHot },
                        { key: 'useCold', label: '❄️ Cold Numbers', val: smartGen.useCold },
                        { key: 'useOverdue', label: '⏰ Overdue', val: smartGen.useOverdue },
                        { key: 'useMarkov', label: '🔗 Markov', val: smartGen.useMarkov },
                        { key: 'useMomentum', label: '📈 Momentum', val: smartGen.useMomentum },
                      ].map(opt => (
                        <button key={opt.key} onClick={() => setSmartGen(prev => ({ ...prev, [opt.key]: !opt.val }))}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${opt.val ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-black/20 text-gray-500 border-white/10'}`}>{opt.label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Sum Range</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} max={36} value={smartGen.targetSum[0]} onChange={e => setSmartGen(prev => ({ ...prev, targetSum: [parseInt(e.target.value) || 0, prev.targetSum[1]] }))} className="w-16 bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-center" />
                          <span className="text-gray-500">—</span>
                          <input type="number" min={0} max={36} value={smartGen.targetSum[1]} onChange={e => setSmartGen(prev => ({ ...prev, targetSum: [prev.targetSum[0], parseInt(e.target.value) || 36] }))} className="w-16 bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-center" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Max Repeats</label>
                        <select value={smartGen.maxRepeats} onChange={e => setSmartGen(prev => ({ ...prev, maxRepeats: parseInt(e.target.value) }))} className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs w-full">
                          <option value={1}>No repeats (ABCD)</option>
                          <option value={2}>Max 2 same</option>
                          <option value={3}>Max 3 same</option>
                          <option value={4}>Any</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={generateSmart} className={`w-full py-3 ${accentGradient} text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg active:scale-95`}>🧠 Generate Smart Numbers</button>
                    {smartGenResults.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {smartGenResults.map((r, i) => (
                          <div key={i} className="flex items-center gap-3 bg-black/20 rounded-lg p-3">
                            <span className="text-xs text-gray-500 w-6">#{i + 1}</span>
                            <div className="flex gap-1">{r.map((d, j) => (<span key={j} className={`w-10 h-10 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded-lg text-lg font-bold text-white font-mono`}>{d}</span>))}</div>
                            <span className="text-xs text-gray-500 font-mono">Σ{r.reduce((a, b) => a + b, 0)} | {r.filter(d => d % 2 !== 0).length}O/{r.filter(d => d % 2 === 0).length}E | M:{r.map(d => mirrorDigit(d)).join('')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>) : <p className="text-gray-400 text-center py-8">Need at least 10 draws for backtest.</p>}
              </div>
            )}

            {activeTab === 'prediction' && (
              <div>
                <h2 className="text-base font-semibold mb-2">🔮 Predictions — {market.state}
                </h2>
                <p className="text-xs text-gray-400 mb-5">⚠️ Based on {periodInfo.label} ({periodInfo.usedDraws} draws). Confidence levels are auto-calibrated by backtest results.</p>
                <div className="flex items-center gap-3 mb-6"><label className="text-sm text-gray-400">Count:</label><input type="range" min={3} max={12} value={predictionCount} onChange={(e) => setPredictionCount(Number(e.target.value))} className="flex-1 max-w-xs accent-yellow-500" /><span className="text-yellow-400 font-bold">{predictionCount}</span></div>
                {predictions?.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {predictions.map((pred, i) => (
                      <div key={i} className="bg-black/30 rounded-xl border border-white/10 p-5 hover:border-yellow-500/30 transition group">
                        <div className="flex items-center justify-between mb-1"><span className="text-sm">{pred.methodIcon}</span><span className={`text-xs font-bold px-2 py-1 rounded-full ${pred.confidence >= 70 ? 'bg-green-500/20 text-green-400' : pred.confidence >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>{pred.confidence}%</span></div>
                        <p className="text-xs text-gray-400 mb-3">{pred.method}</p>
                        <div className="flex justify-center gap-2">{(pred.digits || []).map((d, j) => (<span key={j} className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${market.colorFrom} ${market.colorTo} rounded-xl text-xl font-bold text-white font-mono shadow-lg group-hover:scale-110 transition`}>{d}</span>))}</div>
                        <div className="mt-2 text-center"><p className="text-xs text-gray-500">Σ{(pred.digits || []).reduce((a, b) => a + b, 0)} | {(pred.digits || []).filter(d => d % 2 !== 0).length}O/{(pred.digits || []).filter(d => d % 2 === 0).length}E | Mirror: {(pred.digits || []).map(d => mirrorDigit(d)).join('')}</p></div>
                        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">{pred.reasoning}</p>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-12"><p className="text-4xl mb-3">📊</p><p className="text-gray-400">Enter at least 3 results.</p></div>}
                {predictions?.length > 0 && (
                  <div className={`mt-6 bg-gradient-to-r ${market.colorFrom}/10 ${market.colorTo}/10 rounded-xl border border-white/10 p-4`}>
                    <h3 className="text-sm font-semibold mb-3">📌 Analysis Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-400">Hot: </span><span className="text-white font-bold">{(analysis.hotNumbers || []).map(h => h.digit).join(', ')}</span></div>
                      <div><span className="text-gray-400">Overdue: </span><span className="text-white font-bold">{(analysis.lastSeen || []).slice(0, 3).map(l => l.digit).join(', ')}</span></div>
                      <div><span className="text-gray-400">Top Sums: </span><span className="text-white font-bold">{(analysis.sumAnalysis || []).slice(0, 3).map(s => s.sum).join(', ')}</span></div>
                      <div><span className="text-gray-400">Best Method: </span><span className="text-white font-bold">{analysis.backtestResults?.[0]?.method ?? '-'} ({analysis.backtestResults?.[0]?.grade ?? '-'})</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>)}

        {draws.length === 0 && (
          <div className="text-center py-16"><p className="text-5xl mb-4">🎰</p><h2 className="text-2xl font-bold text-gray-300 mb-2">No Data for {market.state}</h2><p className="text-gray-500 max-w-md mx-auto mb-6">Start entering Pick 4 results to get analysis and predictions.</p>
            {market.sampleData?.length > 0 && <button onClick={loadSampleData} className={`px-6 py-3 ${accentGradient} text-white font-bold rounded-xl hover:opacity-90 transition shadow-lg active:scale-95`}>Load Sample Data</button>}
          </div>
        )}

        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
          <h2 className="text-base font-semibold mb-4">🌎 Supported Markets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {MARKETS.map(m => {
              const isActive = m.id === selectedMarketId; let dataCount = 0; try { const s = localStorage.getItem('pick4_data_' + m.id); if (s) dataCount = JSON.parse(s).length; } catch { /* */ } return (
                <button key={m.id} onClick={() => { setSelectedMarketId(m.id); setActiveTab('frequency'); setAnalysisPeriod('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`text-left p-3 rounded-xl border transition hover:scale-[1.02] active:scale-[0.98] ${isActive ? 'bg-white/10 border-white/30 ring-2 ring-blue-500/40' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2"><span className="text-lg">{m.flag}</span><div className="flex-1 min-w-0"><div className="text-xs font-semibold truncate">{m.state}</div><div className="text-[10px] text-gray-500 truncate">{m.name}</div></div></div>
                  {dataCount > 0 && <div className="mt-1 text-[10px] text-gray-600">{dataCount} draws</div>}
                </button>);
            })}
          </div>
        </section>
      </main>

      <footer className="mt-8 py-6 border-t border-white/5 text-center text-xs text-gray-600 space-y-1">
        <p>Pick 4 Pro Analyzer © 2024 — Advanced Multi-Market Analysis Tool</p>
        <p className="text-gray-700">Predictions are for reference only and do not guarantee winnings.</p>
      </footer>
    </div>
  );
}

export default App;