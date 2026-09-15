const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TARGET = path.join(DATA_DIR, 'kr_korean.csv');
const OPTIONAL = process.argv.includes('--optional');
const FORCE = process.argv.includes('--force');
const MARKER = '# common-nouns-v1,한국어 학습용 어휘';
const MIN_WORDS = 1500;

const SOURCES = [
  {
    name: 'pd-korean-noun-list-for-wordles (jsDelivr)',
    url: 'https://cdn.jsdelivr.net/npm/pd-korean-noun-list-for-wordles@0.4.0/src/CommonNouns.js'
  },
  {
    name: 'pd-korean-noun-list-for-wordles (GitHub)',
    url: 'https://raw.githubusercontent.com/han-dle/pd-korean-noun-list-for-wordles/main/src/CommonNouns.js'
  }
];

function extractWords(text) {
  const words = [];
  const seen = new Set();
  const re = /'([가-힣]{2,})'/g;
  let match;
  while ((match = re.exec(text))) {
    const word = match[1].normalize('NFC');
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

async function existingIsUsable() {
  try {
    const text = await fsp.readFile(TARGET, 'utf8');
    if (!text.startsWith(MARKER)) return false;
    return text.split(/\r?\n/).length >= MIN_WORDS;
  } catch {
    return false;
  }
}

async function download(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'dalmuti-multigame-common-word-db/2.0' }
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const text = await response.text();
    const words = extractWords(text);
    if (words.length < MIN_WORDS) throw Error(`일반 어휘를 충분히 읽지 못했습니다. (${words.length.toLocaleString()}개)`);
    return words;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!FORCE && await existingIsUsable()) {
    console.log('[word-db] Common Korean noun DB already exists.');
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });
  let lastError = null;

  for (const source of SOURCES) {
    try {
      console.log(`[word-db] Downloading common Korean nouns from ${source.name}...`);
      const words = await download(source);
      const csv = [MARKER, '낱말,품사', ...words.map(word => `${word},명사`), ''].join('\n');
      const temp = `${TARGET}.tmp-${process.pid}`;
      await fsp.writeFile(temp, csv, 'utf8');
      await fsp.rename(temp, TARGET);
      console.log(`[word-db] Saved ${path.relative(ROOT, TARGET)} (${words.length.toLocaleString()} common words).`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[word-db] ${source.name} failed: ${error.message}`);
    }
  }

  throw lastError || Error('일반 한국어 단어 목록을 다운로드하지 못했습니다.');
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
