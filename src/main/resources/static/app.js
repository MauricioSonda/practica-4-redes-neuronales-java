const state = { type: 'classification', charts: [] };
const descriptions = {
  classification: ['Wine Quality', 'Clasificación comercial de calidad del vino.', 260, 32],
  regression: ['Airfoil Self-Noise', 'Regresión industrial del ruido aerodinámico.', 500, 64],
  timeseries: ['ItalyPowerDemand', 'Clasificación de curvas diarias de demanda.', 400, 32]
};

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  button.classList.add('active');
  state.type = button.dataset.type;
  const [title, copy, epochs, neurons] = descriptions[state.type];
  document.querySelector('#experiment-title').textContent = title;
  document.querySelector('#experiment-copy').textContent = copy;
  document.querySelector('#epochs').placeholder = String(epochs);
  document.querySelector('#neurons').placeholder = String(neurons);
  loadPrecomputed({ scroll: false });
}));

document.querySelector('#train').addEventListener('click', train);
document.querySelector('#precomputed').addEventListener('click', () => loadPrecomputed({ scroll: true }));
document.querySelector('#copy-prompt').addEventListener('click', copyPrompt);

async function train() {
  const payload = {
    epochs: numberOrNull('#epochs'),
    learningRate: numberOrNull('#learning-rate'),
    neurons: numberOrNull('#neurons')
  };
  const type = state.type;
  setRunSummaryLoading(type, payload);
  focusRunSummary();
  await request(`/api/train/${type}`,
    { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) },
    { kind: 'execution', type, submitted: payload, startedAt: Date.now(), startTime: performance.now(), scroll: true });
}

async function loadPrecomputed({ scroll = false } = {}) {
  const type = state.type;
  await request(`/api/results/${type}`, {}, { kind: 'saved', type, startTime: performance.now(), scroll });
}

async function request(url, options = {}, context = {}) {
  const cacheKey = `neural-lab-result-${context.type || state.type}`;
  toggleLoading(true);
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    localStorage.setItem(cacheKey, JSON.stringify(data));
    render(data);
    renderRunSummary(data, {...context, status: 'success', durationMs: performance.now() - context.startTime});
    setConnectionState(true);
  } catch (error) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      render(data);
      renderRunSummary(data, {...context, kind: 'cached', status: 'warning', error: error.message});
      setConnectionState(false, 'Servidor sin conexión. Se muestran los últimos resultados guardados en este navegador.');
    } else {
      document.querySelector('#details').innerHTML = '<p class="error">No se pudo contactar el servidor. Ejecuta el JAR en modo web y vuelve a cargar esta página.</p>';
      renderRunError(context, error);
      setConnectionState(false, 'No hay conexión con el servidor Java.');
    }
  } finally {
    toggleLoading(false);
    if (context.scroll) focusRunSummary();
  }
}

function render(data) {
  renderMetrics(data.metrics, data.experiment);
  renderLoss(data.lossCurve || []);
  if (data.experiment === 'regression') renderScatter(data.actualVsPredicted || []);
  else renderConfusion(data.metrics.confusionMatrix, data.metrics.classNames);
  renderDetails(data);
}

function renderMetrics(metrics, type) {
  const entries = type === 'regression'
    ? [['RMSE', metrics.rmse], ['MAE', metrics.mae], ['R²', metrics.r2]]
    : [['Accuracy', metrics.accuracy], ['F1 macro', metrics.macroF1], ['F1 ponderado', metrics.weightedF1]];
  document.querySelector('#metrics').innerHTML = entries.map((entry, i) =>
    `<article class="metric ${i === 0 ? 'featured' : ''}"><span>${entry[0]}</span><strong>${format(entry[1], type !== 'regression')}</strong></article>`).join('');
}

function renderLoss(curve) {
  destroyChart(0);
  state.charts[0] = new Chart(document.querySelector('#loss-chart'), {
    type: 'line', data: { labels: curve.map(p => p.epoch), datasets: [
      { label: 'Train', data: curve.map(p => p.train), borderColor: '#d69a5b', backgroundColor: 'rgba(214,154,91,.12)', tension: .25, pointRadius: 0 },
      { label: 'Validación', data: curve.map(p => p.validation), borderColor: '#f2e3d0', borderDash: [5, 5], tension: .25, pointRadius: 0 }
    ]}, options: chartOptions('Época', 'Pérdida')
  });
}

function renderConfusion(matrix, labels) {
  document.querySelector('#second-title').textContent = 'Matriz de confusión';
  document.querySelector('#second-kicker').textContent = 'EVALUACIÓN';
  destroyChart(1);
  const datasets = labels.map((label, index) => ({ label: `Real: ${label}`, data: matrix[index], backgroundColor: ['#d69a5b','#e8a94d','#c66b4e'][index] }));
  state.charts[1] = new Chart(document.querySelector('#second-chart'), {
    type: 'bar', data: { labels: labels.map(l => `Pred. ${l}`), datasets },
    options: {...chartOptions('Predicción', 'Casos'), scales: {x: {stacked: true, ticks: {color:'#bca693'}, grid:{display:false}}, y:{stacked:true, ticks:{color:'#bca693'}, grid:{color:'rgba(188,166,147,.1)'}}}}
  });
}

function renderScatter(points) {
  document.querySelector('#second-title').textContent = 'Real vs. predicho';
  document.querySelector('#second-kicker').textContent = 'PRUEBA';
  destroyChart(1);
  const values = points.map(p => ({x: p.actual, y: p.predicted}));
  const min = Math.min(...points.flatMap(p => [p.actual, p.predicted]));
  const max = Math.max(...points.flatMap(p => [p.actual, p.predicted]));
  state.charts[1] = new Chart(document.querySelector('#second-chart'), {
    type: 'scatter', data: { datasets: [
      {label:'Muestras', data: values, backgroundColor:'#e8a94d', pointRadius:3},
      {label:'Ideal', data:[{x:min,y:min},{x:max,y:max}], borderColor:'#f2e3d0', type:'line', pointRadius:0}
    ]}, options: chartOptions('Valor real', 'Predicción')
  });
}

function renderDetails(data) {
  const architecture = data.winningArchitecture || data.architecture;
  let extra = '';
  if (data.fullDistribution) extra = `<article><b>Distribución completa</b><br>${Object.entries(data.fullDistribution).map(([k,v]) => `${k}: ${v}`).join(' · ')}</article>`;
  if (data.architectureComparisonValidation) extra += comparisonTable(data.architectureComparisonValidation);
  if (data.crossValidation) extra += comparisonTable(data.crossValidation.candidates);
  if (data.metrics.perClass) extra += classTable(data.metrics.perClass);
  document.querySelector('#details').innerHTML = `<div class="details-grid">
    <article><b>Dataset</b><br>${escapeHtml(data.dataset)}</article>
    <article><b>Arquitectura</b><br>${escapeHtml(architecture || '—')}</article>
    <article><b>Generado</b><br>${new Date(data.generatedAt).toLocaleString('es-MX')}</article>
    <article><b>Semilla</b><br>${data.hyperparameters?.seed ?? '20261013'}</article>
    ${extra}</div><p>${escapeHtml(data.description || '')}</p>`;
}

function comparisonTable(rows) {
  return `<article style="grid-column:1/-1"><b>Comparación de modelos</b><table><thead><tr><th>Arquitectura</th><th>RMSE / Accuracy</th><th>R² / F1</th><th>Época</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.architecture)}</td><td>${format(r.rmse ?? r.meanAccuracy ?? r.accuracy, false)}</td><td>${format(r.r2 ?? r.meanMacroF1 ?? r.macroF1, false)}</td><td>${r.bestEpoch ?? r.meanBestEpoch}</td></tr>`).join('')}</tbody></table></article>`;
}
function classTable(rows) {
  return `<article style="grid-column:1/-1"><b>Métricas por clase</b><table><thead><tr><th>Clase</th><th>Precisión</th><th>Recall</th><th>F1</th><th>N</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.className}</td><td>${format(r.precision,true)}</td><td>${format(r.recall,true)}</td><td>${format(r.f1,true)}</td><td>${r.support}</td></tr>`).join('')}</tbody></table></article>`;
}

function setRunSummaryLoading(type, submitted) {
  const title = descriptions[type][0];
  const summary = document.querySelector('#run-summary');
  summary.className = 'run-summary panel running';
  summary.querySelector('.run-indicator').textContent = '…';
  document.querySelector('#run-kicker').textContent = 'ENTRENAMIENTO EN PROCESO';
  document.querySelector('#run-title').textContent = `Ejecutando ${title}`;
  document.querySelector('#run-message').textContent = 'La red se está entrenando en Java con los valores capturados. Al terminar, este bloque mostrará únicamente los resultados de esta operación.';
  renderRunData([
    ['Épocas solicitadas', submitted.epochs ?? 'Automático'],
    ['Learning rate', submitted.learningRate ?? 'Automático'],
    ['Neuronas principales', submitted.neurons ?? 'Automático']
  ]);
}

function renderRunSummary(data, context) {
  const summary = document.querySelector('#run-summary');
  const type = data.experiment || context.type;
  const experimentTitle = descriptions[type]?.[0] || 'Red neuronal';
  const architecture = data.winningArchitecture || data.architecture || '—';
  const hyperparameters = data.hyperparameters || {};
  const isExecution = context.kind === 'execution';
  const isCached = context.kind === 'cached';

  summary.className = `run-summary panel ${isCached ? 'warning' : 'success'}`;
  summary.querySelector('.run-indicator').textContent = isCached ? '!' : '✓';
  document.querySelector('#run-kicker').textContent = isCached
    ? 'RESULTADO LOCAL DE RESPALDO'
    : isExecution ? 'RESULTADO DE ESTA EJECUCIÓN' : 'RESULTADO REAL GUARDADO';
  document.querySelector('#run-title').textContent = isCached
    ? `No se completó la solicitud de ${experimentTitle}`
    : isExecution ? `Ejecución terminada: ${experimentTitle}` : `Resultado cargado: ${experimentTitle}`;
  document.querySelector('#run-message').textContent = isCached
    ? `El servidor no respondió (${context.error || 'error de conexión'}). Las gráficas y métricas corresponden al último resultado conservado en este navegador, no a una ejecución nueva.`
    : isExecution
      ? 'Las tarjetas, gráficas y tablas que aparecen debajo fueron calculadas por la operación que acabas de ejecutar con los parámetros mostrados aquí.'
      : 'Las tarjetas, gráficas y tablas que aparecen debajo corresponden al resultado real precalculado incluido con el proyecto.';

  const appliedEpochs = hyperparameters.epochsRequested ?? data.finalEpochsFromCv ?? data.lossCurve?.length ?? '—';
  const rows = [
    ['Métrica principal', primaryMetric(data)],
    ['Épocas aplicadas', appliedEpochs],
    ['Learning rate', hyperparameters.learningRate ?? '—'],
    ['Arquitectura', architecture]
  ];
  if (isExecution && context.submitted) rows.push(['Valores enviados', submittedText(context.submitted)]);
  if (isExecution && context.durationMs != null) rows.push(['Tiempo de ejecución', formatDuration(context.durationMs)]);
  rows.push(['Fecha del resultado', formatDate(data.generatedAt)]);
  renderRunData(rows);
}

function renderRunError(context, error) {
  const summary = document.querySelector('#run-summary');
  const experimentTitle = descriptions[context.type]?.[0] || 'la red neuronal';
  summary.className = 'run-summary panel error-state';
  summary.querySelector('.run-indicator').textContent = '×';
  document.querySelector('#run-kicker').textContent = 'LA OPERACIÓN NO TERMINÓ';
  document.querySelector('#run-title').textContent = `No se pudo ejecutar ${experimentTitle}`;
  document.querySelector('#run-message').textContent = `No se generaron resultados nuevos. Detalle: ${error.message}`;
  renderRunData(context.submitted ? [
    ['Épocas solicitadas', context.submitted.epochs ?? 'Automático'],
    ['Learning rate', context.submitted.learningRate ?? 'Automático'],
    ['Neuronas principales', context.submitted.neurons ?? 'Automático']
  ] : []);
}

function renderRunData(rows) {
  document.querySelector('#run-data').innerHTML = rows.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}

function primaryMetric(data) {
  const metrics = data.metrics || {};
  return data.experiment === 'regression'
    ? `RMSE ${format(metrics.rmse, false)} · R² ${format(metrics.r2, false)}`
    : `Accuracy ${format(metrics.accuracy, true)} · F1 macro ${format(metrics.macroF1, true)}`;
}

function submittedText(submitted) {
  return `Épocas ${submitted.epochs ?? 'auto'} · LR ${submitted.learningRate ?? 'auto'} · Neuronas ${submitted.neurons ?? 'auto'}`;
}

function formatDuration(milliseconds) {
  const seconds = milliseconds / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-MX');
}

function focusRunSummary() {
  requestAnimationFrame(() => {
    const summary = document.querySelector('#run-summary');
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
    summary.focus({ preventScroll: true });
  });
}

async function copyPrompt() {
  const button = document.querySelector('#copy-prompt');
  const prompt = document.querySelector('#original-prompt').textContent;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt);
    else {
      const field = document.createElement('textarea');
      field.value = prompt;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    button.textContent = 'Prompt copiado';
  } catch (error) {
    button.textContent = 'No se pudo copiar';
  }
  setTimeout(() => { button.textContent = 'Copiar prompt'; }, 1800);
}

function chartOptions(xTitle, yTitle) { return { responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#bca693'}}}, scales:{x:{title:{display:true,text:xTitle,color:'#bca693'},ticks:{color:'#bca693'},grid:{color:'rgba(188,166,147,.08)'}},y:{title:{display:true,text:yTitle,color:'#bca693'},ticks:{color:'#bca693'},grid:{color:'rgba(188,166,147,.1)'}}}}; }
function destroyChart(index) { if (state.charts[index]) state.charts[index].destroy(); }
function numberOrNull(selector) { const value = document.querySelector(selector).value; return value === '' ? null : Number(value); }
function format(value, percentage) { if (value == null) return '—'; return percentage ? `${(value * 100).toFixed(2)}%` : Number(value).toFixed(3); }
function toggleLoading(on) {
  document.querySelector('#loader').classList.toggle('hidden', !on);
  document.querySelector('#train').disabled = on;
  document.querySelector('#precomputed').disabled = on;
  document.querySelectorAll('.tab').forEach(tab => { tab.disabled = on; });
}
function setConnectionState(online, message = '') {
  const status = document.querySelector('#api-status');
  status.classList.toggle('offline', !online);
  status.querySelector('span').textContent = online ? 'API lista' : 'API sin conexión';
  const notice = document.querySelector('#connection-message');
  notice.textContent = message;
  notice.classList.toggle('hidden', online || !message);
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }

loadPrecomputed({ scroll: false });
