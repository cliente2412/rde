// frontend/js/app.js
const API = 'http://localhost:3000/api/transactions';

const el = {
  tableBody: document.querySelector('#tx-table tbody'),
  form: document.querySelector('#tx-form'),
  fDate: document.querySelector('#f-date'),
  fType: document.querySelector('#f-type'),
  fCategory: document.querySelector('#f-category'),
  fDesc: document.querySelector('#f-desc'),
  fValue: document.querySelector('#f-value'),
  btnAdd: document.querySelector('#btn-add'),
  btnCancel: document.querySelector('#btn-cancel'),
  btnFilter: document.querySelector('#btn-filter'),
  filterFrom: document.querySelector('#filter-from'),
  filterTo: document.querySelector('#filter-to'),
  sumRevenue: document.querySelector('#sum-revenue'),
  sumExpense: document.querySelector('#sum-expense'),
  sumLoss: document.querySelector('#sum-loss'),
  sumResult: document.querySelector('#sum-result'),
  btnExport: document.querySelector('#btn-export'),
  importFile: document.querySelector('#import-file'),
  pieCtx: document.getElementById('pieChart').getContext('2d'),
  seriesCtx: document.getElementById('seriesChart').getContext('2d')
}

let editingId = null;
let allTx = [];

async function fetchTx(){
  const params = new URLSearchParams();
  if (el.filterFrom.value) params.append('from', el.filterFrom.value);
  if (el.filterTo.value) params.append('to', el.filterTo.value);
  const res = await fetch('/api/transactions' + (params.toString() ? `?${params}` : ''));
  if (!res.ok) return [];
  const data = await res.json();
  allTx = data;
  renderTable();
  renderSummary();
  renderCharts();
}

function formatCurrency(v){ return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function renderTable(){
  el.tableBody.innerHTML = '';
  allTx.forEach(tx=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td><span class="badge ${tx.type}">${tx.type}</span></td>
      <td>${tx.category}</td>
      <td>${tx.description || ''}</td>
      <td style="text-align:right">${formatCurrency(tx.value)}</td>
      <td class="actions" style="text-align:center">
        <button class="edit" data-id="${tx.id}">Editar</button>
        <button class="del" data-id="${tx.id}">Excluir</button>
      </td>
    `;
    el.tableBody.appendChild(tr);
  });

  document.querySelectorAll('.edit').forEach(btn=>{
    btn.onclick = async ()=> {
      const id = btn.dataset.id;
      const tx = allTx.find(t=>String(t.id)===String(id));
      if (!tx) return;
      editingId = id;
      el.fDate.value = tx.date;
      el.fType.value = tx.type;
      el.fCategory.value = tx.category;
      el.fDesc.value = tx.description;
      el.fValue.value = tx.value;
      el.btnCancel.classList.remove('hidden');
      el.btnAdd.textContent = 'Atualizar';
    }
  });

  document.querySelectorAll('.del').forEach(btn=>{
    btn.onclick = async ()=> {
      if (!confirm('Remover lançamento?')) return;
      const id = btn.dataset.id;
      await fetch('/api/transactions/' + id, { method: 'DELETE' });
      await fetchTx();
    }
  });
}

function renderSummary(){
  const totals = { revenue:0, expense:0, loss:0 };
  allTx.forEach(t=>{
    if (t.type === 'revenue') totals.revenue += t.value;
    if (t.type === 'expense') totals.expense += t.value;
    if (t.type === 'loss') totals.loss += t.value;
  });
  el.sumRevenue.textContent = formatCurrency(totals.revenue);
  el.sumExpense.textContent = formatCurrency(totals.expense);
  el.sumLoss.textContent = formatCurrency(totals.loss);
  el.sumResult.textContent = formatCurrency(totals.revenue - totals.expense - totals.loss);
}

// Charts
let pieChart = null, seriesChart = null;
function renderCharts(){
  // series by month
  const map = {};
  allTx.forEach(t=>{
    const d = new Date(t.date + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    map[key] = map[key] || {month:key, revenue:0, expense:0, loss:0};
    map[key][t.type] += t.value;
  });
  const series = Object.values(map).sort((a,b)=>a.month.localeCompare(b.month));
  const labels = series.map(s=>s.month);
  const revenueData = series.map(s=>s.revenue);
  const expenseData = series.map(s=>s.expense);
  const lossData = series.map(s=>s.loss);

  if (seriesChart) seriesChart.destroy();
  seriesChart = new Chart(el.seriesCtx, {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Receita', data:revenueData, tension:0.3, borderColor:'#2563eb', fill:false },
        { label:'Despesa', data:expenseData, tension:0.3, borderColor:'#ef4444', fill:false },
        { label:'Perda', data:lossData, tension:0.3, borderColor:'#f97316', fill:false }
      ]
    },
    options:{ responsive:true, plugins:{legend:{position:'top'}}}
  });

  // pie losses by category
  const byCat = {};
  allTx.filter(t=>t.type==='loss').forEach(t=> byCat[t.category] = (byCat[t.category]||0) + t.value);
  const pieLabels = Object.keys(byCat);
  const pieData = Object.values(byCat);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(el.pieCtx, {
    type:'pie',
    data:{ labels:pieLabels, datasets:[{ data:pieData }] },
    options:{ responsive:true }
  });
}

// form submit
el.form.onsubmit = async (ev) => {
  ev.preventDefault();
  const payload = {
    date: el.fDate.value,
    type: el.fType.value,
    category: el.fCategory.value,
    description: el.fDesc.value,
    value: Number(el.fValue.value)
  };
  if (!payload.date || !payload.category || !payload.value) { alert('Campos obrigatórios'); return; }

  if (editingId) {
    await fetch('/api/transactions/' + editingId, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    editingId = null;
    el.btnCancel.classList.add('hidden');
    el.btnAdd.textContent = 'Adicionar';
  } else {
    await fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  }
  el.form.reset();
  fetchTx();
}

el.btnCancel.onclick = ()=> { editingId = null; el.form.reset(); el.btnCancel.classList.add('hidden'); el.btnAdd.textContent = 'Adicionar'; }

// filter
el.btnFilter.onclick = ()=> fetchTx();

// export
el.btnExport.onclick = async ()=> {
  const res = await fetch('/api/export');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dre_export.json'; a.click(); URL.revokeObjectURL(url);
}

// import
el.importFile.onchange = async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  const text = await f.text();
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error('Formato inválido');
    // simple: POST each entry (could implement bulk endpoint)
    for (const item of arr) {
      const payload = { date: item.date, type: item.type, category: item.category, description: item.description, value: Number(item.value) };
      await fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    alert('Importação concluída');
    fetchTx();
  } catch(e){
    alert('Arquivo inválido');
  }
}

// init
fetchTx();
