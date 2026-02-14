// app/src/lib/api.js

// 1) Local dev worker (wrangler dev) base URL
// 2) Production worker base URL
const PROD = "https://church-quiz-api.pastortim.workers.dev";
const DEV = "http://127.0.0.1:8787";

// Vite exposes import.meta.env.DEV / PROD
export const API_BASE =
  import.meta.env.VITE_API_BASE || "https://church-quiz-api.pastortim.workers.dev";

export async function createRoom() {
  const res = await fetch(`${API_BASE}/api/room/create`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create room");
  return res.json(); // { code }
}

export function roomWsUrl(code, role, name) {
  const u = new URL(`${API_BASE}/api/room/${code}/ws`);
  u.searchParams.set("role", role);
  if (role === "player") u.searchParams.set("name", name);

  // Convert http/https to ws/wss
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}