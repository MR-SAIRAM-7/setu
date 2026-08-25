/**
 * Visual Explainer — turn any chart, table, diagram, or dense block into a map.
 *
 * Point at something and get back its *shape*: a mind map of how it is put
 * together, its numbers redrawn as a chart you can actually read, and the two
 * or three things worth taking away. Not a paragraph about it — a paragraph is
 * the thing the reader was already struggling with, and answering a chart with
 * more prose is answering the wrong question.
 *
 * Four things make it work everywhere:
 *
 *  - Text-bearing regions are mapped from their text, which is exact and free.
 *    Only genuinely pictorial things go to the vision model.
 *  - Every node speaks itself on hover. This came out of clinical review: a
 *    mind map is a visual artefact, and handing a visual artefact to someone
 *    who reads by ear is only half an accommodation.
 *  - When the engine is unreachable, out of quota, or unconfigured, the map is
 *    built in the page from the element's own structure — headings, list
 *    items, table rows. Less insightful, still a map, and always there.
 *  - It renders in our own shadow root over the site the reader is already on,
 *    so nothing navigates away mid-task.
 */

(() => {
  const { Feature, UI, API, Text, Store, Dock, Scroll, icon } = window.SETU;

  /** Node geometry, in CSS pixels at zoom 1. */
  const ROOT_W = 210;
  const BRANCH_W = 190;
  const CHILD_W = 168;
  const H_GAP = 54;
  const V_GAP = 14;
  const PAD = 18;

  /** How long the cursor must rest on a node before it speaks. */
  const HOVER_SPEAK_MS = 420;

  class VisualBreakdown extends Feature {
    static key = 'visual';

    constructor() {
      super();
      this.picking = false;
      this.hovered = null;
      this.map = null;
      this.zoom = 1;
      this.speakOnHover = false;
      this.hoverTimer = null;
      this.controller = null;
      this.stopSpotlight = null;
      this.collapsed = new Set();
      this.geometry = null;
      this.size = null;
    }

    /** Entry point — invoked from the popup, a shortcut, or the context menu. */
    onEnable(options = {}) {
      API.warm();
      const selection = String(options.selection || '').trim() || Text.selection();

      // A user who selected text and asked for a map has already told us what
      // they mean; making them then point at it is a pointless second step.
      if (selection.length > 40) {
        this.renderPanel();
        this.mapText(selection, 'your selection');
        return;
      }

      this.startPicking();
    }

    onDisable() {
      this.controller?.abort();
      this.controller = null;
      clearTimeout(this.hoverTimer);
      this.stopSpotlight?.();
      this.stopSpotlight = null;
      window.SETU.Voice?.stop();
      this.stopPicking();
      this.releaseDock?.();
      this.releaseDock = null;
      UI.destroyHost('breakdown');
      UI.destroyHost('picker');
      this.panelScope = null;
      this.body = null;
      this.map = null;
      this.collapsed.clear();
      this.geometry = null;
      this.size = null;
    }

    /* ------------------------------------------------------------------ */
    /* Element picker                                                     */
    /* ------------------------------------------------------------------ */

    startPicking() {
      if (this.picking) return;
      this.picking = true;

      const root = UI.host('picker', { layer: 'panel' });
      const style = document.createElement('style');
      style.textContent = `
        .outline {
          position: fixed; pointer-events: none;
          border: 2.5px solid var(--accent);
          background: color-mix(in srgb, var(--accent) 8%, transparent);
          border-radius: var(--radius);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
          display: none; transition: all .08s ease-out;
        }
        .hint {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 8px; pointer-events: none;
          padding: 10px 18px; background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); box-shadow: var(--shadow); color: var(--text);
          font-size: 13.5px; font-weight: 600; white-space: nowrap; font-family: var(--font);
        }
        .hint svg { color: var(--accent); }
        .hint kbd {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 1px 6px;
          font-family: var(--font); font-size: 11.5px; margin: 0 2px; font-weight: 700;
        }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="outline"></div>
        <div class="hint">
          ${icon('hand-pointing', { size: 18 })}
          <span>Click any chart, image, table or section to map it — <kbd>Esc</kbd> to cancel</span>
        </div>
      `;
      root.appendChild(scope);
      this.outline = scope.querySelector('.outline');

      // Capture phase so we intercept the click before the page handles it.
      this.onMove = (event) => this.highlight(event);
      this.onClick = (event) => {
        // Clicks on our own panel (retargeted to its shadow host) must not be
        // read as "map the last thing the cursor happened to pass over".
        if (Text.isOurs(event.target)) return;
        if (!this.hovered) return;
        event.preventDefault();
        event.stopPropagation();
        const target = this.hovered;
        this.stopPicking();
        this.mapElement(target);
      };
      this.onKey = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          // Full teardown, so hosts and listeners are released properly.
          window.setuLens?.toggle('visual', false);
        }
      };

      window.addEventListener('mousemove', this.onMove, true);
      window.addEventListener('click', this.onClick, true);
      window.addEventListener('keydown', this.onKey, true);
    }

    stopPicking() {
      if (!this.picking) return;
      this.picking = false;
      window.removeEventListener('mousemove', this.onMove, true);
      window.removeEventListener('click', this.onClick, true);
      window.removeEventListener('keydown', this.onKey, true);
      UI.destroyHost('picker');
      this.hovered = null;
    }

    highlight(event) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el || Text.isOurs(el)) return;

      // Prefer a meaningful ancestor over a bare <span> of text.
      const target =
        el.closest('figure, table, img, canvas, svg, picture, video, section, article, form, [role="img"]') ||
        el.closest('div, p, li, ul, ol') ||
        el;

      this.hovered = target;
      const rect = target.getBoundingClientRect();
      Object.assign(this.outline.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    }

    /* ------------------------------------------------------------------ */
    /* Mapping                                                            */
    /* ------------------------------------------------------------------ */

    async mapElement(el) {
      this.sourceElement = el;
      this.renderPanel();
      this.setState('Reading this closely…');

      const pictorial =
        /^(IMG|CANVAS|SVG|PICTURE|VIDEO)$/.test(el.tagName) || el.getAttribute('role') === 'img';
      const text = this.extractText(el);

      // Text is exact, free, and far faster. Only send pixels when there are
      // no words to work from.
      if (!pictorial && text.length > 80) {
        await this.mapText(text, this.describeSource(el), el);
        return;
      }

      try {
        const image = await this.capture(el);
        if (!image) {
          if (text.length > 20) {
            await this.mapText(text, this.describeSource(el), el);
          } else {
            this.setState('There is not enough here to map. Try selecting a larger area.', 'error');
          }
          return;
        }

        this.controller = new AbortController();
        const map = await API.cached(
          '/api/agent/visualize',
          {
            image,
            context: `${document.title} — ${el.getAttribute('alt') || el.getAttribute('aria-label') || text.slice(0, 200)}`,
            language: Store.getSetting('language') || 'English'
          },
          { signal: this.controller.signal, timeoutMs: 60000 }
        );

        this.show(map, el);
      } catch (error) {
        if (error.name === 'AbortError') return;
        this.fallBack(el, text, error);
      }
    }

    async mapText(text, sourceLabel, el = null) {
      this.renderPanel();
      // Held so an empty or failed reply can still be mapped from structure.
      this.lastText = text;

      // Draw a map read straight off the page first, then upgrade it when the
      // engine answers. The AI map is worth waiting for, but not worth waiting
      // for in front of an empty panel — and on a free tier the wait ends in a
      // failure often enough that "spinner, then error" would be the common
      // case rather than the rare one.
      const local = this.readStructure(el || this.sourceElement, text);
      if (local.branches.length) {
        this.show({ ...local, fallback: true, pending: true }, el);
      } else {
        this.setState('Finding the shape of this…');
      }

      try {
        this.controller = new AbortController();
        const map = await API.cached(
          '/api/agent/visualize',
          {
            text,
            context: `${document.title}${sourceLabel ? ` — ${sourceLabel}` : ''}`,
            language: Store.getSetting('language') || 'English'
          },
          { signal: this.controller.signal, timeoutMs: 62000 }
        );

        this.show(map, el);
      } catch (error) {
        if (error.name === 'AbortError') return;

        // A local map is already on screen; say why it is not the better one
        // rather than replacing something usable with an error.
        if (this.map?.pending) {
          this.map = { ...this.map, pending: false, fallbackReason: this.explainFailure(error) };
          this.paint();
          return;
        }
        this.fallBack(el, text, error);
      }
    }

    /**
     * Build a map in the page when the engine could not.
     *
     * On free tiers this path runs often — an exhausted daily quota is the
     * normal state, not the exception — so it is a real feature rather than an
     * error screen. The structure of a document is already a map: headings are
     * branches, list items and table rows are children. Reading it out is less
     * insightful than a model, and infinitely better than a red message.
     */
    fallBack(el, text, error) {
      const local = this.readStructure(el, text);

      if (!local.branches.length) {
        this.setState(
          `${this.explainFailure(error)}\n\nThere was also no structure here to map on its own.`,
          'error'
        );
        return;
      }

      this.show({ ...local, fallback: true, fallbackReason: this.explainFailure(error) }, el);
    }

    /** Derive branches from the element's own structure, or from the text. */
    readStructure(el, text) {
      const branches = [];

      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const shorten = (value, max = 60) =>
        clean(value).length > max ? `${clean(value).slice(0, max - 1)}…` : clean(value);

      // A selection has no element of its own, and falling back to
      // `document.body` would map the whole page — confidently answering a
      // question nobody asked. Map the words the user actually chose.
      if (!el) {
        for (const passage of splitIntoPassages(text)) {
          const [first] = passage.split(/(?<=[.!?।])\s+/);
          branches.push({
            label: shorten(first, 46),
            detail: passage.length > first.length ? shorten(passage.slice(first.length), 140) : '',
            children: []
          });
        }

        return {
          title: shorten(document.title, 70),
          kind: 'mindmap',
          summary: 'Built from the text you selected, without the AI engine.',
          branches: branches.filter((branch) => branch.label),
          series: [],
          insights: [],
          caution: ''
        };
      }

      const root = el;

      if (root.tagName === 'TABLE' && root.rows?.length > 1) {
        const header = [...root.rows[0].cells].map((cell) => clean(cell.innerText));
        for (let column = 0; column < Math.min(header.length, 6); column += 1) {
          if (!header[column]) continue;
          const children = [...root.rows]
            .slice(1, 7)
            .map((row) => clean(row.cells[column]?.innerText))
            .filter(Boolean)
            .map((value, index) => ({
              label: shorten(value, 40),
              detail: clean(root.rows[index + 1]?.cells[0]?.innerText)
            }));
          branches.push({ label: shorten(header[column], 40), detail: '', children });
        }
      } else {
        const headings = [...root.querySelectorAll('h1, h2, h3, h4, dt, strong')]
          .filter((node) => clean(node.innerText).length > 2)
          .slice(0, 6);

        for (const heading of headings) {
          const children = [];
          let sibling = heading.nextElementSibling;
          let guard = 0;
          while (sibling && guard < 6 && !/^H[1-4]$/.test(sibling.tagName)) {
            for (const item of sibling.matches?.('ul, ol')
              ? [...sibling.querySelectorAll('li')].slice(0, 4)
              : [sibling]) {
              const value = clean(item.innerText);
              if (value.length > 8) children.push({ label: shorten(value, 46), detail: '' });
            }
            sibling = sibling.nextElementSibling;
            guard += 1;
          }
          branches.push({
            label: shorten(heading.innerText, 46),
            detail: '',
            children: children.slice(0, 4)
          });
        }

        // No headings — fall back to the leading sentence of each paragraph.
        if (!branches.length) {
          const paragraphs = [...root.querySelectorAll('p, li')]
            .map((node) => clean(node.innerText))
            .filter((value) => value.length > 40)
            .slice(0, 5);

          const source = paragraphs.length ? paragraphs : splitIntoPassages(text);

          for (const passage of source) {
            const [first] = passage.split(/(?<=[.!?।])\s+/);
            branches.push({
              label: shorten(first, 46),
              detail: passage.length > first.length ? shorten(passage.slice(first.length), 140) : '',
              children: []
            });
          }
        }
      }

      return {
        title: shorten(
          (el && (el.getAttribute?.('aria-label') || el.querySelector?.('h1,h2,h3')?.innerText)) ||
            document.title,
          70
        ),
        kind: root.tagName === 'TABLE' ? 'comparison' : 'mindmap',
        summary: 'Built from the structure of this section, without the AI engine.',
        branches: branches.filter((branch) => branch.label),
        series: [],
        insights: [],
        caution: ''
      };
    }

    describeSource(el) {
      if (!el) return '';
      const tag = el.tagName?.toLowerCase();
      const label = el.getAttribute?.('aria-label') || el.getAttribute?.('alt') || '';
      return label || (tag === 'table' ? 'a table on the page' : `a ${tag} on the page`);
    }

    /** Turn an engine failure into something the user can act on. */
    explainFailure(error) {
      return (
        {
          offline: 'The SETU engine is unreachable.',
          timeout: 'The engine was too slow this time.',
          'rate-limited': 'The AI quota needs a minute to recover.',
          unavailable: 'The engine has no AI provider configured.',
          server: 'The engine hit an internal error.'
        }[error.code] || error.message
      );
    }

    extractText(el) {
      if (el.tagName === 'TABLE') {
        // Preserve row structure — a flattened table is unreadable, to a model
        // as much as to a person.
        return [...el.rows]
          .slice(0, 40)
          .map((row) => [...row.cells].map((cell) => cell.innerText.trim()).join(' | '))
          .join('\n');
      }
      return (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '')
        .trim()
        .slice(0, 8000);
    }

    /**
     * Crop the element out of a visible-tab screenshot.
     * The service worker owns captureVisibleTab; content scripts cannot call it.
     */
    async capture(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) return null;

      // Only what is on screen can be captured.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        Scroll.into(el, { block: 'center', smooth: false });
        await new Promise((resolve) => setTimeout(resolve, 320));
      }

      const shot = await chrome.runtime.sendMessage({ action: 'captureTab' });
      if (!shot?.dataUrl) return null;

      const box = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const response = await fetch(shot.dataUrl);
      const bitmap = await createImageBitmap(await response.blob());

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1400, Math.round(box.width * dpr));
      canvas.height = Math.round(box.height * dpr * (canvas.width / (box.width * dpr)));

      canvas
        .getContext('2d')
        .drawImage(
          bitmap,
          box.left * dpr,
          box.top * dpr,
          box.width * dpr,
          box.height * dpr,
          0,
          0,
          canvas.width,
          canvas.height
        );

      bitmap.close?.();
      return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                          */
    /* ------------------------------------------------------------------ */

    show(map, sourceEl) {
      // A map with nothing in it is a blank panel, which reads as a broken
      // feature rather than as a failed request. The engine rejects these, but
      // an older engine build would not, and the page's own structure is
      // always a better answer than an empty box.
      if (!map?.branches?.length && !map?.series?.length) {
        const local = this.readStructure(sourceEl || this.sourceElement, this.lastText || '');
        if (local.branches.length) {
          map = { ...local, fallback: true, fallbackReason: 'The AI returned an empty map.' };
        }
      }

      this.map = map;
      this.collapsed.clear();
      this.zoom = 1;
      this.renderPanel();
      this.paint();

      if (sourceEl?.isConnected) {
        this.stopSpotlight?.();
        this.stopSpotlight = UI.spotlight(sourceEl, { duration: 2600, tone: 'accent' });
      }
    }

    setState(message, tone = 'loading') {
      if (!this.body) return;
      this.body.innerHTML = `<div class="state" data-tone="${tone}">${Text.escape(message)}</div>`;
      if (tone === 'loading') {
        const cancel = document.createElement('button');
        cancel.className = 'setu-btn';
        cancel.style.width = '100%';
        cancel.textContent = 'Cancel';
        cancel.onclick = () => this.controller?.abort();
        this.body.appendChild(cancel);
      }
    }

    paint() {
      const map = this.map;
      if (!map || !this.body) return;

      const kindLabel = {
        mindmap: 'Mind map',
        flow: 'Steps',
        comparison: 'Comparison',
        timeline: 'Timeline',
        data: 'Data'
      }[map.kind] || 'Mind map';

      this.body.innerHTML = `
        <div class="meta">
          <span class="setu-tag" data-tone="accent">${Text.escape(kindLabel)}</span>
          ${map.fallback ? '<span class="setu-tag">built from this page</span>' : ''}
          ${map.pending ? '<span class="setu-tag" data-tone="accent">asking the AI for a better one…</span>' : ''}
          ${map.series?.length ? `<span class="setu-tag">${map.series.length} values</span>` : ''}
        </div>
        <h2 class="title">${Text.escape(map.title || 'This section')}</h2>
        ${map.summary ? `<p class="summary">${Text.escape(map.summary)}</p>` : ''}
        ${map.fallbackReason ? `<p class="note">${Text.escape(map.fallbackReason)}</p>` : ''}
        <div class="canvas" role="tree" aria-label="Mind map of this section"><div class="map"></div></div>
        ${this.chartMarkup(map.series)}
        ${
          map.insights?.length
            ? `<section class="insights">
                 <h3 class="setu-kicker">What to take away</h3>
                 <ul>${map.insights.map((line) => `<li>${Text.escape(line)}</li>`).join('')}</ul>
               </section>`
            : ''
        }
        ${map.caution ? `<p class="caution">${icon('warning', { size: 13 })}${Text.escape(map.caution)}</p>` : ''}
      `;

      this.layoutMap(this.body.querySelector('.map'));
    }

    /** Horizontal bars: the one chart form that stays readable when small. */
    chartMarkup(series) {
      if (!series?.length) return '';

      const max = Math.max(...series.map((point) => Math.abs(point.value))) || 1;
      const unit = series.find((point) => point.unit)?.unit || '';

      return `
        <section class="chart">
          <h3 class="setu-kicker">The numbers${unit ? `, in ${Text.escape(unit)}` : ''}</h3>
          <ol class="bars">
            ${series
              .map(
                (point) => `
              <li class="bar-row">
                <span class="bar-label" title="${Text.escape(point.label)}">${Text.escape(point.label)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${Math.max(
                  2,
                  (Math.abs(point.value) / max) * 100
                ).toFixed(1)}%"></span></span>
                <b class="bar-value">${Text.escape(formatNumber(point.value))}</b>
              </li>`
              )
              .join('')}
          </ol>
        </section>
      `;
    }

    /**
     * Lay the tree out.
     *
     * Two passes, because node height depends on how the text wraps and there
     * is no way to know that without measuring. Nodes go in hidden at their
     * final width, get measured, and are then positioned — which is how a
     * six-word branch and a one-word branch end up correctly spaced rather
     * than overlapping or leaving a hole.
     */
    layoutMap(container) {
      if (!container || !this.map) return;

      const branches = this.map.branches || [];
      const nodes = [];

      const make = (level, label, detail, meta = {}) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'node';
        el.dataset.level = String(level);
        el.style.width = `${[ROOT_W, BRANCH_W, CHILD_W][level]}px`;
        el.style.visibility = 'hidden';
        el.setAttribute('role', 'treeitem');

        el.innerHTML = `
          <span class="node-label">${Text.escape(label)}</span>
          ${detail ? `<span class="node-detail">${Text.escape(detail)}</span>` : ''}
          ${meta.count ? `<span class="node-count">${meta.count}</span>` : ''}
        `;

        container.appendChild(el);
        nodes.push({ el, level, label, detail, ...meta });
        return el;
      };

      container.innerHTML = '';

      const edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      edges.setAttribute('class', 'edges');
      container.appendChild(edges);

      // Pass 1 — create and measure.
      const rootNode = { el: make(0, this.map.title || 'This section', this.map.summary || '') };
      const branchNodes = branches.map((branch, index) => {
        const isCollapsed = this.collapsed.has(index);
        const children = branch.children || [];
        const el = make(1, branch.label, branch.detail, {
          count: children.length && isCollapsed ? `+${children.length}` : '',
          branchIndex: index
        });
        el.dataset.branch = String(index);
        if (children.length) el.dataset.collapsible = 'true';

        return {
          el,
          branch,
          index,
          children: isCollapsed
            ? []
            : children.map((child) => ({
                el: make(2, child.label, child.detail),
                child
              }))
        };
      });

      // Pass 2 — measure, then place.
      const heightOf = (el) => el.offsetHeight || 48;

      let cursor = PAD;
      const columnX = [PAD, PAD + ROOT_W + H_GAP, PAD + ROOT_W + H_GAP + BRANCH_W + H_GAP];

      for (const node of branchNodes) {
        const childrenHeight = node.children.reduce(
          (sum, child) => sum + heightOf(child.el) + V_GAP,
          0
        );
        const own = heightOf(node.el) + V_GAP;
        const block = Math.max(own, childrenHeight);

        // Children stack in their own column, and the branch centres on them.
        let childCursor = cursor + (block - childrenHeight) / 2;
        for (const child of node.children) {
          child.top = childCursor;
          childCursor += heightOf(child.el) + V_GAP;
        }

        node.top = cursor + (block - heightOf(node.el)) / 2;
        cursor += block;
      }

      const totalHeight = Math.max(cursor + PAD, heightOf(rootNode.el) + PAD * 2);
      const totalWidth = columnX[branchNodes.some((n) => n.children.length) ? 2 : 1] +
        (branchNodes.some((n) => n.children.length) ? CHILD_W : BRANCH_W) + PAD;

      rootNode.top = Math.max(PAD, (totalHeight - heightOf(rootNode.el)) / 2);

      const place = (el, left, top) => {
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.visibility = 'visible';
      };

      place(rootNode.el, columnX[0], rootNode.top);
      for (const node of branchNodes) {
        place(node.el, columnX[1], node.top);
        for (const child of node.children) place(child.el, columnX[2], child.top);
      }

      container.style.width = `${totalWidth}px`;
      container.style.height = `${totalHeight}px`;

      // Edges last, once every box has a final position.
      edges.setAttribute('width', String(totalWidth));
      edges.setAttribute('height', String(totalHeight));
      edges.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

      const curve = (x1, y1, x2, y2) => {
        const mid = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
        path.setAttribute('class', 'edge');
        edges.appendChild(path);
      };

      const rightOf = (node, left, width) => ({
        x: left + width,
        y: node.top + heightOf(node.el) / 2
      });

      for (const node of branchNodes) {
        const from = rightOf(rootNode, columnX[0], ROOT_W);
        curve(from.x, from.y, columnX[1], node.top + heightOf(node.el) / 2);

        for (const child of node.children) {
          const branchAnchor = rightOf(node, columnX[1], BRANCH_W);
          curve(branchAnchor.x, branchAnchor.y, columnX[2], child.top + heightOf(child.el) / 2);
        }
      }

      this.wireNodes(container);
      this.applyZoom();
    }

    /**
     * Hover speaks, click collapses.
     *
     * Speaking on hover came out of clinical review: a mind map is a visual
     * artefact, and a reader who takes information in by ear gets nothing from
     * one they cannot hear. The delay matters as much as the feature — firing
     * on every pixel of cursor travel turns a map into a stutter of half-words.
     */
    wireNodes(container) {
      for (const node of container.querySelectorAll('.node')) {
        const speak = () => {
          if (!this.speakOnHover) return;
          clearTimeout(this.hoverTimer);
          this.hoverTimer = setTimeout(() => {
            const label = node.querySelector('.node-label')?.textContent || '';
            const detail = node.querySelector('.node-detail')?.textContent || '';
            window.SETU.Voice?.say(detail ? `${label}. ${detail}` : label);
          }, HOVER_SPEAK_MS);
        };

        node.addEventListener('mouseenter', speak);
        node.addEventListener('focus', speak);
        node.addEventListener('mouseleave', () => clearTimeout(this.hoverTimer));

        node.addEventListener('click', () => {
          if (node.dataset.collapsible !== 'true') return;
          const index = Number(node.dataset.branch);
          if (this.collapsed.has(index)) this.collapsed.delete(index);
          else this.collapsed.add(index);
          this.layoutMap(container);
        });
      }
    }

    applyZoom() {
      const map = this.body?.querySelector('.map');
      if (map) {
        map.style.transform = `scale(${this.zoom})`;
        map.style.transformOrigin = '0 0';
      }
      const readout = this.panelScope?.querySelector('.zoom-value');
      if (readout) readout.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    setZoom(next) {
      this.zoom = Math.max(0.5, Math.min(1.6, Number(next.toFixed(2))));
      this.applyZoom();
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                              */
    /* ------------------------------------------------------------------ */

    renderPanel() {
      const root = UI.host('breakdown', { layer: 'panel' });
      if (this.panelScope?.isConnected) return;

      const style = document.createElement('style');
      style.textContent = `
        .panel {
          position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
          width: min(840px, calc(100vw - 36px)); height: min(78vh, 760px);
          min-width: 380px; min-height: 280px;
          max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
          display: flex; flex-direction: column;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); box-shadow: var(--shadow);
          font-family: var(--font); color: var(--text); overflow: hidden;
          resize: both; z-index: 2147483645;
        }
        .panel[data-dragging="true"], .panel[data-resizing="true"] {
          user-select: none;
        }
        .head {
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:12px 16px; border-bottom:1px solid var(--border); background: var(--bg);
          flex-shrink:0; cursor:grab; user-select:none;
        }
        .head:active { cursor:grabbing; }
        .badge { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--accent-700); }
        .acts { display:flex; gap:4px; align-items:center; }
        .acts button {
          background:none; border:1px solid transparent; color:var(--text-dim);
          cursor:pointer; padding:5px; border-radius:var(--radius);
          display:grid; place-items:center;
        }
        .acts button:hover { color:var(--accent-900); background:var(--accent-100); border-color: var(--accent); }
        .acts button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .acts button[aria-pressed="true"] { color:var(--accent-900); background:var(--accent-100); border-color:var(--accent); }
        .zoom-value { font-size:11px; color:var(--text-dim); min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }

        .content { flex: 1; min-height: 0; padding: 18px 20px; overflow-y: auto; background: var(--surface); display: flex; flex-direction: column; }
        .meta { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:10px; flex-shrink:0; }
        .title { font-size:19px; font-weight:700; line-height:1.3; margin-bottom:6px; color:var(--text); flex-shrink:0; }
        .summary { font-size:14px; line-height:1.6; color:var(--text-dim); margin-bottom:14px; flex-shrink:0; }
        .note { font-size:12px; color:var(--warn); margin-bottom:12px; flex-shrink:0; }

        .canvas {
          overflow:auto; border:1px solid var(--border); border-radius:var(--radius);
          background: var(--bg); padding:8px; margin-bottom:16px; min-height:220px; flex: 1 1 auto;
        }
        .map { position:relative; }
        .edges { position:absolute; inset:0; pointer-events:none; overflow:visible; }
        .edge { fill:none; stroke:var(--accent-300); stroke-width:1.6; }

        .node {
          position:absolute; text-align:left; display:block;
          padding:9px 12px; border-radius:var(--radius);
          background:var(--surface); border:1px solid var(--border);
          font-family:var(--font); color:var(--text); cursor:default;
          box-shadow:var(--shadow-sm); transition:border-color .14s ease, background .14s ease;
        }
        .node[data-collapsible="true"] { cursor:pointer; }
        .node:hover, .node:focus-visible {
          border-color:var(--accent); background:var(--accent-100); outline:none;
        }
        .node[data-level="0"] {
          background:var(--accent); border-color:var(--accent); color:var(--on-accent);
        }
        .node[data-level="0"]:hover { background:var(--accent-600); border-color:var(--accent-600); }
        .node[data-level="2"] { background:var(--bg-soft); }
        .node-label { display:block; font-size:13.5px; font-weight:700; line-height:1.35; }
        .node-detail { display:block; font-size:12px; line-height:1.5; margin-top:3px; opacity:.82; }
        .node[data-level="0"] .node-detail { opacity:.92; }
        .node-count {
          display:inline-block; margin-top:5px; padding:1px 7px; border-radius:999px;
          background:var(--accent-100); color:var(--accent-900); border:1px solid var(--accent-300);
          font-size:10.5px; font-weight:700;
        }

        .chart { margin-bottom:16px; flex-shrink:0; }
        .bars { list-style:none; margin-top:9px; display:flex; flex-direction:column; gap:7px; }
        .bar-row { display:grid; grid-template-columns: minmax(70px, 26%) 1fr auto; gap:10px; align-items:center; }
        .bar-label {
          font-size:12.5px; color:var(--text); overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap;
        }
        .bar-track { height:15px; background:var(--bg-soft); border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border); }
        .bar-fill { display:block; height:100%; background:var(--accent); }
        .bar-value { font-size:12.5px; font-variant-numeric:tabular-nums; color:var(--text); }

        .insights { margin-bottom:12px; flex-shrink:0; }
        .insights ul { margin:8px 0 0 18px; }
        .insights li { font-size:13.5px; line-height:1.6; margin-bottom:6px; }
        .caution {
          display:flex; gap:7px; align-items:flex-start;
          font-size:12.5px; line-height:1.5; color:var(--warn);
          padding:9px 11px; border-radius:var(--radius);
          background:rgba(237,187,0,.12); border:1px solid rgba(237,187,0,.35);
          flex-shrink:0;
        }
        .caution svg { flex-shrink:0; margin-top:2px; }

        .resize-handle {
          position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
          cursor: nwse-resize; z-index: 20; display: grid; place-items: center;
          user-select: none;
        }
        .resize-handle::after {
          content: ''; position: absolute; right: 4px; bottom: 4px;
          width: 8px; height: 8px;
          border-right: 2px solid var(--text-dim);
          border-bottom: 2px solid var(--text-dim);
          opacity: 0.55;
          transition: opacity 0.15s ease, border-color 0.15s ease;
        }
        .resize-handle:hover::after, .panel[data-resizing="true"] .resize-handle::after {
          opacity: 1; border-color: var(--accent);
        }

        .state { padding:26px 12px; text-align:center; font-size:13.5px; color:var(--text-dim); white-space:pre-wrap; }
        .state[data-tone="error"] { color:var(--danger); }
        @keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        .state[data-tone="loading"] { animation: pulse 1.4s ease-in-out infinite; }
      `;
      root.appendChild(style);

      const scope = document.createElement('div');
      scope.className = 'setu-scope';
      scope.innerHTML = `
        <div class="panel" role="dialog" aria-label="Visual map">
          <div class="head">
            <span class="badge">VISUAL MAP</span>
            <div class="acts">
              <button data-act="zoom-out" aria-label="Zoom out" title="Zoom out">${icon('minus', { size: 16 })}</button>
              <span class="zoom-value">100%</span>
              <button data-act="zoom-in" aria-label="Zoom in" title="Zoom in">${icon('plus', { size: 16 })}</button>
              <button data-act="hover-audio" aria-pressed="false" aria-label="Speak nodes on hover"
                      title="Speak each node when you point at it">${icon('speaker-high', { size: 17 })}</button>
              <button data-act="read" aria-label="Read the whole map aloud" title="Read the whole map aloud">${icon('book-open', { size: 17 })}</button>
              <button data-act="sanctuary" aria-label="Send to Sanctuary" title="Send to my Sanctuary">${icon('arrow-square-in', { size: 17 })}</button>
              <button data-act="again" aria-label="Map something else" title="Map something else">${icon('crosshair', { size: 17 })}</button>
              <button data-act="close" aria-label="Close" title="Close">${icon('x', { size: 17 })}</button>
            </div>
          </div>
          <div class="content"></div>
          <div class="resize-handle" data-act="resize" title="Drag to resize"></div>
        </div>
      `;
      root.appendChild(scope);

      this.panelScope = scope;
      this.body = scope.querySelector('.content');

      const panel = scope.querySelector('.panel');
      if (this.geometry) {
        panel.style.transform = 'none';
        panel.style.left = `${this.geometry.left}px`;
        panel.style.top = `${this.geometry.top}px`;
      }
      if (this.size) {
        panel.style.width = `${this.size.width}px`;
        panel.style.height = `${this.size.height}px`;
      }

      const act = (name, fn) => {
        const el = scope.querySelector(`[data-act="${name}"]`);
        if (el) el.onclick = fn;
      };

      act('close', () => window.setuLens?.toggle('visual', false));
      act('again', () => {
        window.SETU.Voice?.stop();
        this.startPicking();
      });
      act('zoom-in', () => this.setZoom(this.zoom + 0.15));
      act('zoom-out', () => this.setZoom(this.zoom - 0.15));
      act('read', () => this.readAloud());
      act('sanctuary', () => this.sendToSanctuary());
      act('hover-audio', (event) => {
        this.speakOnHover = !this.speakOnHover;
        event.currentTarget.setAttribute('aria-pressed', String(this.speakOnHover));
        if (!this.speakOnHover) {
          clearTimeout(this.hoverTimer);
          window.SETU.Voice?.stop();
        }
      });

      this.makeDraggable(scope.querySelector('.head'), panel);
      this.makeResizable(scope.querySelector('.resize-handle'), panel);
      this.listen(window, 'resize', () => this.clampIntoView(panel));
    }

    makeDraggable(handle, panel) {
      let origin = null;

      const onDown = (event) => {
        if (event.target.closest('button, .resize-handle')) return;
        const rect = panel.getBoundingClientRect();
        if (!this.geometry) {
          panel.style.transform = 'none';
          panel.style.left = `${rect.left}px`;
          panel.style.top = `${rect.top}px`;
          this.geometry = { left: rect.left, top: rect.top };
        }
        origin = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        handle.setPointerCapture?.(event.pointerId);
        panel.dataset.dragging = 'true';
      };

      const onMove = (event) => {
        if (!origin) return;
        const width = panel.offsetWidth;
        const height = panel.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, origin.left + event.clientX - origin.x));
        const top = Math.max(8, Math.min(window.innerHeight - height - 8, origin.top + event.clientY - origin.y));
        this.geometry = { left, top };
        Object.assign(panel.style, {
          left: `${left}px`,
          top: `${top}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'none'
        });
      };

      const onUp = (event) => {
        if (!origin) return;
        origin = null;
        panel.dataset.dragging = 'false';
        handle.releasePointerCapture?.(event.pointerId);
      };

      this.listen(handle, 'pointerdown', onDown);
      this.listen(handle, 'pointermove', onMove);
      this.listen(handle, 'pointerup', onUp);
      this.listen(handle, 'pointercancel', onUp);
    }

    makeResizable(grip, panel) {
      if (!grip || !panel) return;
      let origin = null;

      const onDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = panel.getBoundingClientRect();
        if (!this.geometry) {
          panel.style.transform = 'none';
          panel.style.left = `${rect.left}px`;
          panel.style.top = `${rect.top}px`;
          this.geometry = { left: rect.left, top: rect.top };
        }
        origin = {
          x: event.clientX,
          y: event.clientY,
          width: rect.width,
          height: rect.height
        };
        grip.setPointerCapture?.(event.pointerId);
        panel.dataset.resizing = 'true';
      };

      const onMove = (event) => {
        if (!origin) return;
        const minW = 380;
        const minH = 280;
        const maxW = window.innerWidth - 24;
        const maxH = window.innerHeight - 24;
        const nextW = Math.max(minW, Math.min(maxW, origin.width + (event.clientX - origin.x)));
        const nextH = Math.max(minH, Math.min(maxH, origin.height + (event.clientY - origin.y)));
        this.size = { width: Math.round(nextW), height: Math.round(nextH) };
        panel.style.width = `${this.size.width}px`;
        panel.style.height = `${this.size.height}px`;
      };

      const onUp = (event) => {
        if (!origin) return;
        origin = null;
        panel.dataset.resizing = 'false';
        grip.releasePointerCapture?.(event.pointerId);
        this.clampIntoView(panel);
      };

      this.listen(grip, 'pointerdown', onDown);
      this.listen(grip, 'pointermove', onMove);
      this.listen(grip, 'pointerup', onUp);
      this.listen(grip, 'pointercancel', onUp);
    }

    clampIntoView(panel = this.panelScope?.querySelector('.panel')) {
      if (!panel || !this.geometry) return;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, this.geometry.left));
      const top = Math.max(8, Math.min(window.innerHeight - height - 8, this.geometry.top));
      this.geometry = { left, top };
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }

    /** The whole map as a spoken narration, in reading order. */
    readAloud() {
      if (!this.map) return;
      window.SETU.Voice?.say(this.asProse());
    }

    asProse() {
      const map = this.map;
      if (!map) return '';

      const lines = [map.title, map.summary];
      for (const branch of map.branches || []) {
        lines.push(`${branch.label}. ${branch.detail || ''}`);
        for (const child of branch.children || []) {
          lines.push(`${child.label}. ${child.detail || ''}`);
        }
      }
      if (map.series?.length) {
        lines.push('The numbers:');
        for (const point of map.series) {
          lines.push(`${point.label}, ${formatNumber(point.value)}${point.unit ? ` ${point.unit}` : ''}.`);
        }
      }
      for (const insight of map.insights || []) lines.push(insight);
      if (map.caution) lines.push(`One caution: ${map.caution}`);

      return lines.filter(Boolean).join('\n');
    }

    async sendToSanctuary() {
      if (!this.map) return;

      const response = await chrome.runtime.sendMessage({
        action: 'sendToSanctuary',
        payload: {
          title: this.map.title || document.title,
          url: location.href,
          text: this.asProse()
        }
      });

      if (!response?.ok) {
        UI.toast(response?.error || 'Could not send that to your Sanctuary.', { tone: 'error' });
      }
    }
  }

  /**
   * Break loose text into a handful of passages to hang branches off.
   *
   * Sentence-level, and only sentences long enough to carry an idea — a map
   * whose branches are "Yes." and "See below." is worse than no map.
   */
  function splitIntoPassages(text, limit = 5) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?।])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 40)
      .slice(0, limit);
  }

  /** Keep large numbers readable without turning 0.5 into "1". */
  function formatNumber(value) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(abs < 1 ? 2 : 1);
  }

  window.SETU.features.set('visual', VisualBreakdown);
})();
