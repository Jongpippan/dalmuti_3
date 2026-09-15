const fs = require('fs');
const path = require('path');

const HANGUL_WORD = /^[가-힣]+$/;
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const DB_PATH = process.env.WORD_DB_PATH
  ? path.resolve(process.env.WORD_DB_PATH)
  : path.join(__dirname, 'data', 'kr_korean.csv');
const REVEAL_MS = 3000;
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const I_OR_Y_VOWELS = new Set([2, 6, 7, 12, 17, 20]); // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ

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

function buildPromptPools(choseongWords) {
  const entries = [...choseongWords.entries()]
    .filter(([, candidates]) => candidates.length >= 2)
    .map(([prompt, candidates]) => ({ prompt, count: candidates.length }))
    .sort((a, b) => a.count - b.count || a.prompt.localeCompare(b.prompt));

  if (!entries.length) return { easy: [], normal: [], hard: [], all: [] };

  let hard = entries.filter(x => x.count <= 3).map(x => x.prompt);
  let normal = entries.filter(x => x.count >= 4 && x.count <= 7).map(x => x.prompt);
  let easy = entries.filter(x => x.count >= 8).map(x => x.prompt);

  const minBucket = Math.min(5, Math.max(1, Math.floor(entries.length / 8)));
  if (hard.length < minBucket || normal.length < minBucket || easy.length < minBucket) {
    const third = Math.max(1, Math.floor(entries.length / 3));
    hard = entries.slice(0, third).map(x => x.prompt);
    normal = entries.slice(third, Math.max(third + 1, entries.length - third)).map(x => x.prompt);
    easy = entries.slice(Math.max(third + 1, entries.length - third)).map(x => x.prompt);
  }

  return {
    easy: easy.length ? easy : entries.map(x => x.prompt),
    normal: normal.length ? normal : entries.map(x => x.prompt),
    hard: hard.length ? hard : entries.map(x => x.prompt),
    all: entries.map(x => x.prompt)
  };
}

function loadDictionary() {
  if (!fs.existsSync(DB_PATH)) {
    throw Error(`한국어 단어 DB가 없습니다: ${DB_PATH}\n먼저 npm run setup:word-db 를 실행해 주세요.`);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8').replace(/^\uFEFF/, '');
  const set = new Set();
  const words = [];

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const [rawWord = '', rawPart = ''] = parseCsvLine(line);
    const word = normalizeWord(rawWord);
    const part = String(rawPart || '').trim();
    if (!word || (word === '낱말' && part === '품사')) continue;
    if (word.length < 2 || !HANGUL_WORD.test(word)) continue;
    if (part.includes('동사') || part.includes('형용사')) continue;
    if (set.has(word)) continue;
    set.add(word);
    words.push(word);
  }

  if (!set.size) throw Error('한국어 단어 DB에서 사용할 수 있는 단어를 읽지 못했습니다.');

  const choseongWords = new Map();
  const startWords = new Map();
  for (const word of words) {
    const chars = [...word];
    const first = chars[0];
    if (!startWords.has(first)) startWords.set(first, []);
    startWords.get(first).push(word);

    if (chars.length === 2) {
      const prompt = getChoseong(word);
      if (!choseongWords.has(prompt)) choseongWords.set(prompt, []);
      choseongWords.get(prompt).push(word);
    }
  }

  const promptPools = buildPromptPools(choseongWords);
  console.log(`[word-db] Loaded ${set.size.toLocaleString()} common Korean words.`);
  console.log(`[word-db] Choseong prompts: easy ${promptPools.easy.length}, normal ${promptPools.normal.length}, hard ${promptPools.hard.length}.`);
  return { set, words, choseongWords, startWords, promptPools };
}

const dictionary = loadDictionary();
const wordSet = dictionary.set;
const wordList = dictionary.words;
const choseongWords = dictionary.choseongWords;
const startWords = dictionary.startWords;
const promptPools = dictionary.promptPools;

function normalizeDifficulty(value) {
  return DIFFICULTIES.has(String(value || '')) ? String(value) : 'normal';
}

function unusedChoseongWords(prompt, usedWords) {
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords || []);
  return (choseongWords.get(prompt) || []).filter(word => !used.has(word));
}

function remainingChoseongCount(game) {
  if (!game || game.type !== 'choseong' || !game.prompt) return 0;
  return unusedChoseongWords(game.prompt, game.usedWords).length;
}

function randomPrompt(previous = '', usedWords = [], difficulty = 'normal') {
  const selectedDifficulty = normalizeDifficulty(difficulty);
  const preferred = promptPools[selectedDifficulty] || promptPools.normal;
  const all = promptPools.all.length ? promptPools.all : [...choseongWords.keys()];
  if (!all.length) return 'ㅅㄱ';
  const used = usedWords instanceof Set ? usedWords : new Set(usedWords || []);
  const hasUnusedWord = prompt => (choseongWords.get(prompt) || []).some(word => !used.has(word));
  const pickFrom = pool => pool.filter(prompt => prompt !== previous && hasUnusedWord(prompt));
  const candidates = pickFrom(preferred);
  const fallbackPreferred = preferred.filter(hasUnusedWord);
  const fallbackAll = pickFrom(all);
  const pool = candidates.length ? candidates : fallbackPreferred.length ? fallbackPreferred : fallbackAll.length ? fallbackAll : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function changeInitial(syllable, initialIndex) {
  if (!syllable) return syllable;
  const code = syllable.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return syllable;
  const vowelIndex = Math.floor((code % 588) / 28);
  const finalIndex = code % 28;
  return String.fromCharCode(0xac00 + initialIndex * 588 + vowelIndex * 28 + finalIndex);
}

function allowedStartsForSyllable(syllable) {
  if (!syllable) return [];
  const code = syllable.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return [syllable];
  const initialIndex = Math.floor(code / 588);
  const vowelIndex = Math.floor((code % 588) / 28);
  const starts = [syllable];

  if (initialIndex === 5) { // ㄹ
    const transformed = I_OR_Y_VOWELS.has(vowelIndex)
      ? changeInitial(syllable, 11) // ㅇ: 량→양, 려→여, 류→유, 리→이
      : changeInitial(syllable, 2); // ㄴ: 라→나, 로→노, 루→누
    if (!starts.includes(transformed)) starts.push(transformed);
  } else if (initialIndex === 2 && I_OR_Y_VOWELS.has(vowelIndex)) { // ㄴ + i/y 계열 → ㅇ
    const transformed = changeInitial(syllable, 11); // 녀→여, 뇨→요, 뉴→유, 니→이
    if (!starts.includes(transformed)) starts.push(transformed);
  }
  return starts;
}

function requiredStarts(game) {
  if (!game?.lastWord) return [];
  return allowedStartsForSyllable([...game.lastWord].at(-1));
}

function candidatesForStarts(starts) {
  const seen = new Set();
  const result = [];
  for (const start of starts || []) {
    for (const word of startWords.get(start) || []) {
      if (seen.has(word)) continue;
      seen.add(word);
      result.push(word);
    }
  }
  return result;
}

function createGame(type, roomPlayers, options = {}) {
  if (!['choseong', 'wordchain'].includes(type)) throw Error('지원하지 않는 단어 게임입니다.');
  if (roomPlayers.length < 2) throw Error('단어 게임은 플레이어 2명 이상이 필요합니다.');
  const turnLimitMs = Math.max(5000, Math.min(60000, Number(options.turnLimitMs) || 15000));
  const lives = Math.max(1, Math.min(5, Number(options.lives) || 3));
  const difficulty = normalizeDifficulty(options.difficulty);
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
    prompt: type === 'choseong' ? randomPrompt('', [], difficulty) : null,
    difficulty,
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
  game.prompt = randomPrompt(previous, game.usedWords, game.difficulty);
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
  if (!wordSet.has(word)) throw Error('게임의 일반 한국어 단어 목록에 없는 단어입니다.');
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
    const starts = requiredStarts(game);
    const first = [...word][0];
    if (!starts.includes(first)) {
      const guide = starts.length > 1 ? starts.map(x => `'${x}'`).join(' 또는 ') : `'${starts[0]}'`;
      throw Error(`${guide}(으)로 시작하는 단어를 입력해 주세요.`);
    }
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
    return randomUnused(candidatesForStarts(requiredStarts(game)), used);
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
  const failedStarts = game.type === 'wordchain' ? requiredStarts(game) : [];

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
    const answer = randomUnused(candidatesForStarts(failedStarts), new Set(game.usedWords));
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
  if (game.history.length > 80) game.history.splice(0, game.history.length - 80);

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
    difficulty: game.difficulty,
    lastWord: game.lastWord,
    requiredStarts: game.type === 'wordchain' ? requiredStarts(game) : [],
    usedWordCount: game.usedWords.length,
    roundNumber: game.roundNumber,
    roundRemainingWords: game.type === 'choseong' ? remainingChoseongCount(game) : null,
    reveal: game.reveal,
    history: game.history.slice(-40),
    winnerId: game.winnerId,
    turnNumber: game.turnNumber,
    dictionarySize: wordSet.size,
    dictionarySource: '국립국어원 한국어 학습용 어휘 기반 일반 명사',
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
  allowedStartsForSyllable,
  dictionarySize: wordSet.size,
  dictionaryPath: DB_PATH
};
