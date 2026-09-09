/**
 * 포케챔스(pokemon.yodams.com) champions_pokemon.json 기준으로
 * extension/regulationSpeedTable.json 을 재생성.
 *
 * 소스: https://pokemon.yodams.com/assets/assets/data/champions_pokemon.json
 *   (서드파티 정적 자산 — 로그인 불필요, `allowedInChampions` 로 이미 필터링되어 배포됨.
 *    런타임에 확장이 이 URL을 fetch하지 않음 — 빌드 타임 1회성 스크립트 실행 전용.)
 *
 *   node scripts/fetch-champions-speed-table.js
 *   node scripts/fetch-champions-speed-table.js --title "레귤레이션 M-D"   (다음 시즌용)
 *
 * 이름 표기 규칙(프로젝트 컨벤션):
 *   - 지역폼 접두사("알로라 X" 등)는 접미사 "X(알로라)" 로 변환.
 *   - 같은 스피드값을 공유하는 코스메틱 폼(로토무 어플라이언스, 냐오닉스 성별,
 *     모르페코 배부름/배고픔, 킬가르도 폼, 캐스퐁 날씨, 돌핀맨 폼, 팔데아 켄타로스
 *     품종, 스트린더 폼, 시비꼬 색)은 하나로 통합. 스피드값이 다른 폼(루가루암,
 *     에써르 성별, 펌킨인 크기 등)은 그대로 분리 유지.
 *   - 새 시즌에 위 그룹에 없는 신규 코스메틱 폼이 추가되면 경고로 표시되니
 *     LUMP_GROUPS 를 확인해서 필요시 추가할 것.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://pokemon.yodams.com/assets/assets/data/champions_pokemon.json';
const OUT = path.join(__dirname, '..', 'extension', 'regulationSpeedTable.json');

const REGIONAL_PREFIX_TO_SUFFIX = {
  '알로라 ': '알로라',
  '가라르 ': '가라르',
  '히스이 ': '히스이',
};

const LUMP_GROUPS = {
  '냐오닉스': ['냐오닉스(수컷)', '냐오닉스(암컷)'],
  '대쓰여너': ['대쓰여너(수컷)', '대쓰여너(암컷)'],
  '모르페코': ['모르페코(배부른 모양)', '모르페코(배고픈 모양)'],
  '킬가르도': ['킬가르도(실드폼)', '킬가르도(블레이드폼)'],
  '로토무(폼체인지)': ['히트로토무', '워시로토무', '프로스트로토무', '스핀로토무', '커트로토무'],
  '캐스퐁': ['캐스퐁', '캐스퐁(태양)', '캐스퐁(빗방울)', '캐스퐁(설운)'],
  '스트린더': ['스트린더(하이한 모습)', '스트린더(로우한 모습)'],
  '돌핀맨': ['돌핀맨(나이브폼)', '돌핀맨(마이티폼)'],
  '켄타로스(팔데아)': ['팔데아 켄타로스(컴뱃종)', '팔데아 켄타로스(블레이즈종)', '팔데아 켄타로스(워터종)'],
  '시비꼬': ['시비꼬(그린 페더)', '시비꼬(블루 페더)', '시비꼬(옐로 페더)', '시비꼬(화이트 페더)'],
};

const RENAME = {
  '루가루암(한낮의 모습)': '루가루암(한낮)',
  '루가루암(한밤중의 모습)': '루가루암(한밤중)',
  '루가루암(황혼의 모습)': '루가루암(황혼)',
  '플라엣테(영원의 꽃)': '플라엣테(영원의꽃)',
};

function toDisplayName(rawName) {
  const prefixes = Object.keys(REGIONAL_PREFIX_TO_SUFFIX);
  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    if (rawName.indexOf(prefix) === 0) {
      const base = rawName.slice(prefix.length);
      return base + '(' + REGIONAL_PREFIX_TO_SUFFIX[prefix] + ')';
    }
  }
  return RENAME[rawName] || rawName;
}

async function main() {
  const titleArgIdx = process.argv.indexOf('--title');
  const regTitle = titleArgIdx >= 0 ? process.argv[titleArgIdx + 1] : '레귤레이션 M-C';

  console.log('fetching', SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const all = await res.json();
  const allowed = all.filter(function (p) { return p.allowedInChampions === true; });
  console.log('allowedInChampions count:', allowed.length, '/', all.length);

  const lumpSourceNames = new Set();
  Object.keys(LUMP_GROUPS).forEach(function (k) {
    LUMP_GROUPS[k].forEach(function (m) { lumpSourceNames.add(m); });
  });

  const bySpeedName = {};
  const warnings = [];

  allowed.forEach(function (p) {
    if (lumpSourceNames.has(p.nameKo)) return;
    const disp = toDisplayName(p.nameKo);
    const spe = p.baseStats.spe;
    if (Object.prototype.hasOwnProperty.call(bySpeedName, disp) && bySpeedName[disp] !== spe) {
      warnings.push('CONFLICT: ' + disp + ' old=' + bySpeedName[disp] + ' new=' + spe + ' (slug=' + p.slug + ')');
    }
    bySpeedName[disp] = spe;
  });

  Object.keys(LUMP_GROUPS).forEach(function (lumpedName) {
    const members = LUMP_GROUPS[lumpedName];
    const speeds = new Set();
    members.forEach(function (m) {
      const found = allowed.find(function (p) { return p.nameKo === m; });
      if (!found) {
        warnings.push('MISSING lump member: ' + m + ' for group ' + lumpedName);
        return;
      }
      speeds.add(found.baseStats.spe);
    });
    if (speeds.size !== 1) {
      warnings.push('LUMP SPEED MISMATCH: ' + lumpedName + ' members have speeds ' + Array.from(speeds).join(','));
      return;
    }
    bySpeedName[lumpedName] = speeds.values().next().value;
  });

  if (warnings.length) {
    console.warn('\n경고 — 소스 데이터 구조가 바뀌었을 수 있습니다. 확인 필요:');
    warnings.forEach(function (w) { console.warn(' -', w); });
  }

  const bySpeed = {};
  Object.keys(bySpeedName).forEach(function (name) {
    const key = String(bySpeedName[name]);
    if (!bySpeed[key]) bySpeed[key] = [];
    bySpeed[key].push(name);
  });
  const sortedKeys = Object.keys(bySpeed).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
  const sortedBySpeed = {};
  sortedKeys.forEach(function (k) { sortedBySpeed[k] = bySpeed[k].sort(); });

  const doc = {
    meta: {
      title: 'Pokémon Champions 「' + regTitle + '」 출전 가능 포켓몬 스피드표',
      note: '본 데이터는 Pokémon Champions 「' + regTitle + '」 규정 하 출전 가능 포켓몬의 종족값 스피드만 정리한 표입니다.',
      verifiedAt: new Date().toISOString().slice(0, 10),
      reference: 'pokechamps(champions_pokemon.json)',
    },
    bySpeed: sortedBySpeed,
  };

  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT, '—', sortedKeys.length, 'tiers,', Object.keys(bySpeedName).length, 'entries');
  console.log('다음: node extension/embedSpeedData.js 로 재임베드 하는 것 잊지 말 것.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
