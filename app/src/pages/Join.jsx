import { useState } from "react";
import { ANSWERS } from "../constants/answerMap.js";
import { AnswerTile } from "../components/AnswerGrid.jsx";

export default function Join() {
  const [joined, setJoined] = useState(false);
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const onJoin = (e) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setJoined(true);
  };

  const pick = () => {
    if (locked) return;
    setLocked(true);
    // later: send answer to server
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
            <button type="submit" style={styles.btn}>Join</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.phoneWrap}>
      <div style={styles.phoneTop}>
        <div style={{ fontWeight: 900 }}>{name}</div>
        <div style={{ opacity: 0.85, fontWeight: 800 }}>Room {code}</div>
      </div>

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
  padding: 18,
},
  card: {
    width: "min(460px, 95vw)",
    borderRadius: 18,
    padding: 22,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  h1: { margin: 0, fontSize: 34 },
  input: {
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
};