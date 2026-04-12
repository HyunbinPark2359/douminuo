'use strict';

/**
 * 호환용: 예전에 이 경로로 실행하던 분을 위해
 * sync-ability-names-ko.js 를 그대로 돌립니다.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const r = spawnSync(process.execPath, [path.join(__dirname, 'sync-ability-names-ko.js')], {
  stdio: 'inherit',
});
process.exit(r.status === 0 ? 0 : r.status || 1);
