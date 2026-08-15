/**
 * Mind Map Visual Export Utilities
 * Provides PDF, PNG, SVG, Markdown, and JSON visual exports for presentations and notes.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PLATE_COLORS } from './layout';

/**
 * Format clean filename from title
 */
function sanitizeFilename(title, ext) {
  const base = (title || 'setu-mindmap')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base || 'mindmap'}.${ext}`;
}

/**
 * Export Mind Map as a Broadsheet-Style Visual PDF Document
 */
export async function exportMindMapToPDF(map) {
  if (!map) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Bar / Kicker
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(140, 60, 20); // Accent brand tint
  doc.text('SETU SANCTUARY — COGNITIVE RESEARCH & VISUAL MAP', margin, y);
  y += 18;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(32, 30, 29); // Ink
  const titleLines = doc.splitTextToSize(map.title || 'Untitled Mind Map', contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 24 + 6;

  // Horizontal divider
  doc.setDrawColor(220, 215, 205);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // Summary box
  if (map.summary) {
    doc.setFillColor(247, 244, 238); // Warm paper surface
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(margin, y, contentWidth, 54, 4, 4, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(60, 58, 55);
    const summaryLines = doc.splitTextToSize(map.summary, contentWidth - 24);
    doc.text(summaryLines, margin + 12, y + 20);
    y += 66;
  }

  // Key facts section
  if (map.keyFacts && map.keyFacts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(32, 30, 29);
    doc.text('Key Takeaways', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 48, 45);

    for (const fact of map.keyFacts) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }
      doc.setFillColor(180, 80, 20);
      doc.circle(margin + 5, y - 3, 2.5, 'F');
      const factLines = doc.splitTextToSize(fact, contentWidth - 18);
      doc.text(factLines, margin + 16, y);
      y += factLines.length * 14 + 4;
    }
    y += 10;
  }

  // Mind Map Hierarchical Tree Structure
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(32, 30, 29);
  doc.text('Mind Map Hierarchy', margin, y);
  y += 18;

  const walkTree = (node, depth = 1, branchColorIndex = 0) => {
    if (!node) return;

    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    const indent = margin + (depth - 1) * 18;
    const labelWidth = contentWidth - (depth - 1) * 18;

    // Draw branch badge
    if (depth === 1) {
      doc.setDrawColor(200, 195, 185);
      doc.setFillColor(252, 250, 246);
      doc.roundedRect(indent, y - 10, labelWidth, 22, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 28, 26);
      doc.text(`• ${node.label}`, indent + 8, y + 4);
      y += 18;

      if (node.detail) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(90, 85, 80);
        const detailLines = doc.splitTextToSize(node.detail, labelWidth - 16);
        doc.text(detailLines, indent + 16, y);
        y += detailLines.length * 12 + 6;
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(50, 48, 45);
      doc.text(`— ${node.label}`, indent, y);
      y += 13;

      if (node.detail) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 95, 90);
        const detailLines = doc.splitTextToSize(node.detail, labelWidth - 14);
        doc.text(detailLines, indent + 14, y);
        y += detailLines.length * 11 + 4;
      }
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child, idx) => walkTree(child, depth + 1, idx % PLATE_COLORS.length));
    }
  };

  if (map.root?.children) {
    map.root.children.forEach((branch, idx) => walkTree(branch, 1, idx % PLATE_COLORS.length));
  }

  // Sources section
  if (map.sources && map.sources.length > 0) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(32, 30, 29);
    doc.text('Sources & Citations', margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 100, 160);

    for (const s of map.sources) {
      const line = `${s.title} (${s.url})`;
      const sourceLines = doc.splitTextToSize(line, contentWidth);
      doc.text(sourceLines, margin, y);
      y += sourceLines.length * 11 + 2;
    }
  }

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 145, 140);
    doc.text(
      `Generated by SETU Sanctuary · Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 20
    );
  }

  doc.save(sanitizeFilename(map.title, 'pdf'));
}

/**
 * Export Mind Map Canvas as High-Resolution PNG image
 */
export async function exportMindMapToPNG(element, title = 'mindmap') {
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5, // 2.5x retina rendering
      backgroundColor: '#f7f4ee', // Broadsheet surface
      useCORS: true,
      logging: false
    });

    const link = document.createElement('a');
    link.download = sanitizeFilename(title, 'png');
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('PNG export failed:', err);
  }
}

/**
 * Export Mind Map SVG element directly as crisp standalone vector SVG file
 */
export function exportMindMapToSVG(svgElement, title = 'mindmap') {
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(title, 'svg');
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export Markdown outline
 */
export function exportMindMapToMarkdown(map) {
  if (!map) return;

  const lines = [`# ${map.title}`, '', map.summary || '', ''];

  if (map.keyFacts?.length) {
    lines.push('## Key facts', ...map.keyFacts.map((fact) => `- ${fact}`), '');
  }

  const walk = (node, depth) => {
    lines.push(`${'  '.repeat(Math.max(0, depth - 1))}- **${node.label}** — ${node.detail || ''}`);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  };
  lines.push('## Mind Map Outline');
  (map.root?.children || []).forEach((branch) => walk(branch, 1));

  if (map.sources?.length) {
    lines.push(
      '',
      '## Sources',
      ...map.sources.map((source) => `- [${source.title}](${source.url})`)
    );
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = sanitizeFilename(map.title, 'md');
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Export JSON schema
 */
export function exportMindMapToJSON(map) {
  if (!map) return;
  const jsonStr = JSON.stringify(map, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = sanitizeFilename(map.title, 'json');
  link.click();
  URL.revokeObjectURL(link.href);
}
