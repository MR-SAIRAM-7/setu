import { useCallback, useEffect, useState } from 'react';
import type { DNAProfile, Mode, ReadingLevel } from '@setu/core';
import { dnaToAttributes } from '@setu/core';
import { sendToBackground, type JobPayload, type ToPanel } from '../lib/messages';
import { takePendingJob } from '../lib/storage';
import { useExtensionState } from './useSetu';
import { PagePanel } from './panels/Page';
import { StartPanel } from './panels/Start';
import { ExplainPanel } from './panels/Explain';
import { WritePanel } from './panels/Write';
import { CommanderPanel } from './panels/Commander';
import { TrustPanel } from './panels/Trust';

type Tab = 'page' | 'start' | 'explain' | 'write' | 'commander' | 'trust';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'page', label: 'This page' },
  { id: 'start', label: 'Start' },
  { id: 'explain', label: 'Explain' },
  { id: 'write', label: 'Write' },
  { id: 'commander', label: 'Do it' },
  { id: 'trust', label: 'Trust' },
];

const MODE_TAB: Partial<Record<Mode, Tab>> = {
  START: 'start',
  EXPLAIN: 'explain',
  WRITE: 'write',
  COMMANDER: 'commander',
  FOCUS: 'page',
};

export function App() {
  const { state, refresh } = useExtensionState();
  const [tab, setTab] = useState<Tab>('page');
  const [seed, setSeed] = useState<JobPayload | null>(null);

  /* Apply the user's own DNA to SETU's own surface. An accessibility tool that
     ignores its own accessibility settings is a contradiction judges notice. */
  useEffect(() => {
    for (const [k, v] of Object.entries(dnaToAttributes(state.dna))) {
      document.documentElement.setAttribute(k, v);
    }
    document.documentElement.setAttribute('data-density', state.dna.density);
  }, [state.dna]);

  /* A context-menu click parks a job before opening the panel, because the
     panel takes a moment to mount and would otherwise miss a live message.
     Collect it on mount AND keep listening. */
  useEffect(() => {
    void (async () => {
      const job = await takePendingJob();
      if (job) {
        setSeed(job.payload);
        setTab(MODE_TAB[job.mode] ?? 'page');
      }
    })();

    const listener = (msg: ToPanel) => {
      if (msg?.type === 'RUN_MODE') {
        setSeed(msg.payload);
        setTab(MODE_TAB[msg.mode] ?? 'page');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const saveDna = useCallback(
    async (dna: DNAProfile) => {
      await sendToBackground({ type: 'SET_DNA', dna });
      await refresh();
    },
    [refresh],
  );

  const setLevel = useCallback(
    (readingLevel: ReadingLevel) => void saveDna({ ...state.dna, readingLevel }),
    [saveDna, state.dna],
  );

  return (
    <div className="panel">
      <header className="hdr">
        <span className="hdr__name">SETU</span>
        <span className="hdr__tag">the cognitive bridge</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn--quiet"
          onClick={() => chrome.runtime.openOptionsPage()}
          aria-label="Open settings"
        >
          Settings
        </button>
      </header>

      {state.demoMode && (
        <div className="banner" role="status">
          <strong>Demo mode.</strong> Every result comes from a local fixture. No network calls.
        </div>
      )}

      {!state.online && (
        <div className="banner banner--calm" role="status">
          Offline — Focus Mode, bionic reading, the load score and the pause offer all still work.
        </div>
      )}

      <nav className="tabs" role="tablist" aria-label="SETU modes">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'page' && (
          <PagePanel
            dna={state.dna}
            cls={state.lastCLS?.cls}
            url={state.lastCLS?.url}
            onDnaChange={saveDna}
          />
        )}
        {tab === 'start' && <StartPanel dna={state.dna} initialText={seed?.text} />}
        {tab === 'explain' && (
          <ExplainPanel dna={state.dna} initialText={seed?.text} onDnaLevelChange={setLevel} />
        )}
        {tab === 'write' && <WritePanel dna={state.dna} initialText={seed?.text} />}
        {tab === 'commander' && <CommanderPanel dna={state.dna} />}
        {tab === 'trust' && <TrustPanel ledger={state.ledger} onRefresh={refresh} />}
      </main>
    </div>
  );
}
