const ZONA_COLORS = { 'SUDESTE': '#facc15', 'LESTE': '#3b82f6', 'SUL': '#22c55e', 'NORTE': '#ec4899' };
const DESEMPENHOS_PERMITIDOS = ['NL', 'N1', 'N2', 'N3'];

let appData = { g1: [], g2: [], lastUpdate: null, fileName: null };
const uiState = { g1: { page: 1, limit: 15, search: '' }, g2: { page: 1, limit: 15, search: '' }, charts: {} };

document.addEventListener('DOMContentLoaded', async () => {
  setupListeners();
  await loadDefaultSpreadsheet();
});

function setupListeners() {
  document.querySelectorAll('.g1-filter').forEach(el => el.addEventListener('change', () => { uiState.g1.page = 1; renderG1(); }));
  document.getElementById('g1-search').addEventListener('input', e => { uiState.g1.search = e.target.value.toLowerCase(); uiState.g1.page = 1; renderG1Table(); });
  document.getElementById('g1-limit').addEventListener('change', e => { uiState.g1.limit = parseInt(e.target.value); uiState.g1.page = 1; renderG1Table(); });
  
  document.querySelectorAll('.g2-filter').forEach(el => el.addEventListener('change', () => { uiState.g2.page = 1; renderG2(); }));
  document.getElementById('g2-search').addEventListener('input', e => { uiState.g2.search = e.target.value.toLowerCase(); uiState.g2.page = 1; renderG2Table(); });
  document.getElementById('g2-limit').addEventListener('change', e => { uiState.g2.limit = parseInt(e.target.value); uiState.g2.page = 1; renderG2Table(); });
}

// MULTI-SELECT HANDLER
function populateMultiSelect(containerId, btnId, options, prefix) {
  const container = document.getElementById(containerId);
  if(!container) return;
  const currentSelected = getMultiValues(containerId);
  
  let html = '';
  options.forEach(opt => {
    const checked = currentSelected.includes(opt) ? 'checked' : '';
    html += `
      <li>
        <label class="dropdown-item d-flex align-items-center gap-2 small">
          <input class="form-check-input mt-0" type="checkbox" value="${opt}" ${checked}> ${opt}
        </label>
      </li>`;
  });
  container.innerHTML = html;
  
  container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
       updateMultiButton(containerId, btnId);
       if(prefix === 'g1') { uiState.g1.page = 1; renderG1(); }
       if(prefix === 'g2') { uiState.g2.page = 1; renderG2(); }
    });
  });
  updateMultiButton(containerId, btnId);
}

function getMultiValues(containerId) {
   const container = document.getElementById(containerId);
   if(!container) return [];
   return Array.from(container.querySelectorAll('input:checked')).map(c => c.value);
}

function updateMultiButton(containerId, btnId) {
   const vals = getMultiValues(containerId);
   const btn = document.getElementById(btnId);
   if(!btn) return;
   if(vals.length === 0) btn.textContent = 'TODOS';
   else if(vals.length === 1) btn.textContent = vals[0];
   else btn.textContent = vals.length + ' selecionados';
}

async function loadDefaultSpreadsheet() {
  try {
    // Procura o arquivo Excel na mesma pasta no GitHub
    const response = await fetch('DESEMPENHO_ESTUDANTE_2.xlsx');
    if (!response.ok) throw new Error('Arquivo padrão não encontrado');
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    let rawG1 = [];
    if (workbook.SheetNames.includes('ALUNOS NL A N3 (4° AO 9°)')) {
      const sheet = workbook.Sheets['ALUNOS NL A N3 (4° AO 9°)'];
      rawG1 = cleanData(XLSX.utils.sheet_to_json(sheet, { header: 1 }), true);
    }

    let rawG2 = [];
    if (workbook.SheetNames.includes('PSICOLER')) {
      const sheet = workbook.Sheets['PSICOLER'];
      rawG2 = cleanData(XLSX.utils.sheet_to_json(sheet, { header: 1 }), false);
    }

    appData.g1 = rawG1; 
    appData.g2 = rawG2;
    appData.lastUpdate = 'Carregado automaticamente';
    appData.fileName = 'DESEMPENHO_ESTUDANTE_2.xlsx';

    document.getElementById('last-update-date').innerHTML = `Automático<br><small class="text-white-50">Base Oficial</small>`;
    refreshAll();
  } catch (err) {
    console.error("Erro ao carregar planilha padrão:", err);
    showAlert("Aviso: Suba o arquivo 'DESEMPENHO_ESTUDANTE_2.xlsx' para o repositório.", "warning");
  }
}

function cleanData(rawJson, uniqueByMatricula) {
  if (rawJson.length < 2) return [];
  const headers = rawJson[1].map(h => String(h || '').trim().toUpperCase());
  let records = [], matriculasVistas = new Set();

  for (let i = 2; i < rawJson.length; i++) {
    const row = rawJson[i];
    if (!row || row.length === 0 || row.every(c => c === null || c === undefined || c === '')) continue;
    
    let obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx] !== undefined ? row[idx] : ''; });
    
    let desemp = String(obj['DESEMPENHO'] || '').trim().toUpperCase();
    if (!DESEMPENHOS_PERMITIDOS.includes(desemp)) continue; 
    obj['DESEMPENHO'] = desemp;
    
    obj['PCD'] = (String(obj['PCD'] || '').trim().toUpperCase() === 'SIM') ? 'SIM' : 'NÃO';
    
    let escola = String(obj['UNIDADE DE ENSINO'] || '').trim();
    obj['UNIDADE DE ENSINO'] = escola;
    
    let zona = String(obj['ZONA'] || '').trim().toUpperCase();
    obj['ZONA'] = zona ? zona : 'NÃO INFORMADO';
    
    let matricula = String(obj['MATRICULA'] || '').trim();
    if (!matricula) matricula = String(obj['NOME'] || '').trim(); 
    obj['MATRICULA'] = matricula;

    let psico = String(obj['PSICOPEDAGOGA'] || obj['PSICOPEDAGOGO'] || '').trim();
    obj['PSICOPEDAGOGO'] = psico ? psico : 'NÃO INFORMADO';
    
    if (uniqueByMatricula) {
      if (matriculasVistas.has(matricula)) continue;
      matriculasVistas.add(matricula);
    }
    records.push(obj);
  }
  return records;
}

function showAlert(msg, type) {
  const cont = document.getElementById('alert-container');
  cont.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
  setTimeout(() => cont.innerHTML='', 4000);
}

function refreshAll() {
  populateFilters('g1', appData.g1, ['UNIDADE DE ENSINO', 'GENERO', 'TURMA']);
  const seriesG1 = [...new Set(appData.g1.map(r => r['SERIE']).filter(Boolean))].sort();
  populateMultiSelect('g1-serie-list', 'btn-g1-serie', seriesG1, 'g1');
  const desempG1 = [...new Set(appData.g1.map(r => r['DESEMPENHO']).filter(Boolean))].sort();
  populateMultiSelect('g1-desemp-list', 'btn-g1-desemp', desempG1, 'g1');

  populateFilters('g2', appData.g2, ['PSICOPEDAGOGO', 'ZONA', 'UNIDADE DE ENSINO', 'GENERO', 'TURMA']);
  const seriesG2 = [...new Set(appData.g2.map(r => r['SERIE']).filter(Boolean))].sort();
  populateMultiSelect('g2-serie-list', 'btn-g2-serie', seriesG2, 'g2');
  const desempG2 = [...new Set(appData.g2.map(r => r['DESEMPENHO']).filter(Boolean))].sort();
  populateMultiSelect('g2-desemp-list', 'btn-g2-desemp', desempG2, 'g2');

  renderG1(); renderG2();
}

function populateFilters(prefix, data, fields) {
  const mappings = { 'UNIDADE DE ENSINO': 'escola', 'ZONA': 'zona', 'GENERO': 'genero', 'TURMA': 'turma', 'PSICOPEDAGOGO': 'psico' };
  fields.forEach(f => {
    let uniques = [...new Set(data.map(r => r[f]).filter(Boolean))].sort();
    let el = document.getElementById(`${prefix}-${mappings[f]}`);
    if (!el) return;
    let curr = el.value;
    el.innerHTML = `<option value="">TODOS</option>` + uniques.map(u => `<option value="${u}">${u}</option>`).join('');
    el.value = curr; 
  });
}

function resetFilters(prefix) {
  document.querySelectorAll(`.${prefix}-filter`).forEach(el => el.value = '');
  document.querySelectorAll(`#${prefix}-serie-list input`).forEach(chk => chk.checked = false);
  document.querySelectorAll(`#${prefix}-desemp-list input`).forEach(chk => chk.checked = false);
  updateMultiButton(`${prefix}-serie-list`, `btn-${prefix}-serie`);
  updateMultiButton(`${prefix}-desemp-list`, `btn-${prefix}-desemp`);
  
  uiState[prefix].search = '';
  document.getElementById(`${prefix}-search`).value = '';
  if (prefix === 'g1') renderG1();
  if (prefix === 'g2') renderG2();
}

// GUIA 1 
function getFilteredG1() {
  const selSeries = getMultiValues('g1-serie-list');
  const selDesemps = getMultiValues('g1-desemp-list');
  const f = {
    pcd: document.getElementById('g1-pcd').value,
    escola: document.getElementById('g1-escola').value,
    genero: document.getElementById('g1-genero').value,
    turma: document.getElementById('g1-turma').value
  };
  return appData.g1.filter(r => {
    if (selSeries.length > 0 && !selSeries.includes(r['SERIE'])) return false;
    if (selDesemps.length > 0 && !selDesemps.includes(r['DESEMPENHO'])) return false;
    if (f.pcd && r['PCD'] !== f.pcd) return false;
    if (f.escola && r['UNIDADE DE ENSINO'] !== f.escola) return false;
    if (f.genero && r['GENERO'] !== f.genero) return false;
    if (f.turma && r['TURMA'] !== f.turma) return false;
    return true;
  });
}

function renderG1() {
  const data = getFilteredG1();
  let nNL=0, nN1=0, nN2=0, nN3=0, pcdSim=0;
  data.forEach(r => {
    if (r['DESEMPENHO'] === 'NL') nNL++;
    if (r['DESEMPENHO'] === 'N1') nN1++;
    if (r['DESEMPENHO'] === 'N2') nN2++;
    if (r['DESEMPENHO'] === 'N3') nN3++;
    if (r['PCD'] === 'SIM') pcdSim++;
  });
  
  const total = data.length;
  document.getElementById('g1-total').textContent = total;
  document.getElementById('g1-nl').textContent = nNL;
  document.getElementById('g1-n1').textContent = nN1;
  document.getElementById('g1-n2').textContent = nN2;
  document.getElementById('g1-n3').textContent = nN3;
  document.getElementById('g1-pcd-sim').textContent = pcdSim;
  document.getElementById('g1-pcd-nao').textContent = total - pcdSim;

  let sC = {};
  data.forEach(r => { let s = r['SERIE']||'N/I'; sC[s] = (sC[s]||0)+1; });
  const sKeys = Object.keys(sC).sort();
  updateChart('chartG1Series', 'bar', sKeys, [{ label: 'Alunos', data: sKeys.map(k=>sC[k]), backgroundColor: '#0f172a' }]);
  
  updateChart('chartG1Desemp', 'pie', ['NL','N1','N2','N3'], [{ data: [nNL, nN1, nN2, nN3], backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#10b981'] }]);

  renderG1Table();
}

function renderG1Table() {
  let data = getFilteredG1();
  const search = uiState.g1.search;
  if (search) data = data.filter(r => (r['NOME']||'').toLowerCase().includes(search) || (r['MATRICULA']||'').toLowerCase().includes(search));
  
  const total = data.length, limit = uiState.g1.limit, maxPage = Math.ceil(total / limit) || 1;
  if (uiState.g1.page > maxPage) uiState.g1.page = maxPage;
  const start = (uiState.g1.page - 1) * limit;
  const pageData = data.slice(start, start + limit);
  
  const tb = document.getElementById('g1-tbody');
  tb.innerHTML = pageData.map(r => `
    <tr>
      <td>${r['MATRICULA']}</td><td>${r['NOME']}</td>
      <td>${r['SERIE']||'-'}</td><td>${r['TURMA']||'-'}</td>
      <td><strong>${r['DESEMPENHO']}</strong></td>
      <td><span class="badge bg-${r['PCD']==='SIM'?'primary':'secondary'}">${r['PCD']}</span></td>
      <td>${r['UNIDADE DE ENSINO']}</td>
    </tr>
  `).join('');
  if (total===0) tb.innerHTML = `<tr><td colspan="7" class="text-center py-3 text-muted">Nenhum registro encontrado.</td></tr>`;
  document.getElementById('g1-table-info').textContent = `Mostrando ${total===0?0:start+1} a ${Math.min(start+limit, total)} de ${total}`;
  renderPagination('g1-pagination', uiState.g1.page, maxPage, 'g1');
}

// GUIA 2
function getFilteredG2() {
  const selSeries = getMultiValues('g2-serie-list');
  const selDesemps = getMultiValues('g2-desemp-list');
  const f = {
    psico: document.getElementById('g2-psico').value,
    pcd: document.getElementById('g2-pcd').value,
    zona: document.getElementById('g2-zona').value,
    escola: document.getElementById('g2-escola').value,
    genero: document.getElementById('g2-genero').value,
    turma: document.getElementById('g2-turma').value
  };
  return appData.g2.filter(r => {
    if (f.psico && r['PSICOPEDAGOGO'] !== f.psico) return false;
    if (selSeries.length > 0 && !selSeries.includes(r['SERIE'])) return false;
    if (selDesemps.length > 0 && !selDesemps.includes(r['DESEMPENHO'])) return false;
    if (f.pcd && r['PCD'] !== f.pcd) return false;
    if (f.zona && r['ZONA'] !== f.zona) return false;
    if (f.escola && r['UNIDADE DE ENSINO'] !== f.escola) return false;
    if (f.genero && r['GENERO'] !== f.genero) return false;
    if (f.turma && r['TURMA'] !== f.turma) return false;
    return true;
  });
}

function renderG2() {
  const data = getFilteredG2();
  let pcdSim = 0; let pC = {}, sC = {}, dC = {}, zC = {};
  
  data.forEach(r => {
    if (r['PCD'] === 'SIM') pcdSim++;
    let p = r['PSICOPEDAGOGO']; pC[p] = (pC[p]||0)+1;
    let s = r['SERIE']||'N/I'; sC[s] = (sC[s]||0)+1;
    let d = r['DESEMPENHO']; dC[d] = (dC[d]||0)+1;
    let z = r['ZONA']; zC[z] = (zC[z]||0)+1;
  });
  
  const total = data.length;
  document.getElementById('g2-total').textContent = total;
  document.getElementById('g2-pcd-sim').textContent = pcdSim;
  document.getElementById('g2-pcd-nao').textContent = total - pcdSim;

  const pKeys = Object.keys(pC).sort((a,b) => pC[b]-pC[a]);
  updateChart('chartG2Psico', 'bar', pKeys, [{ label: 'Atendimentos', data: pKeys.map(k=>pC[k]), backgroundColor: '#8b5cf6' }]);

  const zKeys = Object.keys(zC).sort();
  const zColors = zKeys.map(k => ZONA_COLORS[k] || '#cbd5e1');
  updateChart('chartG2Zonas', 'doughnut', zKeys, [{ data: zKeys.map(k=>zC[k]), backgroundColor: zColors }]);

  const dKeys = ['NL','N1','N2','N3'];
  updateChart('chartG2Desempenho', 'pie', dKeys, [{ data: dKeys.map(k=>dC[k]||0), backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#10b981'] }]);

  // ATUALIZA O RESUMO DE PSICOPEDAGOGOS
  const summaryContainer = document.getElementById('g2-teacher-summary');
  if (summaryContainer) {
    summaryContainer.innerHTML = pKeys.map(k => `
      <div class="col">
        <div class="p-2 border rounded bg-light text-center d-flex flex-column justify-content-center h-100 shadow-sm">
          <div class="small text-muted text-truncate fw-semibold" title="${k}">${k}</div>
          <div class="fs-4 text-purple fw-bold lh-1 mt-1">${pC[k]}</div>
        </div>
      </div>
    `).join('');
  }

  renderG2Table();
}

function renderG2Table() {
  let data = getFilteredG2();
  const search = uiState.g2.search;
  if (search) data = data.filter(r => (r['NOME']||'').toLowerCase().includes(search) || (r['MATRICULA']||'').toLowerCase().includes(search));
  
  const total = data.length, limit = uiState.g2.limit, maxPage = Math.ceil(total / limit) || 1;
  if (uiState.g2.page > maxPage) uiState.g2.page = maxPage;
  const start = (uiState.g2.page - 1) * limit;
  const pageData = data.slice(start, start + limit);
  
  const tb = document.getElementById('g2-tbody');
  tb.innerHTML = pageData.map(r => `
    <tr>
      <td><strong>${r['PSICOPEDAGOGO']}</strong></td>
      <td>${r['MATRICULA']}</td><td>${r['NOME']}</td>
      <td>${r['SERIE']||'-'}</td>
      <td><strong>${r['DESEMPENHO']}</strong></td>
      <td><span class="badge bg-${r['PCD']==='SIM'?'primary':'secondary'}">${r['PCD']}</span></td>
      <td><span class="badge badge-${(r['ZONA']||'').toLowerCase()}">${r['ZONA']}</span></td>
      <td>${r['UNIDADE DE ENSINO']}</td>
    </tr>
  `).join('');
  if (total===0) tb.innerHTML = `<tr><td colspan="8" class="text-center py-3 text-muted">Nenhum registro encontrado.</td></tr>`;
  document.getElementById('g2-table-info').textContent = `Mostrando ${total===0?0:start+1} a ${Math.min(start+limit, total)} de ${total}`;
  renderPagination('g2-pagination', uiState.g2.page, maxPage, 'g2');
}

function updateChart(id, type, labels, datasets) {
  if (uiState.charts[id]) uiState.charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  uiState.charts[id] = new Chart(ctx, { type: type, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false } });
}

function renderPagination(id, current, max, prefix) {
  let h = `<li class="page-item ${current===1?'disabled':''}"><a class="page-link" href="#" onclick="changePage('${prefix}',${current-1});return false;">«</a></li>`;
  for(let i=Math.max(1, current-2); i<=Math.min(max, current+2); i++) h += `<li class="page-item ${i===current?'active':''}"><a class="page-link" href="#" onclick="changePage('${prefix}',${i});return false;">${i}</a></li>`;
  h += `<li class="page-item ${current===max?'disabled':''}"><a class="page-link" href="#" onclick="changePage('${prefix}',${current+1});return false;">»</a></li>`;
  document.getElementById(id).innerHTML = h;
}
window.changePage = function(prefix, p) { uiState[prefix].page = p; if (prefix === 'g1') renderG1Table(); if (prefix === 'g2') renderG2Table(); }
