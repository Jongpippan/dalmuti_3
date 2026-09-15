const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { URL } = require('url');
const E = require('./game-engine');
const W = require('./word-game');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
const DALMUTI_MAX_PLAYERS = 8;
const WORD_MAX_PLAYERS = 20;
const MIN_PLAYERS = 4;
const TURN_LIMIT_MS = 30000;
const WORD_TURN_LIMIT_MS = 15000;
const GAME_TYPES = new Set(['dalmuti', 'choseong', 'wordchain']);
const GAME_NAMES = { dalmuti: '대 달무티', choseong: '초성게임', wordchain: '끝말잇기' };
const PORTRAITS = new Set(['royal', 'mage', 'knight', 'princess', 'ninja', 'bard', 'fox', 'owl']);
const PORTRAIT_IDS = [...PORTRAITS];
const CUSTOM_PORTRAIT = /^custom:[0-4]\.[0-5]\.[0-5]\.[0-5](?:\.[0-5])?$/;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function cleanName(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 14);
  if (!s) throw Error('닉네임을 입력해 주세요.');
  return s;
}
function cleanMessage(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!s) throw Error('메시지를 입력해 주세요.');
  return s;
}
function cleanGameType(v) {
  const type = String(v || '');
  if (!GAME_TYPES.has(type)) throw Error('지원하지 않는 게임입니다.');
  return type;
}
function pikaMask(v) {
  const chars = [...String(v).replace(/\s/g, '')].length;
  const repeats = Math.max(1, Math.ceil(chars / 2));
  return Array.from({ length: repeats }, () => '피카').join(' ') + '!';
}
function romanizeKorean(v) {
  const L = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  const V = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  const T = ['','k','k','ks','n','nj','nh','t','l','lk','lm','lb','ls','lt','lp','lh','m','p','ps','t','t','ng','t','t','k','t','p','h'];
  return [...String(v)].map(ch => {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return ch;
    const li = Math.floor(code / 588), vi = Math.floor((code % 588) / 28), ti = code % 28;
    return L[li] + V[vi] + T[ti];
  }).join('');
}
function cleanPortrait(v) {
  const s = String(v || 'royal');
  return PORTRAITS.has(s) || CUSTOM_PORTRAIT.test(s) ? s : 'royal';
}
function cleanCode(v) { return String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6); }
function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let z = 0; z < 999; z++) {
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    if (!rooms.has(s)) return s;
  }
  throw Error('방 코드를 만들지 못했습니다.');
}
function getRoom(v) {
  const r = rooms.get(cleanCode(v));
  if (!r) throw Error('방을 찾을 수 없습니다.');
  return r;
}
function auth(p) {
  const r = getRoom(p.roomCode);
  const u = r.players.find(x => x.id === p.playerId && x.token === p.reconnectToken);
  if (!u) throw Error('재접속 정보가 올바르지 않습니다.');
  return { r, u };
}
function session(r, u) { return { roomCode: r.code, playerId: u.id, reconnectToken: u.token }; }
function roleName(i) { return E.RANK_NAMES?.[i + 1] || `${i + 1}위`; }
function normalizeGameRoles(g) {
  g.players.sort((a, b) => a.roleIndex - b.roleIndex);
  g.players.forEach((p, i) => { p.roleIndex = i; p.seat = i; p.role = roleName(i); });
}
function normalizedRoomRules(r) { r.rules = E.normalizeRules(r.rules); return r.rules; }
function maxPlayersForType(type) { return type === 'dalmuti' ? DALMUTI_MAX_PLAYERS : WORD_MAX_PLAYERS; }
function roomStarted(r) { return r.gameType === 'dalmuti' ? !!r.game : !!r.wordGame; }
function roomGameType(r) { return roomStarted(r) ? r.gameType : (r.selectedGame || 'dalmuti'); }
function roomMaxPlayers(r) { return maxPlayersForType(roomGameType(r)); }
function isActivePlayer(r, id) {
  if (r.gameType === 'dalmuti') return !!r.game?.players.some(p => p.id === id);
  if (r.gameType === 'choseong' || r.gameType === 'wordchain') return !!r.wordGame?.players.some(p => p.id === id);
  return false;
}
function isRoundResting(r, u) { return !!(r.game && u && u.roundRestHand === r.game.handNumber && u.roundRestNumber === r.game.roundNumber); }
function isResting(r, u) { return !!u && (!!u.resting || isRoundResting(r, u)); }
function currentDalmutiId(r) {
  if (r.gameType !== 'dalmuti' || !r.game) return null;
  const present = new Set(r.players.map(p => p.id));
  return [...r.game.players].sort((a, b) => a.roleIndex - b.roleIndex).find(p => present.has(p.id))?.id || null;
}
function publicTax(g, viewer) {
  if (g.phase === 'revolution') return { eligibleForViewer: g.tax.eligible.includes(viewer), declined: g.tax.declined.includes(viewer) };
  if (g.phase !== 'tax') return null;
  const exchanges = g.tax.pending?.exchanges || [];
  const mine = exchanges.find(x => x.upperId === viewer && !x.done);
  return {
    stage: g.tax.stage,
    pending: mine ? { kind: mine.kind, count: mine.count, upperId: mine.upperId, lowerId: mine.lowerId } : null,
    exchanges: exchanges.map(x => ({ kind: x.kind, count: x.count, upperId: x.upperId, lowerId: x.lowerId, done: !!x.done }))
  };
}
function publicGame(r, viewer) {
  const g = r.game;
  if (!g || r.gameType !== 'dalmuti') return null;
  return {
    status: g.status,
    handNumber: g.handNumber,
    roundNumber: g.roundNumber || 0,
    phase: g.phase,
    currentPlayerId: g.currentPlayerId,
    turnDeadline: r.turnDeadline || null,
    turnLimitMs: TURN_LIMIT_MS,
    pile: g.pile ? { ...g.pile, playerName: g.players.find(p => p.id === g.pile.playerId)?.name || '' } : null,
    passers: g.passers,
    finishOrder: g.finishOrder,
    winnerId: g.winnerId,
    logs: g.logs.slice(-50),
    viewerWaiting: !g.players.some(p => p.id === viewer),
    rules: g.rules,
    deckSize: 80,
    discardedCount: g.discardedCount,
    jokerNeed: 2,
    tax: publicTax(g, viewer),
    players: g.players.map(p => {
      const rp = r.players.find(x => x.id === p.id);
      return {
        id: p.id, name: p.name, portrait: rp?.portrait || p.portrait || 'royal', role: p.role,
        roleIndex: p.roleIndex, connected: p.connected, handCount: p.hand.length, finished: p.finished,
        finishPlace: p.finishPlace, hand: p.id === viewer ? p.hand.map(c => ({ id: c.id, rank: c.rank })) : null
      };
    })
  };
}
function state(r, v) {
  normalizedRoomRules(r);
  const started = roomStarted(r);
  return {
    room: {
      code: r.code,
      maxPlayers: roomMaxPlayers(r),
      hostId: r.hostId,
      dalmutiId: currentDalmutiId(r),
      rules: r.rules,
      lowestChatMode: r.lowestChatMode || 'pika',
      testRoom: !!r.testRoom,
      selectedGame: r.selectedGame || 'dalmuti',
      gameType: started ? r.gameType : null,
      players: r.players.map(p => ({
        id: p.id, name: p.name, portrait: p.portrait || 'royal', connected: p.connected,
        waiting: started && !isActivePlayer(r, p.id), bot: !!p.bot, resting: !!p.resting,
        roundResting: p.id === v && isRoundResting(r, p), aiPlaying: !!p.aiPlaying
      })),
      started,
      chat: r.chat.slice(-60)
    },
    viewerId: v,
    game: publicGame(r, v),
    wordGame: (r.gameType === 'choseong' || r.gameType === 'wordchain') ? W.publicGame(r.wordGame, r.players) : null
  };
}
function publicRooms() {
  return [...rooms.values()].filter(r => r.players.length && !r.testRoom).map(r => ({
    code: r.code,
    count: r.players.length,
    maxPlayers: roomMaxPlayers(r),
    started: roomStarted(r),
    gameType: roomStarted(r) ? r.gameType : r.selectedGame,
    gameName: GAME_NAMES[roomStarted(r) ? r.gameType : r.selectedGame] || '게임',
    joinable: r.players.length < roomMaxPlayers(r)
  })).sort((a, b) => Number(a.started) - Number(b.started) || b.count - a.count || a.code.localeCompare(b.code));
}
function sse(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); return true; } catch { return false; }
}
function emit(r) {
  if (r.gameType === 'dalmuti' && r.game) {
    for (const gp of r.game.players) {
      const lp = r.players.find(x => x.id === gp.id);
      gp.connected = !!lp?.connected;
    }
  }
  if ((r.gameType === 'choseong' || r.gameType === 'wordchain') && r.wordGame) {
    for (const gp of r.wordGame.players) {
      const lp = r.players.find(x => x.id === gp.id);
      gp.connected = !!lp?.connected;
    }
  }
  for (const p of r.players) if (p.stream && !sse(p.stream, 'state', state(r, p.id))) { p.stream = null; p.connected = false; }
}
function transferHost(r) { if (!r.players.find(p => p.id === r.hostId)) r.hostId = r.players.find(p => !p.bot)?.id || r.players[0]?.id || null; }
function removeRoomPlayer(r, target, eventName = null, message = '') {
  if (target.stream) {
    if (eventName) sse(target.stream, eventName, { message });
    target.stream.end(); target.stream = null;
  }
  r.players = r.players.filter(x => x.id !== target.id);
  transferHost(r);
}
function pruneDepartedPlayers(r) {
  if (!r.game) return;
  const present = new Set(r.players.map(p => p.id));
  r.game.players = r.game.players.filter(p => present.has(p.id));
  r.game.finishOrder = r.game.finishOrder.filter(id => present.has(id));
  r.game.passers = r.game.passers.filter(id => present.has(id));
  normalizeGameRoles(r.game);
}
function addWaitingPlayersForNextHand(r) {
  const g = r.game, newcomers = r.players.filter(p => !g.players.some(x => x.id === p.id));
  for (const u of newcomers) g.players.push({
    id: u.id, name: u.name, portrait: u.portrait, connected: u.connected, seat: g.players.length,
    roleIndex: g.players.length, role: roleName(g.players.length), hand: [], finished: false, finishPlace: null
  });
  if (newcomers.length) normalizeGameRoles(g);
  return newcomers;
}
function restartWithoutPlayer(r, targetName, targetId) {
  const g = r.game;
  g.players = g.players.filter(p => p.id !== targetId);
  g.finishOrder = g.finishOrder.filter(id => id !== targetId);
  g.passers = g.passers.filter(id => id !== targetId);
  normalizeGameRoles(g);
  const newcomers = addWaitingPlayersForNextHand(r);
  if (g.players.length < MIN_PLAYERS) { r.game = null; r.gameType = null; return false; }
  E.restartHand(g, r.rules);
  g.logs.push(`${targetName}님을 제외하고 새 판을 시작했습니다.`);
  if (newcomers.length) g.logs.push(`${newcomers.map(x => x.name).join(', ')}님이 최하위 계급 쪽으로 합류했습니다.`);
  return true;
}
function setRules(r, u, p) {
  if (p.remainderMode === undefined) return;
  const editor = r.gameType === 'dalmuti' && r.game ? currentDalmutiId(r) : r.hostId;
  if (u.id !== editor) throw Error(r.game ? '남는 카드 분배는 현재 달무티만 변경할 수 있습니다.' : '남는 카드 분배는 방장만 변경할 수 있습니다.');
  r.rules = E.normalizeRules({ remainderMode: p.remainderMode });
  r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `다음 판 남는 카드: ${{ low:'낮은 계급부터 지급', high:'높은 계급부터 지급', discard:'버리기' }[r.rules.remainderMode]}.`, at: Date.now() });
}
function nextBotName(r) { let i = 1; while (r.players.some(p => p.name === `봇${i}`)) i++; return `봇${i}`; }
function makeBot(r) {
  const n = r.players.filter(p => p.bot).length;
  return { id: crypto.randomUUID(), token: crypto.randomUUID(), name: nextBotName(r), portrait: PORTRAIT_IDS[(n + 1) % PORTRAIT_IDS.length], connected: true, stream: null, bot: true, resting: false, aiPlaying: false };
}
function isBot(r, id) { return !!r.players.find(p => p.id === id)?.bot; }
function canPlayAny(g, p) {
  if (!g?.pile) return !!p?.hand?.length;
  const need = g.pile.count, jokers = p.hand.filter(c => c.rank === 13).length, counts = {};
  for (const c of p.hand) if (c.rank !== 13 && c.rank < g.pile.rank) counts[c.rank] = (counts[c.rank] || 0) + 1;
  return Object.values(counts).some(n => n + jokers >= need);
}
function nextAvailableLeader(r, fromId) {
  const g = r.game, ordered = [...g.players].sort((a, b) => a.roleIndex - b.roleIndex), idx = ordered.findIndex(p => p.id === fromId);
  for (let s = 1; s <= ordered.length; s++) {
    const p = ordered[(idx + s) % ordered.length], u = r.players.find(x => x.id === p.id);
    if (!p.finished && u && !isResting(r, u)) return p;
  }
  return null;
}
function randomAutoDelay() { return 500 + Math.floor(Math.random() * 1501); }
function scheduleNoPlayPass(r, playerId) {
  if (r.autoTimer) return true;
  const delay = randomAutoDelay();
  r.autoTimer = setTimeout(() => {
    r.autoTimer = null;
    const g = r.game, gp = g?.players.find(x => x.id === playerId);
    if (!g || r.gameType !== 'dalmuti' || g.phase !== 'play' || g.currentPlayerId !== playerId || !g.pile || !gp || canPlayAny(g, gp)) { afterAction(r); return; }
    g.logs.push(`${gp.name}은(는) 낼 수 있는 카드가 없어 자동 패스했습니다.`);
    try { E.pass(g, gp.id); } catch {}
    afterAction(r);
  }, delay);
  return true;
}
function clearTurnTimer(r) {
  if (r.turnTimer) { clearTimeout(r.turnTimer); r.turnTimer = null; }
  r.turnKey = null; r.turnDeadline = null;
}
function turnKey(r) {
  const g = r.game;
  if (r.gameType !== 'dalmuti' || !g || g.phase !== 'play' || !g.currentPlayerId) return '';
  const p = g.pile;
  return [g.handNumber, g.roundNumber || 0, g.currentPlayerId, p?.playerId || '', p?.rank || '', p?.count || ''].join(':');
}
function scheduleTurnTimer(r) {
  const g = r.game, key = turnKey(r);
  if (!key) { clearTurnTimer(r); return; }
  if (r.turnKey === key && r.turnTimer) return;
  if (r.turnTimer) clearTimeout(r.turnTimer);
  r.turnKey = key; r.turnDeadline = Date.now() + TURN_LIMIT_MS;
  r.turnTimer = setTimeout(() => {
    r.turnTimer = null;
    const nowKey = turnKey(r), gg = r.game;
    if (!gg || r.gameType !== 'dalmuti' || nowKey !== key || gg.phase !== 'play') return;
    const gp = gg.players.find(x => x.id === gg.currentPlayerId);
    if (!gp) return;
    if (gg.pile) {
      gg.logs.push(`${gp.name}의 제한 시간 30초가 지나 자동 패스했습니다.`);
      try { E.pass(gg, gp.id); } catch {}
    } else {
      const next = nextAvailableLeader(r, gp.id);
      if (next && next.id !== gp.id) { gg.logs.push(`${gp.name}의 제한 시간 30초가 지나 선을 넘겼습니다.`); gg.currentPlayerId = next.id; }
    }
    r.turnKey = null; r.turnDeadline = null; afterAction(r);
  }, TURN_LIMIT_MS);
}
function autoAdvance(r) {
  const g = r.game;
  if (r.gameType !== 'dalmuti' || !g) return false;
  let guard = 0;
  while (g.phase === 'play' && g.currentPlayerId && guard++ < 100) {
    const gp = g.players.find(x => x.id === g.currentPlayerId), u = r.players.find(x => x.id === g.currentPlayerId);
    if (!gp) break;
    if (g.pile) {
      const resting = isResting(r, u), noPlay = !canPlayAny(g, gp);
      if (!resting && !noPlay) break;
      if (noPlay && !resting) return scheduleNoPlayPass(r, gp.id);
      g.logs.push(`${gp.name}은(는) 낼 수 있는 카드가 없어 자동 패스했습니다.`);
      try { E.pass(g, gp.id); } catch { break; }
      continue;
    }
    if (u && isResting(r, u)) {
      const next = nextAvailableLeader(r, gp.id);
      if (next) { g.logs.push(`${gp.name}은(는) 쉬는 중이라 선을 넘겼습니다.`); g.currentPlayerId = next.id; continue; }
      const active = g.players.filter(p => !p.finished);
      const hasRoundOnly = active.some(p => { const ru = r.players.find(x => x.id === p.id); return ru && !ru.resting && isRoundResting(r, ru); });
      if (hasRoundOnly) { g.roundNumber = (g.roundNumber || 0) + 1; g.logs.push('모든 가능한 플레이어가 이번 라운드를 쉬어 새 라운드로 넘어갑니다.'); continue; }
      break;
    }
    break;
  }
  return false;
}
function botReturnCards(p, n) {
  const cards = [...p.hand].sort((a, b) => {
    const aw = a.rank === 13 ? 0 : a.rank, bw = b.rank === 13 ? 0 : b.rank;
    return bw - aw || b.rank - a.rank;
  });
  return cards.slice(0, n).map(c => c.id);
}
function botPlayIds(g, p) {
  const jokers = p.hand.filter(c => c.rank === 13), groups = new Map();
  for (const c of p.hand) if (c.rank !== 13) { if (!groups.has(c.rank)) groups.set(c.rank, []); groups.get(c.rank).push(c); }
  if (!g.pile) {
    const ranks = [...groups.keys()].sort((a, b) => b - a);
    if (ranks.length) return groups.get(ranks[0]).map(c => c.id);
    return jokers.length ? [jokers[0].id] : [];
  }
  const need = g.pile.count, candidates = [];
  for (const [rank, cards] of groups) {
    if (rank >= g.pile.rank) continue;
    const useJ = Math.max(0, need - cards.length);
    if (useJ <= jokers.length && cards.length + useJ >= need) candidates.push({ rank, ids: [...cards.slice(0, need), ...jokers.slice(0, useJ)].slice(0, need).map(c => c.id) });
  }
  candidates.sort((a, b) => b.rank - a.rank);
  return candidates[0]?.ids || [];
}
function scheduleBot(r) {
  if (r.gameType !== 'dalmuti' || r.autoTimer || r.nextHandTimer || r.botTimer || !r.players.some(p => p.bot)) return;
  r.botTimer = setTimeout(() => { r.botTimer = null; runBot(r); }, 420);
}
function runBot(r) {
  const g = r.game;
  if (r.gameType !== 'dalmuti' || !g) return;
  if (g.phase === 'revolution') {
    const id = g.tax.eligible.find(id => isBot(r, id) && !g.tax.declined.includes(id));
    if (id) { try { E.declineRevolution(g, id); } catch {} afterAction(r); return; }
  }
  if (g.phase === 'tax') {
    const ex = g.tax.pending?.exchanges?.find(x => !x.done && isBot(r, x.upperId));
    if (ex) { const p = g.players.find(x => x.id === ex.upperId); try { E.taxReturn(g, p.id, botReturnCards(p, ex.count)); } catch {} afterAction(r); return; }
  }
  if (g.phase === 'play' && isBot(r, g.currentPlayerId)) {
    const p = g.players.find(x => x.id === g.currentPlayerId), ids = botPlayIds(g, p);
    try { if (ids.length) E.playCards(g, p.id, ids); else if (g.pile) E.pass(g, p.id); }
    catch { try { if (g.pile) E.pass(g, p.id); } catch {} }
    afterAction(r);
  }
}
function startNextHand(r, manualPlayerId = null) {
  const g = r.game;
  if (r.gameType !== 'dalmuti' || !g || g.phase !== 'results') return false;
  if (r.nextHandTimer) { clearTimeout(r.nextHandTimer); r.nextHandTimer = null; }
  pruneDepartedPlayers(r);
  const newcomers = addWaitingPlayersForNextHand(r);
  if (g.players.length < MIN_PLAYERS) { r.game = null; r.gameType = null; afterAction(r); return true; }
  const gd = g.players.find(x => x.roleIndex === 0);
  if (manualPlayerId && manualPlayerId !== gd?.id) throw Error('새 달무티만 다음 판을 시작할 수 있습니다.');
  if (newcomers.length) g.logs.push(`${newcomers.map(x => x.name).join(', ')}님이 최하위 계급 쪽으로 합류합니다.`);
  E.nextHand(g, gd.id, r.rules); afterAction(r); return true;
}
function scheduleNextHand(r) {
  if (r.gameType !== 'dalmuti' || r.nextHandTimer || !r.game || r.game.phase !== 'results') return;
  r.nextHandTimer = setTimeout(() => { r.nextHandTimer = null; startNextHand(r); }, 2500);
}
function afterAction(r) {
  if (r.gameType !== 'dalmuti' || !r.game) { emit(r); return; }
  const waiting = autoAdvance(r);
  scheduleTurnTimer(r);
  emit(r);
  if (r.game?.phase === 'results') { scheduleNextHand(r); return; }
  if (!waiting) scheduleBot(r);
}
function clearWordTimer(r) {
  if (r.wordTimer) { clearTimeout(r.wordTimer); r.wordTimer = null; }
  r.wordTurnKey = null;
  if (r.wordGame) r.wordGame.turnDeadline = null;
}
function clearWordBotTimer(r) {
  if (r.wordBotTimer) { clearTimeout(r.wordBotTimer); r.wordBotTimer = null; }
  r.wordBotKey = null;
}
function scheduleWordBot(r) {
  const g = r.wordGame;
  if (!g || !['choseong', 'wordchain'].includes(r.gameType) || g.status !== 'playing' || !g.currentPlayerId || !isBot(r, g.currentPlayerId)) { clearWordBotTimer(r); return; }
  const key = `${g.turnNumber}:${g.currentPlayerId}`;
  if (r.wordBotKey === key && r.wordBotTimer) return;
  clearWordBotTimer(r);
  r.wordBotKey = key;
  const delay = 1000 + Math.floor(Math.random() * 3001);
  r.wordBotTimer = setTimeout(() => {
    r.wordBotTimer = null;
    r.wordBotKey = null;
    const gg = r.wordGame;
    if (!gg || !['choseong', 'wordchain'].includes(r.gameType) || gg.status !== 'playing' || `${gg.turnNumber}:${gg.currentPlayerId}` !== key || !isBot(r, gg.currentPlayerId)) return;
    const bot = r.players.find(x => x.id === gg.currentPlayerId);
    const word = W.pickBotWord(gg);
    if (!word) return;
    try {
      W.submit(gg, bot.id, word);
      r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `${bot.name}: ${word} ✓`, at: Date.now() });
    } catch { return; }
    if (gg.status === 'playing') {
      scheduleWordTimer(r, true);
      scheduleWordBot(r);
    } else {
      clearWordTimer(r);
      clearWordBotTimer(r);
    }
    emit(r);
  }, delay);
}
function scheduleWordTimer(r, force = false) {
  const g = r.wordGame;
  if (!g || !['choseong', 'wordchain'].includes(r.gameType) || g.status !== 'playing' || !g.currentPlayerId) { clearWordTimer(r); clearWordBotTimer(r); return; }
  const key = `${g.turnNumber}:${g.currentPlayerId}`;
  if (!force && r.wordTurnKey === key && r.wordTimer) return;
  if (r.wordTimer) clearTimeout(r.wordTimer);
  r.wordTurnKey = key;
  g.turnDeadline = Date.now() + g.turnLimitMs;
  r.wordTimer = setTimeout(() => {
    r.wordTimer = null;
    if (!r.wordGame || !['choseong', 'wordchain'].includes(r.gameType) || `${r.wordGame.turnNumber}:${r.wordGame.currentPlayerId}` !== key) return;
    const timedOut = W.timeout(r.wordGame);
    if (timedOut) {
      const text = timedOut.lives > 0 ? `${timedOut.name}님이 시간 초과! 목숨이 ${timedOut.lives}개 남았습니다.` : `${timedOut.name}님이 시간 초과로 탈락했습니다.`;
      r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text, at: Date.now() });
    }
    if (r.wordGame.status === 'playing') {
      scheduleWordTimer(r, true);
      scheduleWordBot(r);
    } else {
      clearWordTimer(r);
      clearWordBotTimer(r);
    }
    emit(r);
  }, g.turnLimitMs);
}
function clearGameTimers(r) {
  if (r.botTimer) { clearTimeout(r.botTimer); r.botTimer = null; }
  if (r.autoTimer) { clearTimeout(r.autoTimer); r.autoTimer = null; }
  if (r.nextHandTimer) { clearTimeout(r.nextHandTimer); r.nextHandTimer = null; }
  clearTurnTimer(r);
  clearWordTimer(r);
  clearWordBotTimer(r);
}
function resetPlayerModes(r) {
  for (const p of r.players) { p.resting = false; p.roundRestHand = null; p.roundRestNumber = null; p.aiPlaying = false; }
}
function startGameType(r, type) {
  type = cleanGameType(type);
  const maxPlayers = maxPlayersForType(type);
  if (r.players.length > maxPlayers) throw Error(`${GAME_NAMES[type]}은(는) 최대 ${maxPlayers}명까지 가능합니다.`);
  if (type === 'dalmuti' && r.players.length < MIN_PLAYERS) throw Error('달무티는 최소 4명이 필요합니다.');
  if ((type === 'choseong' || type === 'wordchain') && r.players.length < 2) throw Error('단어 게임은 사람/봇 합계 2명 이상이 필요합니다.');
  clearGameTimers(r);
  resetPlayerModes(r);
  r.game = null;
  r.wordGame = null;
  r.gameType = type;
  r.selectedGame = type;
  if (type === 'dalmuti') {
    r.game = E.createGame(r.players.map(x => ({ id: x.id, name: x.name, portrait: x.portrait, connected: true })), r.rules);
    afterAction(r);
  } else {
    r.wordGame = W.createGame(type, r.players, { turnLimitMs: WORD_TURN_LIMIT_MS, lives: 3 });
    scheduleWordTimer(r, true);
    scheduleWordBot(r);
    emit(r);
  }
}
function wordPlayerLeft(r, playerId) {
  if (!r.wordGame || !['choseong', 'wordchain'].includes(r.gameType)) return;
  const before = r.wordGame.currentPlayerId;
  W.removePlayer(r.wordGame, playerId);
  if (r.wordGame.status === 'playing' && r.wordGame.currentPlayerId !== before) { scheduleWordTimer(r, true); scheduleWordBot(r); }
  else if (r.wordGame.status !== 'playing') { clearWordTimer(r); clearWordBotTimer(r); }
}
function requireDalmuti(r) {
  if (r.gameType !== 'dalmuti' || !r.game) throw Error('현재 게임은 달무티가 아닙니다.');
  return r.game;
}
function roomBase(code, u) {
  return {
    code, hostId: u.id, players: [u], game: null, wordGame: null, gameType: null, selectedGame: 'dalmuti',
    chat: [], rules: { remainderMode: 'low' }, lowestChatMode: 'pika', botTimer: null, autoTimer: null,
    nextHandTimer: null, turnTimer: null, turnKey: null, turnDeadline: null, wordTimer: null, wordTurnKey: null, wordBotTimer: null, wordBotKey: null
  };
}

const A = {
  'create-room': p => {
    const u = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: cleanName(p.name), portrait: cleanPortrait(p.portrait), connected: true, stream: null, resting: false, aiPlaying: false };
    const r = roomBase(newCode(), u); rooms.set(r.code, r); return { session: session(r, u), state: state(r, u.id) };
  },
  'create-test-room': p => {
    const u = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: cleanName(p.name || '테스터'), portrait: cleanPortrait(p.portrait), connected: true, stream: null, resting: false, aiPlaying: false };
    const r = roomBase(newCode(), u); r.testRoom = true;
    for (let i = 0; i < 3; i++) r.players.push(makeBot(r));
    rooms.set(r.code, r);
    r.selectedGame = 'dalmuti'; startGameType(r, 'dalmuti');
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: '혼자 테스트할 수 있는 4인 달무티 테스트 방입니다. 봇은 자동으로 플레이합니다.', at: Date.now() });
    emit(r); return { session: session(r, u), state: state(r, u.id) };
  },
  'join-room': p => {
    const r = getRoom(p.roomCode), name = cleanName(p.name), existing = r.players.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (r.testRoom) throw Error('테스트 방에는 추가 참가할 수 없습니다.');
    if (existing) {
      if (existing.connected) throw Error('같은 닉네임이 이미 접속 중입니다.');
      existing.token = crypto.randomUUID(); existing.portrait = cleanPortrait(p.portrait || existing.portrait); existing.connected = true;
      afterAction(r); return { session: session(r, existing), state: state(r, existing.id) };
    }
    const maxPlayers = roomMaxPlayers(r);
    if (r.players.length >= maxPlayers) throw Error(`방이 가득 찼습니다. 현재 게임은 최대 ${maxPlayers}명입니다.`);
    const u = { id: crypto.randomUUID(), token: crypto.randomUUID(), name, portrait: cleanPortrait(p.portrait), connected: true, stream: null, resting: false, aiPlaying: false };
    r.players.push(u);
    if (roomStarted(r)) {
      const text = r.gameType === 'dalmuti' ? `${name}님이 입장했습니다. 다음 판부터 최하위 계급 쪽으로 합류합니다.` : `${name}님이 입장했습니다. 현재 게임은 관전하고 다음 게임부터 참가합니다.`;
      r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text, at: Date.now() });
    }
    afterAction(r); return { session: session(r, u), state: state(r, u.id) };
  },
  'reconnect-session': p => { const { r, u } = auth(p); u.connected = true; afterAction(r); return { session: session(r, u), state: state(r, u.id) }; },
  'leave-room': p => {
    const { r, u } = auth(p), name = u.name;
    if (u.stream) { u.stream.end(); u.stream = null; }
    if (r.gameType === 'choseong' || r.gameType === 'wordchain') wordPlayerLeft(r, u.id);
    const gp = r.gameType === 'dalmuti' ? r.game?.players.find(x => x.id === u.id) : null;
    const finished = !!gp && (gp.finished || gp.hand.length === 0);
    removeRoomPlayer(r, u);
    let restarted = false;
    if (gp && !finished && r.game) restarted = restartWithoutPlayer(r, name, u.id); else if (gp) { gp.connected = false; gp.departed = true; }
    if (!r.players.filter(x => !x.bot).length) { clearGameTimers(r); rooms.delete(r.code); return {}; }
    let text;
    if (r.gameType === 'dalmuti' && gp && !finished) text = restarted ? `${name}님이 나가 현재 판을 취소하고 새 판을 시작했습니다.` : `${name}님이 나갔습니다. 인원이 4명 미만이라 로비로 돌아갑니다.`;
    else text = `${name}님이 방을 나갔습니다.`;
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text, at: Date.now() });
    afterAction(r); return {};
  },
  'select-game': p => {
    const { r, u } = auth(p);
    if (u.id !== r.hostId) throw Error('방장만 게임을 선택할 수 있습니다.');
    if (roomStarted(r)) throw Error('게임 중에는 게임 바꾸기를 사용해 주세요.');
    const type = cleanGameType(p.gameType);
    const maxPlayers = maxPlayersForType(type);
    if (r.players.length > maxPlayers) throw Error(`${GAME_NAMES[type]}은(는) 최대 ${maxPlayers}명까지 가능합니다.`);
    r.selectedGame = type;
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `다음 게임이 ${GAME_NAMES[r.selectedGame]}(으)로 선택되었습니다.`, at: Date.now() });
    emit(r); return {};
  },
  'switch-game': p => {
    const { r, u } = auth(p);
    if (u.id !== r.hostId) throw Error('방장만 게임을 바꿀 수 있습니다.');
    const type = cleanGameType(p.gameType);
    startGameType(r, type);
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `방장이 게임을 ${GAME_NAMES[type]}(으)로 변경했습니다.`, at: Date.now() });
    emit(r); return {};
  },
  'update-rules': p => { const { r, u } = auth(p); setRules(r, u, p); afterAction(r); return {}; },
  'set-lowest-chat-mode': p => {
    const { r, u } = auth(p), dalmutiId = currentDalmutiId(r);
    if (r.gameType !== 'dalmuti' || !r.game || u.id !== dalmutiId) throw Error('현재 달무티만 최하위 채팅 옵션을 변경할 수 있습니다.');
    const mode = ['off', 'pika', 'roman'].includes(p.mode) ? p.mode : null;
    if (!mode) throw Error('채팅 옵션이 올바르지 않습니다.');
    r.lowestChatMode = mode;
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `최하위 채팅 옵션: ${{ off:'일반', pika:'피카', roman:'로마자' }[mode]}.`, at: Date.now() });
    afterAction(r); return {};
  },
  'add-bot': p => {
    const { r, u } = auth(p); if (u.id !== r.hostId) throw Error('방장만 봇을 추가할 수 있습니다.'); const maxPlayers = roomMaxPlayers(r); if (r.players.length >= maxPlayers) throw Error(`방이 가득 찼습니다. 현재 게임은 최대 ${maxPlayers}명입니다.`);
    const bot = makeBot(r); r.players.push(bot);
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: roomStarted(r) ? `${bot.name}이 추가되었습니다. 다음 판 또는 다음 게임부터 합류합니다.` : `${bot.name}이 방에 추가되었습니다.`, at: Date.now() });
    afterAction(r); return {};
  },
  'remove-bot': p => {
    const { r, u } = auth(p); if (u.id !== r.hostId) throw Error('방장만 봇을 제거할 수 있습니다.');
    const bot = r.players.find(x => x.id === p.botId && x.bot); if (!bot) throw Error('봇을 찾을 수 없습니다.');
    if (r.gameType === 'choseong' || r.gameType === 'wordchain') wordPlayerLeft(r, bot.id);
    const gp = r.gameType === 'dalmuti' ? r.game?.players.find(x => x.id === bot.id) : null, finished = !!gp && (gp.finished || gp.hand.length === 0), name = bot.name;
    removeRoomPlayer(r, bot); let restarted = false;
    if (gp && !finished && r.game) restarted = restartWithoutPlayer(r, name, bot.id); else if (gp) { gp.connected = false; gp.departed = true; }
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: gp && !finished ? (restarted ? `${name}을 제거해 현재 판을 취소하고 새 판을 시작했습니다.` : `${name}을 제거했습니다. 인원이 4명 미만이라 로비로 돌아갑니다.`) : `${name}을 제거했습니다.`, at: Date.now() });
    afterAction(r); return {};
  },
  'kick-player': p => {
    const { r, u } = auth(p); if (u.id !== r.hostId) throw Error('방장만 강퇴할 수 있습니다.');
    const target = r.players.find(x => x.id === p.targetPlayerId); if (!target) throw Error('대상을 찾을 수 없습니다.'); if (target.id === u.id) throw Error('자기 자신은 강퇴할 수 없습니다.'); if (target.bot) throw Error('봇은 봇 관리 버튼으로 제거해 주세요.');
    const active = isActivePlayer(r, target.id), name = target.name;
    if (r.gameType === 'choseong' || r.gameType === 'wordchain') wordPlayerLeft(r, target.id);
    removeRoomPlayer(r, target, 'kicked', '방장에 의해 강퇴되었습니다.');
    const restarted = r.gameType === 'dalmuti' && active && r.game ? restartWithoutPlayer(r, name, target.id) : false;
    const text = r.gameType === 'dalmuti' && active ? (restarted ? `${name}님을 제외하고 새 판을 시작했습니다.` : `${name}님이 강퇴되었습니다. 인원이 4명 미만이라 로비로 돌아갑니다.`) : `${name}님이 방장에 의해 강퇴되었습니다.`;
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text, at: Date.now() }); afterAction(r); return {};
  },
  'start-game': p => {
    const { r, u } = auth(p); if (u.id !== r.hostId) throw Error('방장만 시작할 수 있습니다.');
    startGameType(r, r.selectedGame || 'dalmuti'); return {};
  },
  'submit-word': p => {
    const { r, u } = auth(p);
    if (!r.wordGame || !['choseong', 'wordchain'].includes(r.gameType)) throw Error('현재 게임은 단어 게임이 아닙니다.');
    const word = W.submit(r.wordGame, u.id, p.word);
    r.chat.push({ id: crypto.randomUUID(), playerId: 'system', name: '시스템', text: `${u.name}: ${word} ✓`, at: Date.now() });
    if (r.wordGame.status === 'playing') { scheduleWordTimer(r, true); scheduleWordBot(r); } else { clearWordTimer(r); clearWordBotTimer(r); }
    emit(r); return {};
  },
  'declare-revolution': p => { const { r, u } = auth(p); E.declareRevolution(requireDalmuti(r), u.id, !!p.greater); afterAction(r); return {}; },
  'decline-revolution': p => { const { r, u } = auth(p); E.declineRevolution(requireDalmuti(r), u.id); afterAction(r); return {}; },
  'tax-return': p => { const { r, u } = auth(p); E.taxReturn(requireDalmuti(r), u.id, p.cardIds); afterAction(r); return {}; },
  'play-cards': p => { const { r, u } = auth(p); E.playCards(requireDalmuti(r), u.id, p.cardIds); afterAction(r); return {}; },
  'pass': p => { const { r, u } = auth(p); E.pass(requireDalmuti(r), u.id); afterAction(r); return {}; },
  'rest-round': p => {
    const { r, u } = auth(p), g = requireDalmuti(r), gp = g.players.find(x => x.id === u.id);
    if (g.phase !== 'play' || !gp || gp.finished) throw Error('지금은 이번 라운드 쉬기를 사용할 수 없습니다.');
    u.roundRestHand = g.handNumber; u.roundRestNumber = g.roundNumber; afterAction(r); return {};
  },
  'toggle-rest': p => { const { r, u } = auth(p); requireDalmuti(r); u.resting = !!p.resting; if (!u.resting) { u.roundRestHand = null; u.roundRestNumber = null; } afterAction(r); return {}; },
  'set-ai-playing': p => { const { r, u } = auth(p); requireDalmuti(r); u.aiPlaying = !!p.enabled; afterAction(r); return {}; },
  'next-hand': p => { const { r, u } = auth(p); startNextHand(r, u.id); return {}; },
  'send-chat': p => {
    const { r, u } = auth(p), raw = cleanMessage(p.message);
    const lowest = r.gameType === 'dalmuti' && r.game ? [...r.game.players].sort((a, b) => b.roleIndex - a.roleIndex)[0]?.id : null;
    let text = raw, masked = false;
    if (lowest === u.id) {
      const mode = r.lowestChatMode || 'pika';
      if (mode === 'pika') { text = pikaMask(raw); masked = true; } else if (mode === 'roman') { text = romanizeKorean(raw); masked = true; }
    }
    r.chat.push({ id: crypto.randomUUID(), playerId: u.id, name: u.name, text, masked, at: Date.now() });
    if (r.chat.length > 80) r.chat.splice(0, r.chat.length - 80);
    afterAction(r); return {};
  }
};

function json(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}
function body(req) {
  return new Promise((ok, no) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } });
    req.on('error', no);
  });
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && u.pathname === '/api/rooms') return json(res, 200, { ok: true, rooms: publicRooms() });
    if (req.method === 'POST' && u.pathname === '/api/action') {
      const p = await body(req), fn = A[p.type];
      if (!fn) throw Error('알 수 없는 요청입니다.');
      return json(res, 200, { ok: true, ...fn(p) });
    }
    if (req.method === 'GET' && u.pathname === '/api/events') {
      const p = Object.fromEntries(u.searchParams), { r, u: pl } = auth(p);
      if (pl.stream) pl.stream.end();
      pl.connected = true;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      pl.stream = res;
      sse(res, 'state', state(r, pl.id));
      req.on('close', () => { if (pl.stream === res) { pl.stream = null; pl.connected = false; emit(r); } });
      return;
    }
    let f = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
    f = path.normalize(f).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(PUBLIC, f);
    if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    json(res, req.method === 'POST' && String(req.url || '').startsWith('/api/action') ? 200 : 400, { ok: false, error: e.message || '오류가 발생했습니다.' });
  }
});
function ips() {
  const a = [];
  for (const xs of Object.values(os.networkInterfaces())) for (const x of xs || []) if (x.family === 'IPv4' && !x.internal) a.push(x.address);
  return a;
}
server.listen(PORT, HOST, () => {
  console.log('\nRealtime Party Game server is running.');
  console.log(`This computer: http://localhost:${PORT}`);
  for (const ip of ips()) console.log(`Other devices: http://${ip}:${PORT}`);
  console.log('\nPress Ctrl+C to stop.\n');
});
