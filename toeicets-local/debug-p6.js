const fs = require('fs');
const path = 'd:/en/toeicets-local/public/data/2025/test1/test1-part6.csv';
function detectDelim(line) { return line.includes(';') && (!line.includes(',') || line.indexOf(';') < line.indexOf(',')) ? ';' : ','; }
function parseLine(line, delim) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') { inQ = false; } else { cur += ch; } }
    else { if (ch === '"') { inQ = true; } else if (ch === delim) { out.push(cur); cur = ''; } else { cur += ch; } }
  }
  out.push(cur); return out;
}
function parse(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') { inQ = !inQ; cur += ch; } else if (ch === '\n' && !inQ) { rows.push(cur); cur = ''; } else { cur += ch; } }
  if (cur) rows.push(cur);
  const delim = detectDelim(rows[0]);
  const header = parseLine(rows[0], delim).map(h => h.trim().replace(/^"|"$/g, ''));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    const parts = parseLine(rows[i], delim);
    const obj = {}; for (let k = 0; k < header.length; k++) obj[header[k]] = (parts[k]||'').replace(/\\n/g,'\n');
    out.push(obj);
  }
  return out;
}
const rows = parse(fs.readFileSync(path,'utf8'));
console.log('Part 6 Question Number & Text length:');
rows.forEach(r => console.log((r['Question Number']||'').padEnd(5), '|', (r.Text||'').length.toString().padStart(5), '|', (r.Text||'').slice(0,40).replace(/\s+/g,' ')));
