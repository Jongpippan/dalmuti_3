const fsp = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TARGET = path.join(DATA_DIR, 'kr_korean.csv');
const OPTIONAL = process.argv.includes('--optional');
const FORCE = process.argv.includes('--force');
const MARKER = '# hunspell-modern-standard-nouns-v1,현대 표준어 명사';
const MIN_WORDS = 20000;

const SOURCES = [
  {
    name: 'hunspell-dict-ko (GitHub)',
    url: 'https://raw.githubusercontent.com/spellcheck-ko/hunspell-dict-ko/master/dict-ko-data.yaml'
  },
  {
    name: 'hunspell-dict-ko (jsDelivr)',
    url: 'https://cdn.jsdelivr.net/gh/spellcheck-ko/hunspell-dict-ko@master/dict-ko-data.yaml'
  }
];

function unquoteYamlScalar(value) {
  const s = String(value || '').trim();
  if (s.length >= 2 && ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))) {
    return s.slice(1, -1);
  }
  return s;
}

function extractNouns(text) {
  const words = [];
  const seen = new Set();
  let pos = '';

  for (const line of String(text || '').split(/\r?\n/)) {
    const posMatch = line.match(/^- pos:\s*(.+?)\s*$/);
    if (posMatch) {
      pos = unquoteYamlScalar(posMatch[1]);
      continue;
    }

    if (pos !== '명사') continue;
    const wordMatch = line.match(/^\s+word:\s*(.+?)\s*$/);
    if (!wordMatch) continue;

    const word = unquoteYamlScalar(wordMatch[1]).normalize('NFC').trim();
    // 끝말잇기/초성게임에 맞게 숫자·기호·한 글자 표제어는 제외한다.
    if (!/^[가-힣]{2,}$/.test(word)) continue;
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
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'dalmuti-multigame-standard-korean-db/3.0' }
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const text = await response.text();
    const words = extractNouns(text);
    if (words.length < MIN_WORDS) {
      throw Error(`현대 표준어 명사를 충분히 읽지 못했습니다. (${words.length.toLocaleString()}개)`);
    }
    return words;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!FORCE && await existingIsUsable()) {
    console.log('[word-db] Modern standard Korean noun DB already exists.');
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });
  let lastError = null;

  for (const source of SOURCES) {
    try {
      console.log(`[word-db] Downloading modern standard Korean dictionary from ${source.name}...`);
      const words = await download(source);
      const csv = [MARKER, '낱말,품사', ...words.map(word => `${word},명사`), ''].join('\n');
      const temp = `${TARGET}.tmp-${process.pid}`;
      await fsp.writeFile(temp, csv, 'utf8');
      await fsp.rename(temp, TARGET);
      console.log(`[word-db] Saved ${path.relative(ROOT, TARGET)} (${words.length.toLocaleString()} modern standard nouns).`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[word-db] ${source.name} failed: ${error.message}`);
    }
  }

  throw lastError || Error('현대 표준어 명사 목록을 다운로드하지 못했습니다.');
}

main().catch(error => {
  const message = `[word-db] ${error.message}\n[word-db] source: https://github.com/spellcheck-ko/hunspell-dict-ko`;
  if (OPTIONAL) {
    console.warn(`${message}\n[word-db] 설치는 계속합니다. 서버 실행 전 npm run setup:word-db 를 실행해 주세요.`);
    process.exitCode = 0;
  } else {
    console.error(message);
    process.exitCode = 1;
  }
});
