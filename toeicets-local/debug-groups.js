const fs = require('fs');

function buildGroups(questions, partNum) {
  if (partNum === 1 || partNum === 2 || partNum === 5) {
    return questions.map(q => [q]);
  }
  const groups = [];
  let cur = []; let curKey = null;
  for (const q of questions) {
    const k = partNum <= 4 ? (q.Audio || '') : (q.Text || '');
    if (partNum >= 6 && !k && cur.length) {
      cur.push(q);
      continue;
    }
    if (k !== curKey || !cur.length) {
      if (cur.length) groups.push(cur);
      cur = [q]; curKey = k;
    } else {
      cur.push(q);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

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

for (const partNum of [6, 7]) {
  const rows = parse(fs.readFileSync(`d:/en/toeicets-local/public/data/2025/test1/test1-part${partNum}.csv`,'utf8'));
  const groups = buildGroups(rows, partNum);
  console.log(`\n=== Part ${partNum}: ${groups.length} groups from ${rows.length} questions ===`);
  groups.forEach((g,i) => {
    const nums = g.map(q=>q['Question Number']).join(', ');
    const txt = (g[0].Text||'').slice(0,40).replace(/\s+/g,' ');
    console.log(`  Group ${i+1} (${g.length}Q): [${nums}] | ${txt}`);
  });
}
