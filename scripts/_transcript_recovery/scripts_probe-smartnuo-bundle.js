const fs = require('fs');
const path = require('path');
const p = path.join(process.env.TEMP || '/tmp', 'sn-app.js');
if (!fs.existsSync(p)) {
  console.error('missing', p, 'run curl first');
  process.exit(1);
}
const s = fs.readFileSync(p, 'utf8');
const re = /["']\/api\/[^"']+["']/g;
const set = new Set();
let m;
while ((m = re.exec(s))) set.add(m[0].slice(1, -1));
console.log([...set].sort().join('\n'));
