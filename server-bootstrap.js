'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const filename = path.join(__dirname, 'server.js');
let source = fs.readFileSync(filename, 'utf8');

function replaceOnce(label, from, to) {
  if (!source.includes(from)) throw Error(`[server-bootstrap] patch target not found: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  'word constants',
  "const WORD_TURN_LIMIT_MS = 15000;",
  "const WORD_TURN_LIMIT_MS = 15000;\nconst WORD_AUTO_RESTART_MS = 8000;\nconst ROOM_IDLE_MS = 5 * 60 * 1000;\nconst WORD_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);"
);

replaceOnce(
  'difficulty validator',
  "function cleanGameType(v) {\n  const type = String(v || '');\n  if (!GAME_TYPES.has(type)) throw Error('지원하지 않는 게임입니다.');\n  return type;\n}",
  "function cleanGameType(v) {\n  const type = String(v || '');\n  if (!GAME_TYPES.has(type)) throw Error('지원하지 않는 게임입니다.');\n  return type;\n}\nfunction cleanWordDifficulty(v) {\n  const difficulty = String(v || 'normal');\n  if (!WORD_DIFFICULTIES.has(difficulty)) throw Error('초성게임 난이도가 올바르지 않습니다.');\n  return difficulty;\n}"
);

replaceOnce(
  'human activity auth',
  "function auth(p) {\n  const r = getRoom(p.roomCode);\n  const u = r.players.find(x => x.id === p.playerId && x.token === p.reconnectToken);\n  if (!u) throw Error('재접속 정보가 올바르지 않습니다.');\n  return { r, u };\n}",
  "function auth(p) {\n  const r = getRoom(p.roomCode);\n  const u = r.players.find(x => x.id === p.playerId && x.token === p.reconnectToken);\n  if (!u) throw Error('재접속 정보가 올바르지 않습니다.');\n  if (!u.bot) r.lastHumanActivityAt = Date.now();\n  return { r, u };\n}"
);

replaceOnce(
  'room state word settings',
  "      selectedGame: r.selectedGame || 'dalmuti',\n      gameType: started ? r.gameType : null,",
  "      selectedGame: r.selectedGame || 'dalmuti',\n      wordDifficulty: r.wordDifficulty || 'normal',\n      wordAutoRestartAt: r.wordAutoRestartAt || null,\n      gameType: started ? r.gameType : null,"
);

replaceOnce(
  'public room details',
  "function publicRooms() {\n  return [...rooms.values()].filter(r => r.players.length && !r.testRoom).map(r => ({\n    code: r.code,\n    count: r.players.length,\n    maxPlayers: roomMaxPlayers(r),\n    started: roomStarted(r),\n    gameType: roomStarted(r) ? r.gameType : r.selectedGame,\n    gameName: GAME_NAMES[roomStarted(r) ? r.gameType : r.selectedGame] || '게임',\n    joinable: r.players.length < roomMaxPlayers(r)\n  })).sort((a, b) => Number(a.started) - Number(b.started) || b.count - a.count || a.code.localeCompare(b.code));\n}",
  "function publicRooms() {\n  return [...rooms.values()].filter(r => r.players.length && !r.testRoom).map(r => ({\n    code: r.code,\n    count: r.players.length,\n    maxPlayers: roomMaxPlayers(r),\n    started: roomStarted(r),\n    gameType: roomStarted(r) ? r.gameType : r.selectedGame,\n    gameName: GAME_NAMES[roomStarted(r) ? r.gameType : r.selectedGame] || '게임',\n    humanNames: r.players.filter(p => !p.bot).map(p => p.name),\n    botCount: r.players.filter(p => p.bot).length,\n    joinable: r.players.length < roomMaxPlayers(r)\n  })).sort((a, b) => Number(a.started) - Number(b.started) || b.count - a.count || a.code.localeCompare(b.code));\n}"
);

replaceOnce(
  'schedule restart on emit',
  "function emit(r) {\n",
  "function emit(r) {\n  r.lastHumanActivityAt = Date.now();\n  scheduleWordRestart(r);\n"
);

replaceOnce(
  'word restart scheduler',
  "function scheduleWordBot(r) {",
  "function scheduleWordRestart(r) {\n  const g = r.wordGame;\n  const wordType = r.gameType === 'choseong' || r.gameType === 'wordchain';\n  if (!wordType || !g || g.status !== 'finished' || r.players.length < 2) {\n    if (r.wordRestartTimer) { clearTimeout(r.wordRestartTimer); r.wordRestartTimer = null; }\n    r.wordAutoRestartAt = null;\n    return;\n  }\n  if (r.wordRestartTimer) return;\n  const type = r.gameType;\n  r.wordAutoRestartAt = Date.now() + WORD_AUTO_RESTART_MS;\n  r.wordRestartTimer = setTimeout(() => {\n    r.wordRestartTimer = null;\n    r.wordAutoRestartAt = null;\n    if (!rooms.has(r.code) || r.gameType !== type || r.wordGame?.status !== 'finished' || r.players.length < 2) return;\n    startGameType(r, type);\n  }, WORD_AUTO_RESTART_MS);\n}\nfunction scheduleWordBot(r) {"
);

replaceOnce(
  'bot reveal wait',
  "  const delay = 1000 + Math.floor(Math.random() * 3001);",
  "  const revealWait = Math.max(0, Number(g.reveal?.until || 0) - Date.now());\n  const delay = revealWait + 1000 + Math.floor(Math.random() * 3001);"
);

replaceOnce(
  'clear word restart timer',
  "function clearGameTimers(r) {\n  if (r.botTimer) { clearTimeout(r.botTimer); r.botTimer = null; }",
  "function clearGameTimers(r) {\n  if (r.wordRestartTimer) { clearTimeout(r.wordRestartTimer); r.wordRestartTimer = null; }\n  r.wordAutoRestartAt = null;\n  if (r.botTimer) { clearTimeout(r.botTimer); r.botTimer = null; }"
);

replaceOnce(
  'word difficulty on game creation',
  "    r.wordGame = W.createGame(type, r.players, { turnLimitMs: WORD_TURN_LIMIT_MS, lives: 3 });",
  "    r.wordGame = W.createGame(type, r.players, { turnLimitMs: WORD_TURN_LIMIT_MS, lives: 3, difficulty: r.wordDifficulty || 'normal' });"
);

replaceOnce(
  'room lifecycle fields',
  "    nextHandTimer: null, turnTimer: null, turnKey: null, turnDeadline: null, wordTimer: null, wordTurnKey: null, wordBotTimer: null, wordBotKey: null",
  "    nextHandTimer: null, turnTimer: null, turnKey: null, turnDeadline: null, wordTimer: null, wordTurnKey: null, wordBotTimer: null, wordBotKey: null,\n    wordDifficulty: 'normal', wordRestartTimer: null, wordAutoRestartAt: null, lastHumanActivityAt: Date.now()"
);

replaceOnce(
  'join activity',
  "    const r = getRoom(p.roomCode), name = cleanName(p.name), existing = r.players.find(x => x.name.toLowerCase() === name.toLowerCase());",
  "    const r = getRoom(p.roomCode), name = cleanName(p.name), existing = r.players.find(x => x.name.toLowerCase() === name.toLowerCase());\n    r.lastHumanActivityAt = Date.now();"
);

replaceOnce(
  'difficulty action',
  "  'start-game': p => {",
  "  'set-word-difficulty': p => {\n    const { r, u } = auth(p);\n    if (u.id !== r.hostId) throw Error('방장만 초성게임 난이도를 변경할 수 있습니다.');\n    r.wordDifficulty = cleanWordDifficulty(p.difficulty);\n    emit(r); return {};\n  },\n  'start-game': p => {"
);

replaceOnce(
  'idle room cleanup',
  "const server = http.createServer(async (req, res) => {",
  "const idleRoomSweep = setInterval(() => {\n  const now = Date.now();\n  for (const r of [...rooms.values()]) {\n    if (now - Number(r.lastHumanActivityAt || now) < ROOM_IDLE_MS) continue;\n    clearGameTimers(r);\n    for (const p of r.players) {\n      if (!p.stream) continue;\n      try { sse(p.stream, 'kicked', { message: '5분 동안 활동이 없어 방이 자동으로 종료되었습니다.' }); } catch {}\n      try { p.stream.end(); } catch {}\n      p.stream = null;\n    }\n    rooms.delete(r.code);\n  }\n}, 60_000);\nif (typeof idleRoomSweep.unref === 'function') idleRoomSweep.unref();\n\nconst server = http.createServer(async (req, res) => {"
);

const patched = new Module(filename, module);
patched.filename = filename;
patched.paths = Module._nodeModulePaths(__dirname);
patched._compile(source, filename);
