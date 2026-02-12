export function ShapeIcon({ shape, size = 56, color = "rgba(255,255,255,0.95)" }) {
  const common = { width: size, height: size, display: "block" };

  if (shape === "circle") {
    return <div style={{ ...common, borderRadius: "50%", background: color }} />;
  }
  if (shape === "square") {
    return <div style={{ ...common, background: color }} />;
  }
  if (shape === "diamond") {
    return <div style={{ ...common, background: color, transform: "rotate(45deg)" }} />;
  }
  // triangle
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
      }}
    />
  );
}

export function AnswerTile({
  shape,
  title,
  subtitle,
  variant = "host",
  highlight = "none",
  count,
}) {
  const palette = {
    triangle: { bg: "#E74C3C" }, // red
    diamond: { bg: "#2E86DE" },  // blue
    circle: { bg: "#27AE60" },   // green
    square: { bg: "#F1C40F" },   // yellow
  };

  const bg = palette[shape]?.bg ?? "#444";
  const isCorrect = highlight === "correct";
  const isWrong = highlight === "wrong";

  const border = isCorrect
    ? "6px solid rgba(255,255,255,0.95)"
    : isWrong
      ? "6px solid rgba(0,0,0,0.35)"
      : "1px solid rgba(255,255,255,0.15)";

  const overlay = isCorrect ? "0 0 0 9999px rgba(0,0,0,0.12) inset" : "none";

  const tileShadow = isCorrect
    ? "0 0 0 6px rgba(255,255,255,0.28), 0 12px 24px rgba(0,0,0,0.35)"
    : "0 12px 24px rgba(0,0,0,0.35)";

  return (
    <div
      style={{
        borderRadius: 18,
        padding: variant === "host" ? 18 : 14,
        background: bg,
        border,
        boxShadow: tileShadow,  // <-- only once now
        display: "grid",
        gridTemplateColumns: variant === "host" ? "72px 1fr" : "1fr",
        alignItems: "center",
        gap: 14,
        position: "relative",
        overflow: "hidden",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))",
          justifySelf: variant === "host" ? "start" : "center",
        }}
      >
        <ShapeIcon
          shape={shape}
          size={variant === "host" ? 58 : 72}
          color="rgba(255,255,255,0.95)"
        />
      </div>

      {variant === "host" && (
        <div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "rgba(0,0,0,0.85)",
              textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(0,0,0,0.65)",
            }}
          >
            {subtitle}
          </div>
        </div>
      )}

      {typeof count === "number" && variant === "host" && (
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 12,
            fontSize: 18,
            fontWeight: 900,
            color: "rgba(0,0,0,0.75)",
            background: "rgba(255,255,255,0.45)",
            borderRadius: 999,
            padding: "6px 10px",
          }}
        >
          {count}
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, boxShadow: overlay }} />
    </div>
  );
}