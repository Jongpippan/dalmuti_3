const fs = require('fs');
const path = require('path');

const HANGUL_WORD = /^[가-힣]+$/;
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const DB_PATH = process.env.WORD_DB_PATH
  ? path.resolve(process.env.WORD_DB_PATH)
  : path.join(__dirname, 'data', 'kr_korean.csv');
const MIN_PROMPT_ANSWERS = 8;

function normalizeWord(value) {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, '');
}

function getChoseong(value) {
  return [...normalizeWord(value)].map(ch => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : ch;
  }).join('');
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function loadDictionary() {
  if (!fs.existsSync(DB_PATH)) {
    throw Error(`한국어 단어 DB가 없습니다: ${DB_PATH}\n먼저 npm run setup:word-db 를 실행해 주세요.`);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8').replace(/^\uFEFF/, '');
  const set = new Set();
  let rows = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const [rawWord = '', rawPart = ''] = parseCsvLine(line);
    const word = normalizeWord(rawWord);
    const part = String(rawPart || '').trim();

    if (!word || (word === '낱말' && part === '품사')) continue;
    if (word.length < 2 || !HANGUL_WORD.test(word)) continue;
    if (part.includes('동사') || part.includes('형용사')) continue;

    set.add(word);
    rows += 1;
  }

  if (!set.size) throw Error('한국어 단어 DB에서 사용할 수 있는 단어를 읽지 못했습니다.');

  const promptCounts = new Map();
  for (const word of set) {
    if ([...word].length !== 2) continue;
    const prompt = getChoseong(word);
    promptCounts.set(prompt, (promptCounts.get(prompt) || 0) + 1);
  }

  let prompts = [...promptCounts.entries()]
    .filter(([, count]) => count >= MIN_PROMPT_ANSWERS)
    .map(([prompt]) => prompt);

  if (!prompts.length) prompts = [...promptCounts.keys()];

  console.log(`[word-db] Loaded ${set.size.toLocaleString()} unique words from korean-word-game/db (${rows.toLocaleString()} accepted rows).`);
  console.log(`[word-db] Choseong prompt pool: ${prompts.length.toLocaleString()} combinations.`);

  return { set, prompts };
}

const dictionary = loadDictionary();
const wordSet = dictionary.set;
const promptPool = dictionary.prompts;

function randomPrompt(previous = '') {
  if (!promptPool.length) return 'ㅅㄱ';
  for (let i = 0; i < 12; i++) {
    const next = promptPool[Math.floor(Math.random() * promptPool.length)];
    if (next && next !== previous) return next;
  }
  return promptPool[Math.floor(Math.random() * promptPool.length)];
}

function createGame(type, roomPlayers, options = {}) {
  if (!['choseong', 'wordchain'].includes(type)) throw Error('지원하지 않는 단어 게임입니다.');
  const humans = roomPlayers.filter(p => !p.bot);
  if (humans.length < 2) throw Error('단어 게임은 사람 플레이어 2명 이상이 필요합니다.');
  const turnLimitMs = Math.max(5000, Math.min(60000, Number(options.turnLimitMs) || 15000));
  const lives = Math.max(1, Math.min(5, Number(options.lives) || 3));
  const players = humans.map((p, i) => ({
    id: p.id,
    name: p.name,
    portrait: p.portrait || 'royal',
    seat: i,
    lives,
    maxLives: lives,
    score: 0,
    eliminated: false,
    connected: p.connected !== false
  }));
  return {
    kind: 'word',
    type,
    status: 'playing',
    phase: 'play',
    players,
    currentPlayerId: players[0].id,
    turnLimitMs,
    turnDeadline: null,
    prompt: type === 'choseong' ? randomPrompt() : null,
    lastWord: null,
    usedWords: [],
    history: [],
    winnerId: null,
    turnNumber: 1
  };
}

function activePlayers(game) {
  return game.players.filter(p => !p.eliminated);
}

function nextPlayer(game, fromId) {
  const active = activePlayers(game);
  if (active.length <= 1) return active[0] || null;
  const currentSeat = game.players.find(p => p.id === fromId)?.seat ?? -1;
  for (let step = 1; step <= game.players.length; step++) {
    const candidate = game.players[(currentSeat + step) % game.players.length];
    if (candidate && !candidate.eliminated) return candidate;
  }
  return active[0] || null;
}

function finishIfNeeded(game) {
  const active = activePlayers(game);
  if (active.length <= 1) {
    game.status = 'finished';
    game.phase = 'results';
    game.winnerId = active[0]?.id || null;
    game.currentPlayerId = null;
    game.turnDeadline = null;
    return true;
  }
  return false;
}

function advance(game, previousId) {
  if (finishIfNeeded(game)) return;
  const next = nextPlayer(game, previousId);
  game.currentPlayerId = next?.id || null;
  game.turnNumber += 1;
  if (game.type === 'choseong') game.prompt = randomPrompt(game.prompt);
}

function validateCommon(game, word) {
  if (!word) throw Error('단어를 입력해 주세요.');
  if (!HANGUL_WORD.test(word)) throw Error('한글 단어만 입력할 수 있습니다.');
  if (word.length < 2) throw Error('두 글자 이상의 단어를 입력해 주세요.');
  if (!wordSet.has(word)) throw Error('표준국어대사전 단어 목록에 없는 단어입니다.');
  if (game.usedWords.includes(word)) throw Error('이미 나온 단어입니다.');
}

function submit(game, playerId, rawWord) {
  if (!game || game.status !== 'playing' || game.phase !== 'play') throw Error('지금은 단어를 제출할 수 없습니다.');
  if (game.currentPlayerId !== playerId) throw Error('내 차례가 아닙니다.');
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.eliminated) throw Error('현재 게임에 참가 중이 아닙니다.');
  const word = normalizeWord(rawWord);
  validateCommon(game, word);

  if (game.type === 'choseong') {
    if (getChoseong(word) !== game.prompt) throw Error(`초성 ${game.prompt}에 맞는 단어가 아닙니다.`);
  } else if (game.lastWord) {
    const required = [...game.lastWord].at(-1);
    if ([...word][0] !== required) throw Error(`'${required}'(으)로 시작하는 단어를 입력해 주세요.`);
  }

  game.usedWords.push(word);
  game.lastWord = word;
  player.score += 1;
  game.history.push({ type: 'word', playerId, playerName: player.name, word, at: Date.now() });
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);
  advance(game, playerId);
  return word;
}

function timeout(game) {
  if (!game || game.status !== 'playing' || !game.currentPlayerId) return null;
  const player = game.players.find(p => p.id === game.currentPlayerId);
  if (!player || player.eliminated) return null;
  player.lives = Math.max(0, player.lives - 1);
  if (player.lives === 0) player.eliminated = true;
  game.history.push({ type: 'timeout', playerId: player.id, playerName: player.name, lives: player.lives, at: Date.now() });
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);
  advance(game, player.id);
  return player;
}

function removePlayer(game, playerId) {
  if (!game) return;
  const p = game.players.find(x => x.id === playerId);
  if (!p || p.eliminated) return;
  const wasCurrent = game.currentPlayerId === playerId;
  p.lives = 0;
  p.eliminated = true;
  game.history.push({ type: 'leave', playerId: p.id, playerName: p.name, at: Date.now() });
  if (!finishIfNeeded(game) && wasCurrent) advance(game, playerId);
}

function publicGame(game, roomPlayers) {
  if (!game) return null;
  const present = new Map(roomPlayers.map(p => [p.id, p]));
  return {
    kind: game.kind,
    type: game.type,
    status: game.status,
    phase: game.phase,
    currentPlayerId: game.currentPlayerId,
    turnLimitMs: game.turnLimitMs,
    turnDeadline: game.turnDeadline,
    prompt: game.prompt,
    lastWord: game.lastWord,
    usedWordCount: game.usedWords.length,
    history: game.history.slice(-40),
    winnerId: game.winnerId,
    turnNumber: game.turnNumber,
    dictionarySize: wordSet.size,
    dictionarySource: 'korean-word-game/db · 표준국어대사전',
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      portrait: present.get(p.id)?.portrait || p.portrait || 'royal',
      connected: !!present.get(p.id)?.connected,
      lives: p.lives,
      maxLives: p.maxLives,
      score: p.score,
      eliminated: p.eliminated
    }))
  };
}

module.exports = {
  createGame,
  submit,
  timeout,
  removePlayer,
  publicGame,
  getChoseong,
  normalizeWord,
  dictionarySize: wordSet.size,
  dictionaryPath: DB_PATH
};
