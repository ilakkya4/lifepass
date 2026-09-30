const API = window.location.origin;

function getToken() { return localStorage.getItem('lifepass_token'); }
function authHeaders() { return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }; }

async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) { localStorage.removeItem('lifepass_token'); window.location.href = '/login.html'; return; }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const $ = s => document.querySelector(s);
const fmt = (n, d = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });

const state = { products: [], selected: null, activeTab: 'memory', blockchainInfo: null };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function confetti() {
  const colors = ['#22d38a', '#4aa3ff', '#a877ff', '#ffb547', '#ff6eb4'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;top:-10px;left:${Math.random()*100}vw;width:10px;height:10px;background:${colors[i%colors.length]};z-index:999;pointer-events:none;border-radius:${Math.random()>0.5?'50%':'0'};animation:fall ${1.5+Math.random()*1.5}s linear forwards;`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }
}

async function init() {
  const user = JSON.parse(localStorage.getItem('lifepass_user') || '{}');
  if (user.name) $('#userName').textContent = 'Hi, ' + user.name.split(' ')[0];

  try {
    state.blockchainInfo = await api('/api/blockchain/info');
    state.products = await api('/api/products');
    renderProductGrid();
    updateHeaderStats(await api('/api/impact/summary'));

    if (state.products.length > 0) setTimeout(() => selectProduct(state.products[0].id), 300);
  } catch (e) {
    console.error(e);
    $('#productGrid').innerHTML = '<div class="empty">⚠️ Failed to load. <a href="/login.html" style="color:var(--green)">Sign in again</a></div>';
  }
}

function renderProductGrid() {
  const grid = $('#productGrid');
  grid.innerHTML = state.products.map(p => `
    <div class="product-card ${state.selected?.id === p.id ? 'active' : ''}" data-id="${p.id}">
      <div class="country">${p.country || ''}</div>
      <div class="icon">${p.image}</div>
      <h3>${p.name}</h3>
      <div class="brand">${p.brand} • ${p.category}</div>
      <span class="score-badge ${p.life_score < 70 ? 'low' : ''}">Life Score ${p.life_score}</span>
    </div>
  `).join('');
  grid.querySelectorAll('.product-card').forEach(el =>
    el.addEventListener('click', () => selectProduct(el.dataset.id)));
}

async function selectProduct(id) {
  state.selected = await api('/api/products/' + id);
  renderProductGrid();
  renderHeader();
  $('#selectedPanel').style.display = 'block';
  switchTab(state.activeTab);
  setTimeout(() => $('#selectedPanel').scrollIntoView({ behavior: 'smooth' }), 100);
}

function renderHeader() {
  const p = state.selected;
  const comp = p.compliance;
  $('#productHeader').innerHTML = `
    <div class="big-icon">${p.image}</div>
    <div class="meta">
      <h2>${p.name}</h2>
      <p>${p.brand} • ${p.category} • Owner: ${p.current_owner}</p>
      <div>
        <span class="pill">ID: ${p.id}</span>
        <span class="pill">${p.country || ''} ${p.origin}</span>
        <span class="pill" style="background:${comp.status==='pass'?'rgba(34,211,138,0.15)':comp.status==='warn'?'rgba(255,181,71,0.15)':'rgba(255,92,122,0.15)'};color:${comp.status==='pass'?'var(--green)':comp.status==='warn'?'var(--amber)':'var(--red)'};border-color:transparent;">EU: ${comp.score}%</span>
      </div>
    </div>
  `;
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderTab();
}

function renderTab() {
  const p = state.selected;
  if (!p) return;
  const t = state.activeTab;
  if (t === 'memory') return renderMemory(p);
  if (t === 'future') return renderFuture(p);
  if (t === 'decision') return renderDecision(p);
  if (t === 'chain') return renderChain(p);
  if (t === 'whatif') return renderWhatIf(p);
  if (t === 'ledger') return renderLedger(p);
  if (t === 'wallet') return renderWallet(p);
  if (t === 'marketplace') return renderMarketplace(p);
  if (t === 'compliance') return renderCompliance(p);
}

function renderMemory(p) {
  const bar = (l, v, c) => `<div class="metric-bar"><div class="label"><span>${l}</span><span>${v}%</span></div><div class="bar"><div class="fill" style="width:${v}%;background:${c}"></div></div></div>`;
  $('#tabContent').innerHTML = `
    <div class="memory-grid">
      <div class="info-box">
        <h4>Product Identity</h4>
        <div class="info-row"><span>Material</span><span>${p.material}</span></div>
        <div class="info-row"><span>Category</span><span>${p.category}</span></div>
        <div class="info-row"><span>Owner</span><span>${p.current_owner}</span></div>
        <div class="info-row"><span>Price</span><span>₹${fmt(p.price_new)}</span></div>
      </div>
      <div class="info-box">
        <h4>Sustainability</h4>
        <div class="info-row"><span>Carbon</span><span>${p.carbon_footprint} kg CO₂e</span></div>
        <div class="info-row"><span>Water</span><span>${fmt(p.water_usage)} L</span></div>
        ${bar('Recyclability', p.recyclability, 'linear-gradient(90deg,#22d38a,#4aa3ff)')}
        ${bar('Repairability', p.repairability, 'linear-gradient(90deg,#ffb547,#ff5c7a)')}
        ${bar('Life Score', p.life_score, 'linear-gradient(90deg,#22d38a,#a877ff)')}
      </div>
    </div>
    <div class="info-box" style="margin-top:20px;">
      <h4>🌍 Carbon Equivalents</h4>
      <div class="info-row"><span>🚗 Car km</span><span>${Math.round(p.carbon_footprint * 4)} km</span></div>
      <div class="info-row"><span>🌳 Tree-years</span><span>${Math.round(p.carbon_footprint / 21)} yrs</span></div>
      <div class="info-row"><span>✈️ Flight km</span><span>${(p.carbon_footprint / 250).toFixed(2)} km</span></div>
    </div>
  `;
}

async function renderFuture(p) {
  const { projection } = await api(`/api/products/${p.id}/future`);
  const sparkline = projection.map((pt, i) => `${(i/(projection.length-1))*100},${100-pt.health}`).join(' ');
  $('#tabContent').innerHTML = `
    <h4 style="margin-bottom:12px;font-size:12px;color:var(--muted);text-transform:uppercase;">5-Year Projection</h4>
    <div class="chart-wrap">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:140px;">
        <polyline points="${sparkline}" fill="none" stroke="#22d38a" stroke-width="1.2" />
        <polygon points="0,100 ${sparkline} 100,100" fill="rgba(34,211,138,0.2)" />
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:8px;">
        ${projection.map(pt => `<span>${pt.year}<br>${pt.health}</span>`).join('')}
      </div>
    </div>
    <h4 style="margin:20px 0 12px;font-size:12px;color:var(--muted);text-transform:uppercase;">Scenarios</h4>
    <div class="scenario-grid">
      ${(p.scenarios || []).map(s => `
        <div class="scenario-card">
          <h4>${s.scenario_name}</h4>
          <div class="metric"><span>Health</span><strong>${s.health_score}</strong></div>
          <div class="metric"><span>Resale</span><strong>₹${fmt(s.resale_value)}</strong></div>
          <div class="metric"><span>Carbon Saved</span><strong>${s.carbon_saved} kg</strong></div>
          <div class="recommend">💡 ${s.recommendation}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDecision(p) {
  const rows = [...(p.decisions || [])].sort((a, b) => b.score - a.score);
  $('#tabContent').innerHTML = `
    <div class="decision-row header"><div>Option</div><div>Cost</div><div>Carbon</div><div>Yrs</div><div>Sat</div><div>Score</div></div>
    ${rows.map(r => {
      const cls = r.score >= 80 ? 'good' : r.score >= 60 ? 'mid' : 'bad';
      return `<div class="decision-row">
        <div><strong>${r.option_name}</strong></div>
        <div>₹${fmt(r.cost)}</div>
        <div>${r.carbon}</div>
        <div>${r.lifespan_years}</div>
        <div>${r.satisfaction}/10</div>
        <div class="score ${cls}">${r.score}</div>
      </div>`;
    }).join('')}
  `;
}

async function renderChain(p) {
  const events = await api(`/api/chain/${p.id}`);
  const anchored = events.some(e => e.tx_hash);
  $('#tabContent').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;">⛓️ Lifechain</h4>
      <button class="btn" id="anchorBtn" style="padding:8px 14px;font-size:12px;">${anchored ? '🔗 Re-anchor' : '⛓️ Anchor on Polygon'}</button>
    </div>
    ${state.blockchainInfo?.walletAddress ? `
      <div class="info-box" style="margin-bottom:14px;">
        <div class="info-row"><span>Wallet</span><span style="font-family:monospace;font-size:10px;">${state.blockchainInfo.walletAddress.slice(0,10)}...${state.blockchainInfo.walletAddress.slice(-6)}</span></div>
        <div class="info-row"><span>Balance</span><span>${state.blockchainInfo.balanceMatic ? parseFloat(state.blockchainInfo.balanceMatic).toFixed(4) + ' MATIC' : '—'}</span></div>
        <div class="info-row"><span>Network</span><span>Polygon Amoy Testnet</span></div>
      </div>
    ` : ''}
    <div class="chain-timeline">
      ${events.map(e => `
        <div class="chain-event">
          <h5>${e.event_type}
            <span class="hash-pill" onclick="navigator.clipboard.writeText('${e.event_hash}');toast('📋 Hash copied')">#${e.event_hash.slice(0,8)}</span>
            ${e.tx_hash ? `<a href="${state.blockchainInfo.explorer}${e.tx_hash}" target="_blank" style="font-size:10px;color:var(--green);text-decoration:none;">🔗 on-chain</a>` : ''}
          </h5>
          <div class="when">${new Date(e.timestamp).toLocaleString()} • ${e.location}</div>
          <p>${e.notes || ''}</p>
          <div class="who">👤 ${e.actor || 'Unknown'}</div>
        </div>
      `).join('')}
    </div>
  `;

  $('#anchorBtn')?.addEventListener('click', async () => {
    const btn = $('#anchorBtn');
    btn.disabled = true;
    btn.textContent = '⛓️ Anchoring...';
    try {
      const result = await api(`/api/chain/${p.id}/anchor`, { method: 'POST' });
      if (result.txHash) {
        toast('✅ Anchored on-chain!');
        confetti();
        btn.textContent = '✅ Anchored';
        setTimeout(() => renderChain(p), 1500);
      } else {
        toast('⚠️ ' + (result.error || 'Simulated (no wallet)'));
        btn.disabled = false;
        btn.textContent = '⛓️ Anchor on Polygon';
      }
    } catch (e) {
      toast('❌ Anchor failed');
      btn.disabled = false;
      btn.textContent = '⛓️ Anchor on Polygon';
    }
  });
}

function renderWhatIf(p) {
  $('#tabContent').innerHTML = `
    <div class="whatif-form">
      <div><label>Action</label>
        <select id="wiAction">
          <option value="repair">🔧 Repair</option>
          <option value="reuse">♻️ Reuse</option>
          <option value="recycle">🔄 Recycle</option>
          <option value="replace">🛒 Replace</option>
          <option value="donothing">🚮 Do nothing</option>
        </select>
      </div>
      <div><label>Years</label><input type="number" id="wiYears" value="3" min="1" max="10" /></div>
      <button class="btn" id="wiRun">Run</button>
    </div>
    <div id="wiResult"></div>
  `;
  $('#wiRun').addEventListener('click', async () => {
    const res = await api('/api/whatif', {
      method: 'POST',
      body: JSON.stringify({ productId: p.id, action: $('#wiAction').value, years: $('#wiYears').value })
    });
    const cc = res.carbonImpact < 0 ? 'var(--green)' : 'var(--red)';
    $('#wiResult').innerHTML = `
      <div class="whatif-result">
        <div class="stat"><div class="num">${res.projectedHealth}</div><div class="lbl">Health</div></div>
        <div class="stat"><div class="num" style="color:${cc}">${res.carbonImpact < 0 ? '' : '+'}${res.carbonImpact} kg</div><div class="lbl">Carbon</div></div>
        <div class="stat"><div class="num">₹${fmt(res.estimatedCost)}</div><div class="lbl">Cost</div></div>
        <div class="note">💡 ${res.note}</div>
      </div>`;
  });
}

async function renderLedger(p) {
  const rows = await api(`/api/ledger/${p.id}`);
  $('#tabContent').innerHTML = `
    <h4 style="margin-bottom:14px;font-size:12px;color:var(--muted);text-transform:uppercase;">Log Action</h4>
    <div class="ledger-actions">
      <button data-act="repair">🔧 Repaired</button>
      <button data-act="reuse">♻️ Reused</button>
      <button data-act="recycle">🔄 Recycled</button>
      <button data-act="donate">🎁 Donated</button>
    </div>
    <h4 style="margin:14px 0;font-size:12px;color:var(--muted);text-transform:uppercase;">History</h4>
    <div class="ledger-list">
      ${rows.length === 0 ? '<div class="empty">No actions yet.</div>' :
        rows.map(r => `
          <div class="ledger-item">
            <div class="action">${r.action}</div>
            <div class="numbers">
              <strong>${r.carbon_saved.toFixed(1)} kg CO₂</strong>
              <strong>${fmt(r.water_saved)} L</strong>
              <strong>+${r.points} pts</strong>
              <span>${new Date(r.timestamp).toLocaleString()}</span>
            </div>
          </div>
        `).join('')}
    </div>
  `;
  document.querySelectorAll('.ledger-actions button').forEach(b => {
    b.addEventListener('click', async () => {
      await api('/api/ledger', { method: 'POST', body: JSON.stringify({ productId: p.id, action: b.dataset.act }) });
      toast('✅ Logged!');
      confetti();
      updateHeaderStats(await api('/api/impact/summary'));
      renderLedger(p);
    });
  });
}

async function renderWallet(p) {
  const s = await api('/api/impact/summary');
  const c = Math.round(s.carbon * 0.2), w = Math.round(s.water * 0.05), pt = Math.round(s.points * 0.5);
  const total = c + w + pt;
  $('#tabContent').innerHTML = `
    <div class="wallet">
      <div class="wallet-grid">
        <div class="wallet-stat"><div class="num">₹${fmt(total)}</div><div class="lbl">Total Value</div></div>
        <div class="wallet-stat"><div class="num">${s.carbon.toFixed(1)}</div><div class="lbl">kg CO₂</div></div>
        <div class="wallet-stat"><div class="num">${fmt(s.points)}</div><div class="lbl">LifePoints</div></div>
        <div class="wallet-stat"><div class="num">${s.actions}</div><div class="lbl">Actions</div></div>
      </div>
    </div>
    <div class="info-box">
      <h4>Breakdown</h4>
      <div class="info-row"><span>Carbon credits</span><span>₹${fmt(c)}</span></div>
      <div class="info-row"><span>Water savings</span><span>₹${fmt(w)}</span></div>
      <div class="info-row"><span>LifePoints</span><span>₹${fmt(pt)}</span></div>
    </div>
  `;
}

async function renderMarketplace(p) {
  const shops = await api(`/api/shops?category=${encodeURIComponent(p.category)}`);
  $('#tabContent').innerHTML = `
    <h4 style="margin-bottom:14px;font-size:12px;color:var(--muted);text-transform:uppercase;">🛠️ Certified Shops</h4>
    <div class="shop-grid">
      ${shops.length === 0 ? '<div class="empty">No shops for this category.</div>' :
        shops.map(s => `
          <div class="shop-card">
            <h4>${s.certified ? '✅ ' : ''}${s.name}</h4>
            <div class="rating">⭐ ${s.rating} (${s.reviews})</div>
            <div class="meta">📍 ${s.location}</div>
            <div class="meta">⏱️ ${s.eta}</div>
            <div class="price">₹${fmt(s.price)}</div>
            <button class="btn" style="width:100%;margin-top:10px;font-size:12px;padding:8px" onclick="toast('✅ Booked!')">Book</button>
          </div>
        `).join('')}
    </div>
  `;
}

function renderCompliance(p) {
  const c = p.compliance;
  const emoji = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
  const txt = c.status === 'pass' ? 'FULLY COMPLIANT' : c.status === 'warn' ? 'PARTIAL' : 'NON-COMPLIANT';
  const col = c.status === 'pass' ? 'var(--green)' : c.status === 'warn' ? 'var(--amber)' : 'var(--red)';
  $('#tabContent').innerHTML = `
    <div class="compliance ${c.status}">
      <div class="compliance-head">
        <div class="check-icon">${emoji}</div>
        <div>
          <h3 style="color:${col}">EU ESPR 2027: ${txt}</h3>
          <p style="font-size:11px;color:var(--muted)">${c.passed}/${c.total} rules (${c.score}%)</p>
        </div>
      </div>
      <ul class="compliance-list">
        ${c.rules.map(r => `<li><span>${r.pass ? '✅' : '❌'} ${r.name}</span><span style="color:${r.pass ? 'var(--green)' : 'var(--red)'}">${r.detail}</span></li>`).join('')}
      </ul>
    </div>
  `;
}

function updateHeaderStats(s) {
  $('#hCarbon').textContent = s.carbon.toFixed(1);
  $('#hWater').textContent = fmt(s.water);
  $('#hPoints').textContent = fmt(s.points);
}

document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

async function openScanner() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(6,15,24,0.95);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--green);border-radius:20px;padding:24px;max-width:420px;width:100%;text-align:center;">
      <h3 style="margin-bottom:16px">📷 Scan Product</h3>
      <video id="cam" style="width:100%;aspect-ratio:1;background:#000;border-radius:12px;border:2px solid var(--green);object-fit:cover;" autoplay muted playsinline></video>
      <button class="btn" id="simScan" style="margin-top:16px;margin-right:8px">Simulate</button>
      <button class="btn" id="closeScan" style="margin-top:16px;background:var(--card-2);color:var(--text);border:1px solid var(--line)">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    modal.querySelector('#cam').srcObject = s;
    modal._s = s;
  } catch {}
  modal.querySelector('#simScan').onclick = () => {
    if (modal._s) modal._s.getTracks().forEach(t => t.stop());
    const p = state.products[Math.floor(Math.random() * state.products.length)];
    modal.remove();
    selectProduct(p.id);
    toast(`📷 Scanned: ${p.name}`);
  };
  modal.querySelector('#closeScan').onclick = () => {
    if (modal._s) modal._s.getTracks().forEach(t => t.stop());
    modal.remove();
  };
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('🎤 Not supported'); return; }
  const r = new SR();
  r.lang = 'en-IN';
  r.onresult = e => {
    const t = e.results[0][0].transcript.toLowerCase();
    toast(`🎤 "${t}"`);
    if (t.match(/wallet/)) switchTab('wallet');
    else if (t.match(/repair|marketplace/)) switchTab('marketplace');
    else if (t.match(/compliance|eu/)) switchTab('compliance');
    else if (t.match(/chain/)) switchTab('chain');
    else if (t.match(/scan/)) openScanner();
  };
  r.start();
  toast('🎤 Listening...');
}

function toggleTheme() {
  document.body.classList.toggle('light');
  $('#themeBtn').textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
}

async function showChainInfo() {
  const info = await api('/api/blockchain/info');
  alert(`🔗 Blockchain Info\n\nNetwork: ${info.network}\nWallet: ${info.walletAddress || 'not configured'}\nBalance: ${info.balanceMatic ? parseFloat(info.balanceMatic).toFixed(4) + ' MATIC' : 'N/A'}`);
}

function logout() {
  if (!confirm('Sign out?')) return;
  localStorage.removeItem('lifepass_token');
  localStorage.removeItem('lifepass_user');
  window.location.href = '/login.html';
}

function pitchMode() {
  const slides = [
    { t: 'By 2027, every product needs a passport.', b: 'EU ESPR makes Digital Product Passports mandatory.' },
    { t: '€40B+ of Indian exports at risk.', b: 'Without DPP, Indian manufacturers lose EU market access.' },
    { t: 'LIFEPASS is the fix.', b: 'Open · Affordable · India-first · On-chain.', n: '12' },
    { t: 'The UPI of Product Passports.', b: '4 revenue streams. ₹80L → ₹18Cr in 3 years.', n: '₹18Cr' }
  ];
  let i = 0;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,15,24,0.98);z-index:600;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;';
  document.body.appendChild(ov);
  const show = () => {
    if (i >= slides.length) { ov.remove(); toast('🎬 Done!'); return; }
    const s = slides[i];
    ov.innerHTML = `
      <h2 style="font-size:32px;margin-bottom:16px;background:linear-gradient(90deg,var(--green),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${s.t}</h2>
      ${s.n ? `<div style="font-size:64px;font-weight:700;color:var(--green);margin:16px 0;">${s.n}</div>` : ''}
      <p style="font-size:16px;color:var(--muted);max-width:600px;">${s.b}</p>
      <button class="btn" style="margin-top:24px;background:var(--card-2);color:var(--text);border:1px solid var(--line)" onclick="this.parentElement.remove();">✕ Exit</button>
    `;
    i++;
    if (i < slides.length) setTimeout(show, 4000);
  };
  show();
}

$('#scanBtn').onclick = openScanner;
$('#voiceBtn').onclick = startVoice;
$('#themeBtn').onclick = toggleTheme;
$('#chainInfoBtn').onclick = showChainInfo;
$('#pitchBtn').onclick = pitchMode;
$('#logoutBtn').onclick = logout;

init().catch(e => {
  console.error(e);
  $('#productGrid').innerHTML = '<div class="empty">⚠️ Failed to load. <a href="/login.html" style="color:var(--green)">Sign in</a></div>';
});
