import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { BionicText } from '../lib/bionic';
import { tts } from '../lib/tts';
import { getPrefs } from '../lib/storage';
import { award } from '../lib/progress';
import FileUploadModal from '../components/FileUploadModal';
import NumberStory from '../components/NumberStory';
import VoiceInputButton from '../components/VoiceInputButton';

const MODES_DATA = [
  {
    key: 'start',
    name: 'Start',
    icon: 'ph-play-circle',
    tint: '#edbb00', // Yellow plate
    tagline: 'Break task freeze',
    blurb: 'Turns something you have been avoiding into one ten-minute action small enough to actually begin.',
    fieldLabel: 'What are you stuck on or putting off?',
    placeholder: 'e.g. writing my quarterly report or filing my medical reimbursement claim…',
    rows: 3,
    run: (val) => api.start(val, true),
    workedExample: {
      supportiveMessage:
        'Starting is the only hard part. Executive freeze happens when a task looks like an endless mountain rather than a single physical step.',
      confidenceMeter: {
        effortLevel: 'Low',
        anxietyLevel: 'Manageable',
        estimatedTimeMinutes: 10
      },
      immediateTenMinuteAction: 'Open the document, create the title page, and type the first 3 section headings.',
      microSteps: [
        'Open the blank document and save it as "Quarterly Report Q3".',
        'Type the main heading: Summary of Accomplishments.',
        'Paste in 3 bullet points of what you actually finished this week.',
        'Close the tab or take a 5-minute break.'
      ],
      clarifyingQuestion: 'What is the single most important number or milestone your reader needs to see first?'
    }
  },
  {
    key: 'simplify',
    name: 'Simplify',
    icon: 'ph-waves',
    tint: '#0088b0', // Cyan plate
    tagline: 'Plain language',
    blurb: 'Rewrites dense or legal text at a Grade 6 reading level without dropping a single fact.',
    fieldLabel: 'Paste the dense text, notice, or clause',
    placeholder: 'Paste dense government policies, contract terms, or academic abstracts…',
    rows: 6,
    run: (val) => api.simplify(val),
    workedExample: {
      readabilityGrade: 'Grade 6 · Plain English',
      plainLanguageRewrite:
        'You have 14 days after moving in to tell the landlord in writing about any broken items. If you send this notice on time, the landlord must fix safety hazards within 7 days at no cost to you.',
      keyTakeaways: [
        'Deadline: 14 days from move-in date.',
        'Format: Written notice (email or paper).',
        'Landlord responsibility: Safety fixes within 7 days.'
      ],
      sensoryTips: [
        'Read one bullet at a time and highlight the dates.',
        'Keep a copy of your email in a dedicated folder.'
      ]
    }
  },
  {
    key: 'learn',
    name: 'Learn',
    icon: 'ph-graduation-cap',
    tint: '#d6006c', // Magenta plate
    tagline: 'Study material',
    blurb: 'A summary, a branching outline, and a self-quiz, built from whatever you paste in.',
    fieldLabel: 'Paste study notes, lecture content, or articles',
    placeholder: 'Paste lecture transcripts, textbook chapters, or reference material…',
    rows: 6,
    run: (val) => api.learn(val),
    workedExample: {
      summary:
        'Photosynthesis converts solar photons into chemical glucose using chlorophyll pigments in chloroplast thylakoids, releasing oxygen as a byproduct.',
      mindMap: {
        rootNode: 'Photosynthesis Mechanism',
        branches: [
          {
            topic: 'Light-Dependent Reactions',
            details: ['Takes place in thylakoid membranes', 'Splits water molecules (photolysis)', 'Generates ATP and NADPH']
          },
          {
            topic: 'Calvin Cycle (Light-Independent)',
            details: ['Occurs in chloroplast stroma', 'Fixes CO2 into organic carbon compounds', 'Requires RuBisCO enzyme']
          }
        ]
      },
      quiz: [
        {
          question: 'Where do the light-dependent reactions of photosynthesis take place?',
          options: ['Thylakoid membrane', 'Stroma', 'Mitochondrial matrix', 'Outer membrane'],
          answerIndex: 0,
          explanation: 'Thylakoid membranes contain chlorophyll and ATP synthase complexes.'
        },
        {
          question: 'What does the Calvin cycle actually consume to build sugar?',
          options: [
            'ATP and NADPH made by the light reactions',
            'Oxygen released from water',
            'Chlorophyll pigment itself',
            'Sunlight directly'
          ],
          answerIndex: 0,
          explanation:
            'The Calvin cycle is light-independent: it spends the ATP and NADPH the light reactions produced.'
        }
      ]
    }
  },
  {
    key: 'meet',
    name: 'Meet',
    icon: 'ph-users-three',
    tint: '#0088b0', // Cyan plate
    tagline: 'Meeting rescue',
    blurb: 'Pulls the decisions, owners and deadlines out of a transcript, and decodes the jargon along the way.',
    fieldLabel: 'Paste meeting transcript or raw notes',
    placeholder: 'Paste Zoom transcript, Slack discussion, or meeting notes…',
    rows: 6,
    run: (val) => api.meet(val),
    workedExample: {
      summary:
        'The team aligned on shipping the accessibility audit by Friday and resolved the pending database schema migration conflict.',
      actionItems: [
        { task: 'Finalize WCAG contrast audit report', owner: 'Sarah M.', deadline: 'Friday 5 PM', priority: 'High' },
        { task: 'Deploy staging migration patch', owner: 'Alex K.', deadline: 'Thursday noon', priority: 'Medium' }
      ],
      keyDecisions: [
        'Broadsheet light theme approved as the default accessible palette.',
        'MongoDB selected for resilient persistence layer.'
      ],
      jargonDecoded: [
        { term: 'RLS', plainMeaning: 'Row-Level Security — database rules that limit which user can see each row.' },
        { term: 'Telemetry spike', plainMeaning: 'A sudden burst in user activity or logged error counts.' }
      ]
    }
  },
  {
    key: 'practice',
    name: 'Practice',
    icon: 'ph-chats-circle',
    tint: '#d6006c', // Magenta plate
    tagline: 'Rehearse it first',
    blurb: 'Scripts for a hard conversation, in a few different tones, before you have to have it for real.',
    fieldLabel: 'What conversation do you need to prepare for?',
    placeholder: 'e.g. asking my team lead for an extra two days on a sprint task…',
    rows: 3,
    run: (val) => api.practice(val),
    workedExample: {
      scenarioContext: 'Requesting a realistic deadline extension while maintaining professional trust.',
      openingLine: 'Hey, I wanted to check in quickly on how the frontend deliverable is pacing for tomorrow.',
      suggestedResponses: [
        {
          tone: 'Direct & collaborative',
          text: 'Thanks for checking in. The core feature is working well, but ensuring keyboard accessibility will take until Thursday morning. Can we move the review to Thursday 2 PM?'
        },
        {
          tone: 'Brief & factual',
          text: 'The architecture is complete, and I am running the final validation passes. I will have the branch ready for merge on Thursday morning.'
        }
      ],
      coachingTip: 'Propose a specific new time rather than asking open-ended permission. It shows control of your workload.'
    }
  },
  {
    key: 'write',
    name: 'Write',
    icon: 'ph-pencil-simple',
    tint: '#edbb00', // Yellow plate
    tagline: 'Accessible writing',
    blurb: 'Checks your draft for reading level, passive voice, and the sentences that lose people.',
    fieldLabel: 'Paste your draft text or message',
    placeholder: 'Paste your email draft, documentation section, or announcement…',
    rows: 6,
    run: (val) => api.write(val),
    workedExample: {
      originalGradeLevel: 'Grade 12.4 → rewritten at Grade 7',
      improvedText:
        'We updated the login system today. You can now sign in with your email address or your Google account. You no longer have to wait for an SMS code.',
      passiveVoiceInstances: [
        'SMS codes were dispatched by our authentication server',
        'Users are advised that credentials will be migrated'
      ],
      clarityFixes: [
        {
          originalSnippet:
            'Please be advised that as of today our authentication subsystem has been upgraded to facilitate a seamless synchronization paradigm across identity providers.',
          suggestedSnippet: 'We updated the login system today.',
          reason: 'A 24-word sentence of corporate jargon replaced with the one fact the reader needs.'
        },
        {
          originalSnippet: 'SMS codes were dispatched by our authentication server.',
          suggestedSnippet: 'You no longer have to wait for an SMS code.',
          reason: 'Passive voice hides who acts. Active voice tells the reader what changes for them.'
        }
      ]
    }
  },
  {
    key: 'numbers',
    name: 'Numbers',
    icon: 'ph-math-operations',
    tint: '#0088b0', // Cyan plate
    tagline: 'Maths with objects',
    blurb:
      'Turns a sum into things you can count on a table, one step at a time, read aloud as you go. Built for dyscalculia.',
    fieldLabel: 'What number problem is in your way?',
    placeholder: 'e.g. 12 × 4, splitting a ₹840 bill between 6 people, or 15% off 2400…',
    rows: 3,
    run: (val) => api.numbers(val),
    workedExample: {
      plainQuestion: 'What is 12 lots of 4?',
      objectName: 'apple',
      objectNamePlural: 'apples',
      objectEmoji: '🍎',
      story: 'You have 12 baskets on the table, and every basket holds 4 apples.',
      steps: [
        {
          narration: 'Make 12 separate piles on the table.',
          operation: 'group',
          count: 12,
          runningTotal: 0,
          groupSize: 4
        },
        {
          narration: 'Now put 4 apples into every single pile.',
          operation: 'add',
          count: 48,
          runningTotal: 48,
          groupSize: 4
        },
        {
          narration: 'Count every apple across all the piles. There are 48.',
          operation: 'result',
          count: 48,
          runningTotal: 48
        }
      ],
      answer: '48',
      answerNumber: 48,
      checkIt: 'Count the piles one at a time, adding 4 each time. You should land on 48.',
      realLife: 'This is what you do when you buy 12 packs of something that costs 4 each.'
    }
  },
  {
    key: 'guide',
    name: 'Guide',
    icon: 'ph-path',
    tint: '#201e1d', // Ink plate
    tagline: 'Step by step',
    blurb: 'Turns any workflow into numbered steps, each with a clear signal that it worked.',
    fieldLabel: 'What process or goal do you need broken down?',
    placeholder: 'e.g. submitting an expense report, setting up SSH keys, or appealing a parking ticket…',
    rows: 3,
    run: (val) => api.guide(val),
    workedExample: {
      workflowName: 'Setting up Git SSH authentication',
      totalSteps: 3,
      steps: [
        {
          stepNumber: 1,
          title: 'Generate your key pair',
          actionRequired:
            'Run ssh-keygen -t ed25519 -C "your_email@example.com" in the terminal and press Enter at every prompt.',
          tip: 'the terminal prints "Your identification has been saved in ~/.ssh/id_ed25519".'
        },
        {
          stepNumber: 2,
          title: 'Give GitHub the public half',
          actionRequired:
            'Run cat ~/.ssh/id_ed25519.pub, copy the whole line, and paste it into GitHub → Settings → SSH and GPG keys → New SSH key.',
          tip: 'the key appears in the list with your email beside it.'
        },
        {
          stepNumber: 3,
          title: 'Prove the connection works',
          actionRequired: 'Run ssh -T git@github.com and type yes if it asks about the fingerprint.',
          tip: 'you see "Hi username! You\'ve successfully authenticated".'
        }
      ]
    }
  }
];

export default function Modes() {
  const [searchParams] = useSearchParams();
  const initialModeKey = searchParams.get('mode') || 'start';

  const [activeKey, setActiveKey] = useState(initialModeKey);
  const [inputVal, setInputVal] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [bionicMode, setBionicMode] = useState(() => getPrefs().bionicReading === true);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const activeMode = MODES_DATA.find((m) => m.key === activeKey) || MODES_DATA[0];

  useEffect(() => {
    const paramKey = searchParams.get('mode');
    if (paramKey && MODES_DATA.some((m) => m.key === paramKey)) {
      setActiveKey(paramKey);
    }
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = tts.subscribe((state) => {
      setTtsPlaying(state.isPlaying && !state.isPaused);
    });
    return () => {
      unsubscribe();
      tts.stop();
    };
  }, []);

  const selectMode = (key) => {
    if (key === activeKey) return;
    tts.stop();
    setActiveKey(key);
    setInputVal('');
    setError(null);
  };

  const handleRun = async (e) => {
    e?.preventDefault();
    if (!inputVal.trim() || loading) return;

    tts.stop();
    setLoading(true);
    setError(null);

    try {
      const data = await activeMode.run(inputVal.trim());
      setResults((prev) => ({ ...prev, [activeKey]: data }));
      award('modeRun');
    } catch (err) {
      setError(err.message || 'Could not process mode request. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputVal('');
    setError(null);
  };

  const currentResult = results[activeKey] || activeMode.workedExample;
  const isWorkedExample = !results[activeKey];

  const handleReadAloud = () => {
    if (ttsPlaying) {
      tts.stop();
    } else {
      let text = '';
      if (activeKey === 'start') {
        text = `${currentResult.supportiveMessage || ''}. Start with: ${currentResult.immediateTenMinuteAction || ''}. Steps: ${(currentResult.microSteps || []).join('. ')}`;
      } else if (activeKey === 'simplify') {
        text = `${currentResult.plainLanguageRewrite || ''}. Key takeaways: ${(currentResult.keyTakeaways || []).join('. ')}`;
      } else if (activeKey === 'meet') {
        text = `${currentResult.summary || ''}. Action items: ${(currentResult.actionItems || []).map((a) => `${a.task} assigned to ${a.owner || 'team'}`).join('. ')}`;
      } else if (activeKey === 'guide') {
        text = `${currentResult.workflowName || ''}. Steps: ${(currentResult.steps || []).map((s) => `${s.title}: ${s.actionRequired || s.action}`).join('. ')}`;
      } else if (activeKey === 'learn') {
        text = `${currentResult.summary || ''}`;
      } else if (activeKey === 'practice') {
        text = `${currentResult.scenarioContext || ''}. Opening line: ${currentResult.openingLine || ''}`;
      } else if (activeKey === 'write') {
        text = `${currentResult.improvedText || currentResult.accessibleRewrite || ''}`;
      } else if (activeKey === 'numbers') {
        // Read the story and every step, so the whole method is available by ear
        // alone — the step-by-step narration inside the canvas is for working
        // through it, this is for hearing it end to end.
        text = `${currentResult.plainQuestion || ''}. ${currentResult.story || ''}. ${(
          currentResult.steps || []
        )
          .map((step) => step.narration)
          .join('. ')}. The answer is ${currentResult.answer || ''}.`;
      }
      tts.speak(text);
    }
  };

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-[var(--color-bg)] text-left">
      {/* ----------------- Left Navigation Pane (268px) ----------------- */}
      <aside className="lg:w-[268px] lg:shrink-0 flex flex-col border-r border-[var(--color-divider)] bg-[var(--color-surface)] p-4 sm:p-5 overflow-y-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Cognitive Modes</h1>
          <p className="text-[12.5px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] mt-1">
            Eight tools covering reading, writing, numbers, and getting started — built for
            dyslexia, dyscalculia, dysgraphia, and ADHD.
          </p>
        </div>

        <nav className="space-y-1.5 flex-1" aria-label="Cognitive Modes">
          {MODES_DATA.map((mode) => {
            const isActive = mode.key === activeKey;
            return (
              <button
                key={mode.key}
                onClick={() => selectMode(mode.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] text-left transition-all duration-150 cursor-pointer border-0 ${
                  isActive
                    ? 'bg-[var(--color-bg)] shadow-[var(--shadow-sm)]'
                    : 'bg-transparent hover:bg-[color-mix(in_srgb,var(--color-bg)_60%,transparent)]'
                }`}
              >
                <i
                  className={`ph-duotone ${mode.icon} text-xl shrink-0 mt-0.5`}
                  style={{ color: mode.tint }}
                ></i>
                <div className="min-w-0">
                  <span className="block font-semibold text-[14.5px] leading-tight text-[var(--color-text)]">
                    {mode.name}
                  </span>
                  <span className="block text-[11.5px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)] truncate mt-0.5">
                    {mode.tagline}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ----------------- Right Content & Execution Pane ----------------- */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6 sm:p-10 space-y-8 bg-[var(--color-bg)]">
        {/* Mode Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <i
              className={`ph-duotone ${activeMode.icon} text-3xl`}
              style={{ color: activeMode.tint }}
            ></i>
            <h2 className="text-3xl font-bold text-[var(--color-text)]">{activeMode.name}</h2>
          </div>
          <p className="text-[16px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_78%,transparent)] max-w-[60ch]">
            {activeMode.blurb}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRun} className="space-y-4 max-w-3xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="kicker block">{activeMode.fieldLabel}</label>
              <div className="flex items-center gap-2">
                <VoiceInputButton
                  onTranscript={(txt) =>
                    setInputVal((prev) => (prev ? `${prev} ${txt}` : txt))
                  }
                  showLabel={true}
                  label="Voice query"
                  size="sm"
                />
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="btn btn-ghost !min-h-[26px] !px-2 text-xs flex items-center gap-1.5 text-[var(--color-accent)]"
                >
                  <i className="ph-duotone ph-file-arrow-up text-sm"></i>
                  Upload file
                </button>
              </div>
            </div>
            <textarea
              rows={activeMode.rows}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`${activeMode.placeholder} (Type or speak into microphone)`}
              className="textarea text-[14.5px]"
              aria-label={activeMode.fieldLabel}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !inputVal.trim()}
              className="btn btn-primary text-sm px-5"
            >
              {loading ? (
                <>
                  <i className="ph-duotone ph-spinner animate-spin"></i>
                  Processing…
                </>
              ) : (
                <>
                  <i className="ph-duotone ph-sparkle"></i>
                  Run {activeMode.name}
                </>
              )}
            </button>

            <VoiceInputButton
              onTranscript={(txt) =>
                setInputVal((prev) => (prev ? `${prev} ${txt}` : txt))
              }
              size="lg"
              title="Voice query (Speak into microphone)"
            />

            {inputVal && (
              <button type="button" onClick={handleClear} className="btn btn-ghost text-sm">
                Clear
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-accent-2-100)] border border-[var(--color-accent-2)] text-[13px] text-[var(--color-accent-2-900)]">
              {error}
            </div>
          )}
        </form>

        {/* Divider */}
        <hr className="border-0 border-t border-[var(--color-divider)] my-8" />

        {/* Result Area */}
        <section className="space-y-6 max-w-3xl animate-setu-rise">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker">Output Result</span>
              {isWorkedExample ? (
                <span className="tag tag-neutral text-[10.5px]">worked example</span>
              ) : (
                <span className="tag tag-accent text-[10.5px]">
                  <i className="ph-duotone ph-sparkle"></i>
                  AI Response
                </span>
              )}
            </div>

            {/* Accessibility Perception Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReadAloud}
                className={`btn !min-h-[28px] !px-2.5 text-xs font-semibold ${
                  ttsPlaying ? 'btn-primary' : 'btn-ghost'
                }`}
                title="Read result aloud with Text-to-Speech"
              >
                <i className={`ph-duotone ${ttsPlaying ? 'ph-pause-circle' : 'ph-speaker-high'}`}></i>
                <span>{ttsPlaying ? 'Pause Audio' : 'Listen'}</span>
              </button>

              <button
                onClick={() => setBionicMode((prev) => !prev)}
                className={`btn !min-h-[28px] !px-2.5 text-xs font-semibold ${
                  bionicMode
                    ? 'bg-[var(--color-accent-100)] text-[var(--color-accent-900)] border border-[var(--color-accent-300)]'
                    : 'btn-ghost'
                }`}
                title="Toggle Bionic Reading Fixations"
              >
                <i className="ph-duotone ph-eye text-sm"></i>
                <span>Bionic: {bionicMode ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Render Result Content with Interactive ADHD Dopamine Checklists */}
          <RenderModeResult modeKey={activeKey} data={currentResult} bionicEnabled={bionicMode} />
        </section>
      </main>

      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        variant="text"
        attachLabel="Load this text into the field"
        onFileAttached={(doc) => {
          const text = doc.extractedText || doc.summary || '';
          setInputVal(text.slice(0, 60000));
          setError(null);
        }}
      />
    </div>
  );
}

/* ------------------------------ Interactive Render Helpers ------------------------------ */

function RenderModeResult({ modeKey, data, bionicEnabled }) {
  const [checkedSteps, setCheckedSteps] = useState(new Set());
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState({});

  if (!data) return null;

  const toggleStep = (stepId) => {
    const wasChecked = checkedSteps.has(stepId);

    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (wasChecked) next.delete(stepId);
      else next.add(stepId);
      return next;
    });

    // Kept outside the updater: `award` writes to storage and notifies the toast
    // host, and StrictMode invokes updaters twice in development — which paid
    // out two lots of points and played the chime twice for one tick. The chime
    // fires here rather than through the reward toast because a ticked step
    // should feel immediate even when points are switched off.
    if (!wasChecked) {
      tts.playCelebrationChime();
      award('stepChecked');
    }
  };

  switch (modeKey) {
    case 'numbers':
      return <NumberStory data={data} onSolved={() => award('numbersSolved')} />;

    case 'start': {
      const totalSteps = (data.microSteps || []).length;
      const completedCount = [...checkedSteps].filter((id) => id.startsWith('start-step-')).length;

      return (
        <div className="space-y-5">
          {data.supportiveMessage && (
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#edbb00]">
              <p className="text-[14.5px] italic text-[var(--color-text)]">
                <BionicText text={`“${data.supportiveMessage}”`} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.confidenceMeter && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="tag tag-accent">Effort: {data.confidenceMeter.effortLevel}</span>
              <span className="tag tag-neutral">Anxiety: {data.confidenceMeter.anxietyLevel}</span>
              <span className="tag tag-neutral">
                {data.confidenceMeter.estimatedTimeMinutes} min
              </span>
              {totalSteps > 0 && (
                <span className="tag bg-[var(--color-accent-100)] text-[var(--color-accent-900)] font-bold ml-auto">
                  {completedCount}/{totalSteps} Completed
                </span>
              )}
            </div>
          )}

          {data.immediateTenMinuteAction && (
            <div className="space-y-1.5 p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
              <span className="kicker block text-[11px]">Start with just this (10-minute micro-action)</span>
              <p className="text-[16px] font-bold text-[var(--color-text)]">
                <BionicText text={data.immediateTenMinuteAction} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.microSteps?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="kicker block">Checkable Micro-Steps (Click to complete)</span>
                <span className="text-[11px] text-[var(--color-accent-700)] font-semibold">
                  ADHD Momentum Tracker
                </span>
              </div>
              <ul className="space-y-2 pl-0 list-none">
                {data.microSteps.map((step, idx) => {
                  const stepId = `start-step-${idx}`;
                  const isChecked = checkedSteps.has(stepId);
                  return (
                    <li
                      key={idx}
                      onClick={() => toggleStep(stepId)}
                      className={`flex items-start gap-3 text-[14px] p-3 rounded-[var(--radius-sm)] border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-[var(--color-accent-100)] border-[var(--color-accent-300)] text-[var(--color-text)] opacity-80'
                          : 'bg-[var(--color-surface)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStep(stepId)}
                        className="h-4 w-4 rounded mt-0.5 accent-[var(--color-accent)] shrink-0 cursor-pointer"
                      />
                      <span className={isChecked ? 'line-through opacity-75' : 'font-medium'}>
                        <BionicText text={step} enabled={bionicEnabled} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {data.clarifyingQuestion && (
            <div className="space-y-1 p-3 bg-[var(--color-surface)] rounded-[var(--radius-sm)] border border-[var(--color-divider)]">
              <span className="kicker block text-[10.5px]">Worth answering first</span>
              <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] italic">
                <BionicText text={data.clarifyingQuestion} enabled={bionicEnabled} />
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'simplify':
      return (
        <div className="space-y-5">
          {data.readabilityGrade && (
            <span className="tag tag-accent font-bold">{data.readabilityGrade}</span>
          )}

          {data.plainLanguageRewrite && (
            <div className="space-y-1.5">
              <span className="kicker block">In plain words (Grade 6 Reading Level)</span>
              <p className="text-[15.5px] leading-relaxed text-[var(--color-text)] p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
                <BionicText text={data.plainLanguageRewrite} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.keyTakeaways?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">Core Takeaways</span>
              <ul className="space-y-1.5 pl-5 list-disc text-[14px] text-[var(--color-text)]">
                {data.keyTakeaways.map((point, idx) => (
                  <li key={idx}>
                    <BionicText text={point} enabled={bionicEnabled} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.sensoryTips?.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="kicker block">Cognitive Reading Tips</span>
              <ul className="space-y-1 pl-5 list-disc text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                {data.sensoryTips.map((tip, idx) => (
                  <li key={idx}>
                    <BionicText text={tip} enabled={bionicEnabled} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'learn':
      return (
        <div className="space-y-5">
          {data.summary && (
            <div className="space-y-1.5">
              <span className="kicker block">Summary</span>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
                <BionicText text={data.summary} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.mindMap?.branches?.length > 0 && (
            <div className="space-y-3">
              <span className="kicker block">{data.mindMap.rootNode || 'Key Concept Branches'}</span>
              <div className="space-y-3">
                {data.mindMap.branches.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#d6006c]"
                  >
                    <h4 className="font-bold text-[14.5px] text-[var(--color-text)] mb-1">
                      <BionicText text={b.topic} enabled={bionicEnabled} />
                    </h4>
                    <ul className="space-y-1 pl-4 list-disc text-[13px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
                      {(b.details || []).map((d, dIdx) => (
                        <li key={dIdx}>
                          <BionicText text={d} enabled={bionicEnabled} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.quiz?.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="kicker block">Interactive Knowledge Check</span>
              {data.quiz.map((q, idx) => {
                const selectedOpt = selectedQuizAnswers[idx];
                const correctIdx = q.answerIndex ?? q.correctAnswerIndex ?? 0;
                const hasAnswered = selectedOpt !== undefined;

                return (
                  <div
                    key={idx}
                    className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2.5"
                  >
                    <p className="font-semibold text-[14.5px] text-[var(--color-text)]">
                      <BionicText text={`${idx + 1}. ${q.question}`} enabled={bionicEnabled} />
                    </p>
                    <div className="space-y-1.5 pl-2">
                      {(q.options || []).map((opt, optIdx) => {
                        const isChosen = selectedOpt === optIdx;
                        const isCorrect = optIdx === correctIdx;

                        return (
                          <button
                            key={optIdx}
                            onClick={() => {
                              // Only the first answer to a question scores, so
                              // clicking through the options cannot farm points.
                              if (hasAnswered) return;
                              setSelectedQuizAnswers((prev) => ({ ...prev, [idx]: optIdx }));
                              if (optIdx === correctIdx) {
                                tts.playCelebrationChime();
                                award('quizCorrect');
                              }
                            }}
                            className={`w-full text-left p-2.5 rounded text-[13px] transition-all cursor-pointer border ${
                              hasAnswered
                                ? isCorrect
                                  ? 'bg-green-100 border-green-400 text-green-900 font-bold'
                                  : isChosen
                                    ? 'bg-red-100 border-red-400 text-red-900'
                                    : 'bg-[var(--color-bg)] border-[var(--color-divider)] opacity-60'
                                : 'bg-[var(--color-bg)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                            }`}
                          >
                            {hasAnswered && isCorrect ? '✓ ' : hasAnswered && isChosen ? '✗ ' : '• '}
                            <BionicText text={opt} enabled={bionicEnabled} />
                          </button>
                        );
                      })}
                    </div>
                    {hasAnswered && q.explanation && (
                      <p className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] italic pt-1 border-t border-[var(--color-divider)] animate-setu-rise">
                        <strong>Explanation:</strong> <BionicText text={q.explanation} enabled={bionicEnabled} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    case 'meet':
      return (
        <div className="space-y-5">
          {data.summary && (
            <div className="space-y-1.5">
              <span className="kicker block">Meeting Summary</span>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
                <BionicText text={data.summary} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.actionItems?.length > 0 && (
            <div className="space-y-2.5">
              <span className="kicker block">Action Items (Check when completed)</span>
              <div className="space-y-2">
                {data.actionItems.map((item, idx) => {
                  const itemId = `meet-action-${idx}`;
                  const isChecked = checkedSteps.has(itemId);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleStep(itemId)}
                      className={`p-3 rounded-[var(--radius-md)] border flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'bg-[var(--color-accent-100)] border-[var(--color-accent-300)] opacity-80'
                          : 'bg-[var(--color-surface)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStep(itemId)}
                          className="h-4 w-4 rounded accent-[var(--color-accent)] shrink-0 cursor-pointer"
                        />
                        <span
                          className={`font-semibold text-[14px] text-[var(--color-text)] ${
                            isChecked ? 'line-through opacity-75' : ''
                          }`}
                        >
                          <BionicText text={item.task} enabled={bionicEnabled} />
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0 pl-6 sm:pl-0">
                        {item.owner && <span className="tag tag-accent">{item.owner}</span>}
                        {item.deadline && <span className="tag tag-neutral">{item.deadline}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.keyDecisions?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">Decisions made</span>
              <ul className="space-y-1 pl-5 list-disc text-[14px] text-[var(--color-text)]">
                {data.keyDecisions.map((dec, idx) => (
                  <li key={idx}>
                    <BionicText text={dec} enabled={bionicEnabled} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.jargonDecoded?.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="kicker block">Jargon decoded</span>
              <dl className="space-y-1.5">
                {data.jargonDecoded.map((j, idx) => (
                  <div key={idx} className="text-[13.5px]">
                    <dt className="inline font-bold text-[var(--color-text)]">{j.term}: </dt>
                    <dd className="inline text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
                      <BionicText text={j.plainMeaning} enabled={bionicEnabled} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      );

    case 'practice':
      return (
        <div className="space-y-5">
          {data.scenarioContext && (
            <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
              <BionicText text={data.scenarioContext} enabled={bionicEnabled} />
            </p>
          )}

          {data.openingLine && (
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#d6006c] space-y-2">
              <div className="flex items-center justify-between">
                <span className="kicker block">Their opening line</span>
                <button
                  type="button"
                  onClick={() => tts.speak(data.openingLine)}
                  className="btn btn-ghost !min-h-[24px] !px-2 text-[11px] text-[var(--color-accent)]"
                  title="Listen to opening line"
                >
                  <i className="ph-duotone ph-speaker-high"></i>
                  Listen
                </button>
              </div>
              <p className="text-[15px] italic text-[var(--color-text)] font-serif">
                “<BionicText text={data.openingLine} enabled={bionicEnabled} />”
              </p>
            </div>
          )}

          {data.suggestedResponses?.length > 0 && (
            <div className="space-y-3">
              <span className="kicker block">Suggested responses</span>
              {data.suggestedResponses.map((res, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="tag tag-accent text-[11px]">{res.tone}</span>
                    <button
                      type="button"
                      onClick={() => tts.speak(res.text)}
                      className="btn btn-ghost !min-h-[22px] !px-1.5 text-[11px]"
                      title="Listen to this response"
                    >
                      <i className="ph-duotone ph-speaker-high"></i>
                      Listen
                    </button>
                  </div>
                  <p className="text-[14.5px] leading-relaxed text-[var(--color-text)]">
                    “<BionicText text={res.text} enabled={bionicEnabled} />”
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.coachingTip && (
            <div className="p-3 bg-[var(--color-accent-100)] rounded-[var(--radius-md)] border border-[var(--color-accent-300)] text-[13.5px] text-[var(--color-accent-900)]">
              <strong>Tip:</strong> <BionicText text={data.coachingTip} enabled={bionicEnabled} />
            </div>
          )}
        </div>
      );

    case 'write': {
      const grade = data.originalGradeLevel || data.readingGrade;
      const rewrite = data.improvedText || data.accessibleRewrite;
      const fixes = data.clarityFixes || [];

      return (
        <div className="space-y-5">
          {grade && <span className="tag tag-accent">{grade}</span>}

          {rewrite && (
            <div className="space-y-1.5">
              <span className="kicker block">Clear Accessible Rewrite</span>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)] p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
                <BionicText text={rewrite} enabled={bionicEnabled} />
              </p>
            </div>
          )}

          {data.passiveVoiceInstances?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">Passive voice found</span>
              <ul className="space-y-1.5 pl-0 list-none">
                {data.passiveVoiceInstances.map((instance, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-sm)] border-l-[3px] border-[#edbb00] text-[13.5px] text-[var(--color-text)] italic"
                  >
                    “<BionicText text={instance} enabled={bionicEnabled} />”
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fixes.length > 0 && (
            <div className="space-y-2.5">
              <span className="kicker block">Line-by-Line Clarity Edits</span>
              {fixes.map((fix, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2"
                >
                  <p className="text-[13px] leading-snug text-[color-mix(in_srgb,var(--color-text)_62%,transparent)] line-through decoration-[var(--color-accent-2)]">
                    {fix.originalSnippet}
                  </p>
                  <p className="text-[14.5px] leading-relaxed font-semibold text-[var(--color-text)]">
                    <BionicText text={fix.suggestedSnippet} enabled={bionicEnabled} />
                  </p>
                  {fix.reason && (
                    <p className="text-[12.5px] text-[var(--color-accent-700)] pt-1.5 border-t border-[var(--color-divider)]">
                      {fix.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'guide': {
      const heading = data.workflowName || data.goal;
      const steps = data.steps || [];

      return (
        <div className="space-y-5">
          {heading && (
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[17px] font-bold text-[var(--color-text)]">
                <BionicText text={heading} enabled={bionicEnabled} />
              </h3>
              <span className="tag tag-neutral">
                {data.totalSteps || steps.length} steps
              </span>
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-3">
              {steps.map((st, idx) => {
                const stepId = `guide-step-${idx}`;
                const isDone = checkedSteps.has(stepId);

                return (
                  <div
                    key={idx}
                    onClick={() => toggleStep(stepId)}
                    className={`p-4 rounded-[var(--radius-md)] border space-y-2 cursor-pointer transition-all ${
                      isDone
                        ? 'bg-[var(--color-accent-100)] border-[var(--color-accent-300)] opacity-85'
                        : 'bg-[var(--color-surface)] border-[var(--color-divider)] hover:border-[var(--color-accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] font-bold text-[12px]">
                          {st.stepNumber || idx + 1}
                        </span>
                        <span className={`font-bold text-[15px] text-[var(--color-text)] ${isDone ? 'line-through' : ''}`}>
                          <BionicText text={st.title || `Step ${st.stepNumber || idx + 1}`} enabled={bionicEnabled} />
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleStep(stepId)}
                        className="h-4 w-4 rounded accent-[var(--color-accent)] shrink-0 cursor-pointer"
                      />
                    </div>
                    <p className={`text-[14px] leading-relaxed text-[var(--color-text)] pl-[34px] ${isDone ? 'line-through opacity-75' : ''}`}>
                      <BionicText text={st.actionRequired || st.action} enabled={bionicEnabled} />
                    </p>
                    {(st.tip || st.successSignal) && (
                      <div className="ml-[34px] p-2.5 rounded bg-[var(--color-bg)] border border-[var(--color-divider)] text-[12.5px] leading-snug text-[var(--color-accent-700)]">
                        <strong>You will know it worked when:</strong>{' '}
                        <BionicText text={st.tip || st.successSignal} enabled={bionicEnabled} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    default:
      return (
        <pre className="p-4 bg-[var(--color-surface)] rounded text-[13px] overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}
