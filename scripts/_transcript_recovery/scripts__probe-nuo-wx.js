const fs = require('fs');
const s = fs.readFileSync(__dirname + '/_sn-c.js', 'utf8');
const needles = [
  'weather_list',
  'field_list',
  'terrain_list',
  'attacker.weather',
  'attacker.field',
  'attacker.terrain',
  'model:{value:t.attacker.weather',
  'model:{value:t.weather',
  '날씨',
  '필드',
];
needles.forEach(function (n) {
  const i = s.indexOf(n);
  console.log(n, i);
  if (i >= 0) console.log(s.slice(i, i + 280).replace(/\n/g, ' '));
  console.log('---');
});
