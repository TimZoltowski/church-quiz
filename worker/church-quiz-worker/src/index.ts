export interface Env {
  ROOM: DurableObjectNamespace;
}

type Role = "host" | "player";

type Player = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
};

type Phase = "LOBBY" | "QUESTION_ONLY" | "ANSWERS_OPEN" | "REVEAL" | "LEADERBOARD";

type Question = {
  question: string;
  choices: string[];
  correctIndex: number; // 0..3
};

type BankQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

type BankFile = {
  version: number;
  title: string;
  questions: BankQuestion[];
};

// Import bank JSON (bundled into worker)
import bankJson from "./questions.json";

const BANK: BankFile = bankJson as any;

type RoomState = {
  code: string;
  phase: Phase;
  timerSeconds: number;
  counts: number[]; // [0..3]
  players: Player[];
  question: Question;
  bankIndex: number;

  answers: Record<string, number>;
  gameOver: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function bankToQuestion(q: BankQuestion): Question {
  return {
    question: q.prompt,
    choices: q.choices,
    correctIndex: q.correctIndex,
  };
}

// Fallback if bank is missing
function defaultQuestion(): Question {
  return {
    question: "What did Jesus tell Nicodemus is necessary to enter the kingdom of God?",
    choices: [
      "A person must be born again",
      "A person must try harder",
      "A person must be born into the right family",
      "A person must become more religious",
    ],
    correctIndex: 0,
  };
}

function firstQuestionFromBank(): Question {
  const q = BANK?.questions?.[0];
  return q ? bankToQuestion(q) : defaultQuestion();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: json({}, 204).headers });
    }

    if (url.pathname === "/api/room/create" && req.method === "POST") {
      const code = makeCode();
      const id = env.ROOM.idFromName(code);
      const stub = env.ROOM.get(id);
      // touch the DO so it initializes
      await stub.fetch("https://room/init", { method: "POST" });
      return json({ code });
    }

    const m = url.pathname.match(/^\/api\/room\/([A-Z0-9]{5})\/ws$/);
    if (m) {
      const code = m[1];
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }
      const id = env.ROOM.idFromName(code);
      return env.ROOM.get(id).fetch(req);
    }

    return new Response("Not found", { status: 404 });
  },
};

export class Room {
  state: DurableObjectState;
  room: RoomState;

  sockets = new Map<WebSocket, { role: Role; playerId?: string }>();

  // Per-round: playerId -> idx they picked
  answered = new Map<string, number>();

  // Per-round: once we score, we don’t score again if host re-sends REVEAL
  scoredThisRound = false;

  resetRound() {
      this.room.counts = [0, 0, 0, 0];
      this.room.answers = {};
      this.answered.clear();
      this.scoredThisRound = false;
    }

    advanceQuestionIfPossible() {
      const total = BANK?.questions?.length ?? 0;

      if (total <= 0) {
        this.room.bankIndex = 0;
        this.room.question = defaultQuestion();
        this.room.gameOver = true;
        return;
      }

      // if already at last question, mark game over and do not advance
      if (this.room.bankIndex >= total - 1) {
        this.room.bankIndex = total - 1;
        this.room.question = bankToQuestion(BANK.questions[this.room.bankIndex]);
        this.room.gameOver = true;
        return;
      }

      this.room.bankIndex += 1;
      this.room.question = bankToQuestion(BANK.questions[this.room.bankIndex]);
      this.room.gameOver = false;
    }

  constructor(state: DurableObjectState) {
    this.state = state;

    this.room = {
      code: "",
      phase: "LOBBY",
      timerSeconds: 20,
      counts: [0, 0, 0, 0],
      players: [],
      question: firstQuestionFromBank(),
      bankIndex: 0,
      answers: {},
      gameOver: false,
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.hostname === "room" && url.pathname === "/init" && req.method === "POST") {
      const stored = await this.state.storage.get<RoomState>("room");
      if (stored) this.room = stored;

      // Safety: if older rooms don’t have bankIndex/question yet
      if (typeof (this.room as any).bankIndex !== "number") (this.room as any).bankIndex = 0;
      if (!this.room.question) this.room.question = firstQuestionFromBank();
      if (!(this.room as any).answers) (this.room as any).answers = {};
      if (typeof (this.room as any).gameOver !== "boolean") (this.room as any).gameOver = false;

      await this.state.storage.put("room", this.room);
      return new Response("ok");
    }

    if (req.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();

      const role = (url.searchParams.get("role") || "") as Role;
      const name = (url.searchParams.get("name") || "").trim();

      if (role !== "host" && role !== "player") {
        server.close(1008, "Invalid role");
        return new Response(null, { status: 101, webSocket: client });
      }
      if (role === "player" && !name) {
        server.close(1008, "Name required");
        return new Response(null, { status: 101, webSocket: client });
      }

      // Ensure room code is set from the path
      const mm = url.pathname.match(/^\/api\/room\/([A-Z0-9]{5})\/ws$/);
      const code = mm?.[1] || "";

      // Load persisted state first
      const stored = await this.state.storage.get<RoomState>("room");
      if (stored) this.room = stored;

      if (!this.room.code) this.room.code = code;

      let playerId: string | undefined;

      if (role === "player") {
        playerId = crypto.randomUUID();
        this.room.players.push({ id: playerId, name, score: 0, connected: true });
        await this.persist();
      }

      this.sockets.set(server, { role, playerId });

      server.addEventListener("message", async (evt) => {
        try {
          const msg = JSON.parse(String(evt.data || "{}"));
          await this.onMessage(server, msg);
        } catch {
          // ignore
        }
      });

      server.addEventListener("close", async () => {
        const meta = this.sockets.get(server);
        this.sockets.delete(server);

        if (meta?.playerId) {
          const p = this.room.players.find((x) => x.id === meta.playerId);
          if (p) p.connected = false;
          await this.persist();
          this.broadcast();
        }
      });

      this.send(server);
      this.broadcast();

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async onMessage(ws: WebSocket, msg: any) {
    const meta = this.sockets.get(ws);
    if (!meta) return;

    // Host: timer
    if (meta.role === "host" && msg?.type === "SET_TIMER") {
      const n = Number(msg.timerSeconds);
      if ([10, 20, 30, 45, 60].includes(n)) {
        this.room.timerSeconds = n;
        await this.persist();
        this.broadcast();
      }
      return;
    }

    if (meta.role === "host" && msg?.type === "RESET_GAME") {
        this.room.phase = "LOBBY";
        this.room.bankIndex = 0;
        this.room.question = firstQuestionFromBank();
        this.room.gameOver = false;

        this.resetRound();

        // reset scores but keep the same joined players
        for (const p of this.room.players) p.score = 0;

        await this.persist();
        this.broadcast();
        return;
      }

    // Host: advance question in bank
    if (meta.role === "host" && msg?.type === "NEXT_QUESTION") {
      const total = BANK?.questions?.length ?? 0;
      if (total > 0) {
        this.room.bankIndex = (this.room.bankIndex + 1) % total;
        const next = BANK.questions[this.room.bankIndex];
        this.room.question = bankToQuestion(next);
      } else {
        this.room.question = defaultQuestion();
        this.room.bankIndex = 0;
      }

      // Reset per-question round state safely
      this.room.counts = [0, 0, 0, 0];
      this.room.answers = {};
      this.answered.clear();
      this.scoredThisRound = false;

      await this.persist();
      this.broadcast();
      return;
    }

    // Host: phase control
    if (meta.role === "host" && msg?.type === "SET_PHASE") {
      const nextPhase = String(msg.phase || "") as Phase;

      if (!["LOBBY", "QUESTION_ONLY", "ANSWERS_OPEN", "REVEAL", "LEADERBOARD"].includes(nextPhase)) return;

      const prevPhase = this.room.phase;
      this.room.phase = nextPhase;

      // When entering answer window, reset round data
      if (nextPhase === "ANSWERS_OPEN") {
        this.resetRound();
      }

      // On reveal, score once
      if (nextPhase === "REVEAL") {
        await this.scoreRoundIfNeeded();
      }

      // When host goes from LEADERBOARD -> QUESTION_ONLY, advance question (unless game over)
      if (prevPhase === "LEADERBOARD" && nextPhase === "QUESTION_ONLY") {
        if (!this.room.gameOver) {
          this.advanceQuestionIfPossible();
          this.resetRound();
        }
      }

      // If we enter LEADERBOARD while on last question, mark game over
      if (nextPhase === "LEADERBOARD") {
        const total = BANK?.questions?.length ?? 0;
        if (total > 0 && this.room.bankIndex >= total - 1) {
          this.room.gameOver = true;
        }
      }

      await this.persist();
      this.broadcast();
      return;
    }

    // Player answers
    if (meta.role === "player" && msg?.type === "ANSWER") {
      if (!meta.playerId) return;
      if (this.room.phase !== "ANSWERS_OPEN") return;

      const idx = Number(msg.idx);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) return;

      // Only one answer per player per question window
      if (this.room.answers[meta.playerId] !== undefined) return; // NEW: persisted lock

      this.room.answers[meta.playerId] = idx; // NEW: persist
      this.answered.set(meta.playerId, idx);  // optional, keep if you want
      this.room.counts[idx] = (this.room.counts[idx] || 0) + 1;

      await this.persist();
      this.broadcast();
      return;
    }

    if (msg?.type === "GET_STATE") {
      this.send(ws);
      return;
    }
  }

  async scoreRoundIfNeeded() {
  if (this.scoredThisRound) return;

  const correct = this.room.question.correctIndex;

  for (const [playerId, idx] of Object.entries(this.room.answers)) {
    const picked = Number(idx);
    if (picked !== correct) continue;

    const p = this.room.players.find((x) => x.id === playerId);
    if (!p) continue;

    p.score += 1000;
  }

  this.scoredThisRound = true;
}

  snapshot() {
    const playersConnected = this.room.players.filter((p) => p.connected);

    const top5 = [...playersConnected]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((p) => ({ name: p.name, score: p.score }));

    return {
      code: this.room.code,
      phase: this.room.phase,
      timerSeconds: this.room.timerSeconds,
      counts: this.room.counts,
      playersCount: playersConnected.length,
      top5,
      players: playersConnected.map((p) => ({ name: p.name, score: p.score })),

      // Now driven by bank:
      question: this.room.question.question,
      choices: this.room.question.choices,
      correctIndex: this.room.question.correctIndex,
      bankIndex: this.room.bankIndex,

      totalQuestions: BANK?.questions?.length ?? 0,
      gameOver: this.room.gameOver,
    };
  }

  send(ws: WebSocket) {
    const meta = this.sockets.get(ws);
    const state: any = this.snapshot();

    if (meta?.role === "player" && meta.playerId) {
      const me = this.room.players.find((p) => p.id === meta.playerId);
      state.me = me ? { name: me.name, score: me.score } : { name: "", score: 0 };
    }

    ws.send(JSON.stringify({ type: "STATE", state }));
  }

  broadcast() {
    for (const [ws] of this.sockets) {
      try {
        this.send(ws);
      } catch {
        // ignore
      }
    }
  }

  async persist() {
    await this.state.storage.put("room", this.room);
  }
}