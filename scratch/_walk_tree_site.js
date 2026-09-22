'use strict';
const fs = require('fs');
const path = require('path');
const lines = [];
const HERE = __dirname;
lines.push('HERE=' + HERE);
lines.push('scratch = ' + path.basename(HERE));

// parent = the scaffold dir that contains this scratch dir
const parent = path.dirname(HERE);
lines.push('PARENT=' + parent);
function list(dir) {
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return ' <err>' + e.message + '>'; }
  const ls = [];
  for (const it of items) ls.push((it.isDirectory() ? '[D] ' : '    ') + it.name);
  return ls;
}
lines.push('--- items in HERE (' + HERE + ') ---');
lines.push(list(HERE).join('\n'));
lines.push('--- items in PARENT (' + parent + ') ---');
lines.push(list(parent).join('\n'));
// grandparent
const gp = path.dirname(parent);
lines.push('--- items in GRANDPARENT (' + gp + ') ---');
lines.push(list(gp).join('\n'));
lines.push('--- items in CWD ' + process.cwd() + ' ---');
try { lines.push(list(process.cwd()).join('\n')); } catch (e) { lines.push(' <err>' + e.message + '>'); }

const out = lines.join('\n');
const dest = path.join(HERE, '_probe2_out.txt');
fs.writeFileSync(dest, out, 'utf8');
console.log('WROTE ' + dest);
