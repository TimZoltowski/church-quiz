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

type RoomState = {
  code: string;
  phase: "LOBBY" | "QUESTION_ONLY" | "ANSWERS_OPEN" | "REVEAL" | "LEADERBOARD";
  timerSeconds: number;
  counts: number[]; // [0..3]
  players: Player[];
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: json({}, 204).headers });

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

  constructor(state: DurableObjectState) {
    this.state = state;
    this.room = {
      code: "",
      phase: "LOBBY",
      timerSeconds: 20,
      counts: [0, 0, 0, 0],
      players: [],
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.hostname === "room" && url.pathname === "/init" && req.method === "POST") {
      // idempotent init
      const stored = await this.state.storage.get<RoomState>("room");
      if (stored) this.room = stored;
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
      if (!this.room.code) this.room.code = code;

      // Load persisted state
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
        } catch {}
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

      // Send initial state to new connection, then broadcast roster update
      this.send(server);
      this.broadcast();

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async onMessage(ws: WebSocket, msg: any) {
    const meta = this.sockets.get(ws);
    if (!meta) return;

    // Host control messages (we'll expand these next)
    if (meta.role === "host" && msg?.type === "SET_TIMER") {
      const n = Number(msg.timerSeconds);
      if ([10, 20, 30, 45, 60].includes(n)) this.room.timerSeconds = n;
      await this.persist();
      this.broadcast();
      return;
    }

    if (meta.role === "host" && msg?.type === "SET_PHASE") {
      const phase = msg.phase;
      if (["LOBBY","QUESTION_ONLY","ANSWERS_OPEN","REVEAL","LEADERBOARD"].includes(phase)) {
        this.room.phase = phase;
        await this.persist();
        this.broadcast();
      }
      return;
    }
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
    };
  }

  send(ws: WebSocket) {
    ws.send(JSON.stringify({ type: "STATE", state: this.snapshot() }));
  }

  broadcast() {
    for (const [ws] of this.sockets) {
      try { this.send(ws); } catch {}
    }
  }

  async persist() {
    await this.state.storage.put("room", this.room);
  }
}