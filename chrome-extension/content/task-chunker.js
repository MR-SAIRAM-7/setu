/**
 * Preemptive Cognitive Task Chunking.
 *
 * Dense portals (banking, government, employment) present the whole wall at
 * once. This asks the engine to collapse the page into exactly three steps and
 * floats them as a checklist, so the user faces one thing at a time.
 */

(() => {
  const { Feature, UI, API, Text } = window.SETU;

  class TaskChunker extends Feature {
    static key = 'chunking';

    constructor() {
      super();
      this.plan = null;
      this.done = new Set();
      this.collapsed = false;
    }

    async onEnable() {
      this.build();
      await this.load();
    }

    onDisable() {
      UI.destroyHost('chunks');
      this.plan = null;
      this.done.clear();
    }

    async load() {
      this.renderLoading();
      try {
        this.plan = await API.post('/api/agent/chunk', {
          pageContext: window.setuLens?.pageContext({ maxControls: 40 }) || { title: document.title }
        });
        this.render();
      } catch (error) {
        this.renderError(error.message);
      }
    }

    build() {
      const root = UI.host('chunks', { layer: 'panel', interactive: true });

      const style = document.createElement('style');
      style.textContent = `
        .panel {
          position: fixed; top: 84px; right: 20px; width: min(340px, calc(100vw - 40px));
          max-height: calc(100vh - 120px); overflow-y: auto;
          padding: 16px; pointer-events: auto;
        }
        .panel[data-collapsed="true"] .body { display: none; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }
        .badge { font-size:10.5px; font-weight:800; letter-spacing:.09em; color:var(--accent); }
        .icons { display:flex; gap:2px; }
        .icons button { background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:15px; padding:2px 6px; border-radius:6px; }
        .icons button:hover { color:var(--text); background:rgba(255,255,255,.09); }
        h3 { font-size:15.5px; font-weight:700; margin:6px 0 4px; line-height:1.35; }
        .sub { font-size:12.5px; color:var(--text-dim); line-height:1.5; margin-bottom:12px; }
        .meta { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:13px; }
        .chip {
          font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px;
          background:var(--surface); border:1px solid var(--border); color:var(--text-dim);
        }
        .ready { margin-bottom:13px; padding:10px 12px; border-radius:10px;
                 background:rgba(251,191,36,.1); border:1px solid rgba(251,191,36,.3); }
        .ready-title { font-size:11px; font-weight:800; color:var(--warn); letter-spacing:.05em; margin-bottom:5px; }
        .ready li { font-size:12px; color:var(--text-dim); margin-left:15px; line-height:1.5; }
        ol.steps { list-style:none; display:flex; flex-direction:column; gap:9px; }
        .step {
          display:flex; gap:11px; padding:12px; border-radius:11px;
          background:var(--surface); border:1px solid var(--border);
          cursor:pointer; transition:border-color .16s ease, opacity .16s ease;
        }
        .step:hover { border-color:var(--accent); }
        .step[data-done="true"] { opacity:.5; }
        .step[data-done="true"] .step-title { text-decoration:line-through; }
        .tick {
          flex-shrink:0; width:23px; height:23px; border-radius:50%;
          border:2px solid var(--border); display:grid; place-items:center;
          font-size:12px; font-weight:800; color:transparent;
        }
        .step[data-done="true"] .tick { background:var(--accent-2); border-color:var(--accent-2); color:#0b1020; }
        .step-title { font-size:13.5px; font-weight:700; margin-bottom:3px; }
        .step-what { font-size:12.5px; color:var(--text-dim); line-height:1.5; }
        .step-why  { font-size:11.5px; color:var(--text-dim); opacity:.8; margin-top:4px; font-style:italic; }
        .foot { margin-top:14px; font-size:12px; color:var(--accent-2); line-height:1.5; }
        .state { padding:22px 8px; text-align:center; font-size:13px; color:var(--text-dim); }
        .state[data-tone="error"] { color:var(--danger); }
        .bar { height:3px; background:var(--surface); border-radius:2px; overflow:hidden; margin-bottom:13px; }
        .bar-fill { height:100%; width:0; background:var(--accent-2); transition:width .3s ease; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        .state[data-tone="loading"] { animation: pulse 1.4s ease-in-out infinite; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="setu-card panel" role="region" aria-label="Task steps">
          <div class="head">
            <span class="badge">3-STEP PATH</span>
            <div class="icons">
              <button data-act="collapse" aria-label="Collapse" title="Collapse">–</button>
              <button data-act="refresh" aria-label="Regenerate" title="Regenerate">↻</button>
              <button data-act="close" aria-label="Close" title="Close">×</button>
            </div>
          </div>
          <div class="body"></div>
        </div>
      `;
      root.appendChild(scope);

      this.scope = scope;
      this.panel = scope.querySelector('.panel');
      this.body = scope.querySelector('.body');

      scope.querySelector('[data-act="close"]').onclick = () => window.setuLens?.toggle('chunking', false);
      scope.querySelector('[data-act="refresh"]').onclick = () => this.load();
      scope.querySelector('[data-act="collapse"]').onclick = (event) => {
        this.collapsed = !this.collapsed;
        this.panel.dataset.collapsed = String(this.collapsed);
        event.target.textContent = this.collapsed ? '+' : '–';
      };
    }

    renderLoading() {
      this.body.innerHTML = `<div class="state" data-tone="loading">Reading this page and shrinking it to three steps…</div>`;
    }

    renderError(message) {
      this.body.innerHTML = `
        <div class="state" data-tone="error">${Text.escape(message)}</div>
        <button class="setu-btn" data-act="retry" style="width:100%">Try again</button>
      `;
      this.body.querySelector('[data-act="retry"]').onclick = () => this.load();
    }

    render() {
      const plan = this.plan;
      if (!plan) return;

      this.body.innerHTML = `
        <div class="bar"><div class="bar-fill"></div></div>
        <h3>${Text.escape(plan.pageName || document.title)}</h3>
        <p class="sub">${Text.escape(plan.whatThisPageIsFor || '')}</p>
        <div class="meta">
          <span class="chip">~${Number(plan.estimatedMinutes) || 5} min</span>
          <span class="chip">${(plan.steps || []).length} steps</span>
          ${plan.fallback ? '<span class="chip">offline plan</span>' : ''}
        </div>
        ${
          (plan.thingsToHaveReady || []).length
            ? `<div class="ready">
                 <div class="ready-title">HAVE THESE READY</div>
                 <ul>${plan.thingsToHaveReady.map((item) => `<li>${Text.escape(item)}</li>`).join('')}</ul>
               </div>`
            : ''
        }
        <ol class="steps">
          ${(plan.steps || [])
            .map(
              (step, index) => `
            <li class="step" data-index="${index}" data-done="false" tabindex="0" role="checkbox" aria-checked="false">
              <div class="tick">✓</div>
              <div>
                <div class="step-title">${index + 1}. ${Text.escape(step.title)}</div>
                <div class="step-what">${Text.escape(step.what)}</div>
                <div class="step-why">${Text.escape(step.why)}</div>
              </div>
            </li>`
            )
            .join('')}
        </ol>
        <p class="foot">${Text.escape(plan.encouragement || '')}</p>
      `;

      this.body.querySelectorAll('.step').forEach((el) => {
        const toggle = () => this.toggleStep(el);
        el.onclick = toggle;
        el.onkeydown = (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        };
      });
    }

    toggleStep(el) {
      const index = Number(el.dataset.index);
      const nowDone = !this.done.has(index);

      if (nowDone) this.done.add(index);
      else this.done.delete(index);

      el.dataset.done = String(nowDone);
      el.setAttribute('aria-checked', String(nowDone));

      const total = (this.plan?.steps || []).length || 1;
      const fill = this.body.querySelector('.bar-fill');
      if (fill) fill.style.width = `${(this.done.size / total) * 100}%`;

      if (this.done.size === total) {
        UI.toast('All three steps done. Nicely handled.', { tone: 'success', duration: 3600 });
      }
    }
  }

  window.SETU.features.set('chunking', TaskChunker);
})();
