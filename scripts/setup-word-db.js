const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TARGET = path.join(DATA_DIR, 'korean-common-nouns.txt');
const OPTIONAL = process.argv.includes('--optional');
const FORCE = process.argv.includes('--force');
const SOURCE = {
  name: '한국어 학습용 어휘 기반 COMMON_NOUNS',
  url: 'https://raw.githubusercontent.com/han-dle/pd-korean-noun-list-for-wordles/ff8a5974fbe10adafa4e73f3726b9e99fba7ac69/src/CommonNouns.js'
};

function extractWords(text) {
  const words = [];
  const seen = new Set();
  for (const match of String(text || '').matchAll(/^'([가-힣]+)',?$/gm)) {
    const word = match[1].normalize('NFC');
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  if (words.length < 1000) throw Error(`일반 명사 목록이 너무 작습니다. (${words.length.toLocaleString()}개)`);
  return words;
}

async function existingIsUsable() {
  try {
    const text = await fsp.readFile(TARGET, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).length >= 1000;
  } catch {
    return false;
  }
}

async function downloadWords() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(SOURCE.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'dalmuti-common-korean-word-db/1.0' }
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return extractWords(await response.text());
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!FORCE && await existingIsUsable()) {
    console.log('[word-db] data/korean-common-nouns.txt already exists.');
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });
  console.log(`[word-db] Downloading ${SOURCE.name}...`);
  const words = await downloadWords();
  const temp = `${TARGET}.tmp-${process.pid}`;
  await fsp.writeFile(temp, `${words.join('\n')}\n`, 'utf8');
  await fsp.rename(temp, TARGET);
  console.log(`[word-db] Saved ${path.relative(ROOT, TARGET)} (${words.length.toLocaleString()} words).`);
}

main().catch(error => {
  const message = `[word-db] ${error.message}\n[word-db] source: https://github.com/han-dle/pd-korean-noun-list-for-wordles`;
  if (OPTIONAL) {
    console.warn(`${message}\n[word-db] 설치는 계속합니다. 서버 실행 전 npm run setup:word-db 를 실행해 주세요.`);
    process.exitCode = 0;
  } else {
    console.error(message);
    process.exitCode = 1;
  }
});
