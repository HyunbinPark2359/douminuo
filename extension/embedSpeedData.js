/* `regulationMaSpeedTable.json` 편집 후: node extension/embedSpeedData.js */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const raw = fs.readFileSync(path.join(dir, 'regulationMaSpeedTable.json'), 'utf8');
const j = JSON.stringify(JSON.parse(raw));
const out =
  "(function(){'use strict';globalThis.NUO_REGULATION_MA_SPEED=" + j + ';})();\n';
fs.writeFileSync(path.join(dir, 'regulationMaSpeedData.js'), out, 'utf8');
