// SETU Visual Breakdown creates plain-language cards from information already
// exposed in the DOM (alt text, captions, table headers, and visible labels).
class VisualBreakdown {
  constructor() {
    this.overlay = null;
  }

  open() {
    this.overlay?.remove();
    this.overlay = document.createElement('section');
    this.overlay.id = 'setu-visual-breakdown';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Visual breakdown');
    this.overlay.innerHTML = `
      <div class="setu-visual-header"><div><p class="setu-kicker">SETU visual breakdown</p><h2>What the page is showing</h2></div><button class="setu-dismiss" aria-label="Close visual breakdown">×</button></div>
      <p class="setu-muted">These cards use page-provided descriptions and structure. They do not upload screenshots.</p>
      <div class="setu-visual-cards"></div>`;
    document.body.appendChild(this.overlay);
    this.overlay.querySelector('.setu-dismiss').addEventListener('click', () => this.close());
    this.renderCards();
  }

  close() {
    this.overlay?.remove();
    this.overlay = null;
  }

  addCard(title, description, steps = []) {
    const container = this.overlay?.querySelector('.setu-visual-cards');
    if (!container) return;
    const card = document.createElement('article');
    card.className = 'setu-visual-card';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = description;
    card.append(heading, body);
    if (steps.length) {
      const list = document.createElement('ol');
      steps.forEach((step) => { const item = document.createElement('li'); item.textContent = step; list.appendChild(item); });
      card.appendChild(list);
    }
    container.appendChild(card);
  }

  renderCards() {
    const main = document.querySelector('article, main, [role="main"]') || document.body;
    const tables = Array.from(main.querySelectorAll('table')).filter((table) => table.offsetParent !== null).slice(0, 3);
    const images = Array.from(main.querySelectorAll('img, svg, canvas, [role="img"]')).filter((image) => image.offsetParent !== null).slice(0, 4);
    const forms = Array.from(main.querySelectorAll('form')).filter((form) => form.offsetParent !== null).slice(0, 2);
    let cardCount = 0;

    tables.forEach((table, index) => {
      const caption = table.querySelector('caption')?.innerText.trim();
      const headers = Array.from(table.querySelectorAll('th')).slice(0, 6).map((header) => header.innerText.trim()).filter(Boolean);
      const rows = Array.from(table.querySelectorAll('tbody tr, tr')).slice(0, 3).map((row) => Array.from(row.querySelectorAll('td')).slice(0, 4).map((cell) => cell.innerText.trim()).filter(Boolean).join(' — ')).filter(Boolean);
      this.addCard(
        caption || `Table ${index + 1}`,
        headers.length ? `This table compares: ${headers.join(', ')}.` : 'This table contains structured information.',
        rows.length ? [`Start with the column headings.`, ...rows.map((row) => `Example row: ${row}`)] : ['Read across one row at a time rather than scanning the whole table.']
      );
      cardCount += 1;
    });

    images.forEach((image, index) => {
      const caption = image.closest('figure')?.querySelector('figcaption')?.innerText.trim();
      const alt = image.getAttribute('alt') || image.getAttribute('aria-label') || image.getAttribute('title');
      const text = `${caption || ''} ${alt || ''}`.trim();
      const kind = /chart|graph|plot|data/i.test(`${image.className} ${image.id} ${text}`) ? 'Chart or graph' : 'Image or diagram';
      this.addCard(
        `${kind} ${index + 1}`,
        text || 'This visual has no text description supplied by the page, so SETU cannot reliably infer its meaning without sending an image to an AI service.',
        text ? ['Notice the title or caption first.', 'Use nearby text to confirm the main takeaway.'] : ['Look for a caption, legend, or surrounding paragraph.', 'Ask the publisher to provide useful alt text for this visual.']
      );
      cardCount += 1;
    });

    forms.forEach((form, index) => {
      const controls = Array.from(form.querySelectorAll('input, textarea, select')).filter((control) => control.type !== 'hidden').slice(0, 6);
      const labels = controls.map((control) => control.labels?.[0]?.innerText.trim() || control.getAttribute('aria-label') || control.placeholder || control.name).filter(Boolean);
      this.addCard(`Form ${index + 1}`, `This form asks for ${labels.length ? labels.join(', ') : 'several details'}.`, ['You can open Task path to complete one field at a time.', 'SETU Commander can preview an optional contact-details fill.']);
      cardCount += 1;
    });

    if (!cardCount) this.addCard('No structured visuals found', 'This page does not expose visible images, data tables, or forms in its main content.', ['Use the reading tools to simplify the text instead.']);
  }
}

window.VisualBreakdown = VisualBreakdown;
