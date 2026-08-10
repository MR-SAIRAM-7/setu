// SETU Sanctuary bridge. Builds a deterministic local learning artifact that
// works without an account, API key, or network request.
class SanctuaryBridge {
  getReadableRoot() {
    return document.querySelector('article, main, [role="main"], .post-content, .entry-content') || document.body;
  }

  getPageText(limit = 30000) {
    const root = this.getReadableRoot().cloneNode(true);
    root.querySelectorAll('script, style, nav, aside, footer, header, .advertisement, .ad, .comments, .newsletter, #setu-commander, #setu-task-path').forEach((node) => node.remove());
    return root.innerText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, limit);
  }

  sentences(text) {
    return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35);
  }

  summarize(text, maxPoints = 5) {
    const sentences = this.sentences(text);
    const keywords = /important|key|main|because|therefore|result|means|need|must|first|second|benefit|challenge|summary/i;
    return sentences.map((sentence, index) => ({
      sentence,
      score: (keywords.test(sentence) ? 4 : 0) + (index < 2 ? 3 : 0) + (index > sentences.length - 3 ? 1 : 0) + Math.min(sentence.length / 90, 2)
    })).sort((a, b) => b.score - a.score).slice(0, maxPoints).sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence)).map((item) => item.sentence);
  }

  buildSections(root, fallbackText) {
    const headings = Array.from(root.querySelectorAll('h1, h2, h3')).filter((heading) => heading.innerText.trim()).slice(0, 8);
    if (!headings.length) return [{ title: 'Main idea', text: fallbackText.slice(0, 550) }];
    return headings.map((heading) => {
      let text = '';
      let sibling = heading.nextElementSibling;
      while (sibling && !/^H[1-3]$/.test(sibling.tagName) && text.length < 500) {
        text += ` ${sibling.innerText || ''}`;
        sibling = sibling.nextElementSibling;
      }
      return { title: heading.innerText.trim().replace(/\s+/g, ' ').slice(0, 120), text: text.replace(/\s+/g, ' ').trim().slice(0, 520) };
    });
  }

  buildArtifact() {
    const root = this.getReadableRoot();
    const text = this.getPageText();
    const sections = this.buildSections(root, text);
    const points = this.summarize(text);
    const flashcards = sections.slice(0, 7).map((section, index) => ({
      id: `card-${index + 1}`,
      front: section.title,
      back: this.sentences(section.text)[0] || section.text || points[index] || 'Review the source section for the main idea.'
    }));
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `setu-${Date.now()}`,
      title: document.title.replace(/\s+/g, ' ').trim().slice(0, 160) || 'Untitled page',
      sourceUrl: location.href,
      createdAt: new Date().toISOString(),
      text,
      summary: points,
      sections,
      map: {
        title: document.title.replace(/\s+/g, ' ').trim().slice(0, 100) || 'This page',
        children: sections.slice(0, 6).map((section) => ({ title: section.title, detail: this.sentences(section.text)[0] || section.text.slice(0, 150) }))
      },
      flashcards,
      progress: { reviewedCards: [], lastOpenedAt: new Date().toISOString() }
    };
  }

  async save() {
    const documentArtifact = this.buildArtifact();
    const { setuVault = [] } = await chrome.storage.local.get('setuVault');
    const withoutDuplicate = setuVault.filter((item) => item.sourceUrl !== documentArtifact.sourceUrl);
    await chrome.storage.local.set({ setuVault: [documentArtifact, ...withoutDuplicate].slice(0, 30), setuLastOpened: documentArtifact.id });
    return documentArtifact;
  }
}

window.SanctuaryBridge = SanctuaryBridge;
