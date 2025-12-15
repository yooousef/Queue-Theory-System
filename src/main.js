// /**
//  * Queue System Calculator - Main JavaScript
//  * Implements D/D/1/K-1, M/M/1, and M/M/C queueing models
//  */

// // ============================================
// // QUEUEING THEORY MATH FUNCTIONS
// // ============================================

// /**
//  * Calculate D/D/1/K-1 metrics (Deterministic model)
//  * @param {number} lambda - Arrival rate
//  * @param {number} mu - Service rate
//  * @param {number} K - System capacity
//  * @param {number} n0 - Initial customers
//  * @param {number} t - Time point
//  * @returns {Object} Queue metrics
//  */
function calculateDD1K1(lambda, mu, K, n0, t) {
    // Instantaneous number in system
    const netRate = lambda - mu;
    let nt = n0 + netRate * t;
    nt = Math.max(0, Math.min(K - 1, nt));

    const rho = lambda / mu;

    let L = 0;
    let Lq = 0;

    if (lambda < mu) {
        // System periodically empties
        // Average customers in system over a cycle (educational approximation)
        L = (lambda * lambda) / (2 * mu * (mu - lambda));
        // Lq should be L minus mean in service (<=1)
        Lq = L - (lambda / mu);
        // Ensure non-negative
        Lq = Math.max(0, Lq);
    } else if (Math.abs(lambda - mu) < 1e-9) {

        // Linear growth / flat depending on initial condition
        L = n0;
        Lq = Math.max(0, n0 - 1);
    } else {
        // System saturates at capacity
        L = K - 1;
        Lq = Math.max(0, K - 2);
    }

    const W = lambda > 0 ? L / lambda : 0;
    const Wq = lambda > 0 ? Lq / lambda : 0;

    return {
        nt: +nt.toFixed(3),
        L: +L.toFixed(3),
        Lq: +Lq.toFixed(3),
        W: +W.toFixed(3),
        Wq: +Wq.toFixed(3),
        rho: +rho.toFixed(3)
    };
}

/**
 * Calculate M/M/1 metrics (Single server, infinite capacity)
 */
function calculateMM1(lambda, mu) {
    const rho = lambda / mu;

    if (rho >= 1) {
        return {
            nt: Infinity,
            L: Infinity,
            Lq: Infinity,
            W: Infinity,
            Wq: Infinity,
            rho,
            error: 'System unstable: λ must be less than μ for M/M/1'
        };
    }

    const L = rho / (1 - rho);
    const Lq = (rho * rho) / (1 - rho);
    const W = 1 / (mu - lambda);
    const Wq = rho / (mu * (1 - rho));

    return {
        nt: +L.toFixed(3),
        L: +L.toFixed(3),
        Lq: +Lq.toFixed(3),
        W: +W.toFixed(3),
        Wq: +Wq.toFixed(3),
        rho: +rho.toFixed(3)
    };
}

/**
 * Factorial helper (M/M/C)
 */
function factorial(n) {
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

/**
 * Calculate M/M/C metrics (Multiple servers, infinite capacity)
 */
function calculateMMC(lambda, mu, c) {
    const rho = lambda / (c * mu);
    const r = lambda / mu;

    if (rho >= 1) {
        return {
            nt: Infinity,
            L: Infinity,
            Lq: Infinity,
            W: Infinity,
            Wq: Infinity,
            rho,
            error: 'System unstable: λ must be less than c×μ for M/M/C'
        };
    }

    let sum = 0;
    for (let n = 0; n < c; n++) {
        sum += Math.pow(r, n) / factorial(n);
    }

    const tail = (Math.pow(r, c) / factorial(c)) * (1 / (1 - rho));
    const P0 = 1 / (sum + tail);

    const Lq = (P0 * Math.pow(r, c) * rho) /
                         (factorial(c) * Math.pow(1 - rho, 2));

    const L = Lq + r;
    const W = L / lambda;
    const Wq = Lq / lambda;

    return {
        nt: +L.toFixed(3),
        L: +L.toFixed(3),
        Lq: +Lq.toFixed(3),
        W: +W.toFixed(3),
        Wq: +Wq.toFixed(3),
        rho: +rho.toFixed(3)
    };
}

// ============================================
// DIAGRAM RENDERING
// ============================================

/**
 * Draw the queue diagram SVG
 * @param {string} model - Current model type
 * @param {number} queueLength - Number in queue
 * @param {number} servers - Number of servers
 */
function drawDiagram(model, queueLength, servers) {
    const svg = document.getElementById('queueDiagram');
    const numServers = model === 'MMC' ? servers : 1;
    const displayQueue = Math.min(Math.max(0, Math.floor(queueLength)), 8);

    let html = '';

    // Arrival arrow
    html += `
        <g>
            <line x1="30" y1="100" x2="100" y2="100" stroke="hsl(142, 76%, 36%)" stroke-width="3" marker-end="url(#arrowGreen)"/>
            <text x="65" y="85" text-anchor="middle" fill="hsl(142, 76%, 36%)" font-size="14" font-weight="600">λ</text>
        </g>
    `;

    // Queue box
    html += `
        <g>
            <rect x="110" y="70" width="180" height="60" rx="8" fill="hsl(38, 92%, 95%)" stroke="hsl(38, 92%, 50%)" stroke-width="2"/>
            <text x="200" y="60" text-anchor="middle" fill="hsl(38, 92%, 40%)" font-size="12" font-weight="500">Queue</text>
    `;

    // Customers in queue
    for (let i = 0; i < displayQueue; i++) {
        const cx = 130 + i * 20;
        html += `<circle cx="${cx}" cy="100" r="8" fill="hsl(38, 92%, 50%)"/>`;
    }
    if (queueLength > 8) {
        html += `<text x="270" y="105" fill="hsl(38, 92%, 40%)" font-size="12">+${Math.floor(queueLength) - 8}</text>`;
    }
    html += '</g>';

    // Arrow to servers
    html += `
        <line x1="290" y1="100" x2="350" y2="100" stroke="hsl(215, 16%, 47%)" stroke-width="2" marker-end="url(#arrowGray)"/>
    `;

    // Server(s)
    const serverHeight = numServers > 1 ? 40 : 60;
    const serverStartY = numServers > 1 ? 40 : 70;
    const serverSpacing = numServers > 1 ? 50 : 0;

    for (let i = 0; i < Math.min(numServers, 3); i++) {
        const y = serverStartY + i * serverSpacing;
        html += `
            <g>
                <rect x="360" y="${y}" width="100" height="${serverHeight}" rx="8" fill="hsl(221, 83%, 95%)" stroke="hsl(221, 83%, 53%)" stroke-width="2"/>
                <text x="410" y="${y + serverHeight/2 + 5}" text-anchor="middle" fill="hsl(221, 83%, 43%)" font-size="12" font-weight="500">Server ${numServers > 1 ? i + 1 : ''}</text>
            </g>
        `;
    }
    if (numServers > 3) {
        html += `<text x="410" y="175" text-anchor="middle" fill="hsl(221, 83%, 43%)" font-size="11">+${numServers - 3} more</text>`;
    }

    // Departure arrow
    const exitY = numServers > 1 ? 80 : 100;
    html += `
        <g>
            <line x1="460" y1="${exitY}" x2="530" y2="${exitY}" stroke="hsl(0, 84%, 60%)" stroke-width="3" marker-end="url(#arrowRed)"/>
            <text x="495" y="${exitY - 15}" text-anchor="middle" fill="hsl(0, 84%, 60%)" font-size="14" font-weight="600">μ</text>
        </g>
    `;

    // Arrow markers
    html += `
        <defs>
            <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="hsl(142, 76%, 36%)"/>
            </marker>
            <marker id="arrowGray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="hsl(215, 16%, 47%)"/>
            </marker>
            <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="hsl(0, 84%, 60%)"/>
            </marker>
        </defs>
    `;

    svg.innerHTML = html;
}

// ============================================
// UI LOGIC
// ============================================

let currentModel = 'DD1K1';

const modelDescriptions = {
    DD1K1: 'Deterministic arrival and service with single server and finite capacity K-1',
    MM1: 'Markovian (Poisson) arrivals and exponential service with single server',
    MMC: 'Markovian arrivals and exponential service with multiple (C) servers'
};

const modelFormulas = {
    DD1K1: `
        <div class="formula-item"><strong>D/D/1/K-1 Model:</strong></div>
        <div class="formula-item"><code>n(t) = n₀ + (λ - μ)t</code> bounded by [0, K-1]</div>
        <div class="formula-item"><code>ρ = λ / μ</code> (utilization)</div>
    `,
    MM1: `
        <div class="formula-item"><strong>M/M/1 Model:</strong> (requires λ < μ)</div>
        <div class="formula-item"><code>ρ = λ / μ</code></div>
        <div class="formula-item"><code>L = ρ / (1 - ρ)</code></div>
        <div class="formula-item"><code>Lq = ρ² / (1 - ρ)</code></div>
        <div class="formula-item"><code>W = 1 / (μ - λ)</code></div>
        <div class="formula-item"><code>Wq = ρ / (μ(1 - ρ))</code></div>
    `,
    MMC: `
        <div class="formula-item"><strong>M/M/C Model:</strong> (requires λ < c×μ)</div>
        <div class="formula-item"><code>ρ = λ / (c × μ)</code></div>
        <div class="formula-item"><code>P₀ = [Σ(r^n/n!) + (r^c/c!)×(1/(1-ρ))]⁻¹</code></div>
        <div class="formula-item"><code>Lq = P₀ × r^c × ρ / (c! × (1-ρ)²)</code></div>
        <div class="formula-item"><code>L = Lq + λ/μ</code></div>
    `
};

/**
 * Update visible input fields based on model
 */
function updateInputVisibility() {
    const kGroup = document.getElementById('kGroup');
    const n0Group = document.getElementById('n0Group');
    const tGroup = document.getElementById('tGroup');
    const cGroup = document.getElementById('cGroup');

    // Reset all
    if (kGroup) kGroup.style.display = 'none';
    if (n0Group) n0Group.style.display = 'none';
    if (tGroup) tGroup.style.display = 'none';
    if (cGroup) cGroup.style.display = 'none';

    switch (currentModel) {
        case 'DD1K1':
            if (kGroup) kGroup.style.display = 'flex';
            if (n0Group) n0Group.style.display = 'flex';
            if (tGroup) tGroup.style.display = 'flex';
            break;
        case 'MM1':
            // Only λ and μ needed
            break;
        case 'MMC':
            if (cGroup) cGroup.style.display = 'flex';
            break;
    }

    // Update description and formulas
    const descEl = document.getElementById('modelDescription');
    const formulaEl = document.getElementById('formulaContent');
    if (descEl) descEl.textContent = modelDescriptions[currentModel];
    if (formulaEl) formulaEl.innerHTML = modelFormulas[currentModel];
}

/**
 * Handle model tab selection
 */
function setupModelTabs() {
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentModel = tab.dataset.model;
            updateInputVisibility();
            clearResults();
            drawDiagram(currentModel, 0, currentModel === 'MMC' ? 2 : 1);
        });
    });
}

/**
 * Clear results display
 */
function clearResults() {
    const el = (id) => document.getElementById(id);
    if (el('metricNt')) el('metricNt').textContent = '-';
    if (el('metricL')) el('metricL').textContent = '-';
    if (el('metricLq')) el('metricLq').textContent = '-';
    if (el('metricW')) el('metricW').textContent = '-';
    if (el('metricWq')) el('metricWq').textContent = '-';
    if (el('metricRho')) el('metricRho').textContent = '-';
    hideError();
}

/**
 * Display results
 */
function displayResults(results) {
    if (results.error) {
        showError(results.error);
        return;
    }

    hideError();

    const format = (val) => {
        if (val === Infinity) return '∞';
        if (isNaN(val)) return '-';
        return (typeof val === 'number') ? val.toFixed(3) : val;
    };

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = format(value);
    };

    setText('metricNt', results.nt);
    setText('metricL', results.L);
    setText('metricLq', results.Lq);
    setText('metricW', results.W);
    setText('metricWq', results.Wq);
    setText('metricRho', results.rho);
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('visible');
}

/**
 * Hide error message
 */
function hideError() {
    const errorEl = document.getElementById('errorMessage');
    if (!errorEl) return;
    errorEl.classList.remove('visible');
}

/**
 * Handle form submission
 */
function handleCalculate(e) {
    e.preventDefault();

    const lambda = parseFloat(document.getElementById('lambda').value);
    const mu = parseFloat(document.getElementById('mu').value);
    const c = parseInt(document.getElementById('c').value) || 2;
    const K = parseInt(document.getElementById('k').value) || 10;
    const n0 = parseInt(document.getElementById('n0').value) || 0;
    const t = parseFloat(document.getElementById('t').value) || 0;

    // Validation
    if (isNaN(lambda) || lambda <= 0) {
        showError('Arrival rate (λ) must be a positive number');
        return;
    }
    if (isNaN(mu) || mu <= 0) {
        showError('Service rate (μ) must be a positive number');
        return;
    }

    let results;

    switch (currentModel) {
        case 'DD1K1':
            if (K < 1) {
                showError('System capacity (K) must be at least 1');
                return;
            }
            results = calculateDD1K1(lambda, mu, K, n0, t);
            break;

        case 'MM1':
            results = calculateMM1(lambda, mu);
            break;

        case 'MMC':
            if (c < 1) {
                showError('Number of servers (c) must be at least 1');
                return;
            }
            results = calculateMMC(lambda, mu, c);
            break;
    }

    displayResults(results);
    drawDiagram(currentModel, results.Lq || 0, c);
}

/**
 * Initialize the application
 */
function init() {
    setupModelTabs();
    updateInputVisibility();

    const form = document.getElementById('queueForm');
    if (form) form.addEventListener('submit', handleCalculate);

    // Initial diagram
    drawDiagram('DD1K1', 0, 1);
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
