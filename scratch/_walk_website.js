const fs = require('fs');
const path = require('path');
const ROOT = 'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite';
const out = [];
function walk(dir, depth = 0) {
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { out.push('  '.repeat(depth) + '<err ' + e.message + '>'); return; }
  items.sort((a, b) => (a.isDirectory() === b.isDirectory() ? (a.name < b.name ? -1 : 1) : a.isDirectory() ? -1 : 1));
  for (const it of items) {
    if (it.name === 'node_modules' || it.name === '.next') continue;
    const full = path.join(dir, it.name);
    out.push('  '.repeat(depth) + (it.isDirectory() ? '[D] ' : '    ') + it.name);
    if (it.isDirectory()) walk(full, depth + 1);
  }
}
walk(ROOT);
const dest = 'D:\\Downloads\\Antigravity\\IndexWebsite\\scratch\\_walk_website.txt';
fs.writeFileSync(dest, out.join('\n'), 'utf8');
fs.writeFileSync('D:\\Downloads\\Antigravity\\IndexWebsite\\scratch\\_walk_website_ok.txt', 'ok', 'utf8');
console.log('WROTE ' + dest);
