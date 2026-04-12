const fs = require('fs');
const s = fs.readFileSync(__dirname + '/_sn-c.js', 'utf8');
const needle = 'weather="비바라기"';
let i = s.indexOf(needle);
console.log('idx', i);
if (i >= 0) console.log(s.slice(i - 250, i + 350));
