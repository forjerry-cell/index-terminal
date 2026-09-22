const fs = require('fs');
const path = require('path');
const ROOT = 'D:\\Downloads\\Antigravity\\IndexWebsite\\IndexWebsite';

function walker() {
  const lines = [];
  function walk(dir, depth = 0) {
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { lines.push('  '.repeat(depth) + '<err>' + e.message + '>'); return; }
    items.sort((a, b) => (a.isDirectory() === b.isDirectory() ? (a.name < b.name ? -1 : 1) : a.isDirectory() ? -1 : 1));
    for (const it of items) {
      if (it.name === 'node_modules' || it.name === '.next') continue;
      const full = path.join(dir, it.name);
      lines.push('  '.repeat(depth) + (it.isDirectory() ? '[D] ' : '    ') + it.name);
      if (it.isDirectory()) walk(full, depth + 1);
    }
  }
  walk(ROOT);
  return lines;
}

const dest = 'D:\\Downloads\\Antigravity\\IndexWebsite\\scratch\\_walk3.txt';
fs.writeFileSync(dest, walker().join('\n'), 'utf8');
const marker = 'scratch_node_wrote_v3 ' + process.pid;
fs.writeFileSync('D:\\Downloads\\Antigravity\\IndexWebsite\\scratch\\_walk3_ok.txt', marker, 'utf8');
console.log(marker);
