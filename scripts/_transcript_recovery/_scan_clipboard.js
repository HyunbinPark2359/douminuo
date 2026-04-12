const fs = require('fs');
const s = fs.readFileSync(__dirname + '/_smartnuo_common.js', 'utf8');
let p = 0;
while (true) {
  const a = s.indexOf('clipboard.writeText', p);
  if (a === -1) break;
  console.log(s.slice(Math.max(0, a - 350), a + 100));
  console.log('\n---\n');
  p = a + 20;
}
