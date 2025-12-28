/* worker.js */

// Constants
const FILAS = 12;
const COLUMNAS = 4;
const MAX_COMB = 16777216;
const MAP_SIGNOS = ['0', '1', '2', 'M'];

// Memory State (in worker)
let listaRentables = []; // Stores the generated combinations
let abortController = null; // For cancelling reduction

self.onmessage = function (e) {
    const { action, payload } = e.data;

    try {
        switch (action) {
            case 'CALC_ENTROPIA':
                doCalcEntropia(payload);
                break;
            case 'RUN_RENTABLES':
                doRunRentables(payload);
                break;
            case 'RUN_REDUCCION':
                doRunReduccion(payload);
                break;
            case 'STOP_REDUCCION':
                if (abortController) abortController.abort();
                break;
            default:
                break;
        }
    } catch (err) {
        self.postMessage({ type: 'ERROR', msg: err.message });
    }
};

// --- 1. ENTROPIA ---
function doCalcEntropia({ rawText }) {
    const m = parseMatriz(rawText);
    if (!m) {
        self.postMessage({ type: 'ENTROPIA_RESULT', value: null });
        return;
    }

    let ent = 0;
    for (let i = 0; i < FILAS; i++) {
        let row = 0;
        for (let j = 0; j < COLUMNAS; j++) {
            if (m[i][j] > 0) {
                // Math.log in JS is base e. To get base 4: Math.log(x) / Math.log(4)
                row += m[i][j] * (Math.log(m[i][j]) / Math.log(4.0));
            }
        }
        ent -= row;
    }
    self.postMessage({ type: 'ENTROPIA_RESULT', value: ent });
}

// --- 2. GENERATE RENTABLES ---
function doRunRentables({ textReales, textLae, umbral }) {
    const mR = parseMatriz(textReales);
    const mA = parseMatriz(textLae);

    if (!mR || !mA) {
        throw new Error("Datos de porcentajes inválidos.");
    }

    listaRentables = []; // Clear previous
    let count = 0;
    const batchSize = 160000;

    // Pre-calculate logs to speed up the loop
    const logR = precalcLogs(mR);
    const logA = precalcLogs(mA);

    // Use a reusable buffer for combinations if needed, but since we are filtering, we recreate strings.
    // Optimization: We iterate 0 to MAX_COMB.

    for (let i = 0; i < MAX_COMB; i++) {
        let t = i;
        let lR = 0;
        let lA = 0;
        let combStr = "";

        // Build combination from the bottom up (or top down matches C# loop j=FILAS-1)
        // C# Loop: for(int j=FILAS-1; j>=0; j--) { int v = t%4; ... t/=4; }
        // We must construct the string in the correct order.

        // We can build an array of chars then join, or prepend string (slower).
        // Since it's fixed 12 chars, let's use a temporary array.
        let chars = new Array(12);

        for (let j = FILAS - 1; j >= 0; j--) {
            let v = t % 4;
            chars[j] = MAP_SIGNOS[v];
            lR += logR[j][v];
            lA += logA[j][v];
            t = (t - v) / 4; // Integer division
        }

        // Check threshold
        // Ratio = exp(lR - lA) >= umbral
        if (Math.exp(lR - lA) >= umbral) {
            listaRentables.push({
                c: chars.join(''),
                lr: lR,
                la: lA,
                r: Math.exp(lR - lA)
            });
        }

        if (i % batchSize === 0) {
            self.postMessage({ type: 'PROGRESS', percent: (i / MAX_COMB * 100).toFixed(0), status: 'Generando...' });
        }
    }

    // Check if we have results
    if (listaRentables.length > 2000000) {
        // Safety warning for memory? 
    }

    // Sort
    self.postMessage({ type: 'PROGRESS', percent: 100, status: 'Ordenando...' });
    listaRentables.sort((a, b) => b.lr - a.lr); // Sort by ProbReal (matches C# LogProductoReales)

    self.postMessage({ type: 'RENTABLES_DONE', count: listaRentables.length });
}

// --- 3. REDUCTION ---
function doRunReduccion({ dist, max }) {
    abortController = new AbortController();
    const signal = abortController.signal;

    let sel = [];
    const total = listaRentables.length;
    let checked = 0;

    // Reduction loop
    // Logic: Greedy selection. 
    // Pick first, then only pick next if dist(next, selected) >= dist for ALL selected.

    for (let i = 0; i < total; i++) {
        if (signal.aborted) {
            self.postMessage({ type: 'REDUCCION_DONE', sel: sel, stopped: true });
            return;
        }

        if (max > 0 && sel.length >= max) break;

        const candidate = listaRentables[i];

        // Check distance against all currently selected
        let valid = true;
        // Optimization: checking in reverse might be faster if we assume recent adds are closer? not necessarily.
        for (let s of sel) {
            if (calcDist(candidate.c, s.c) < dist) {
                valid = false;
                break;
            }
        }

        if (valid) {
            sel.push(candidate);
        }

        checked++;
        if (checked % 2000 === 0) {
            self.postMessage({ type: 'PROGRESS', percent: (checked / total * 100).toFixed(0), status: `Reduciendo... (${sel.length})` });
        }
    }

    self.postMessage({ type: 'REDUCCION_DONE', sel: sel });
}

// Helpers
function parseMatriz(text) {
    if (!text) return null;
    // Match numbers like C#: \d+([.,]\d+)?
    // But in JS regex, be careful.
    const regex = /\d+([.,]\d+)?/g;
    const matches = text.match(regex);

    if (!matches || matches.length < 48) return null; // 12 * 4 = 48

    let m = [];
    let k = 0;
    for (let i = 0; i < FILAS; i++) {
        m[i] = [];
        for (let j = 0; j < COLUMNAS; j++) {
            let valStr = matches[k++].replace(',', '.');
            let val = parseFloat(valStr);
            if (val > 1) val /= 100.0;
            if (val <= 0) val = 1e-7; // Prevent log(0)
            m[i][j] = val;
        }
    }
    return m;
}

function precalcLogs(matrix) {
    let logs = [];
    for (let i = 0; i < FILAS; i++) {
        logs[i] = [];
        for (let j = 0; j < COLUMNAS; j++) {
            logs[i][j] = Math.log(matrix[i][j]);
        }
    }
    return logs;
}

function calcDist(a, b) {
    let d = 0;
    // C# logic: for(int i=0; i<FILAS; i+=2) if(a[i]!=b[i] || a[i+1]!=b[i+1]) d++;
    // Wait, the C# code has: for(int i=0; i<FILAS; i+=2) ... ?
    // Let me check the user request.
    // "for(int i=0; i<FILAS; i+=2) if(a[i]!=b[i] || a[i+1]!=b[i+1]) d++;"
    // "FILAS = 12". "i" goes 0, 2, 4, 6, 8, 10.
    // It checks pairs of matches? 
    // Ah, Quinigol often groups matches? Or maybe "Resultados por partido"?
    // Actually standard Hamming distance counts different CHARACTERS.
    // The C# code says: "if(a[i]!=b[i] || a[i+1]!=b[i+1]) d++"
    // This implies it treats a BLOCK of 2 characters as 1 unit of distance? 
    // Or maybe it's checking Matches 1&2 together?
    // Wait, FILAS=12 usually means 12 matches? 
    // In Quinigol, there are 6 matches, each has "Local" and "Visitante" goals (M-M). 
    // But standard formatting is 1 row per team stats?
    // Let's look at the C# data model.
    // "ItemPartido { InfoPartido partido ... }"
    // "StatsEquipo local ... StatsEquipo visitante"
    // The "dgvBoleto" adds columns Local and Visitante.
    // The "txtEditor" format seems to have 2 lines per match (Local row, Visitante row)?
    // "if (p.segunAnalisis?.local != null) tr += ... \r\n"
    // "if (p.segunAnalisis?.visitante != null) tr += ... \r\n"
    // So yes, 1 Match = 2 Rows (Local Goals, Visitor Goals).
    // Total 6 Matches = 12 Rows.
    // So `i+=2` iterates over MATCHES.
    // Distance behaves as: "If LocalGoals differs OR VisitorGoals differs, Distance++".
    // So filtering distance is based on Matches, not individual goal lines.

    // Implementing EXACT C# Logic:
    for (let i = 0; i < 12; i += 2) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) {
            d++;
        }
    }
    return d;
}
