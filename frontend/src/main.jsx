import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBase = import.meta.env.VITE_API_BASE_URL;
const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

async function request(path, { token, ...options } = {}) {
  if (!apiBase) throw new Error('Set VITE_API_BASE_URL in frontend/.env and restart Vite.');
  const response = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error ?? 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try { onLogin(await request('/api/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="login"><h1>Welcome back</h1><p>Sign in to see your orders.</p>
    <form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form></section>;
}

function Catalog({ page, session, onExpired }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    request(`/api/${page}`, { token: session?.token, signal: controller.signal })
      .then((data) => setState({ data }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (error.status === 401) onExpired();
        else setState({ error: error.message });
      });
    return () => controller.abort();
  }, [page, session, onExpired]);
  return <section><h1>{page === 'products' ? 'Everyday essentials' : 'Your orders'}</h1>
    <p>{page === 'products' ? 'Simple things for your daily routine.' : 'A record of your purchases.'}</p>
    {state.loading && <p role="status">Loading…</p>}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.data && page === 'products' && <div className="grid">
      {state.data.products.map((product) => <article key={product.id}><span className="sku">{product.sku}</span><h2>{product.name}</h2><p>{product.description}</p><strong>{money(product.price_cents)}</strong></article>)}
      {!state.data.products.length && <p>No products available yet.</p>}
    </div>}
    {state.data && page === 'orders' && <div className="orders">
      {state.data.orders.map((order) => <article key={order.id}><div className="order-heading"><h2>Order #{order.id}</h2><span>{order.status}</span></div>
        <p>{new Date(order.created_at).toLocaleDateString()}</p><ul>{order.items.map((item) => <li key={item.product_id}>{item.name} × {item.quantity} <span>{money(item.unit_price_cents * item.quantity)}</span></li>)}</ul>
        <strong>Total {money(order.total_cents)}</strong></article>)}
      {!state.data.orders.length && <p>You have no orders yet.</p>}
    </div>}
  </section>;
}

function App() {
  const [page, setPage] = useState('products');
  const [session, setSession] = useState(null);
  const onExpired = React.useCallback(() => { setSession(null); setPage('login'); }, []);
  return <><header><a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('products'); }}>Everyday Store</a>
    <nav aria-label="Main navigation">{['products', 'orders', 'login'].filter((entry) => entry !== 'login' || !session).map((entry) =>
      <button key={entry} className={page === entry ? 'active' : ''} aria-current={page === entry ? 'page' : undefined} onClick={() => setPage(entry)}>{entry[0].toUpperCase() + entry.slice(1)}</button>)}
      {session && <button onClick={onExpired}>Sign out</button>}</nav></header>
    <main>{session && <p className="signed-in">Signed in as {session.user.email}</p>}
      {page === 'login' || (page === 'orders' && !session) ? <Login onLogin={(data) => { setSession(data); setPage('orders'); }} /> : <Catalog page={page} session={session} onExpired={onExpired} />}
    </main><footer>Everyday Store · A DevOps learning application</footer></>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
