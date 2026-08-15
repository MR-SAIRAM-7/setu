export default function BreakDialog({ isOpen, onKeepGoing, onTakeFive }) {
  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop items-center p-4">
      <div
        className="dialog w-full max-w-[480px] p-6 text-left border border-[var(--color-divider)]"
        role="alertdialog"
        aria-labelledby="break-dialog-title"
        aria-describedby="break-dialog-desc"
      >
        <span className="kicker kicker-magenta mb-2 block">Focus Session</span>
        <h2 id="break-dialog-title" className="text-2xl font-bold text-[var(--color-text)] mb-3">
          That's twenty-five minutes.
        </h2>
        <p
          id="break-dialog-desc"
          className="text-[15px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_78%,transparent)] mb-6"
        >
          You've done the hard part. Look away from the screen for a few minutes — the map will be
          exactly where you left it, and so will your place in it.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button onClick={onKeepGoing} className="btn btn-secondary text-sm">
            Keep going
          </button>
          <button onClick={onTakeFive} className="btn btn-primary text-sm">
            Take five
          </button>
        </div>
      </div>
    </div>
  );
}
