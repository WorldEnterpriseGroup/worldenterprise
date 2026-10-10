/**
 * A small Markdown to HTML renderer for the gated briefs. Plain JavaScript with no dependencies so the render job runs in the
 * Playwright image without an install. It covers what a brief uses: headings, paragraphs, lists, quotes, tables, code, rules,
 * and bold, italic, code and link spans. Raw HTML is never passed through: every `<`, `>` and `&` in the source is escaped,
 * and a link whose scheme is not http, https or mailto is rendered as plain text.
 */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function safeHref(href) {
  const value = href.trim();
  if (/^(https?:\/\/|mailto:|#)/i.test(value)) return value;
  return null;
}

/** Inline spans. The text is escaped first, so markers only ever act on escaped text. */
export function renderInline(source) {
  const codes = [];
  let text = escapeHtml(source).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = text.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (whole, label, href) => {
    const target = safeHref(href.replaceAll('&amp;', '&'));
    return target === null ? label : `<a href="${escapeHtml(target)}">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?![\w*])/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^\w])_([^_\s][^_]*)_(?![\w])/g, '$1<em>$2</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function indentOf(line) {
  return /^\s*/.exec(line)[0].length;
}

/** Renders a run of list lines at one indent, recursing into deeper indents. Returns the HTML and the next line index. */
function renderList(lines, start, ids) {
  const first = BULLET.exec(lines[start]) ?? ORDERED.exec(lines[start]);
  const ordered = ORDERED.test(lines[start]) && !BULLET.test(lines[start]);
  const base = first[1].length;
  const items = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    const match = ordered ? ORDERED.exec(line) : BULLET.exec(line);
    if (match !== null && match[1].length === base) {
      items.push({ text: match[3], children: '' });
      index += 1;
    } else if (items.length > 0 && line.trim() !== '' && indentOf(line) > base) {
      if (BULLET.test(line) || ORDERED.test(line)) {
        const nested = renderList(lines, index, ids);
        items[items.length - 1].children += nested.html;
        index = nested.next;
      } else {
        items[items.length - 1].text += ` ${line.trim()}`;
        index += 1;
      }
    } else {
      break;
    }
  }
  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.map((item) => `<li>${renderInline(item.text)}${item.children}</li>`).join('')}</${tag}>`, next: index };
}

/** Renders block Markdown to HTML. `headings` collects the h2 entries so a caller can build a contents list. */
export function renderMarkdown(source, { headings = [] } = {}) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const used = new Set();
  const out = [];
  let index = 0;

  const uniqueId = (text) => {
    const base = slugify(text) || 'section';
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = /^\s*```(.*)$/.exec(line);
    if (fence !== null) {
      const body = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading !== null) {
      // The brief title is the page's one h1, so a body heading never renders above h2.
      const level = Math.max(2, heading[1].length);
      const id = uniqueId(heading[2]);
      if (level === 2) headings.push({ id, text: heading[2] });
      out.push(`<h${level} id="${id}">${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const list = renderList(lines, index, used);
      out.push(list.html);
      index = list.next;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1]) && lines[index + 1].includes('-')) {
      const head = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() !== '' && lines[index].includes('|')) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      const cells = (row, tag) => row.map((cell) => `<${tag}>${renderInline(cell)}</${tag}>`).join('');
      out.push(`<div class="table-wrap"><table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((row) => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() !== '' && !/^\s*(```|#{1,6}\s|>|([-*_])(\s*\2){2,}\s*$)/.test(lines[index]) && !((BULLET.test(lines[index]) || ORDERED.test(lines[index])) && paragraph.length > 0)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length === 0) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}
