const fs = require('fs');
const path = require('path');

// Inline the CSV parser from js/csv.js
function detectDelim(line) {
  return line.includes(';') && (!line.includes(',') || line.indexOf(';') < line.indexOf(',')) ? ';' : ',';
}
function parseLine(line, delim) {
  const out = []; let cur = ''; let inQ = false;
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
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = []; let cur = ''; let inQ = false;
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
      const val = (parts[k] || '').replace(/\\n/g, '\n');
      obj[header[k]] = val;
    }
    out.push(obj);
  }
  return { header, rows: out };
}

function testFile(name, p) {
  const text = fs.readFileSync(p, 'utf8');
  const r = parse(text);
  console.log(`\n=== ${name} ===`);
  console.log('Header:', JSON.stringify(r.header));
  console.log('First row keys:', Object.keys(r.rows[0]));
  console.log('Question Number:', JSON.stringify(r.rows[0]['Question Number']));
  console.log('Question:', JSON.stringify(r.rows[0]['Question']));
  console.log('A:', JSON.stringify(r.rows[0]['A']));
  console.log('B:', JSON.stringify(r.rows[0]['B']));
  console.log('Answer:', JSON.stringify(r.rows[0]['Answer']));
}

testFile('2026 Part 1', 'd:/en/toeicets-local/public/data/2026/test1/test1-part1.csv');
testFile('2026 Part 2', 'd:/en/toeicets-local/public/data/2026/test1/test1-part2.csv');
testFile('2025 Part 1', 'd:/en/toeicets-local/public/data/2025/test1/test1-part1.csv');
testFile('2025 Part 5', 'd:/en/toeicets-local/public/data/2025/test1/test1-part5.csv');
