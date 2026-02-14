import { createRoom, roomWsUrl } from "../lib/api.js";
import { useState, useEffect } from "react";
import { ANSWERS } from "../constants/answerMap.js";
import { AnswerTile } from "../components/AnswerGrid.jsx";

export default function Host() {
  // IMPORTANT: phase/timer/counts are treated as server-truth once WS is connected.
  const [phase, setPhase] = useState("LOBBY"); // LOBBY | QUESTION_ONLY | ANSWERS_OPEN | REVEAL | LEADERBOARD
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [roomCode, setRoomCode] = useState("");
  const [playersCount, setPlayersCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [ws, setWs] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected | connecting | connected
  const [top5, setTop5] = useState([]);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [bankIndex, setBankIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const [roundEndsAt, setRoundEndsAt] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
  if (phase !== "ANSWERS_OPEN" || !roundEndsAt) return;

  const tick = () => setNow(Date.now());

  // Kick off an initial tick ASAP (not synchronously in the effect body)
  queueMicrotask(tick);

  const id = setInterval(tick, 250);
  return () => clearInterval(id);
}, [roundEndsAt, phase]);

  async function startRoom() {
    try {
      setWsStatus("connecting");

      const { code } = await createRoom();
      setRoomCode(code);

      const socket = new WebSocket(roomWsUrl(code, "host"));

      socket.onopen = () => {
        setWsStatus("connected");
        try {
          socket.send(JSON.stringify({ type: "HELLO", role: "host" }));
          socket.send(JSON.stringify({ type: "GET_STATE" }));
        } catch {
          // ignore
        }
      };

      socket.onclose = () => setWsStatus("disconnected");
      socket.onerror = () => setWsStatus("disconnected");

      socket.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "STATE") {
            // Treat server as source of truth (prevents UI drift).
            setPhase(msg.state.phase ?? "LOBBY");
            setTimerSeconds(msg.state.timerSeconds ?? 20);
            setPlayersCount(msg.state.playersCount ?? 0);
            setPlayers(msg.state.players ?? []);
            setCounts(Array.isArray(msg.state.counts) ? msg.state.counts : [0, 0, 0, 0]);
            setTop5(Array.isArray(msg.state.top5) ? msg.state.top5 : []);
            setQuestion(msg.state.question ?? "");
            setChoices(Array.isArray(msg.state.choices) ? msg.state.choices : ["", "", "", ""]);
            setCorrectIndex(Number.isInteger(msg.state.correctIndex) ? msg.state.correctIndex : 0);
            setTop5(Array.isArray(msg.state.top5) ? msg.state.top5 : []);
            setBankIndex(Number.isInteger(msg.state.bankIndex) ? msg.state.bankIndex : 0);
            setTotalQuestions(Number.isInteger(msg.state.totalQuestions) ? msg.state.totalQuestions : 0);
            setGameOver(!!msg.state.gameOver);

            setRoundEndsAt(
              typeof msg.state.roundEndsAt === "number" ? msg.state.roundEndsAt : null
            );

            // Helpful when debugging counts
            // console.log("STATE:", msg.state);
          }
        } catch {
          // ignore
        }
      };

      setWs(socket);
    } catch {
      setWsStatus("disconnected");
      alert("Could not create room. Try again.");
    }
  }

  function send(type, payload = {}) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ type, ...payload }));
    } catch {
      // ignore
    }
  }

  const nextPhase = () => {
    if (phase === "LEADERBOARD") {
      if (gameOver) return; // button is already disabled, but safe
      send("SET_PHASE", { phase: "QUESTION_ONLY" });
      return;
    }

    const order = ["LOBBY", "QUESTION_ONLY", "ANSWERS_OPEN", "REVEAL", "LEADERBOARD"];
    const idx = order.indexOf(phase);
    const next = order[idx + 1] || "LOBBY";
    send("SET_PHASE", { phase: next });
  };

  const remaining =
  phase === "ANSWERS_OPEN" && roundEndsAt
    ? Math.max(0, Math.ceil((roundEndsAt - now) / 1000))
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.brand}>Church Quiz</div>

        <div style={styles.code}>
          Room: <span style={{ letterSpacing: 2 }}>{roomCode || "—"}</span>
          <span style={{ marginLeft: 12, opacity: 0.85 }}>Players: {playersCount}</span>
          <span style={{ marginLeft: 12, opacity: 0.85 }}>
            Q: {totalQuestions ? bankIndex + 1 : 0}/{totalQuestions || "—"}
          </span>
          <span style={{ marginLeft: 12, opacity: 0.75, fontSize: 14 }}>({wsStatus})</span>
        </div>

        <div style={styles.controls}>
          {!roomCode && (
            <button onClick={startRoom} style={styles.btn}>
              Create Room
            </button>
          )}

          <select
            value={timerSeconds}
            onChange={(e) => {
              const n = Number(e.target.value);
              setTimerSeconds(n); // local UI immediately reflects selection
              send("SET_TIMER", { timerSeconds: n }); // server persists + rebroadcasts
            }}
            style={styles.select}
            disabled={!roomCode}
          >
            {[10, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>

          <button
            onClick={nextPhase}
            style={styles.btn}
            disabled={!roomCode || (phase === "LEADERBOARD" && gameOver)}
          >
            Next
          </button>

          {phase === "LEADERBOARD" && gameOver && (
            <button
              onClick={() => send("RESET_GAME")}
              style={{ ...styles.btn, background: "#F5F7FA", color: "#0B1F3A" }}
              disabled={!roomCode}
            >
              New Game
            </button>
          )}
        </div>
      </div>

      <div style={styles.stageWrap}>
        <div style={styles.stage43}>
          {phase === "LOBBY" ? (
            <div style={styles.lobby}>
              <div style={styles.lobbyTitle}>Players Joined</div>
              <div style={styles.lobbyCount}>{playersCount}</div>

              <div style={styles.lobbyList}>
                {players.length === 0 ? (
                  <div style={{ opacity: 0.85, fontWeight: 800 }}>Waiting for players…</div>
                ) : (
                  players.map((p) => (
                    <div key={p.name} style={styles.lobbyChip}>
                      {p.name}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => send("SET_PHASE", { phase: "QUESTION_ONLY" })}
                style={{
                  ...styles.btn,
                  fontSize: 18,
                  padding: "14px 18px",
                  marginTop: 18,
                }}
                disabled={!roomCode}
              >
                Start Game
              </button>
            </div>
          ) : (
            <>
              <div style={styles.question}>{question}</div>

              {phase !== "QUESTION_ONLY" && phase !== "LEADERBOARD" && (
                <>
                  <div style={styles.timerPill}>
                    {phase === "ANSWERS_OPEN"
                      ? `Time: ${remaining ?? timerSeconds}s`
                      : "Time Up"}
                  </div>

                  <div style={styles.grid}>
                    {ANSWERS.map((a) => {
                      const highlight =
                        phase === "REVEAL"
                          ? a.idx === correctIndex
                            ? "correct"
                            : "wrong"
                          : "none";

                      return (
                        <AnswerTile
                          key={a.idx}
                          shape={a.shape}
                          title={choices[a.idx]}
                          subtitle={a.label}
                          variant="host"
                          highlight={highlight}
                          count={phase === "REVEAL" ? (counts?.[a.idx] ?? 0) : undefined}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {phase === "LEADERBOARD" && (
                <div style={styles.leaderboard}>
                  <div style={styles.lbTitle}>
                    {gameOver ? "Final Leaderboard (Top 5)" : "Leaderboard (Top 5)"}
                  </div>
                  <div style={styles.lbList}>
                    {top5.length === 0 ? (
                      <div style={{ opacity: 0.85, fontWeight: 800 }}>No scores yet…</div>
                    ) : (
                      top5.map((p, i) => (
                        <div key={`${p.name}-${i}`} style={styles.lbRow}>
                          <div style={styles.lbRank}>{i + 1}</div>
                          <div style={styles.lbName}>{p.name}</div>
                          <div style={styles.lbScore}>{p.score}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={styles.lbHint}>
                    {gameOver
                      ? "Game over. Click New Game to restart."
                      : "Next: question-only screen again."}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0B1F3A",
    color: "#F5F7FA",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.15)",
  },
  brand: { fontWeight: 900, fontSize: 18, letterSpacing: 0.4 },
  code: { fontWeight: 800, fontSize: 16, opacity: 0.95 },
  controls: { display: "flex", gap: 10, alignItems: "center" },
  select: {
    borderRadius: 10,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#F5F7FA",
    fontWeight: 800,
  },
  btn: {
    borderRadius: 10,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#D4AF37",
    color: "#0B1F3A",
    fontWeight: 900,
    cursor: "pointer",
  },
  stageWrap: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    padding: 0,
  },
  stage43: {
    width: "min(100vw, calc(100vh * 4 / 3))",
    height: "min(100vh, calc(100vw * 3 / 4))",
    borderRadius: 0,
    padding: 26,
    background: "rgba(255,255,255,0.05)",
    border: "none",
    boxShadow: "none",
    position: "relative",
    overflow: "hidden",
  },
  question: {
    fontSize: 46,
    fontWeight: 950,
    lineHeight: 1.08,
    letterSpacing: 0.2,
    marginBottom: 14,
    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
  },
  timerPill: {
    position: "absolute",
    top: 18,
    right: 18,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.16)",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginTop: 12,
  },
  leaderboard: {
    marginTop: 20,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 18,
    height: "calc(100% - 120px)",
    display: "flex",
    flexDirection: "column",
  },
  lbTitle: { fontSize: 40, fontWeight: 950, marginBottom: 10 },
  lbList: { display: "grid", gap: 10, marginTop: 8, flex: 1 },
  lbRow: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 140px",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  lbRank: { fontSize: 30, fontWeight: 950 },
  lbName: { fontSize: 30, fontWeight: 900 },
  lbScore: { fontSize: 30, fontWeight: 950, textAlign: "right" },
  lbHint: { marginTop: 10, opacity: 0.85, fontWeight: 700 },

  lobby: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 10,
    textAlign: "center",
  },
  lobbyTitle: { fontSize: 26, fontWeight: 950, opacity: 0.95 },
  lobbyCount: { fontSize: 64, fontWeight: 950, lineHeight: 1 },
  lobbyList: {
    marginTop: 10,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    maxWidth: "95%",
  },
  lobbyChip: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    fontWeight: 900,
  },
};