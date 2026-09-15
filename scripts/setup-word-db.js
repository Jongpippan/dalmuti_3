const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TARGET = path.join(DATA_DIR, 'kr_korean.csv');
const OPTIONAL = process.argv.includes('--optional');
const FORCE = process.argv.includes('--force');
const MIN_BYTES = 5_000_000;

// Canonical source published by korean-word-game/db.
const SOURCES = [
  {
    name: 'korean-word-game/db (Google Drive)',
    url: 'https://drive.usercontent.google.com/download?id=1PdzYubqcPKAIsHRtWZEFdQ1m4-fba6Oj&export=download&confirm=t'
  },
  {
    // Public GitHub mirror of the same kr_korean.csv. This is only a transport fallback
    // for environments where Google Drive blocks non-browser downloads.
    name: 'GitHub mirror of kr_korean.csv',
    url: 'https://raw.githubusercontent.com/isaac7778/word-chain-korean/master/kr_korean.csv'
  }
];

function looksLikeDictionary(buffer) {
  if (!buffer || buffer.length < MIN_BYTES) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 128 * 1024)).toString('utf8').replace(/^\uFEFF/, '');
  return sample.includes(',') && /[가-힣]{2,}/.test(sample);
}

async function existingIsUsable() {
  try {
    const stat = await fsp.stat(TARGET);
    if (!stat.isFile() || stat.size < MIN_BYTES) return false;
    const handle = await fsp.open(TARGET, 'r');
    try {
      const sample = Buffer.alloc(128 * 1024);
      const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
      const text = sample.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '');
      return text.includes(',') && /[가-힣]{2,}/.test(text);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

async function download(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'dalmuti-multigame-word-db-setup/1.0' }
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('text/html')) throw Error('HTML 응답이 반환되었습니다.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!looksLikeDictionary(buffer)) throw Error(`사전 파일 형식이 올바르지 않습니다. (${buffer.length.toLocaleString()} bytes)`);
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!FORCE && await existingIsUsable()) {
    console.log('[word-db] data/kr_korean.csv already exists.');
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });
  let lastError = null;

  for (const source of SOURCES) {
    try {
      console.log(`[word-db] Downloading from ${source.name}...`);
      const buffer = await download(source);
      const temp = `${TARGET}.tmp-${process.pid}`;
      await fsp.writeFile(temp, buffer);
      await fsp.rename(temp, TARGET);
      console.log(`[word-db] Saved ${path.relative(ROOT, TARGET)} (${buffer.length.toLocaleString()} bytes).`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[word-db] ${source.name} failed: ${error.message}`);
    }
  }

  throw lastError || Error('kr_korean.csv를 다운로드하지 못했습니다.');
}

main().catch(error => {
  const message = `[word-db] ${error.message}\n[word-db] 원본: https://github.com/korean-word-game/db`;
  if (OPTIONAL) {
    console.warn(`${message}\n[word-db] 설치는 계속합니다. 서버 실행 전 npm run setup:word-db 를 실행해 주세요.`);
    process.exitCode = 0;
  } else {
    console.error(message);
    process.exitCode = 1;
  }
});
