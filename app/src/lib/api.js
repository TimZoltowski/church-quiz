export const API_BASE = "https://church-quiz-worker.pastortim.workers.dev";

export async function createRoom() {
  const res = await fetch(`${API_BASE}/api/room/create`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create room");
  return res.json(); // { code }
}

export function roomWsUrl(code, role, name) {
  const u = new URL(`${API_BASE}/api/room/${code}/ws`);
  u.searchParams.set("role", role);
  if (role === "player") u.searchParams.set("name", name);
  // Convert https -> wss
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}