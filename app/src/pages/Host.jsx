import { createRoom, roomWsUrl } from "../lib/api.js";
import { useMemo, useState } from "react";
import { ANSWERS } from "../constants/answerMap.js";
import { AnswerTile } from "../components/AnswerGrid.jsx";

export default function Host() {
  const [phase, setPhase] = useState("LOBBY"); // LOBBY | QUESTION_ONLY | ANSWERS_OPEN | REVEAL | LEADERBOARD
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [roomCode, setRoomCode] = useState("");
  const [playersCount, setPlayersCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [ws, setWs] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected | connecting | connected

  const sample = useMemo(
    () => ({
      question:
        "What did Jesus tell Nicodemus is necessary to enter the kingdom of God?",
      choices: [
        "A person must be born again",
        "A person must try harder",
        "A person must be born into the right family",
        "A person must become more religious",
      ],
      correctIndex: 0,
      counts: [9, 3, 1, 2],
      top5: [
        { name: "James", score: 1850 },
        { name: "Mike", score: 1700 },
        { name: "Andre", score: 1600 },
        { name: "Chris", score: 1500 },
        { name: "Derrick", score: 1400 },
      ],
    }),
    []
  );

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
            setPlayersCount(msg.state.playersCount ?? 0);
            setPlayers(msg.state.players ?? []);
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
    ws.send(JSON.stringify({ type, ...payload }));
  }

  const nextPhase = () => {
    const order = ["LOBBY", "QUESTION_ONLY", "ANSWERS_OPEN", "REVEAL", "LEADERBOARD"];
    const idx = order.indexOf(phase);
    const next = order[(idx + 1) % order.length];
    setPhase(next);
    send("SET_PHASE", { phase: next });
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.brand}>Church Quiz</div>

        <div style={styles.code}>
          Room: <span style={{ letterSpacing: 2 }}>{roomCode || "—"}</span>
          <span style={{ marginLeft: 12, opacity: 0.85 }}>
            Players: {playersCount}
          </span>
          <span style={{ marginLeft: 12, opacity: 0.75, fontSize: 14 }}>
            ({wsStatus})
          </span>
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
              setTimerSeconds(n);
              send("SET_TIMER", { timerSeconds: n });
            }}
            style={styles.select}
          >
            {[10, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>

          <button onClick={nextPhase} style={styles.btn}>
            Next
          </button>
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
                  <div style={{ opacity: 0.85, fontWeight: 800 }}>
                    Waiting for players…
                  </div>
                ) : (
                  players.map((p) => (
                    <div key={p.name} style={styles.lobbyChip}>
                      {p.name}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setPhase("QUESTION_ONLY");
                  send("SET_PHASE", { phase: "QUESTION_ONLY" });
                }}
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
              <div style={styles.question}>{sample.question}</div>

              {phase !== "QUESTION_ONLY" && phase !== "LEADERBOARD" && (
                <>
                  <div style={styles.timerPill}>
                    {phase === "ANSWERS_OPEN" ? `Time: ${timerSeconds}s` : "Time Up"}
                  </div>

                  <div style={styles.grid}>
                    {ANSWERS.map((a) => {
                      const highlight =
                        phase === "REVEAL"
                          ? a.idx === sample.correctIndex
                            ? "correct"
                            : "wrong"
                          : "none";

                      return (
                        <AnswerTile
                          key={a.idx}
                          shape={a.shape}
                          title={sample.choices[a.idx]}
                          subtitle={a.label}
                          variant="host"
                          highlight={highlight}
                          count={phase === "REVEAL" ? sample.counts[a.idx] : undefined}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {phase === "LEADERBOARD" && (
                <div style={styles.leaderboard}>
                  <div style={styles.lbTitle}>Leaderboard (Top 5)</div>
                  <div style={styles.lbList}>
                    {sample.top5.map((p, i) => (
                      <div key={p.name} style={styles.lbRow}>
                        <div style={styles.lbRank}>{i + 1}</div>
                        <div style={styles.lbName}>{p.name}</div>
                        <div style={styles.lbScore}>{p.score}</div>
                      </div>
                    ))}
                  </div>
                  <div style={styles.lbHint}>Next: question-only screen again.</div>
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