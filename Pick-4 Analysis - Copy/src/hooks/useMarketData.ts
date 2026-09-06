import { getMarketById } from '../data/markets';
import { useState, useCallback, useEffect } from 'react';

export interface DrawEntry {
  id: number;
  digits: [number, number, number, number];
  date: string; // YYYY-MM-DD
  session: 'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm' | 'morning' | 'day' | 'night';
  dateAdded: string; 
}

const STORAGE_KEY_PREFIX = 'pick4_data_';

// Konfigurasi GitHub Repository
const REPO_OWNER = 'blinksatan696';
const REPO_NAME = 'scraper.py';
const BRANCH = 'main';
const DATA_PATH = 'data_market';

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// Fungsi pembantu untuk sinkronisasi ke GitHub
async function uploadToGitHub(marketId: string, data: DrawEntry[]) {
  const token = localStorage.getItem('github_token')?.trim();
  if (!token) {
    console.warn('GitHub token tidak ditemukan. Perubahan hanya disimpan secara lokal.');
    return;
  }

  const filePath = `${DATA_PATH}/${marketId}.json`;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

  try {
    // 1. Ambil SHA file terbaru terlebih dahulu untuk menghindari konflik
    const getRes = await fetch(`${url}?ref=${BRANCH}`, {
      headers: { 
        'Authorization': `token ${token}`, 
        'Accept': 'application/vnd.github.v3+json' 
      }
    });

    let sha: string | undefined = undefined;
    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    // 2. Format data JSON ke Base64
    const jsonString = JSON.stringify(data, null, 2);
    // Mendukung encoding base64 yang aman untuk karakter UTF-8 di browser
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    // 3. Kirim PUT request ke GitHub API
    const payload: any = {
      message: `Auto-sync: update ${marketId}.json`,
      content: base64Content,
      branch: BRANCH
    };
    if (sha) payload.sha = sha;

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 
        'Authorization': `token ${token}`, 
        'Accept': 'application/vnd.github.v3+json', 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload)
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      console.error('Gagal melakukan sync ke GitHub:', errData.message);
    } else {
      console.log(`Berhasil sync ${marketId}.json ke GitHub!`);
    }
  } catch (error) {
    console.error('Error saat koneksi ke GitHub API:', error);
  }
}

export function useMarketData(
  marketId: string,
  sampleData: [number, number, number, number][]
) {
  const [draws, setDraws] = useState<DrawEntry[]>([]);

  // Load from GitHub Raw first, fallback to localStorage or sample data
  useEffect(() => {
    let isMounted = true;
    const market = getMarketById(marketId);
    const isSingleDraw = market.singleDrawPerDay;
    const isOregon = marketId.toLowerCase() === 'oregon';

    async function loadData() {
      try {
        // Coba ambil langsung dari file JSON publik di GitHub (Raw)
        const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${DATA_PATH}/${marketId}.json?t=${new Date().getTime()}`;
        const res = await fetch(rawUrl);
        
        if (res.ok) {
          const remoteData = await res.json();
          if (isMounted && Array.isArray(remoteData) && remoteData.length > 0) {
            let migrated: DrawEntry[] = remoteData.map((d: any) => ({
              id: d.id || generateId(),
              digits: d.digits || [Number(d.nomor?.[0]||0), Number(d.nomor?.[1]||0), Number(d.nomor?.[2]||0), Number(d.nomor?.[3]||0)], // Kompatibilitas format scraper lama jika ada
              date: d.date || d.tanggal?.split('-').reverse().join('-') || getYesterdayStr(),
              session: d.session || 'evening',
              dateAdded: d.dateAdded || new Date().toISOString(),
            }));

            // Normalisasi format jika single draw
            if (isSingleDraw) {
              const byDate = new Map<string, DrawEntry>();
              for (const draw of migrated) {
                byDate.set(draw.date, { ...draw, session: 'evening' });
              }
              migrated = Array.from(byDate.values());
            }

            migrated.sort((a: DrawEntry, b: DrawEntry) => {
              if (a.date !== b.date) return b.date.localeCompare(a.date);
              if (a.session === b.session) return 0;
              return a.session === 'evening' ? -1 : 1;
            });

            setDraws(migrated);
            localStorage.setItem(STORAGE_KEY_PREFIX + marketId, JSON.stringify(migrated));
            return;
          }
        }
      } catch (e) {
        console.warn('Gagal memuat dari GitHub Raw, beralih ke localStorage.');
      }

      // Fallback ke localStorage
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + marketId);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          let migrated: DrawEntry[] = parsed.map((d: any) => ({
            id: d.id || generateId(),
            digits: d.digits,
            date: d.date || getYesterdayStr(),
            session: d.session || 'evening',
            dateAdded: d.dateAdded || new Date().toISOString(),
          }));
          setDraws(migrated);
          return;
        } catch {
          // ignore invalid
        }
      }

      // Fallback terakhir ke sample data bawaan
      if (sampleData.length > 0) {
        const today = new Date();
        const sessionSlots: ('1pm' | '4pm' | '7pm' | '10pm')[] = ['1pm', '4pm', '7pm', '10pm'];

        const samples: DrawEntry[] = sampleData.map((digits, i) => {
          const d = new Date(today);
          const dayOffset = isOregon ? Math.floor((sampleData.length - i) / 4) : (sampleData.length - i);
          d.setDate(d.getDate() - dayOffset);

          return {
            id: generateId() + i,
            digits,
            date: d.toISOString().split('T')[0],
            session: isSingleDraw 
              ? 'evening' 
              : (isOregon ? sessionSlots[i % sessionSlots.length] : (i % 2 === 0 ? 'midday' : 'evening')),
            dateAdded: new Date().toISOString(),
          };
        });

        setDraws(samples);
      } else {
        setDraws([]);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [marketId, sampleData]);

  // Save to localStorage and auto-sync to GitHub on draws change
  useEffect(() => {
    if (draws.length > 0) {
      localStorage.setItem(
        STORAGE_KEY_PREFIX + marketId,
        JSON.stringify(draws)
      );
    }
  }, [draws, marketId]);

  const addDraw = useCallback((
    digits: [number, number, number, number],
    date: string,
    session: 'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm' | 'morning' | 'day' | 'night'
  ) => {
    const market = getMarketById(marketId);
    const isSingleDraw = market.singleDrawPerDay;

    setDraws(prev => {
      const exists = isSingleDraw
        ? prev.find(d => d.date === date)
        : prev.find(d => d.date === date && d.session === session);

      let updated = [...prev];
      if (exists) {
        updated = updated.map(d =>
          d.id === exists.id
            ? {
                ...d,
                digits,
                session: isSingleDraw ? 'evening' : session,
                dateAdded: new Date().toISOString(),
              }
            : d
        );
      } else {
        const newEntry: DrawEntry = {
          id: generateId(),
          digits,
          date,
          session: isSingleDraw ? 'evening' : session,
          dateAdded: new Date().toISOString(),
        };
        updated.push(newEntry);
      }

      updated.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.session === b.session) return 0;
        return a.session === 'evening' ? -1 : 1;
      });

      // Panggil auto-sync ke GitHub di latar belakang
      uploadToGitHub(marketId, updated);

      return updated;
    });
  }, [marketId]);

  const addBulkDraws = useCallback((
    entries: {
      digits: [number, number, number, number];
      date: string;
      session: 'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm' | 'morning' | 'day' | 'night';
    }[]
  ) => {
    const market = getMarketById(marketId);
    const isSingleDraw = market.singleDrawPerDay;

    setDraws(prev => {
      let updated = [...prev];

      for (const entry of entries) {
        const existIdx = isSingleDraw
          ? updated.findIndex(d => d.date === entry.date)
          : updated.findIndex(
              d => d.date === entry.date && d.session === entry.session
            );

        const normalizedSession = isSingleDraw ? 'evening' : entry.session;

        if (existIdx >= 0) {
          updated[existIdx] = {
            ...updated[existIdx],
            digits: entry.digits,
            session: normalizedSession,
            dateAdded: new Date().toISOString(),
          };
        } else {
          updated.push({
            id: generateId(),
            digits: entry.digits,
            date: entry.date,
            session: normalizedSession,
            dateAdded: new Date().toISOString(),
          });
        }
      }

      updated.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.session === b.session) return 0;
        return a.session === 'evening' ? -1 : 1;
      });

      uploadToGitHub(marketId, updated);

      return updated;
    });
  }, [marketId]);

  const removeDraw = useCallback((id: number) => {
    setDraws(prev => {
      const updated = prev.filter(d => d.id !== id);
      uploadToGitHub(marketId, updated);
      return updated;
    });
  }, [marketId]);

  const updateDraw = useCallback((
    id: number,
    digits: [number, number, number, number]
  ) => {
    setDraws(prev => {
      const updated = prev.map(d =>
        d.id === id
          ? { ...d, digits, dateAdded: new Date().toISOString() }
          : d
      );
      uploadToGitHub(marketId, updated);
      return updated;
    });
  }, [marketId]);

  const clearAll = useCallback(() => {
    setDraws([]);
    uploadToGitHub(marketId, []);
  }, [marketId]);

  const loadSampleData = useCallback(() => {
    const market = getMarketById(marketId);
    const isSingleDraw = market.singleDrawPerDay;
    const isOregon = marketId.toLowerCase() === 'oregon';
    const today = new Date();

    const samples: DrawEntry[] = sampleData.map((digits, i) => {
      const d = new Date(today);
      const dayOffset = isOregon ? Math.floor((sampleData.length - i) / 4) : (sampleData.length - i);
      d.setDate(d.getDate() - dayOffset);

      return {
        id: generateId() + i,
        digits,
        date: d.toISOString().split('T')[0],
        session: isSingleDraw
          ? 'evening'
          : (isOregon ? ['1pm', '4pm', '7pm', '10pm'][i % 4] as any : (i % 2 === 0 ? 'midday' : 'evening')),
        dateAdded: new Date().toISOString(),
      };
    });

    setDraws(samples);
    uploadToGitHub(marketId, samples);
  }, [marketId, sampleData]);

  const getDrawByDateSession = useCallback((
    date: string,
    session: 'midday' | 'evening' | '1pm' | '4pm' | '7pm' | '10pm' | 'morning' | 'day' | 'night'
  ): DrawEntry | undefined => {
    const market = getMarketById(marketId);

    if (market.singleDrawPerDay) {
      return draws.find(d => d.date === date);
    }

    return draws.find(
      d => d.date === date && d.session === session
    );
  }, [draws, marketId]);

  const getDatesWithDraws = useCallback((): Set<string> => {
    return new Set(draws.map(d => d.date));
  }, [draws]);

  return {
    draws,
    addDraw,
    addBulkDraws,
    removeDraw,
    updateDraw,
    clearAll,
    loadSampleData,
    getDrawByDateSession,
    getDatesWithDraws,
    getTodayStr,
    getYesterdayStr,
  };
}