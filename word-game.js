const KoreanNouns = require('pd-korean-noun-list-for-wordles');

const ALL = Array.isArray(KoreanNouns.ALL_NOUNS) ? KoreanNouns.ALL_NOUNS : [];
const COMMON = Array.isArray(KoreanNouns.COMMON_NOUNS) ? KoreanNouns.COMMON_NOUNS : [];
const HANGUL_WORD = /^[가-힣]+$/;
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const words = [...new Set(ALL.map(normalizeWord).filter(w => w.length >= 2 && HANGUL_WORD.test(w)))];
const wordSet = new Set(words);
const promptWords = [...new Set(COMMON.map(normalizeWord).filter(w => w.length === 2 && wordSet.has(w) && HANGUL_WORD.test(w)))];
const promptPool = promptWords.length ? promptWords : words.filter(w => w.length === 2);

function normalizeWord(value) {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, '');
}

function getChoseong(value) {
  return [...normalizeWord(value)].map(ch => {
    const code = ch.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : ch;
  }).join('');
}

function randomPrompt(previous = '') {
  if (!promptPool.length) return 'ㅅㄱ';
  for (let i = 0; i < 12; i++) {
    const next = getChoseong(promptPool[Math.floor(Math.random() * promptPool.length)]);
    if (next && next !== previous) return next;
  }
  return getChoseong(promptPool[Math.floor(Math.random() * promptPool.length)]);
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
    score: 0,
    eliminated: false,
    connected: p.connected !== false
  }));
  const game = {
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
  return game;
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
  if (!wordSet.has(word)) throw Error('단어 목록에 없는 단어입니다.');
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
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      portrait: present.get(p.id)?.portrait || p.portrait || 'royal',
      connected: !!present.get(p.id)?.connected,
      lives: p.lives,
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
  dictionarySize: wordSet.size
};
