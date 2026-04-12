const fs = require('fs');
const s = fs.readFileSync(__dirname + '/_sn-common-temp.js', 'utf8');
let i = s.indexOf('damage_class:"');
let c = 0;
while (i !== -1 && c++ < 20) {
  console.log(c, i, s.slice(i, i + 80));
  i = s.indexOf('damage_class:"', i + 1);
}
