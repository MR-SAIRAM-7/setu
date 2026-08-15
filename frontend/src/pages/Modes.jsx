import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

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
          correctAnswerIndex: 0,
          explanation: 'Thylakoid membranes contain chlorophyll and ATP synthase complexes.'
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
      readingGrade: 'Grade 7 (Clear & Accessible)',
      accessibleRewrite:
        'We updated the login system today. You can now use your email address or Google account to sign in immediately without waiting for an SMS code.',
      passiveVoiceInstances: ['"SMS codes were dispatched by our server" → changed to active voice.'],
      improvements: [
        'Split the 42-word run-on sentence into two concise sentences.',
        'Removed redundant corporate jargon ("seamless synchronization paradigm").'
      ]
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
      goal: 'Setting up Git SSH Authentication',
      steps: [
        {
          stepNumber: 1,
          action: 'Run ssh-keygen -t ed25519 -C "your_email@example.com" in terminal.',
          successSignal: 'Terminal outputs "Your identification has been saved in /id_ed25519".'
        },
        {
          stepNumber: 2,
          action: 'Copy the public key using cat ~/.ssh/id_ed25519.pub and paste it into GitHub SSH Settings.',
          successSignal: 'GitHub displays green key icon with your email address.'
        },
        {
          stepNumber: 3,
          action: 'Test the connection with ssh -T git@github.com.',
          successSignal: 'You see "Hi username! You\'ve successfully authenticated".'
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

  const activeMode = MODES_DATA.find((m) => m.key === activeKey) || MODES_DATA[0];

  useEffect(() => {
    const paramKey = searchParams.get('mode');
    if (paramKey && MODES_DATA.some((m) => m.key === paramKey)) {
      setActiveKey(paramKey);
    }
  }, [searchParams]);

  const handleRun = async (e) => {
    e?.preventDefault();
    if (!inputVal.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const data = await activeMode.run(inputVal.trim());
      setResults((prev) => ({ ...prev, [activeKey]: data }));
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

  // Show active result or fallback to rich worked example
  const currentResult = results[activeKey] || activeMode.workedExample;
  const isWorkedExample = !results[activeKey];

  return (
    <div className="flex h-full w-full flex-col lg:flex-row overflow-hidden bg-[var(--color-bg)] text-left">
      {/* ----------------- Left Navigation Pane (268px) ----------------- */}
      <aside className="lg:w-[268px] lg:shrink-0 flex flex-col border-r border-[var(--color-divider)] bg-[var(--color-surface)] p-4 sm:p-5 overflow-y-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Modes</h1>
          <p className="text-[12.5px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] mt-1">
            Seven tools. Pick whatever is in your way right now.
          </p>
        </div>

        <nav className="space-y-1.5 flex-1" aria-label="Cognitive Modes">
          {MODES_DATA.map((mode) => {
            const isActive = mode.key === activeKey;
            return (
              <button
                key={mode.key}
                onClick={() => {
                  setActiveKey(mode.key);
                  setError(null);
                }}
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
            <label className="kicker block">{activeMode.fieldLabel}</label>
            <textarea
              rows={activeMode.rows}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={activeMode.placeholder}
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
                  Thinking…
                </>
              ) : (
                <>
                  <i className="ph-duotone ph-sparkle"></i>
                  Run {activeMode.name}
                </>
              )}
            </button>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="kicker">Last result</span>
              {isWorkedExample && (
                <span className="tag tag-neutral text-[10.5px]">worked example</span>
              )}
            </div>
          </div>

          {/* Render Result Content */}
          <RenderModeResult modeKey={activeKey} data={currentResult} />
        </section>
      </main>
    </div>
  );
}

/* ------------------------------ Render Helpers ------------------------------ */

function RenderModeResult({ modeKey, data }) {
  if (!data) return null;

  switch (modeKey) {
    case 'start':
      return (
        <div className="space-y-5">
          {data.supportiveMessage && (
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#edbb00]">
              <p className="text-[14.5px] italic text-[var(--color-text)]">
                “{data.supportiveMessage}”
              </p>
            </div>
          )}

          {data.confidenceMeter && (
            <div className="flex flex-wrap gap-2">
              <span className="tag tag-accent">Effort: {data.confidenceMeter.effortLevel}</span>
              <span className="tag tag-neutral">Anxiety: {data.confidenceMeter.anxietyLevel}</span>
              <span className="tag tag-neutral">
                {data.confidenceMeter.estimatedTimeMinutes} min
              </span>
            </div>
          )}

          {data.immediateTenMinuteAction && (
            <div className="space-y-1.5 p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
              <span className="kicker block text-[11px]">Start with just this</span>
              <p className="text-[16px] font-bold text-[var(--color-text)]">
                {data.immediateTenMinuteAction}
              </p>
            </div>
          )}

          {data.microSteps?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">Then, in order</span>
              <ol className="space-y-2 pl-0 list-none">
                {data.microSteps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-[14px] text-[var(--color-text)] p-2.5 bg-[var(--color-surface)] rounded-[var(--radius-sm)]"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-accent-100)] text-[11px] font-bold text-[var(--color-accent-900)]">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.clarifyingQuestion && (
            <div className="space-y-1">
              <span className="kicker block">Worth answering first</span>
              <p className="text-[14px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)] italic">
                {data.clarifyingQuestion}
              </p>
            </div>
          )}
        </div>
      );

    case 'simplify':
      return (
        <div className="space-y-5">
          {data.readabilityGrade && (
            <span className="tag tag-accent">{data.readabilityGrade}</span>
          )}

          {data.plainLanguageRewrite && (
            <div className="space-y-1.5">
              <span className="kicker block">In plain words</span>
              <p className="text-[15.5px] leading-relaxed text-[var(--color-text)] p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
                {data.plainLanguageRewrite}
              </p>
            </div>
          )}

          {data.keyTakeaways?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">What matters</span>
              <ul className="space-y-1.5 pl-5 list-disc text-[14px] text-[var(--color-text)]">
                {data.keyTakeaways.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {data.sensoryTips?.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="kicker block">Reading tips</span>
              <ul className="space-y-1 pl-5 list-disc text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
                {data.sensoryTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
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
                {data.summary}
              </p>
            </div>
          )}

          {data.mindMap?.branches?.length > 0 && (
            <div className="space-y-3">
              <span className="kicker block">{data.mindMap.rootNode || 'Key Branches'}</span>
              <div className="space-y-3">
                {data.mindMap.branches.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#d6006c]"
                  >
                    <h4 className="font-bold text-[14.5px] text-[var(--color-text)] mb-1">
                      {b.topic}
                    </h4>
                    <ul className="space-y-1 pl-4 list-disc text-[13px] text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
                      {(b.details || []).map((d, dIdx) => (
                        <li key={dIdx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.quiz?.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="kicker block">Self Quiz</span>
              {data.quiz.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2.5"
                >
                  <p className="font-semibold text-[14.5px] text-[var(--color-text)]">{q.question}</p>
                  <div className="space-y-1.5 pl-2">
                    {(q.options || []).map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`p-2 rounded text-[13px] ${
                          optIdx === q.correctAnswerIndex
                            ? 'bg-[var(--color-accent-100)] text-[var(--color-accent-900)] font-semibold'
                            : 'text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]'
                        }`}
                      >
                        {optIdx === q.correctAnswerIndex ? '✓ ' : '• '} {opt}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] italic pt-1 border-t border-[var(--color-divider)]">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'meet':
      return (
        <div className="space-y-5">
          {data.summary && (
            <div className="space-y-1.5">
              <span className="kicker block">What happened</span>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
                {data.summary}
              </p>
            </div>
          )}

          {data.actionItems?.length > 0 && (
            <div className="space-y-2.5">
              <span className="kicker block">Action items</span>
              <div className="space-y-2">
                {data.actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-[14px] text-[var(--color-text)]">
                      {item.task}
                    </span>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {item.owner && <span className="tag tag-accent">{item.owner}</span>}
                      {item.deadline && <span className="tag tag-neutral">{item.deadline}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.keyDecisions?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">Decisions made</span>
              <ul className="space-y-1 pl-5 list-disc text-[14px] text-[var(--color-text)]">
                {data.keyDecisions.map((dec, idx) => (
                  <li key={idx}>{dec}</li>
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
                      {j.plainMeaning}
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
              {data.scenarioContext}
            </p>
          )}

          {data.openingLine && (
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border-l-4 border-[#d6006c]">
              <span className="kicker block mb-1">Their opening line</span>
              <p className="text-[15px] italic text-[var(--color-text)] font-serif">
                “{data.openingLine}”
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
                  <span className="tag tag-accent text-[11px]">{res.tone}</span>
                  <p className="text-[14.5px] leading-relaxed text-[var(--color-text)]">
                    “{res.text}”
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.coachingTip && (
            <div className="p-3 bg-[var(--color-accent-100)] rounded-[var(--radius-md)] border border-[var(--color-accent-300)] text-[13.5px] text-[var(--color-accent-900)]">
              <strong>Tip:</strong> {data.coachingTip}
            </div>
          )}
        </div>
      );

    case 'write':
      return (
        <div className="space-y-5">
          {data.readingGrade && (
            <span className="tag tag-accent">{data.readingGrade}</span>
          )}

          {data.accessibleRewrite && (
            <div className="space-y-1.5">
              <span className="kicker block">Clear rewrite</span>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)] p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)]">
                {data.accessibleRewrite}
              </p>
            </div>
          )}

          {data.improvements?.length > 0 && (
            <div className="space-y-2">
              <span className="kicker block">What was changed</span>
              <ul className="space-y-1 pl-5 list-disc text-[13.5px] text-[var(--color-text)]">
                {data.improvements.map((imp, idx) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'guide':
      return (
        <div className="space-y-5">
          {data.goal && (
            <h3 className="text-[17px] font-bold text-[var(--color-text)]">{data.goal}</h3>
          )}

          {data.steps?.length > 0 && (
            <div className="space-y-3">
              {data.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-divider)] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-text)] text-[var(--color-bg)] font-bold text-[12px]">
                      {st.stepNumber || idx + 1}
                    </span>
                    <span className="font-bold text-[15px] text-[var(--color-text)]">
                      Step {st.stepNumber || idx + 1}
                    </span>
                  </div>
                  <p className="text-[14px] text-[var(--color-text)] pl-8">{st.action}</p>
                  {st.successSignal && (
                    <div className="ml-8 p-2 rounded bg-[var(--color-bg)] border border-[var(--color-divider)] text-[12.5px] text-[var(--color-accent-700)]">
                      <strong>Signal it worked:</strong> {st.successSignal}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );

    default:
      return (
        <pre className="p-4 bg-[var(--color-surface)] rounded text-[13px] overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}
