require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { q, migrate } = require('./db');
const { hashPassword, verifyPassword, signToken, requireAuth, optionalAuth } = require('./auth');
const blockchain = require('./blockchain');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function checkEUCompliance(product) {
  const rules = [
    { name: 'Digital Product Passport ID', pass: true, detail: 'Unique LP-ID' },
    { name: 'Material composition', pass: !!product.material, detail: product.material || 'Missing' },
    { name: 'Carbon footprint per unit', pass: product.carbon_footprint > 0, detail: product.carbon_footprint + ' kg CO2e' },
    { name: 'Recyclability >= 70%', pass: product.recyclability >= 70, detail: product.recyclability + '%' },
    { name: 'Repairability >= 60%', pass: product.repairability >= 60, detail: product.repairability + '%' },
    { name: 'Country of origin', pass: !!product.origin, detail: product.origin },
    { name: 'Expected lifespan', pass: product.life_score > 50, detail: 'Life score ' + product.life_score },
    { name: 'End-of-life instructions', pass: product.recyclability >= 50, detail: product.recyclability >= 50 ? 'Provided' : 'Missing' }
  ];
  const passed = rules.filter(r => r.pass).length;
  const score = Math.round((passed / rules.length) * 100);
  let status = 'fail';
  if (score === 100) status = 'pass';
  else if (score >= 75) status = 'warn';
  return { rules, passed, total: rules.length, score, status };
}

// ============ AUTH ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ chars' });

    const exists = await q('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash = await hashPassword(password);
    const r = await q('INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email.toLowerCase(), hash, name]);

    const user = r.rows[0];
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await q('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = r.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const r = await q('SELECT id, email, name, created_at FROM users WHERE id = $1', [req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json(r.rows[0]);
});

// ============ PRODUCTS ============
app.get('/api/products', requireAuth, async (req, res) => {
  const r = await q('SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json(r.rows.map(p => ({ ...p, compliance: checkEUCompliance(p) })));
});

app.get('/api/products/:id', requireAuth, async (req, res) => {
  const r = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const p = r.rows[0];

  const events = await q('SELECT * FROM chain_events WHERE product_id = $1 ORDER BY timestamp ASC', [p.id]);
  const scenarios = await q('SELECT * FROM future_scenarios WHERE product_id = $1', [p.id]);
  const decisions = await q('SELECT * FROM decisions WHERE product_id = $1', [p.id]);
  const ledger = await q('SELECT * FROM impact_ledger WHERE product_id = $1 ORDER BY timestamp DESC', [p.id]);

  res.json({
    ...p,
    compliance: checkEUCompliance(p),
    events: events.rows,
    scenarios: scenarios.rows,
    decisions: decisions.rows,
    ledger: ledger.rows
  });
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const { name, brand, category, material, origin, carbon_footprint, water_usage, recyclability, repairability, price_new } = req.body;
    if (!name || !brand || !category) return res.status(400).json({ error: 'Missing required fields' });

    const id = 'LP-' + Date.now().toString(36).toUpperCase();
    const image = { Smartphone:'📱', Laptop:'💻', Footwear:'👟', Watch:'⌚', Apparel:'👖', 'EV Battery':'🔋' }[category] || '📦';

    const r = await q(`INSERT INTO products (id, user_id, name, brand, category, image, material, origin,
        carbon_footprint, water_usage, recyclability, repairability, price_new, life_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, req.user.id, name, brand, category, image, material || 'Not specified', origin || 'Unknown',
       carbon_footprint || 10, water_usage || 100, recyclability || 70, repairability || 60,
       price_new || 10000, 75]);

    res.json({ ...r.rows[0], compliance: checkEUCompliance(r.rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ============ FUTURE ============
app.get('/api/products/:id/future', requireAuth, async (req, res) => {
  const r = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const p = r.rows[0];
  const projection = [];
  for (let y = 0; y <= 5; y++) {
    const decay = Math.round(p.life_score - y * (100 - p.life_score) / 6);
    projection.push({
      year: new Date().getFullYear() + y,
      health: Math.max(5, decay),
      resaleValue: Math.max(0, Math.round(p.price_new * (decay / 100) * 0.6))
    });
  }
  res.json({ projection });
});

// ============ WHAT-IF ============
app.post('/api/whatif', requireAuth, async (req, res) => {
  const { productId, action, years } = req.body;
  const r = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [productId, req.user.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const p = r.rows[0];

  const y = Number(years) || 3;
  let lifeExtension = 0, carbonDelta = 0, cost = 0, note = '';
  switch (action) {
    case 'repair': lifeExtension = y; carbonDelta = -p.carbon_footprint * 0.6; cost = Math.round(p.price_new * 0.02); note = 'Repair keeps the product in use, saving embodied carbon.'; break;
    case 'reuse': lifeExtension = y * 1.2; carbonDelta = -p.carbon_footprint * 0.8; cost = 0; note = 'Reuse maximizes life extension.'; break;
    case 'recycle': lifeExtension = 0; carbonDelta = -p.carbon_footprint * 0.9; cost = 0; note = 'Recycling recovers materials but ends life.'; break;
    case 'replace': lifeExtension = 0; carbonDelta = p.carbon_footprint * 0.4; cost = p.price_new; note = 'Replacement adds new embodied carbon.'; break;
    default: lifeExtension = 0; carbonDelta = p.carbon_footprint * 0.5; cost = 0; note = 'Inaction leads to landfill.';
  }

  res.json({
    action, years: y,
    projectedHealth: Math.min(100, Math.round(p.life_score + lifeExtension * 4)),
    carbonImpact: Math.round(carbonDelta * 100) / 100,
    estimatedCost: Math.round(cost),
    note
  });
});

// ============ CHAIN ============
app.get('/api/chain/:id', requireAuth, async (req, res) => {
  const pr = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (pr.rowCount === 0) return res.status(404).json({ error: 'Not found' });

  const events = await q('SELECT * FROM chain_events WHERE product_id = $1 ORDER BY timestamp ASC', [req.params.id]);

  const chained = [];
  for (let i = 0; i < events.rows.length; i++) {
    const e = events.rows[i];
    const prev = i === 0 ? '0'.repeat(64) : chained[i - 1].event_hash;
    const eventHash = sha256(JSON.stringify({ ...e, prev }));
    chained.push({
      ...e,
      event_hash: e.event_hash || eventHash,
      prev_hash: e.prev_hash || prev,
      blockNum: i + 1
    });
  }

  res.json(chained);
});

app.post('/api/chain/:id/anchor', requireAuth, async (req, res) => {
  const pr = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (pr.rowCount === 0) return res.status(404).json({ error: 'Not found' });

  const events = await q('SELECT * FROM chain_events WHERE product_id = $1 ORDER BY timestamp ASC', [req.params.id]);
  if (events.rowCount === 0) return res.status(400).json({ error: 'No events to anchor' });

  let rolling = '0'.repeat(64);
  for (const e of events.rows) rolling = sha256(rolling + JSON.stringify(e));

  const result = await blockchain.anchorHash(rolling);

  if (result.txHash) {
    await q(`UPDATE chain_events SET tx_hash = $1, block_number = $2, anchored_at = NOW()
             WHERE id = (SELECT MAX(id) FROM chain_events WHERE product_id = $3)`,
      [result.txHash, result.blockNumber, req.params.id]);
  }

  res.json({
    chainHash: rolling,
    ...result,
    walletAddress: blockchain.getWalletAddress(),
    eventsAnchored: events.rowCount
  });
});

// ============ LEDGER ============
app.get('/api/ledger/:id', requireAuth, async (req, res) => {
  const r = await q('SELECT * FROM impact_ledger WHERE product_id = $1 AND user_id = $2 ORDER BY timestamp DESC',
    [req.params.id, req.user.id]);
  res.json(r.rows);
});

app.post('/api/ledger', requireAuth, async (req, res) => {
  const { productId, action } = req.body;
  const pr = await q('SELECT * FROM products WHERE id = $1 AND user_id = $2', [productId, req.user.id]);
  if (pr.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const p = pr.rows[0];

  const impacts = {
    repair:  { carbon: p.carbon_footprint * 0.6, water: p.water_usage * 0.5, waste: 1.2, points: 120 },
    reuse:   { carbon: p.carbon_footprint * 0.8, water: p.water_usage * 0.7, waste: 2.5, points: 200 },
    recycle: { carbon: p.carbon_footprint * 0.9, water: p.water_usage * 0.3, waste: 3.0, points: 180 },
    donate:  { carbon: p.carbon_footprint * 0.75, water: p.water_usage * 0.6, waste: 2.0, points: 250 }
  };
  const i = impacts[action] || impacts.reuse;

  const r = await q(`INSERT INTO impact_ledger (product_id, user_id, action, carbon_saved, water_saved, waste_diverted, points)
                     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [productId, req.user.id, action, i.carbon, i.water, i.waste, i.points]);

  res.json(r.rows[0]);
});

app.get('/api/impact/summary', requireAuth, async (req, res) => {
  const r = await q(`SELECT COALESCE(SUM(carbon_saved),0) AS carbon, COALESCE(SUM(water_saved),0) AS water,
                            COALESCE(SUM(waste_diverted),0) AS waste, COALESCE(SUM(points),0) AS points,
                            COUNT(*) AS actions
                     FROM impact_ledger WHERE user_id = $1`, [req.user.id]);
  const row = r.rows[0];
  res.json({
    carbon: +row.carbon,
    water: +row.water,
    waste: +row.waste,
    points: parseInt(row.points),
    actions: parseInt(row.actions)
  });
});

// ============ SHOPS ============
app.get('/api/shops', optionalAuth, async (req, res) => {
  const { category } = req.query;
  const r = category
    ? await q('SELECT * FROM repair_shops WHERE category = $1', [category])
    : await q('SELECT * FROM repair_shops');
  res.json(r.rows);
});

// ============ BLOCKCHAIN INFO ============
app.get('/api/blockchain/info', async (req, res) => {
  const balance = await blockchain.getBalance();
  res.json({
    enabled: blockchain.enabled,
    walletAddress: blockchain.getWalletAddress(),
    balanceMatic: balance,
    network: 'Polygon Amoy Testnet',
    explorer: process.env.POLYGON_EXPLORER || 'https://amoy.polygonscan.com/tx/'
  });
});

// ============ HEALTH ============
app.get('/api/health', async (req, res) => {
  try {
    await q('SELECT 1');
    res.json({ status: 'ok', db: 'connected', blockchain: blockchain.enabled, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ============ START ============
(async () => {
  await migrate();
  app.listen(PORT, () => {
    console.log(`\n🌱 LIFEPASS v5.0 running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Blockchain: ${blockchain.enabled ? 'ENABLED' : 'DISABLED'}\n`);
  });
})();