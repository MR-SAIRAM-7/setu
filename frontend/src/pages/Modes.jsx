import { useState } from 'react';
import { api } from '../lib/api';

/**
 * The seven cognitive modes.
 *
 * Each is the same shape — one input, one AI call, one rendered result — so
 * they are declared as data and driven by a single form component rather than
 * seven near-identical screens.
 */
const MODES = [
  {
    key: 'start',
    name: 'Start',
    glyph: '▶',
    tint: 'text-sun-400',
    tagline: 'Break task freeze',
    blurb: 'Turns a daunting task into one ten-minute action you can actually begin.',
    field: { label: 'What are you stuck on?', placeholder: 'e.g. write my dissertation literature review', rows: 2 },
    call: (value) => api.start(value, true),
    render: (data) => (
      <>
        <Quote>{data.supportiveMessage}</Quote>
        <Row>
          <Chip>Effort: {data.confidenceMeter?.effortLevel}</Chip>
          <Chip>Anxiety: {data.confidenceMeter?.anxietyLevel}</Chip>
          <Chip>{data.confidenceMeter?.estimatedTimeMinutes} min</Chip>
        </Row>
        <Block title="Start with just this">
          <p className="text-[14px] font-semibold text-white">{data.immediateTenMinuteAction}</p>
        </Block>
        <Block title="Then, in order">
          <ol className="space-y-2">
            {(data.microSteps || []).map((step, index) => (
              <li key={index} className="flex gap-2.5 text-[13px] text-slate-300">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-iris-500/20 text-[10.5px] font-bold text-iris-300">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </Block>
        <Block title="Worth answering first">
          <p className="text-[13px] italic text-slate-400">{data.clarifyingQuestion}</p>
        </Block>
      </>
    )
  },
  {
    key: 'simplify',
    name: 'Simplify',
    glyph: '≈',
    tint: 'text-teal-400',
    tagline: 'Plain language',
    blurb: 'Rewrites dense or legal text at a Grade 6 reading level without losing any facts.',
    field: { label: 'Paste the text', placeholder: 'Paste a dense notice, contract clause, or policy…', rows: 7 },
    call: (value) => api.simplify(value),
    render: (data) => (
      <>
        <Row><Chip>{data.readabilityGrade}</Chip></Row>
        <Block title="In plain words">
          <p className="text-[14px] leading-relaxed text-slate-200">{data.plainLanguageRewrite}</p>
        </Block>
        <Block title="What matters">
          <List items={data.keyTakeaways} />
        </Block>
        {data.sensoryTips?.length > 0 && (
          <Block title="Reading tips"><List items={data.sensoryTips} muted /></Block>
        )}
      </>
    )
  },
  {
    key: 'learn',
    name: 'Learn',
    glyph: '◈',
    tint: 'text-blue-400',
    tagline: 'Study material',
    blurb: 'Summary, a branching outline, and a self-quiz built from what you paste in.',
    field: { label: 'Paste your study material', placeholder: 'Paste lecture notes, an article, or a chapter…', rows: 7 },
    call: (value) => api.learn(value),
    render: (data) => (
      <>
        <Block title="Summary">
          <p className="text-[14px] leading-relaxed text-slate-200">{data.summary}</p>
        </Block>
        <Block title={data.mindMap?.rootNode || 'Outline'}>
          <div className="space-y-3">
            {(data.mindMap?.branches || []).map((branch, index) => (
              <div key={index} className="border-l-2 border-iris-500/50 pl-3">
                <p className="text-[13.5px] font-bold text-white">{branch.topic}</p>
                <List items={branch.details} muted />
              </div>
            ))}
          </div>
        </Block>
        <Block title="Check yourself"><Quiz questions={data.quiz} /></Block>
      </>
    )
  },
  {
    key: 'meet',
    name: 'Meet',
    glyph: '◍',
    tint: 'text-purple-400',
    tagline: 'Meeting rescue',
    blurb: 'Pulls decisions, owners, and deadlines out of a transcript, and decodes the jargon.',
    field: { label: 'Paste the transcript', placeholder: 'Paste meeting notes or a transcript…', rows: 7 },
    call: (value) => api.meet(value),
    render: (data) => (
      <>
        <Block title="What happened">
          <p className="text-[14px] leading-relaxed text-slate-200">{data.summary}</p>
        </Block>
        {data.actionItems?.length > 0 && (
          <Block title="Action items">
            <div className="space-y-2">
              {data.actionItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-ink-700/50 p-3">
                  <p className="text-[13.5px] font-semibold text-white">{item.task}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Chip>{item.owner}</Chip>
                    <Chip>{item.deadline}</Chip>
                    <Chip>{item.priority}</Chip>
                  </div>
                </div>
              ))}
            </div>
          </Block>
        )}
        {data.keyDecisions?.length > 0 && <Block title="Decisions"><List items={data.keyDecisions} /></Block>}
        {data.jargonDecoded?.length > 0 && (
          <Block title="Jargon, decoded">
            <dl className="space-y-1.5">
              {data.jargonDecoded.map((entry, index) => (
                <div key={index} className="text-[13px]">
                  <dt className="inline font-bold text-white">{entry.term}: </dt>
                  <dd className="inline text-slate-400">{entry.plainMeaning}</dd>
                </div>
              ))}
            </dl>
          </Block>
        )}
      </>
    )
  },
  {
    key: 'practice',
    name: 'Practice',
    glyph: '◑',
    tint: 'text-pink-400',
    tagline: 'Rehearse a conversation',
    blurb: 'Scripts for a hard conversation, in a few different tones, before you have it for real.',
    field: { label: 'What conversation?', placeholder: 'e.g. asking my manager for a deadline extension', rows: 2 },
    call: (value) => api.practice(value),
    render: (data) => (
      <>
        <Block title="The setup">
          <p className="text-[13px] text-slate-400">{data.scenarioContext}</p>
          <p className="mt-2 rounded-xl bg-ink-700/60 p-3 text-[14px] italic text-slate-200">
            “{data.openingLine}”
          </p>
        </Block>
        <Block title="You could say">
          <div className="space-y-2">
            {(data.suggestedResponses || []).map((response, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-ink-700/50 p-3">
                <Chip>{response.tone}</Chip>
                <p className="mt-1.5 text-[13.5px] text-slate-200">“{response.text}”</p>
              </div>
            ))}
          </div>
        </Block>
        <Quote>{data.coachingTip}</Quote>
      </>
    )
  },
  {
    key: 'write',
    name: 'Write',
    glyph: '✎',
    tint: 'text-mint-400',
    tagline: 'Accessible writing',
    blurb: 'Checks your draft for reading level, passive voice, and clarity.',
    field: { label: 'Paste your draft', placeholder: 'Paste something you have written…', rows: 7 },
    call: (value) => api.write(value),
    render: (data) => (
      <>
        <Row><Chip>Reads at {data.originalGradeLevel}</Chip></Row>
        <Block title="Clearer version">
          <p className="text-[14px] leading-relaxed text-slate-200">{data.improvedText}</p>
        </Block>
        {data.clarityFixes?.length > 0 && (
          <Block title="Specific edits">
            <div className="space-y-2">
              {data.clarityFixes.map((fix, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-ink-700/50 p-3 text-[12.5px]">
                  <p className="text-slate-500 line-through">{fix.originalSnippet}</p>
                  <p className="mt-1 font-semibold text-mint-300">{fix.suggestedSnippet}</p>
                  <p className="mt-1 text-[11.5px] italic text-slate-500">{fix.reason}</p>
                </div>
              ))}
            </div>
          </Block>
        )}
        {data.passiveVoiceInstances?.length > 0 && (
          <Block title="Passive voice found"><List items={data.passiveVoiceInstances} muted /></Block>
        )}
      </>
    )
  },
  {
    key: 'guide',
    name: 'Guide',
    glyph: '➜',
    tint: 'text-orange-400',
    tagline: 'Step-by-step',
    blurb: 'Turns any workflow into numbered steps with a clear signal that each one worked.',
    field: { label: "What do you need to do?", placeholder: 'e.g. renew my passport online', rows: 2 },
    call: (value) => api.guide(value),
    render: (data) => (
      <>
        <Row><Chip>{data.totalSteps} steps</Chip></Row>
        <Block title={data.workflowName}>
          <ol className="space-y-2.5">
            {(data.steps || []).map((step) => (
              <li key={step.stepNumber} className="rounded-xl border border-white/10 bg-ink-700/50 p-3">
                <p className="text-[13.5px] font-bold text-white">
                  {step.stepNumber}. {step.title}
                </p>
                <p className="mt-1 text-[13px] text-slate-300">{step.actionRequired}</p>
                <p className="mt-1 text-[11.5px] italic text-slate-500">{step.tip}</p>
              </li>
            ))}
          </ol>
        </Block>
      </>
    )
  }
];

export default function Modes() {
  const [active, setActive] = useState(MODES[0]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold text-white">Cognitive modes</h1>
        <p className="mt-1 text-[13px] text-slate-400">
          Seven focused tools. Pick the one that matches what is in your way right now.
        </p>
      </header>

      <div
        className="mb-6 flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Cognitive modes"
      >
        {MODES.map((mode) => (
          <button
            key={mode.key}
            role="tab"
            aria-selected={active.key === mode.key}
            onClick={() => setActive(mode)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all ${
              active.key === mode.key
                ? 'border-iris-500/60 bg-iris-500/15 text-white'
                : 'border-white/10 bg-ink-800/60 text-slate-400 hover:border-white/25 hover:text-slate-200'
            }`}
          >
            <span className={`text-[15px] ${mode.tint}`} aria-hidden>{mode.glyph}</span>
            <span className="text-left">
              <span className="block text-[13px] font-bold leading-tight">{mode.name}</span>
              <span className="block text-[10.5px] text-slate-500">{mode.tagline}</span>
            </span>
          </button>
        ))}
      </div>

      <ModeForm key={active.key} mode={active} />
    </div>
  );
}

function ModeForm({ mode }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (event) => {
    event.preventDefault();
    if (!value.trim() || busy) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      setResult(await mode.call(value.trim()));
    } catch (runError) {
      setError(runError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={run} className="card h-fit p-5">
        <p className="mb-3 text-[13px] leading-relaxed text-slate-400">{mode.blurb}</p>

        <label className="label mb-2 block" htmlFor="mode-input">
          {mode.field.label}
        </label>
        <textarea
          id="mode-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={mode.field.rows}
          placeholder={mode.field.placeholder}
          className="input resize-y"
        />

        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={!value.trim() || busy}>
            {busy ? 'Working…' : `Run ${mode.name}`}
          </button>
          {value && (
            <button type="button" onClick={() => setValue('')} className="btn-quiet">
              Clear
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
            {error}
          </p>
        )}
      </form>

      <div className="card min-h-[220px] p-5">
        {result ? (
          <div className="animate-fade-up space-y-4">
            {result.fallback && (
              <p className="rounded-lg border border-sun-400/30 bg-sun-400/10 px-3 py-2 text-[11.5px] text-sun-400">
                The AI engine was unreachable, so this is a basic offline result.
              </p>
            )}
            {mode.render(result)}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div className="space-y-2">
              <p className={`text-3xl ${mode.tint}`} aria-hidden>{mode.glyph}</p>
              <p className="text-[13px] text-slate-500">
                {busy ? 'Thinking…' : 'Your result will appear here.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- presentational --------------------------- */

const Block = ({ title, children }) => (
  <section>
    <h3 className="label mb-2">{title}</h3>
    {children}
  </section>
);

const Row = ({ children }) => <div className="flex flex-wrap gap-1.5">{children}</div>;
const Chip = ({ children }) => <span className="chip">{children}</span>;

const Quote = ({ children }) => (
  <p className="rounded-xl border-l-2 border-iris-500 bg-iris-500/10 px-3 py-2.5 text-[13px] italic text-slate-200">
    {children}
  </p>
);

const List = ({ items = [], muted }) => (
  <ul className="space-y-1.5">
    {items.map((item, index) => (
      <li key={index} className={`flex gap-2 text-[13px] ${muted ? 'text-slate-400' : 'text-slate-300'}`}>
        <span className="text-iris-400" aria-hidden>·</span>
        {item}
      </li>
    ))}
  </ul>
);

function Quiz({ questions = [] }) {
  const [picked, setPicked] = useState({});

  return (
    <div className="space-y-4">
      {questions.map((question, qIndex) => {
        const choice = picked[qIndex];
        const answered = choice !== undefined;

        return (
          <div key={qIndex}>
            <p className="mb-2 text-[13.5px] font-semibold text-white">{question.question}</p>
            <div className="space-y-1.5">
              {question.options.map((option, oIndex) => {
                const isAnswer = oIndex === question.answerIndex;
                const isPicked = choice === oIndex;

                return (
                  <button
                    key={oIndex}
                    onClick={() => setPicked((current) => ({ ...current, [qIndex]: oIndex }))}
                    disabled={answered}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors
                      ${
                        answered && isAnswer
                          ? 'border-mint-400/60 bg-mint-400/15 text-mint-200'
                          : isPicked
                            ? 'border-rose-400/60 bg-rose-400/10 text-rose-200'
                            : 'border-white/10 bg-ink-700/40 text-slate-300 hover:border-white/30'
                      }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className="mt-1.5 text-[11.5px] italic text-slate-400">{question.explanation}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
