const fs = require('fs');
const path = require('path');

const HANGUL_WORD = /^[가-힣]+$/;
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const DB_PATH = process.env.WORD_DB_PATH
  ? path.resolve(process.env.WORD_DB_PATH)
  : path.join(__dirname, 'data', 'kr_korean.csv');
const MIN_PROMPT_ANSWERS = 8;
const REVEAL_MS = 900;

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
  const words = [];
  let rows = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const [rawWord = '', rawPart = ''] = parseCsvLine(line);
    const word = normalizeWord(rawWord);
    const part = String(rawPart || '').trim();

    if (!word || (word === '낱말' && part === '품사')) continue;
    if (word.length < 2 || !HANGUL_WORD.test(word)) continue;
    if (part.includes('동사') || part.includes('형용사')) continue;
    if (set.has(word)) continue;

    set.add(word);
    words.push(word);
    rows += 1;
  }

  if (!set.size) throw Error('한국어 단어 DB에서 사용할 수 있는 단어를 읽지 못했습니다.');

  const choseongWords = new Map();
  const startWords = new Map();
  for (const word of words) {
    const first = [...word][0];
    if (!startWords.has(first)) startWords.set(first, []);
    startWords.get(first).push(word);

    if ([...word].length === 2) {
      const prompt = getChoseong(word);
      if (!choseongWords.has(prompt)) choseongWords.set(prompt, []);
      choseongWords.get(prompt).push(word);
    }
  }

  let prompts = [...choseongWords.entries()]
    .filter(([, candidates]) => candidates.length >= MIN_PROMPT_ANSWERS)
    .map(([prompt]) => prompt);

  if (!prompts.length) prompts = [...choseongWords.keys()];

  console.log(`[word-db] Loaded ${set.size.toLocaleString()} unique words from korean-word-game/db (${rows.toLocaleString()} accepted rows).`);
  console.log(`[word-db] Choseong prompt pool: ${prompts.length.toLocaleString()} combinations.`);

  return { set, words, prompts, choseongWords, startWords };
}

const dictionary = loadDictionary();
const wordSet = dictionary.set;
const wordList = dictionary.words;
const promptPool = dictionary.prompts;
const choseongWords = dictionary.choseongWords;
const startWords = dictionary.startWords;

function unusedChoseongWords(prompt, usedWords) {
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords || []);
  return (choseongWords.get(prompt) || []).filter(word => !used.has(word));
}

function remainingChoseongCount(game) {
  if (!game || game.type !== 'choseong' || !game.prompt) return 0;
  return unusedChoseongWords(game.prompt, game.usedWords).length;
}

function randomPrompt(previous = '', usedWords = []) {
  if (!promptPool.length) return 'ㅅㄱ';
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords || []);
  const candidates = promptPool.filter(prompt =>
    prompt !== previous && (choseongWords.get(prompt) || []).some(word => !used.has(word))
  );
  const fallback = promptPool.filter(prompt =>
    (choseongWords.get(prompt) || []).some(word => !used.has(word)
  );
  const pool = candidates.length ? candidates : fallback.length ? fallback : promptPool;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createGame(type, roomPlayers, options = {}) {
  if (!['choseong', 'wordchain'].includes(type)) throw Error('지원하지 않는 단어 게임입니다.');
  if (roomPlayers.length < 2) throw Error('단어 게임은 플레이어 2명 이상이 필요합니다.');
  const turnLimitMs = Math.max(5000, Math.min(60000, Number(options.turnLimitMs) || 15000));
  const lives = Math.max(1, Math.min(5, Number(options.lives) || 3));
  const players = roomPlayers.map((p, i) => ({
    id: p.id,
    name: p.name,
    portrait: p.portrait || 'royal',
    seat: i,
    lives,
    maxLives: lives,
    score: 0,
    eliminated: false,
    connected: p.bot ? true : p.connected !== false,
    bot: !!p.bot
  }));
  return {
    kind: 'word',
    type,
    status: 'playing',
    phase: 'play',
    players,
    currentPlayerId: players[0].id,
    baseTurnLimitMs: turnLimitMs,
    turnLimitMs,
    turnDeadline: null,
    prompt: type === 'choseong' ? randomPrompt() : null,
    lastWord: null,
    usedWords: [],
    history: [],
    winnerId: null,
    turnNumber: 1,
    roundNumber: type === 'choseong' ? 1 : null,
    consecutiveFailedPlayerIds: [],
    reveal: null
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
    game.reveal = null;
    return true;
  }
  return false;
}

function advance(game, previousId) {
  if (finishIfNeeded(game)) return;
  const next = nextPlayer(game, previousId);
  game.currentPlayerId = next?.id || null;
  game.turnNumber += 1;
}

function startNextChoseongRound(game, reason = 'all_failed') {
  if (!game || game.type !== 'choseong' || game.status !== 'playing') return false;
  const previous = game.prompt;
  game.prompt = randomPrompt(previous, game.usedWords);
  game.roundNumber = (game.roundNumber || 1) + 1;
  game.consecutiveFailedPlayerIds = [];
  game.history.push({
    type: 'round',
    roundNumber: game.roundNumber,
    prompt: game.prompt,
    reason,
    at: Date.now()
  });
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);
  return true;
}

function allActivePlayersFailed(game) {
  if (!game || game.type !== 'choseong') return false;
  const failed = new Set(game.consecutiveFailedPlayerIds || []);
  const active = activePlayers(game);
  return active.length > 0 && active.every(player => failed.has(player.id));
}

function validateCommon(game, word) {
  if (!word) throw Error('단어를 입력해 주세요.');
  if (!HANGUL_WORD.test(word)) throw Error('한글 단어만 입력할 수 있습니다.');
  if (word.length < 2) throw Error('두 글자 이상의 단어를 입력해 주세요.');
  if (!wordSet.has(word)) throw Error('표준국어대사전 단어 목록에 없는 단어입니다.');
  if (game.usedWords.includes(word)) throw Error('이미 나온 단어입니다.');
}

function resetReveal(game) {
  if (!game) return;
  game.reveal = null;
  game.turnLimitMs = game.baseTurnLimitMs || game.turnLimitMs;
}

function setReveal(game, reveal) {
  const base = game.baseTurnLimitMs || game.turnLimitMs;
  game.reveal = { ...reveal, until: Date.now() + REVEAL_MS };
  game.turnLimitMs = base + REVEAL_MS;
}

function submit(game, playerId, rawWord) {
  if (!game || game.status !== 'playing' || game.phase !== 'play') throw Error('지금은 단어를 제출할 수 없습니다.');
  if (game.currentPlayerId !== playerId) throw Error('내 차례가 아닙니다.');
  const player = game.players.find(p => p.id === playerId);
  if (!player || player.eliminated) throw Error('현재 게임에 참가 중이 아닙니다.');
  resetReveal(game);
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
  if (game.type === 'choseong') game.consecutiveFailedPlayerIds = [];
  game.history.push({ type: 'word', playerId, playerName: player.name, word, at: Date.now() });
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);

  const exhausted = game.type === 'choseong' && remainingChoseongCount(game) === 0;
  advance(game, playerId);
  if (game.status === 'playing' && exhausted) startNextChoseongRound(game, 'exhausted');
  return word;
}

function randomUnused(candidates, used) {
  if (!candidates?.length) return null;
  for (let i = 0; i < Math.min(24, candidates.length); i++) {
    const word = candidates[Math.floor(Math.random() * candidates.length)];
    if (!used.has(word)) return word;
  }
  for (const word of candidates) if (!used.has(word)) return word;
  return null;
}

function randomUnusedMany(candidates, used, limit = 3) {
  const available = (candidates || []).filter(word => !used.has(word));
  const picked = [];
  while (available.length && picked.length < limit) {
    const i = Math.floor(Math.random() * available.length);
    picked.push(available.splice(i, 1)[0]);
  }
  return picked;
}

function pickBotWord(game) {
  if (!game || game.status !== 'playing' || !game.currentPlayerId) return null;
  const player = game.players.find(p => p.id === game.currentPlayerId);
  if (!player?.bot || player.eliminated) return null;
  const used = new Set(game.usedWords);

  if (game.type === 'choseong') {
    return randomUnused(choseongWords.get(game.prompt), used);
  }

  if (game.lastWord) {
    const required = [...game.lastWord].at(-1);
    return randomUnused(startWords.get(required), used);
  }

  return randomUnused(wordList, used);
}

function timeout(game) {
  if (!game || game.status !== 'playing' || !game.currentPlayerId) return null;
  const player = game.players.find(p => p.id === game.currentPlayerId);
  if (!player || player.eliminated) return null;

  resetReveal(game);
  const failedPrompt = game.type === 'choseong' ? game.prompt : null;
  const failedLastWord = game.type === 'wordchain' ? game.lastWord : null;

  player.lives = Math.max(0, player.lives - 1);
  if (player.lives === 0) player.eliminated = true;

  if (game.type === 'choseong') {
    const failed = new Set(game.consecutiveFailedPlayerIds || []);
    failed.add(player.id);
    game.consecutiveFailedPlayerIds = [...failed];
  }

  game.history.push({ type: 'timeout', playerId: player.id, playerName: player.name, lives: player.lives, at: Date.now() });
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);

  advance(game, player.id);
  if (game.status !== 'playing') return player;

  if (game.type === 'choseong' && allActivePlayersFailed(game)) {
    const answers = randomUnusedMany(choseongWords.get(failedPrompt), new Set(game.usedWords), 3);
    startNextChoseongRound(game, 'all_failed');
    if (answers.length) {
      setReveal(game, {
        type: 'choseong',
        prompt: failedPrompt,
        words: answers,
        playerName: player.name
      });
    }
  } else if (game.type === 'wordchain' && failedLastWord) {
    const required = [...failedLastWord].at(-1);
    const answer = randomUnused(startWords.get(required), new Set(game.usedWords));
    if (answer) {
      game.usedWords.push(answer);
      game.lastWord = answer;
      game.history.push({
        type: 'reveal',
        word: answer,
        fromWord: failedLastWord,
        playerName: player.name,
        at: Date.now()
      });
      if (game.history.length > 80) game.history.splice(0, game.history.length - 80);
      setReveal(game, {
        type: 'wordchain',
        fromWord: failedLastWord,
        words: [answer],
        playerName: player.name
      });
    }
  }
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
  if (game.status === 'playing' && game.type === 'choseong' && allActivePlayersFailed(game)) {
    startNextChoseongRound(game, 'all_failed');
  }
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
    baseTurnLimitMs: game.baseTurnLimitMs || game.turnLimitMs,
    turnLimitMs: game.turnLimitMs,
    turnDeadline: game.turnDeadline,
    prompt: game.prompt,
    lastWord: game.lastWord,
    usedWordCount: game.usedWords.length,
    roundNumber: game.roundNumber,
    roundRemainingWords: game.type === 'choseong' ? remainingChoseongCount(game) : null,
    reveal: game.reveal,
    history: game.history.slice(-40),
    winnerId: game.winnerId,
    turnNumber: game.turnNumber,
    dictionarySize: wordSet.size,
    dictionarySource: 'korean-word-game/db · 표준국어대사전',
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      portrait: present.get(p.id)?.portrait || p.portrait || 'royal',
      connected: p.bot ? true : !!present.get(p.id)?.connected,
      bot: !!p.bot,
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
  pickBotWord,
  timeout,
  removePlayer,
  publicGame,
  getChoseong,
  normalizeWord,
  dictionarySize: wordSet.size,
  dictionaryPath: DB_PATH
};
