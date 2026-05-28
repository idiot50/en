// Minimal CSV parser with quote/escape support. Handles ; and , delimiters.
// Returns array of objects keyed by header row.
const CSV = (() => {

  function detectDelim(line) {
    return line.includes(';') && (!line.includes(',') || line.indexOf(';') < line.indexOf(',')) ? ';' : ',';
  }

  function parseLine(line, delim) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQ = true; }
        else if (ch === delim) { out.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    out.push(cur);
    return out;
  }

  function parse(text) {
    // Normalize line endings, but be careful about \n inside quoted fields.
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') { inQ = !inQ; cur += ch; }
      else if (ch === '\n' && !inQ) { rows.push(cur); cur = ''; }
      else { cur += ch; }
    }
    if (cur) rows.push(cur);

    if (rows.length === 0) return [];
    const delim = detectDelim(rows[0]);
    const header = parseLine(rows[0], delim).map(h => h.trim().replace(/^"|"$/g, ''));
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      const parts = parseLine(rows[i], delim);
      const obj = {};
      for (let k = 0; k < header.length; k++) {
        // Unescape \n literal in source to real newline for display
        const val = (parts[k] || '').replace(/\\n/g, '\n');
        obj[header[k]] = val;
      }
      out.push(obj);
    }
    return out;
  }

  async function load(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('CSV fetch failed: ' + url);
    return parse(await r.text());
  }

  return { parse, load };
})();
