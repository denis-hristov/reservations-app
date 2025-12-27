import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  adminLogin,
  adminLogout,
  createReservation,
  getAvailability,
  getReservationsAdmin,
  deleteReservationAdmin,
  isAdminLoggedIn,
} from "./api";
import "./App.css";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function Layout({ children }) {
  return (
    <div className="wrap">
      <nav className="nav">
        <Link to="/">Резервации</Link>
        <Link to="/admin">Админ</Link>
      </nav>
      {children}
    </div>
  );
}

function PublicPage() {
  const [date, setDate] = useState(todayISO());
  const [bookedTimes, setBookedTimes] = useState([]);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    date: todayISO(),
    time: "19:00",
    people: 2,
    notes: "",
  });

  async function loadAvailability(d) {
    setErr("");
    try {
      const data = await getAvailability(d);
      setBookedTimes(data.bookedTimes || []);
    } catch (e) {
      setErr(e.message || "Грешка");
    }
  }

  useEffect(() => {
    loadAvailability(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await createReservation({
        ...form,
        people: Number(form.people),
      });
      setForm((f) => ({ ...f, name: "", phone: "", notes: "" }));
      setDate(form.date);
      await loadAvailability(form.date);
    } catch (e2) {
      setErr(e2.message || "Грешка");
    }
  }

  const isTaken = bookedTimes.includes(form.time);

  return (
    <Layout>
      <h1>Нова резервация</h1>

      <div className="card">
        <label>
          Дата за проверка:
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <h2>Заети часове</h2>
        {bookedTimes.length === 0 ? (
          <p className="muted">Няма резервации за тази дата.</p>
        ) : (
          <ul className="times">
            {bookedTimes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Добави</h2>
        {err ? <p className="error">{err}</p> : null}

        <form onSubmit={onSubmit} className="form">
          <label>
            Име:
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>

          <label>
            Телефон:
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>

          <div className="row">
            <label>
              Дата:
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>

            <label>
              Час:
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </label>
          </div>

          <label>
            Брой хора:
            <input
              type="number"
              min="1"
              max="50"
              value={form.people}
              onChange={(e) => setForm({ ...form, people: e.target.value })}
              required
            />
          </label>

          <label>
            Бележка:
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </label>

          <button type="submit" disabled={isTaken}>
            {isTaken ? "Часът е зает" : "Запази"}
          </button>

          <p className="muted">Системата не позволява две резервации за една и съща дата и час.</p>
        </form>
      </div>
    </Layout>
  );
}

function AdminPage() {
  const nav = useNavigate();
  const [logged, setLogged] = useState(isAdminLoggedIn());
  const [err, setErr] = useState("");

  const [creds, setCreds] = useState({ username: "", password: "" });

  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await getReservationsAdmin(date);
      setItems(data);
    } catch (e) {
      setErr(e.message || "Грешка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (logged) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, date]);

  async function onLogin(e) {
    e.preventDefault();
    setErr("");
    try {
      await adminLogin(creds.username, creds.password);
      setLogged(true);
    } catch (e2) {
      setErr(e2.message || "Грешка");
    }
  }

  function onLogout() {
    adminLogout();
    setLogged(false);
    setItems([]);
    nav("/admin");
  }

  async function onDelete(id) {
    setErr("");
    try {
      await deleteReservationAdmin(id);
      await load();
    } catch (e) {
      setErr(e.message || "Грешка");
    }
  }

  if (!logged) {
    return (
      <Layout>
        <h1>Админ вход</h1>
        {err ? <p className="error">{err}</p> : null}
        <form onSubmit={onLogin} className="card form">
          <label>
            Име:
            <input value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} required />
          </label>
          <label>
            Парола:
            <input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} required />
          </label>
          <button type="submit">Вход</button>
        </form>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="rowBetween">
        <h1>Админ панел</h1>
        <button onClick={onLogout}>Изход</button>
      </div>

      <div className="card">
        <div className="row">
          <label>
            Дата:
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button onClick={load} disabled={loading}>
            Обнови
          </button>
        </div>

        {err ? <p className="error">{err}</p> : null}

        {loading ? <p>Зареждане…</p> : null}
        {!loading && items.length === 0 ? <p className="muted">Няма резервации.</p> : null}

        <ul className="list">
          {items.map((r) => (
            <li key={r.id} className="item">
              <div>
                <strong>{r.time}</strong> – {r.name} ({r.people})
                {r.phone ? <span className="muted"> • {r.phone}</span> : null}
                {r.notes ? <div className="muted">{r.notes}</div> : null}
              </div>
              <button onClick={() => onDelete(r.id)}>Изтрий</button>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}