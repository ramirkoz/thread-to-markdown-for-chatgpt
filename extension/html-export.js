'use strict';

const baseReadThread = self.readThread;

if (typeof baseReadThread !== 'function') {
  throw new Error('Thread reader cleanup layer was not initialized.');
}

self.normalizeFormat = function normalizeFormatWithHtml(value) {
  return ['markdown', 'text', 'json', 'html'].includes(value) ? value : 'markdown';
};

self.readThread = async function readThreadWithHtml(tabId, options = {}) {
  if (options.format !== 'html') {
    return baseReadThread(tabId, options);
  }

  const result = await baseReadThread(tabId, { ...options, format: 'json' });
  return buildHtmlExport(result);
};

function buildHtmlExport(result) {
  if (!result?.ok || typeof result.content !== 'string') return result;

  try {
    const payload = JSON.parse(result.content);
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const title = String(payload.title || 'ChatGPT conversation');
    const exportedAt = String(payload.exportedAt || new Date().toISOString());
    const source = String(payload.source || '');
    const selectedCount = Number(payload.selectedCount || messages.length);
    const messageCount = Number(payload.messageCount || selectedCount);

    const sections = messages.map((message) => {
      const role = roleLabel(message.role);
      const markdown = stripServiceArtifacts(message.markdown || message.text || '');
      return [
        '<section class="message">',
        `<h2>${escapeHtml(role)}</h2>`,
        `<div class="message-body">${markdownToHtml(markdown)}</div>`,
        '</section>'
      ].join('\n');
    }).join('\n');

    const content = [
      '<!doctype html>',
      '<html lang="und">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${escapeHtml(title)}</title>`,
      '<style>',
      ':root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:#f5f5f5;color:#18181b;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:900px;margin:0 auto;padding:40px 24px 72px}.meta,.message{background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:22px 24px;margin:0 0 18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}h1{font-size:2rem;line-height:1.2;margin:0 0 18px}h2{font-size:1rem;text-transform:uppercase;letter-spacing:.06em;color:#52525b;margin:0 0 16px}.message-body h1,.message-body h2,.message-body h3,.message-body h4,.message-body h5,.message-body h6{text-transform:none;letter-spacing:normal;color:inherit;margin:1.4em 0 .55em}.message-body h1{font-size:1.65rem}.message-body h2{font-size:1.4rem}.message-body h3{font-size:1.2rem}p{margin:.75em 0}a{color:#155eef;overflow-wrap:anywhere}pre{overflow:auto;background:#18181b;color:#f4f4f5;border-radius:10px;padding:16px;white-space:pre-wrap}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#f4f4f5;border-radius:5px;padding:.1em .35em}pre code{background:transparent;padding:0}blockquote{margin:1em 0;padding:.1em 1em;border-left:4px solid #a1a1aa;color:#52525b}table{width:100%;border-collapse:collapse;margin:1em 0;display:block;overflow:auto}th,td{border:1px solid #d4d4d8;padding:8px 10px;text-align:left;vertical-align:top}ul,ol{padding-left:1.5rem}hr{border:0;border-top:1px solid #d4d4d8;margin:1.5em 0}.meta dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:0}.meta dt{font-weight:700}.meta dd{margin:0;overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#09090b;color:#f4f4f5}.meta,.message{background:#18181b;border-color:#3f3f46}h2{color:#a1a1aa}code{background:#27272a}blockquote{color:#d4d4d8}th,td{border-color:#52525b}a{color:#8ab4ff}}@media print{body{background:#fff;color:#000}.meta,.message{box-shadow:none;break-inside:avoid;border-color:#bbb}main{max-width:none;padding:0}a{color:#000;text-decoration:underline}}',
      '</style>',
      '</head>',
      '<body>',
      '<main>',
      `<h1>${escapeHtml(title)}</h1>`,
      '<section class="meta">',
      '<dl>',
      `<dt>Exported</dt><dd>${escapeHtml(exportedAt)}</dd>`,
      `<dt>Source</dt><dd>${source ? `<a href="${escapeAttribute(source)}">${escapeHtml(source)}</a>` : ''}</dd>`,
      `<dt>Messages</dt><dd>${selectedCount} of ${messageCount}</dd>`,
      '</dl>',
      '</section>',
      sections,
      '</main>',
      '</body>',
      '</html>'
    ].join('\n');

    return {
      ...result,
      format: 'html',
      filename: String(result.filename || 'chatgpt-thread.json').replace(/\.json$/i, '.html'),
      mimeType: 'text/html',
      content
    };
  } catch (error) {
    return { ok: false, error: `HTML export failed: ${String(error?.message || error)}` };
  }
}

function markdownToHtml(value) {
  const codeBlocks = [];
  let markdown = String(value || '').replace(/\r\n?/g, '\n');

  markdown = markdown.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, language, code) => {
    const index = codeBlocks.length;
    const languageClass = String(language || '').trim().replace(/[^a-z0-9_+.-]/gi, '');
    codeBlocks.push(
      `<pre><code${languageClass ? ` class="language-${escapeAttribute(languageClass)}"` : ''}>${escapeHtml(code.replace(/\n+$/g, ''))}</code></pre>`
    );
    return `\n@@CODEBLOCK_${index}@@\n`;
  });

  const lines = markdown.split('\n');
  const output = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${paragraph.map((line) => inlineMarkdown(line.trim())).join('<br>')}</p>`);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const codeMatch = line.match(/^@@CODEBLOCK_(\d+)@@$/);
    if (codeMatch) {
      flushParagraph();
      output.push(codeBlocks[Number(codeMatch[1])] || '');
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      output.push('<hr>');
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      flushParagraph();
      const tableLines = [line];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      output.push(renderTable(tableLines));
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      const quoteLines = [];
      let cursor = index;
      while (cursor < lines.length && /^>\s?/.test(lines[cursor].trim())) {
        quoteLines.push(lines[cursor].trim().replace(/^>\s?/, ''));
        cursor += 1;
      }
      output.push(`<blockquote>${quoteLines.map(inlineMarkdown).join('<br>')}</blockquote>`);
      index = cursor - 1;
      continue;
    }

    const listMatch = rawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const listLines = [];
      let cursor = index;
      while (cursor < lines.length) {
        const match = lines[cursor].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (!match) break;
        listLines.push(match);
        cursor += 1;
      }
      output.push(renderList(listLines));
      index = cursor - 1;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return output.join('\n');
}

function renderTable(lines) {
  const rows = lines.map(splitTableRow);
  if (!rows.length) return '';
  const header = rows[0];
  const body = rows.slice(1);
  return [
    '<table>',
    `<thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead>`,
    body.length
      ? `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
      : '',
    '</table>'
  ].join('');
}

function splitTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderList(matches) {
  const ordered = /^\d+\.$/.test(matches[0][2]);
  const tag = ordered ? 'ol' : 'ul';
  const items = matches.map((match) => {
    const depth = Math.floor(match[1].replace(/\t/g, '  ').length / 2);
    return `<li${depth ? ` style="margin-left:${depth * 1.25}rem"` : ''}>${inlineMarkdown(match[3])}</li>`;
  }).join('');
  return `<${tag}>${items}</${tag}>`;
}

function inlineMarkdown(value) {
  const inlineCodes = [];
  let text = String(value || '').replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `@@INLINECODE_${index}@@`;
  });

  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
    const safe = safeUrl(url);
    return safe ? `<img src="${escapeAttribute(safe)}" alt="${escapeAttribute(alt)}">` : escapeHtml(alt);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    return safe ? `<a href="${escapeAttribute(safe)}">${label}</a>` : label;
  });
  text = text
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\\([\\`*_\[\]{}()#+\-.!>])/g, '$1')
    .replace(/@@INLINECODE_(\d+)@@/g, (_, index) => inlineCodes[Number(index)] || '');

  return text;
}

function safeUrl(value) {
  const url = String(value || '').replace(/&amp;/g, '&').trim();
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function roleLabel(role) {
  const labels = {
    user: 'User',
    assistant: 'ChatGPT',
    system: 'System',
    tool: 'Tool',
    conversation: 'Conversation',
    unknown: 'Message'
  };
  return labels[role] || labels.unknown;
}

function stripServiceArtifacts(value) {
  const standaloneLabel = /^(?:цитата(?:\s+кодування)?|кодування|копіювати код|скопійовано|quote(?:\s+coding)?|citation|citations|coding|copy code|copied)$/iu;
  const trailingLabel = /[ \t]+(?:цитата\s+кодування|копіювати код|скопійовано|quote\s+coding|copy code|copied)(?=\s*(?:\n+---\s*)?(?:\n|$))/giu;

  const lines = String(value || '')
    .split('\n')
    .filter((line) => !standaloneLabel.test(stripMarkdownDecoration(line)));

  return lines
    .join('\n')
    .replace(trailingLabel, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownDecoration(value) {
  return String(value || '')
    .trim()
    .replace(/^[-*+]\s+/, '')
    .replace(/^#+\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/[*_`~]/g, '')
    .trim();
}
