/* app.js */

// Elements
const elements = {
    inpSeason: document.getElementById('inpSeason'),
    inpRound: document.getElementById('inpRound'),
    btnDownload: document.getElementById('btnDownload'),
    apiStatus: document.getElementById('apiStatus'),
    apiDates: document.getElementById('apiDates'),
    matchGrid: document.getElementById('matchGrid'),

    txtReales: document.getElementById('txtReales'),
    txtLae: document.getElementById('txtLae'),
    entropyLabel: document.getElementById('entropyLabel'),

    inpUmbral: document.getElementById('inpUmbral'),
    btnCalculate: document.getElementById('btnCalculate'),

    selDist: document.getElementById('selDist'),
    inpMaxCombs: document.getElementById('inpMaxCombs'),
    recommendationLabel: document.getElementById('recommendationLabel'),
    btnFilter: document.getElementById('btnFilter'),
    btnStop: document.getElementById('btnStop'),

    resultsSection: document.getElementById('resultsSection'),
    resBase: document.getElementById('resBase'),
    resFinal: document.getElementById('resFinal'),

    progressBar: document.getElementById('progressBar'),
    mainStatus: document.getElementById('mainStatus'),
    mainPercent: document.getElementById('mainPercent')
};

// State
let worker = new Worker('worker.js');
let reducedCombinations = [];

// Worker Handlers
worker.onmessage = function (e) {
    const data = e.data;
    if (data.type === 'PROGRESS') {
        updateProgress(data.percent, data.status);
    } else if (data.type === 'ENTROPIA_RESULT') {
        updateEntropyUI(data.value);
    } else if (data.type === 'RENTABLES_DONE') {
        updateProgress(100, 'Rentables generadas');
        elements.resBase.textContent = data.count;
        elements.btnCalculate.disabled = false;
        elements.btnFilter.disabled = false;
        alert(`Generadas ${data.count} combinaciones base. Ahora puedes filtrar.`);
    } else if (data.type === 'REDUCCION_DONE') {
        updateProgress(100, data.stopped ? 'Parado por usuario' : 'Finalizado');
        reducedCombinations = data.sel;
        elements.resFinal.textContent = reducedCombinations.length;
        elements.resultsSection.classList.remove('hidden');
        elements.btnFilter.classList.remove('hidden');
        elements.btnStop.classList.add('hidden');
    } else if (data.type === 'ERROR') {
        alert("Error: " + data.msg);
        elements.btnCalculate.disabled = false;
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    elements.btnDownload.addEventListener('click', downloadData);

    elements.txtReales.addEventListener('input', () => {
        worker.postMessage({ action: 'CALC_ENTROPIA', payload: { rawText: elements.txtReales.value } });
    });

    elements.btnCalculate.addEventListener('click', () => {
        const umbral = parseFloat(elements.inpUmbral.value.replace(',', '.'));
        if (isNaN(umbral)) return alert("Coeficiente incorrecto");

        elements.btnCalculate.disabled = true;
        elements.btnFilter.disabled = true;
        elements.resultsSection.classList.add('hidden');

        worker.postMessage({
            action: 'RUN_RENTABLES',
            payload: {
                textReales: elements.txtReales.value,
                textLae: elements.txtLae.value,
                umbral: umbral
            }
        });
    });

    elements.btnFilter.addEventListener('click', () => {
        const dist = parseInt(elements.selDist.value);
        const max = parseInt(elements.inpMaxCombs.value);

        elements.btnFilter.classList.add('hidden');
        elements.btnStop.classList.remove('hidden');

        worker.postMessage({
            action: 'RUN_REDUCCION',
            payload: { dist, max }
        });
    });

    elements.btnStop.addEventListener('click', () => {
        worker.postMessage({ action: 'STOP_REDUCCION' });
    });
});

// --- UI HELPERS ---
function toggleSection(id) {
    document.getElementById(id).classList.toggle('collapsed');
}

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    // Find button
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes(tabId === 'tabReales' ? 'REALES' : 'LAE'));
    if (btn) btn.classList.add('active');
}

function updateProgress(percent, status) {
    elements.progressBar.style.width = percent + '%';
    elements.mainPercent.textContent = percent + '%';
    elements.mainStatus.textContent = status;
}

function updateEntropyUI(val) {
    if (val === null) {
        elements.entropyLabel.textContent = "Entropía: ---";
        return;
    }
    const isEasy = val < 10.8;
    const txt = isEasy ? "(FÁCIL)" : "(DIFÍCIL)";
    elements.entropyLabel.textContent = `Entropía: ${val.toFixed(2)} ${txt}`;
    elements.entropyLabel.style.color = isEasy ? "green" : "red";
    elements.recommendationLabel.textContent = `Recomendación: ${isEasy ? 'Distancia 1' : 'Distancia 3'}`;
    elements.selDist.value = isEasy ? 1 : 3;
}

// --- API ---
async function downloadData() {
    const temp = elements.inpSeason.value;
    const jor = elements.inpRound.value;
    const url = `https://api.eduardolosilla.es/quinigol/porcentajes?temporada=${temp}&jornada=${jor}`;
    // const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url); // Fallback option if needed

    elements.btnDownload.disabled = true;
    elements.apiStatus.textContent = "Conectando...";

    try {
        // First try direct
        let response;
        try {
            response = await fetch(url);
        } catch (e) {
            console.warn("Direct fetch failed, trying proxy if configured or alerting user.");
            // For this demo, we can assume direct won't work on many browsers without CORS, 
            // but let's try. If it fails, maybe use a public proxy or ask user.
            // Since I cannot setup a real proxy, I will throw to catch.
            throw new Error("Bloqueo CORS detectado (Es normal en web).");
        }

        if (!response.ok) throw new Error("Error HTTP " + response.status);
        const data = await response.json();
        processData(data);
        elements.apiStatus.textContent = "Datos cargados OK";

    } catch (err) {
        elements.apiStatus.textContent = "Error de conexión";
        alert("No se pudo conectar a la API (Posible bloqueo CORS). \n\nSolución:\n1. Usa una extensión 'Allow CORS'.\n2. O copia los datos manualmente.\n\nError: " + err.message);
    } finally {
        elements.btnDownload.disabled = false;
    }
}

function processData(root) {
    if (!root || !root.porcentajes) return;

    // Dates
    const f1 = root.fecha_actualizacion_porcentajes_reales ? new Date(root.fecha_actualizacion_porcentajes_reales * 1000).toLocaleString() : 'N/A';
    const f2 = root.fecha_actualizacion_porcentajes_lae ? new Date(root.fecha_actualizacion_porcentajes_lae * 1000).toLocaleString() : 'N/A';
    elements.apiDates.innerHTML = `Actualización:<br>Reales: ${f1}<br>LAE: ${f2}`;

    // Process Matches
    const lista = root.porcentajes.sort((a, b) => a.partido.orden - b.partido.orden);
    let strR = "", strL = "";

    elements.matchGrid.innerHTML = "";

    lista.forEach(p => {
        // Grid UI
        const div = document.createElement('div');
        div.className = 'match-item';
        div.innerHTML = `
            <div class="match-time">${p.partido.orden}. ${p.partido.horario.dia} ${p.partido.horario.hora}</div>
            <div class="match-teams">
                <span>${p.partido.local.nombre}</span>
                <span>${p.partido.visitante.nombre}</span>
            </div>
        `;
        elements.matchGrid.appendChild(div);

        // Text Data Construction
        // Format: 4 numbers tab separated per line
        const fmt = (stats) => {
            if (!stats) return "0\t0\t0\t0";
            return `${stats.porcentaje0.toFixed(2)}\t${stats.porcentaje1.toFixed(2)}\t${stats.porcentaje2.toFixed(2)}\t${stats.porcentajeM.toFixed(2)}`;
        };

        // Local Row
        strR += fmt(p.segunAnalisis?.local) + "\n";
        strL += fmt(p.segunLAE?.local) + "\n";
        // Visitor Row
        strR += fmt(p.segunAnalisis?.visitante) + "\n";
        strL += fmt(p.segunLAE?.visitante) + "\n";
    });

    elements.txtReales.value = strR;
    elements.txtLae.value = strL;

    // Trigger Entropy Calc
    worker.postMessage({ action: 'CALC_ENTROPIA', payload: { rawText: strR } });
    elements.btnCalculate.disabled = false;
}

// --- DOWNLOADS ---
window.downloadFile = function (type) {
    let content = "";
    if (type === 'txt') {
        content = reducedCombinations.map(x => x.c).join('\r\n');
    } else {
        content = "Combinacion;ProductoReales;ProductoApostadas;Ratio\r\n";
        content += reducedCombinations.map(x => `${x.c};${Math.exp(x.lr).toFixed(10)};${Math.exp(x.la).toFixed(10)};${x.r.toFixed(4)}`).join('\r\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rentagol_${elements.inpRound.value}_${reducedCombinations.length}.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};
