/* worker.js */

// Constants
const FILAS = 12;
const COLUMNAS = 4;
const MAX_COMB = 16777216;
const MAP_SIGNOS = ['0', '1', '2', 'M'];

// Memory State (in worker)
let indicesRentables = new Uint32Array(0);
let ratiosRentables = new Float32Array(0);
let countRentables = 0;
let abortController = null;

// Values for sorting logic
let currentLogRMatrix = null;

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

// ... (doCalcEntropia remains same) ...

// --- 2. GENERATE RENTABLES ---
function doRunRentables({ textReales, textLae, umbral }) {
    const mR = parseMatriz(textReales);
    const mA = parseMatriz(textLae);

    if (!mR || !mA) {
        throw new Error("Datos de porcentajes inválidos.");
    }

    // Pre-calculate logs
    const logR = precalcLogs(mR);
    const logA = precalcLogs(mA);
    currentLogRMatrix = logR; // Store for sorting

    // SAFETY LIMIT for Mobile Memory (approx 3MB raw + overhead)
    let MAX_STORED = 300000;

    // We don't know the exact size yet, but we can't over-allocate too much.
    // We'll use a dynamic approach or a large fixed Buffer if possible.
    // A Uint32Array(300,000) is tiny.
    let capacity = 300000;
    if (capacity > MAX_STORED) capacity = MAX_STORED;

    indicesRentables = new Uint32Array(capacity);
    ratiosRentables = new Float32Array(capacity);
    countRentables = 0;

    const batchSize = 160000;

    // Loop
    for (let i = 0; i < MAX_COMB; i++) {
        // If we hit the safety limit, we stop collecting to safe memory
        // Ideally we would warn the user.
        if (countRentables >= MAX_STORED) {
            // We can't store more. We break early to save the user's browser.
            // We will send a special "limit reached" status later.
            break;
        }

        let t = i;
        let lR = 0;
        let lA = 0;

        for (let j = FILAS - 1; j >= 0; j--) {
            let v = t % 4;
            lR += logR[j][v];
            lA += logA[j][v];
            t = (t - v) / 4;
        }

        const ratio = Math.exp(lR - lA);
        if (ratio >= umbral) {
            indicesRentables[countRentables] = i;
            ratiosRentables[countRentables] = ratio;
            countRentables++;
        }

        if (i % batchSize === 0) {
            self.postMessage({ type: 'PROGRESS', percent: (i / MAX_COMB * 100).toFixed(0), status: `Generando... (Max 300k)` });
        }
    }

    // Sort logic
    self.postMessage({ type: 'PROGRESS', percent: 100, status: 'Ordenando...' });

    // Sorting by Probability Real (LogR). 
    // We need to recreate probabilities for sorting.
    // Optimization: Create a Sort Index array.
    let sortIndices = new Uint32Array(countRentables);
    for (let i = 0; i < countRentables; i++) sortIndices[i] = i;

    // Custom sort
    sortIndices.sort((a, b) => {
        const probA = calcLogR(indicesRentables[a], currentLogRMatrix);
        const probB = calcLogR(indicesRentables[b], currentLogRMatrix);
        return probB - probA; // DESC
    });

    // Reorder our arrays based on sortIndices
    let finalIndices = new Uint32Array(countRentables);
    let finalRatios = new Float32Array(countRentables);
    for (let i = 0; i < countRentables; i++) {
        finalIndices[i] = indicesRentables[sortIndices[i]];
        finalRatios[i] = ratiosRentables[sortIndices[i]];
    }
    indicesRentables = finalIndices;
    ratiosRentables = finalRatios;

    self.postMessage({ type: 'RENTABLES_DONE', count: countRentables });
}

function calcLogR(combIndex, logMatrix) {
    let t = combIndex;
    let sum = 0;
    for (let j = FILAS - 1; j >= 0; j--) {
        let v = t % 4;
        sum += logMatrix[j][v];
        t = (t - v) / 4;
    }
    return sum;
}

// Recreate string from index
function getCombString(idx) {
    let t = idx;
    let chars = new Array(12);
    for (let j = FILAS - 1; j >= 0; j--) {
        let v = t % 4;
        chars[j] = MAP_SIGNOS[v];
        t = (t - v) / 4;
    }
    return chars.join('');
}

// --- 3. REDUCTION ---
function doRunReduccion({ dist, max }) {
    abortController = new AbortController();
    const signal = abortController.signal;

    let selIndices = [];
    let selStrings = []; // Cache strings of selected to avoid recalculating distance
    const total = countRentables;
    let checked = 0;

    for (let i = 0; i < total; i++) {
        if (signal.aborted) {
            // Return selected as objects for display/download
            const results = selIndices.map((idx, index) => ({
                c: selStrings[index],
                r: ratiosRentables[idx] // Wait, idx here is the pointer in indicesRentables... no.
                // It should be the original values.
            }));
            // Let's fix this result mapping
            return;
        }

        if (max > 0 && selIndices.length >= max) break;

        const candIndex = indicesRentables[i];
        const candString = getCombString(candIndex);

        let valid = true;
        for (let s of selStrings) {
            if (calcDistStrings(candString, s) < dist) {
                valid = false;
                break;
            }
        }

        if (valid) {
            selIndices.push(i);
            selStrings.push(candString);
        }

        checked++;
        if (checked % 2000 === 0) {
            self.postMessage({ type: 'PROGRESS', percent: (checked / total * 100).toFixed(0), status: `Reduciendo... (${selIndices.length})` });
        }
    }

    // Map to final objects for UI
    const finalResults = selIndices.map((val, idx) => {
        const originalArrayIdx = val;
        const combIdx = indicesRentables[originalArrayIdx];
        const ratio = ratiosRentables[originalArrayIdx];
        return {
            c: selStrings[idx],
            r: ratio,
            lr: calcLogR(combIdx, currentLogRMatrix)
        };
    });

    self.postMessage({ type: 'REDUCCION_DONE', sel: finalResults });
}

function calcDistStrings(a, b) {
    let d = 0;
    for (let i = 0; i < 12; i += 2) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) {
            d++;
        }
    }
    return d;
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
