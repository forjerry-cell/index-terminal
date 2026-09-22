'use strict';
const fs = require('fs');
const path = require('path');

// 1) candidate roots
const CANDIDATES = [
  'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite',
  'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite\\IndexWebsite',
  'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite\\IndexWebsite\\IndexWebsite',
  'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite\\IndexWebsite\\IndexWebsite\\IndexWebsite',
];
const lines = [];
let root = null;
for (const c of CANDIDATES) {
  try {
    const st = fs.statSync(path.join(c, 'package.json'));
    if (st.isFile()) { root = c; break; }
  } catch (e) {}
}
lines.push('CHOSEN_ROOT=' + root);
const scratchDev = path.join(__dirname, 'dev');
fs.mkdirSync(scratchDev, { recursive: true });

function walkTree(dir) {
  const base = Math.max(dir.lastIndexOf('\\'), dir.lastIndexOf('/'));
  const name = base >= 0 ? dir.slice(base + 1) : dir;
  lines.push('  '.repeat(0) + '[' + name + '] ' + dir);
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { lines.push('     <err ' + e.message + '>'); return; }
  items.sort((a, b) => (a.isDirectory() === b.isDirectory() ? (a.name < b.name ? -1 : 1) : a.isDirectory() ? -1 : 1));
  for (const it of items) {
    if (it.isDirectory()) walkTree(path.join(dir, it.name));
    else lines.push('     file ' + it.name);
  }
}
if (!root) {
  lines.push('NO package.json under candidate roots; dumping drive levels instead');
}

// 2) scratch tree for the real (website offline) project if it has its own package
function tryScratch(p) {
  const pkg = path.join(p, 'package.json');
  try {
    const st = fs.statSync(pkg);
    if (!st.isFile()) return;
    const txt = fs.readFileSync(pkg, 'utf8');
    lines.push('===PACKAGE===' + p + '===');
    lines.push(txt.replace(/\r?\n/g, '\n'));
  } catch (e) { lines.push(' (scratch candidate no pkg: ' + p + ')'); }
}
const websiteRoot = root;
walkScratch = websiteRoot;
for (const p of [websiteRoot]) {
  lines.push('\n\n===== WALK scratch website root ===== ' + p);
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries.filter(x => !['node_modules','.next','scratch'].includes(x.name))) {
      if (e.isDirectory()) walkTree(path.join(p, e.name));
      else lines.push('file ' + e.name);
    }
  } catch (e) { lines.push('ERR ' + e.message); }
}
walkTree = null;
// also dump scratch just in case the dump used it
const reportPath = path.join(scratchDev, '_walk_report.txt');
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(scratchDev, '_report_written.txt'), 'ok', 'utf8');
console.log('WROTE ' + reportPath);
