const fs = require('fs');
const path = require('path');

const ROOT = 'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite';
const out = [];
function walk(dir, depth = 0) {
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { out.push('ERROR ' + dir + ' :: ' + e.message); return; }
  items.sort((a, b) => (a.isDirectory() === b.isDirectory() ? (a.name < b.name ? -1 : 1) : a.isDirectory() ? -1 : 1));
  for (const it of items) {
    if (it.name === 'node_modules' || it.name === '.next' || it.name === 'scratch') continue;
    const full = path.join(dir, it.name);
    out.push('  '.repeat(depth) + (it.isDirectory() ? '[D] ' : '    ') + it.name);
    if (it.isDirectory()) walk(full, depth + 1);
  }
}
walk(ROOT);
const lines = ['ROOT=' + ROOT, '====== tree ======'].concat(out);
lines.push('');
lines.push('====== files under lib (want path) ======');
for (const l of out) if (/strategy|crawler|strategy-products|products/.test(l)) lines.push('* ' + l.trim());
const dest = path.join(ROOT, 'scratch', '_tree.txt');
fs.writeFileSync(dest, lines.join('\n'), 'utf8');
fs.writeFileSync('D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite\\scratch\\_tree_written_ok.txt', 'ok', 'utf8');
console.log('WROTE ' + dest + ' lines=' + lines.length);
