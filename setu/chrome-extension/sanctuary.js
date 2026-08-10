class SetuSanctuary {
  constructor() {
    this.vault = [];
    this.activeId = null;
    this.cardIndex = 0;
    this.currentView = 'map';
    this.bindEvents();
    this.load();
  }

  bindEvents() {
    document.querySelectorAll('.view-tabs button').forEach((button) => button.addEventListener('click', () => this.setView(button.dataset.view)));
    document.getElementById('flip-card').addEventListener('click', () => this.flipCard());
    document.getElementById('flashcard').addEventListener('click', () => this.flipCard());
    document.getElementById('flashcard').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.flipCard(); } });
    document.getElementById('previous-card').addEventListener('click', () => this.moveCard(-1));
    document.getElementById('next-card').addEventListener('click', () => this.moveCard(1));
    document.getElementById('remember-card').addEventListener('click', () => this.rememberCard());
    document.getElementById('open-source').addEventListener('click', () => { const doc = this.activeDocument(); if (doc) chrome.tabs.create({ url: doc.sourceUrl }); });
    document.getElementById('remove-document').addEventListener('click', () => this.removeActive());
    document.getElementById('search-button').addEventListener('click', () => this.search());
    document.getElementById('memory-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') this.search(); });
    document.getElementById('file-import').addEventListener('change', (event) => this.importFile(event));
  }

  async load() {
    const { setuVault = [], setuLastOpened } = await chrome.storage.local.get(['setuVault', 'setuLastOpened']);
    this.vault = setuVault;
    this.activeId = this.vault.some((doc) => doc.id === setuLastOpened) ? setuLastOpened : this.vault[0]?.id || null;
    this.render();
  }

  activeDocument() { return this.vault.find((doc) => doc.id === this.activeId); }
  async persist() { await chrome.storage.local.set({ setuVault: this.vault, setuLastOpened: this.activeId }); }

  render() {
    this.renderDocumentList();
    const doc = this.activeDocument();
    document.getElementById('empty-state').hidden = Boolean(doc);
    document.getElementById('document-view').hidden = !doc;
    document.getElementById('open-source').disabled = !doc;
    document.getElementById('remove-document').disabled = !doc;
    if (!doc) return;
    document.getElementById('document-title').textContent = doc.title;
    document.getElementById('document-meta').textContent = `Saved ${this.formatDate(doc.createdAt)} · Local to this device`;
    const summary = document.getElementById('summary-list'); summary.replaceChildren();
    (doc.summary || []).forEach((point) => { const item = document.createElement('li'); item.textContent = point; summary.appendChild(item); });
    this.renderMap(doc); this.renderCard(doc); this.renderTrail(doc); this.setView(this.currentView, false);
  }

  renderDocumentList() {
    const list = document.getElementById('document-list'); list.replaceChildren();
    document.getElementById('material-count').textContent = this.vault.length;
    this.vault.forEach((doc) => {
      const button = document.createElement('button'); button.className = doc.id === this.activeId ? 'active' : '';
      const title = document.createElement('strong'); title.textContent = doc.title;
      const date = document.createElement('small'); date.textContent = this.formatDate(doc.createdAt);
      button.append(title, date); button.addEventListener('click', () => { this.activeId = doc.id; this.cardIndex = 0; this.persist(); this.render(); }); list.appendChild(button);
    });
  }

  renderMap(doc) {
    const target = document.getElementById('mind-map'); target.replaceChildren();
    const root = document.createElement('div'); root.className = 'mind-root'; root.textContent = doc.map?.title || doc.title; target.appendChild(root);
    const branches = document.createElement('div'); branches.className = 'map-branches';
    (doc.map?.children || []).forEach((child) => { const branch = document.createElement('details'); branch.className = 'map-branch'; const summary = document.createElement('summary'); summary.textContent = child.title; const detail = document.createElement('p'); detail.textContent = child.detail || 'Open the source material for this section.'; branch.append(summary, detail); branches.appendChild(branch); });
    target.appendChild(branches);
  }

  renderCard(doc) {
    const cards = doc.flashcards || [];
    if (!cards.length) return;
    this.cardIndex = Math.max(0, Math.min(cards.length - 1, this.cardIndex));
    const card = cards[this.cardIndex];
    const element = document.getElementById('flashcard'); element.querySelector('h2').textContent = card.front; const answer = element.querySelector('.card-answer'); answer.textContent = card.back; answer.hidden = true;
    document.getElementById('flip-card').textContent = 'Show answer'; document.getElementById('card-progress').textContent = `Card ${this.cardIndex + 1} of ${cards.length}`;
    document.getElementById('previous-card').disabled = this.cardIndex === 0; document.getElementById('next-card').disabled = this.cardIndex === cards.length - 1;
  }

  renderTrail(doc) {
    const target = document.getElementById('memory-trail'); target.replaceChildren();
    const events = [{ title: 'Saved to Sanctuary', text: 'SETU made a map, summary, and flashcards from this material.', at: doc.createdAt }, ...(doc.progress?.reviewedCards || []).map((review) => ({ title: 'Flashcard reviewed', text: review.front, at: review.at }))];
    events.forEach((event) => { const item = document.createElement('article'); item.className = 'trail-item'; const title = document.createElement('h3'); title.textContent = event.title; const body = document.createElement('p'); body.textContent = event.text; const time = document.createElement('time'); time.textContent = this.formatDate(event.at); item.append(title, body, time); target.appendChild(item); });
  }

  setView(view, shouldRender = true) { this.currentView = view; document.querySelectorAll('.view-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.view === view)); document.querySelectorAll('.view-panel').forEach((panel) => { panel.hidden = panel.id !== `view-${view}`; }); if (shouldRender) this.render(); }
  flipCard() { const answer = document.querySelector('#flashcard .card-answer'); answer.hidden = !answer.hidden; document.getElementById('flip-card').textContent = answer.hidden ? 'Show answer' : 'Hide answer'; }
  moveCard(offset) { this.cardIndex += offset; this.renderCard(this.activeDocument()); }
  async rememberCard() { const doc = this.activeDocument(); const card = doc.flashcards?.[this.cardIndex]; if (!card) return; doc.progress = doc.progress || { reviewedCards: [] }; doc.progress.reviewedCards = doc.progress.reviewedCards || []; if (!doc.progress.reviewedCards.some((review) => review.id === card.id)) doc.progress.reviewedCards.unshift({ id: card.id, front: card.front, at: new Date().toISOString() }); await this.persist(); this.renderTrail(doc); if (this.cardIndex < doc.flashcards.length - 1) this.moveCard(1); }

  async removeActive() { const doc = this.activeDocument(); if (!doc || !confirm(`Remove “${doc.title}” from this device?`)) return; this.vault = this.vault.filter((item) => item.id !== doc.id); this.activeId = this.vault[0]?.id || null; this.cardIndex = 0; await this.persist(); this.render(); }

  search() { const query = document.getElementById('memory-search').value.trim().toLowerCase(); const results = document.getElementById('search-results'); results.replaceChildren(); if (!query) { results.hidden = true; return; } const terms = query.split(/\s+/).filter((term) => term.length > 2); const ranked = this.vault.map((doc) => ({ doc, score: terms.reduce((score, term) => score + ((`${doc.title} ${doc.text || ''} ${(doc.summary || []).join(' ')}`).toLowerCase().match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0) })).filter((result) => result.score > 0).sort((a, b) => b.score - a.score).slice(0, 4); if (!ranked.length) { const note = document.createElement('p'); note.textContent = 'No close local match yet.'; results.appendChild(note); } ranked.forEach(({ doc }) => { const button = document.createElement('button'); button.textContent = doc.title; const detail = document.createElement('small'); detail.textContent = (doc.summary || [])[0] || this.formatDate(doc.createdAt); button.appendChild(detail); button.addEventListener('click', () => { this.activeId = doc.id; this.cardIndex = 0; this.persist(); this.render(); results.hidden = true; }); results.appendChild(button); }); results.hidden = false; }

  async importFile(event) { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); if (!text.trim()) return; const artifact = this.makeImportedArtifact(file.name, text); this.vault = [artifact, ...this.vault].slice(0, 30); this.activeId = artifact.id; this.cardIndex = 0; await this.persist(); this.render(); event.target.value = ''; }
  makeImportedArtifact(name, text) { const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30000); const sentences = (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35); const summary = sentences.slice(0, 5); const title = name.replace(/\.[^.]+$/, ''); const sections = summary.map((sentence, index) => ({ title: `Key idea ${index + 1}`, text: sentence })); return { id: crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}`, title, sourceUrl: '', createdAt: new Date().toISOString(), text: clean, summary, sections, map: { title, children: sections.map((section) => ({ title: section.title, detail: section.text })) }, flashcards: sections.map((section, index) => ({ id: `import-${index}`, front: section.title, back: section.text })), progress: { reviewedCards: [] } }; }
  formatDate(value) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
}
document.addEventListener('DOMContentLoaded', () => new SetuSanctuary());
