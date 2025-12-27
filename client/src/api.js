const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("admin_token") || "";
}

function adminHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function adminLogin(username, password) {
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Login failed");
  localStorage.setItem("admin_token", data.token);
  return data;
}

export function adminLogout() {
  localStorage.removeItem("admin_token");
}

export function isAdminLoggedIn() {
  return !!getToken();
}

// PUBLIC
export async function getAvailability(date) {
  const res = await fetch(`${BASE}/availability?date=${encodeURIComponent(date)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Неуспешно зареждане");
  return data; // { date, bookedTimes: [] }
}

export async function createReservation(payload) {
  const res = await fetch(`${BASE}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Неуспешно създаване");
  return data;
}

// ADMIN
export async function getReservationsAdmin(date) {
  const url = date ? `${BASE}/reservations?date=${encodeURIComponent(date)}` : `${BASE}/reservations`;
  const res = await fetch(url, { headers: { ...adminHeaders() } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Неуспешно зареждане");
  return data;
}

export async function deleteReservationAdmin(id) {
  const res = await fetch(`${BASE}/reservations/${id}`, {
    method: "DELETE",
    headers: { ...adminHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Неуспешно изтриване");
  return data;
}
