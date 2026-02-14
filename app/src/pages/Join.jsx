import { useEffect, useRef, useState } from "react";
import { ANSWERS } from "../constants/answerMap.js";
import { AnswerTile } from "../components/AnswerGrid.jsx";
import { roomWsUrl } from "../lib/api.js";

export default function Join() {
  const [joined, setJoined] = useState(false);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState("LOBBY"); // LOBBY | QUESTION_ONLY | ANSWERS_OPEN | REVEAL | LEADERBOARD
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const wsRef = useRef(null);
  const prevPhaseRef = useRef("LOBBY");
  const [score, setScore] = useState(0);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const onJoin = (e) => {
    e.preventDefault();
    const nm = name.trim();
    const cd = code.trim().toUpperCase();
    if (!nm || !cd) return;

    // close any previous socket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    const socket = new WebSocket(roomWsUrl(cd, "player", nm));
    wsRef.current = socket;

    socket.onopen = () => {
  // Tell the server who we are (so it can count us)
  try {
    socket.send(JSON.stringify({ type: "HELLO", role: "player", name: nm }));
  } catch {
    // ignore
  }

  setJoined(true);
  setLocked(false);
};

    socket.onmessage = (evt) => {
  try {
    const msg = JSON.parse(evt.data);
    if (msg.type === "STATE") {
      const nextPhase = msg.state.phase ?? "LOBBY";
      setPhase(nextPhase);
      setScore(msg.state?.me?.score ?? 0);

      const prev = prevPhaseRef.current;

      // Only unlock when we ENTER answers-open
      if (prev !== nextPhase && nextPhase === "ANSWERS_OPEN") {
        setLocked(false);
      }

      // Optionally lock when reveal starts
      if (prev !== nextPhase && nextPhase === "REVEAL") {
        setLocked(true);
      }

      prevPhaseRef.current = nextPhase;
    }

    const newPhase = msg.state?.phase ?? "LOBBY";

    // Only react when the phase CHANGES (prevents "unlocking" on every broadcast)
    if (newPhase !== prevPhaseRef.current) {
      if (newPhase === "ANSWERS_OPEN") {
        setLocked(false); // new question window
      }
      if (newPhase === "REVEAL") {
        setLocked(true); // optional: force lock on reveal
      }
      prevPhaseRef.current = newPhase;
    }

    setPhase(newPhase);
  } catch {
    // ignore
  }
};

    socket.onclose = () => {
      // Optional: if the socket closes, return to join screen
      // setJoined(false);
      console.log("WS closed");
    };

    socket.onerror = () => {
      alert("Could not connect to the room. Check the code and try again.");
    };
  };

  const pick = (idx) => {
  if (locked) return;
  setLocked(true);

  if (wsRef.current?.readyState === 1) {
    try {
      wsRef.current.send(JSON.stringify({ type: "ANSWER", idx }));
    } catch {
      // ignore
    }
  }
};

  if (!joined) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Join Game</h1>
          <form onSubmit={onJoin} style={{ display: "grid", gap: 10 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              style={styles.input}
              maxLength={6}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={styles.input}
              maxLength={20}
            />
            <button type="submit" style={styles.btn}>
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
  <div style={styles.phoneWrap}>
    <div style={styles.phoneTop}>
      <div style={{ fontWeight: 900 }}>{name}</div>
      <div style={{ opacity: 0.85, fontWeight: 800 }}>
        Room {code} · {score} pts
      </div>
      
    </div>

    {phase === "ANSWERS_OPEN" ? (
      <>
        <div style={styles.grid}>
          {ANSWERS.map((a) => (
            <button
              key={a.idx}
              onClick={() => pick(a.idx)}
              disabled={locked}
              style={styles.tileBtn}
            >
              <AnswerTile shape={a.shape} variant="phone" />
            </button>
          ))}
        </div>

        <div style={styles.bottom}>
          {!locked ? "Tap your answer (color + shape)" : "Answer locked ✅"}
        </div>
      </>
    ) : (
      <div style={styles.waiting}>
  <div style={styles.waitTitle}>
    {phase === "LOBBY"
      ? "Waiting…"
      : phase === "QUESTION_ONLY"
      ? "Question is on the screen."
      : phase === "REVEAL"
      ? "Answer revealed."
      : "Waiting…"}
  </div>

  <div style={styles.waitSub}>
    {phase === "LOBBY"
      ? "Host is getting the game ready."
      : phase === "QUESTION_ONLY"
      ? "Get ready to answer when the choices appear."
      : phase === "REVEAL"
      ? "Watch the screen for the correct answer."
      : `Phase: ${phase}`}
  </div>
</div>
    )}
  </div>
);
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0B1F3A",
    color: "#F5F7FA",
    padding: 16,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 22,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    boxSizing: "border-box",
  },
  h1: { margin: 0, fontSize: 34 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    padding: "12px 12px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#F5F7FA",
    fontSize: 16,
    fontWeight: 700,
    outline: "none",
  },
  btn: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#D4AF37",
    color: "#0B1F3A",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
  },
  phoneWrap: {
    minHeight: "100vh",
    background: "#0B1F3A",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  phoneTop: {
    display: "flex",
    justifyContent: "space-between",
    color: "#F5F7FA",
    padding: "6px 6px 0 6px",
  },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  tileBtn: {
    border: "none",
    padding: 0,
    background: "transparent",
    width: "100%",
    height: "100%",
  },
  bottom: {
    color: "#F5F7FA",
    opacity: 0.9,
    fontWeight: 800,
    textAlign: "center",
    paddingBottom: 8,
  },
  waiting: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    color: "#F5F7FA",
    padding: 24,
  },
  waitTitle: { fontSize: 40, fontWeight: 950 },
  waitSub: { marginTop: 8, opacity: 0.85, fontWeight: 800, fontSize: 16 },
};