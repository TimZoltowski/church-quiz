import { useMemo, useState } from "react";
import { ANSWERS } from "../constants/answerMap.js";
import { AnswerTile } from "../components/AnswerGrid.jsx";

export default function Host() {
  const [phase, setPhase] = useState("QUESTION_ONLY"); // QUESTION_ONLY | ANSWERS_OPEN | REVEAL | LEADERBOARD
  const [timerSeconds, setTimerSeconds] = useState(20);

  const sample = useMemo(() => ({
    roomCode: "R7K2Q",
    question: "What did Jesus tell Nicodemus is necessary to enter the kingdom of God?",
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
  }), []);

  const nextPhase = () => {
    const order = ["QUESTION_ONLY", "ANSWERS_OPEN", "REVEAL", "LEADERBOARD"];
    const idx = order.indexOf(phase);
    setPhase(order[(idx + 1) % order.length]);
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.brand}>Church Quiz</div>
        <div style={styles.code}>Room: <span style={{ letterSpacing: 2 }}>{sample.roomCode}</span></div>

        <div style={styles.controls}>
          <select
            value={timerSeconds}
            onChange={(e) => setTimerSeconds(Number(e.target.value))}
            style={styles.select}
          >
            {[10, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>{n}s</option>
            ))}
          </select>

          <button onClick={nextPhase} style={styles.btn}>Next</button>
        </div>
      </div>

      <div style={styles.stageWrap}>
        <div style={styles.stage43}>
          <div style={styles.question}>
            {sample.question}
          </div>

          {phase !== "QUESTION_ONLY" && phase !== "LEADERBOARD" && (
            <>
              <div style={styles.timerPill}>
                {phase === "ANSWERS_OPEN" ? `Time: ${timerSeconds}s` : "Time Up"}
              </div>

              <div style={styles.grid}>
                {ANSWERS.map((a) => {
                  const highlight =
                    phase === "REVEAL"
                      ? (a.idx === sample.correctIndex ? "correct" : "wrong")
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
  /* fill the screen as much as possible but keep 4:3 */
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
};