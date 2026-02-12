import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Church Quiz</h1>
        <p style={styles.p}>Host a game on the projector or join on your phone.</p>
        <div style={styles.row}>
          <Link to="/host" style={styles.btn}>Host</Link>
          <Link to="/join" style={styles.btn}>Join</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(1200px 700px at 30% 35%, rgba(212,175,55,0.10), rgba(11,31,58,1) 60%)",
  color: "#F5F7FA",
  padding: 24,
},
  card: {
    width: "min(860px, 96vw)",
    borderRadius: 18,
    padding: 28,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  h1: { margin: 0, fontSize: 42, letterSpacing: 0.2 },
  p: { marginTop: 10, opacity: 0.9, fontSize: 18, lineHeight: 1.4 },
  row: { display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" },
  btn: {
    display: "inline-block",
    padding: "12px 18px",
    borderRadius: 12,
    background: "#D4AF37",
    color: "#0B1F3A",
    fontWeight: 800,
    textDecoration: "none",
  },
};