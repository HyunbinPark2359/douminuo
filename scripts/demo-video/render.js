// 데모 움짤 렌더러: 커서 없이 녹화한 영상 + 설정 파일 → 가짜 커서·클릭 물결·카메라(확대/이동) → 움직이는 webp.
// 사용:
//   node scripts/demo-video/render.js configs/box.js            (설정 경로는 이 폴더 기준)
//   node scripts/demo-video/render.js sheet <영상> [fps] [crop]  (클릭 시점 찾기용 타임스탬프 밀착 인화)
// ffmpeg 경로: 환경변수 FFMPEG, 없으면 PATH 의 ffmpeg. 자세한 흐름은 README.md.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CACHE = path.join(ROOT, 'scripts', '.cache', 'demo-video');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const fwd = p => p.replace(/\\/g, '/');

// ── 커서·물결 스타일 (box 움짤에서 정한 값) ──
const STYLE = {
  cursorH: 28, pressedH: 24,      // 화살표 높이(원본 px). 눌림 = 클릭 순간 살짝 작아짐
  outline: 1 / 20,                // 윤곽 두께 = 높이 × 이 값
  pressSec: 0.15,
  ripple: { r0: 4.5, r1: 25, th0: 3.3, th1: 1.8, alpha: 0.75, frames: 8, color: [228, 0, 127] }, // 사이트 핑크, 0.4초(20fps)
  webpQ: 75
};

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.error) throw new Error('ffmpeg 실행 실패 (FFMPEG 환경변수 확인): ' + r.error.message);
  if (r.status !== 0) throw new Error('ffmpeg 종료 코드 ' + r.status);
}

// ── PNG (커서·물결 생성용) ──
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, px) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = px(x, y), o = y * (w * 4 + 1) + 1 + x * 4; for (let k = 0; k < 4; k++) raw[o + k] = Math.max(0, Math.min(255, Math.round(p[k]))); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const segDist = (px, py, [ax, ay], [bx, by]) => { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - t * vx, py - ay - t * vy); };
const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

const ARROW = [[0, 0], [0, 0.84], [0.215, 0.645], [0.36, 0.98], [0.5, 0.92], [0.355, 0.6], [0.62, 0.6]];
const HOT = 4; // 이미지 안 화살표 끝(핫스팟) 위치
function cursorPng(H, file) {
  const pts = ARROW.map(([x, y]) => [HOT + x * H, HOT + y * H]);
  const W = Math.ceil(HOT * 2 + 0.62 * H + 4), Ht = Math.ceil(HOT * 2 + H + 4), LW = H * STYLE.outline, SS = 4;
  fs.writeFileSync(file, png(W, Ht, (x, y) => {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS, inside = inPoly(pts, px, py);
      let d = Infinity; for (let i = 0; i < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i], pts[(i + 1) % pts.length]));
      const c = d <= LW / 2 ? [20, 24, 28, 255] : inside ? [255, 255, 255, 255] : inPoly(pts, px - 1.2, py - 2) ? [0, 0, 0, 70] : null; // 윤곽 / 몸통 / 그림자
      if (c) { r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]; }
    }
    return a ? [r / a, g / a, b / a, a / (SS * SS)] : [0, 0, 0, 0];
  }));
}
const RIP = 40; // 물결 이미지 반폭
function ripplePngs(dir) {
  const s = STYLE.ripple;
  for (let i = 0; i < s.frames; i++) {
    const p = i / (s.frames - 1), e = 1 - Math.pow(1 - p, 3), rad = s.r0 + (s.r1 - s.r0) * e, al = s.alpha * (1 - p), th = s.th0 + (s.th1 - s.th0) * p;
    fs.writeFileSync(path.join(dir, `ripple_${String(i).padStart(2, '0')}.png`), png(RIP * 2, RIP * 2, (x, y) => {
      let cov = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) if (Math.abs(Math.hypot(x + (sx + 0.5) / 3 - RIP, y + (sy + 0.5) / 3 - RIP) - rad) <= th / 2) cov++;
      return [...s.color, 255 * al * cov / 9];
    }));
  }
}

// ── 보간식 ──
const ease = p => `if(lt(${p},0.5),4*pow(${p},3),1-pow(-2*${p}+2,3)/2)`;
// moves: [[t0, t1, from, to]] → 시간변수 v 에 대한 ffmpeg 식 (구간 밖은 직전 값 유지)
function track(v, moves, init) {
  let expr = String(moves.length ? moves[moves.length - 1][3] : init);
  for (let i = moves.length - 1; i >= 0; i--) {
    const [t0, t1, a, b] = moves[i], p = `((${v}-${t0})/${t1 - t0})`;
    expr = `if(lt(${v},${t0}),${a},if(lt(${v},${t1}),${a}+(${b - a})*${ease(p)},${expr}))`;
  }
  return expr;
}
// keys: [[t0, t1, 값이름]] (첫 항목 = 시작값), get(이름) → 숫자
function keyTrack(v, keys, get) {
  const moves = [];
  for (let i = 1; i < keys.length; i++) moves.push([keys[i][0], keys[i][1], get(keys[i - 1][2]), get(keys[i][2])]);
  return track(v, moves, get(keys[0][2]));
}

const webp = (q, preset) => ['-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', q, '-compression_level', '6', '-preset', preset, '-loop', '0'];
// hq: README 용 — 1.5배 크기(720x480 → 1080x720, 전체 화면이 원본과 거의 1:1), 품질 90, 글자용 프리셋
const HQ = { scale: 1.5, q: 90, preset: 'text' };

// segments: 녹화 여러 개를 이어 붙일 때 — 각 항목 = 녹화별 설정(input·trim·base·views·camera·points·cursor·clicks·cuts),
// 공통값(size·fps·cursorScreen)은 바깥에서 물려받음. 구간마다 무손실에 가까운 mp4 로 렌더 → 이어서 webp.
function render(configPath, mode, outPath) {
  const base = require(path.resolve(__dirname, configPath));
  const hq = mode === 'hq';
  if (mode && !hq) throw new Error('알 수 없는 모드: ' + mode);
  const s = hq ? HQ.scale : 1;
  const C = { ...base, size: base.size.map(v => v * s), cursorScreen: base.cursorScreen && base.cursorScreen * s,
    output: outPath || base.output };
  const WEBP = hq ? webp(HQ.q, HQ.preset) : webp(STYLE.webpQ, 'picture');
  const work = path.join(CACHE, path.basename(configPath, '.js') + (hq ? '-hq' : ''));
  fs.mkdirSync(work, { recursive: true });
  if (!C.segments) return renderSegment(C, work, [...WEBP, path.join(ROOT, C.output)]);
  const parts = C.segments.map((s, i) => {
    const dir = path.join(work, 'seg' + i), out = path.join(dir, 'seg.mp4');
    fs.mkdirSync(dir, { recursive: true });
    const { segments, output, ...shared } = C;
    renderSegment({ ...shared, ...s }, dir, ['-c:v', 'libx264', '-crf', '8', '-pix_fmt', 'yuv420p', out]);
    return out;
  });
  ffmpeg([...parts.flatMap(p => ['-i', p]), '-filter_complex', parts.map((_, i) => `[${i}:v]`).join('') + `concat=n=${parts.length}:v=1:a=0[v]`,
    '-map', '[v]', ...WEBP, path.join(ROOT, C.output)].map(String));
  console.log('완료:', C.output, Math.round(fs.statSync(path.join(ROOT, C.output)).size / 1024) + 'KB');
}

function renderSegment(C, work, outArgs) {
  const [OW, OH] = C.size, B = C.base, ar = B.w / B.h;
  if (Math.abs(ar - OW / OH) > 0.01) throw new Error(`base 비율(${ar.toFixed(3)}) ≠ size 비율(${(OW / OH).toFixed(3)})`);
  // cursorScreen: 커서를 카메라 뒤(출력 화면)에 그림 → 확대와 무관하게 크기 고정 (값 = 출력 px 높이)
  const SCR = C.cursorScreen;
  cursorPng(SCR || STYLE.cursorH, path.join(work, 'cursor.png'));
  cursorPng(Math.round((SCR || STYLE.cursorH) * STYLE.pressedH / STYLE.cursorH), path.join(work, 'cursor_p.png'));
  ripplePngs(work);

  const pt = name => { const p = C.points[name]; if (!p) throw new Error('points 에 없음: ' + name); return p; };
  const view = (n, k) => { const vw = C.views[n]; if (!vw) throw new Error('views 에 없음: ' + n); return vw[k] - (k === 'cx' ? B.x : k === 'cy' ? B.y : 0); };
  const cam = v => ['w', 'cx', 'cy'].map(k => keyTrack(v, C.camera, n => view(n, k)));
  const [ZW, ZX, ZY] = cam('it');
  const tv = SCR ? `(t+${C.trim[0]})` : 't'; // 출력 화면 단계에선 t = 원본초 - trim 시작
  const CX = keyTrack(tv, C.cursor, n => pt(n)[0]), CY = keyTrack(tv, C.cursor, n => pt(n)[1]);
  const pressed = C.clicks.map(([c]) => `between(${tv},${c},${c + STYLE.pressSec})`).join('+') || '0';

  const g = [`[0:v]fps=${C.fps},format=yuv420p[b0]`];
  C.clicks.forEach(([, n], i) => g.push(`[b${i}][${3 + i}:v]overlay=x=${pt(n)[0] - RIP}:y=${pt(n)[1] - RIP}:eof_action=pass[b${i + 1}]`));
  let src = `b${C.clicks.length}`, cx = `${CX}-${HOT}`, cy = `${CY}-${HOT}`;
  const overlayCursor = to => {
    g.push(`[${src}][1:v]overlay=x='${cx}':y='${cy}':enable='not(${pressed})':shortest=1[${to}a]`);
    g.push(`[${to}a][2:v]overlay=x='${cx}':y='${cy}':enable='${pressed}':shortest=1[${to}]`);
    src = to;
  };
  if (!SCR) overlayCursor('c');
  g.push(`[${src}]trim=start=${C.trim[0]}:end=${C.trim[1]},crop=${B.w}:${B.h}:${B.x}:${B.y},scale=${B.w * 2}:${B.h * 2}:flags=lanczos,` +
    `zoompan=z='${B.w}/(${ZW})':x='2*(${ZX})-(${ZW})':y='2*(${ZY})-(${ZW})/${ar}':d=1:s=${OW}x${OH}:fps=${C.fps},setpts=PTS-STARTPTS[z]`);
  src = 'z';
  if (SCR) { // 원본 좌표 → 출력 좌표 (카메라 식을 같은 시간으로 다시 계산)
    const [W2, X2, Y2] = cam(tv);
    cx = `((${CX})-(${X2})-${B.x}+(${W2})/2)*${OW}/(${W2})-${HOT}`;
    cy = `((${CY})-(${Y2})-${B.y}+(${W2})/${2 * ar})*${OW}/(${W2})-${HOT}`;
    overlayCursor('s');
  }
  // cuts: [[시작, 끝]] 원본 초 — 기다린 구간 잘라내기 (카메라·커서 시간은 원본 기준 그대로)
  const cuts = C.cuts && C.cuts.length
    ? `select='not(${C.cuts.map(([a, b]) => `between(t,${a - C.trim[0]},${b - C.trim[0]})`).join('+')})',setpts=N/(${C.fps}*TB),` : '';
  g.push(`[${src}]${cuts}format=yuv420p[v]`);
  const fc = path.join(work, 'filter.txt');
  fs.writeFileSync(fc, g.join(';\n'));

  const args = ['-i', path.join(ROOT, C.input),
    '-loop', '1', '-framerate', C.fps, '-i', fwd(path.join(work, 'cursor.png')),
    '-loop', '1', '-framerate', C.fps, '-i', fwd(path.join(work, 'cursor_p.png'))];
  C.clicks.forEach(([c]) => args.push('-itsoffset', c, '-framerate', C.fps, '-i', fwd(path.join(work, 'ripple_%02d.png'))));
  args.push('-/filter_complex', fc, '-map', '[v]', ...outArgs);
  ffmpeg(args.map(String));
  if (C.output) console.log('완료:', C.output, Math.round(fs.statSync(path.join(ROOT, C.output)).size / 1024) + 'KB');
}

function sheet(video, fps = '4', crop) {
  const out = path.join(CACHE, 'sheet', path.basename(video, path.extname(video)) + (crop ? '-' + crop.replace(/:/g, '_') : ''));
  fs.mkdirSync(out, { recursive: true });
  const vf = [`fps=${fps}`, crop && `crop=${crop}`, 'scale=480:-1',
    "drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts}':x=4:y=4:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7",
    'tile=4x6'].filter(Boolean).join(',');
  ffmpeg(['-i', path.resolve(ROOT, video), '-vf', vf, path.join(out, 'sheet%d.png')]);
  console.log('밀착 인화:', fwd(path.relative(ROOT, out)));
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) { console.error('사용: render.js <configs/x.js> [hq <출력.webp>] | render.js sheet <영상> [fps] [crop]'); process.exit(1); }
if (cmd === 'sheet') sheet(...rest); else render(cmd, ...rest);
