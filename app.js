// ============================================================
// app.js — PERFORMACE IAIT - ANALISTAS
// ============================================================

// 🔥 Projeto Firebase: perfomace--iait-analistas
const firebaseConfig = {
  apiKey:            "AIzaSyBH49MhgHzYdQV13y3IeBRchZpQNwUV_Cg",
  authDomain:        "perfomace--iait-analistas.firebaseapp.com",
  projectId:         "perfomace--iait-analistas",
  storageBucket:     "perfomace--iait-analistas.firebasestorage.app",
  messagingSenderId: "679865318131",
  appId:             "1:679865318131:web:d75f4508e16ddaffb3d586"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ────── ANALISTAS FIXOS (com meta diária) ──────
const ANALISTAS = [
  { id: "ricardo-dias",    name: "RICARDO DIAS",    meta: 3 },
  { id: "pamella-reis",    name: "PAMELLA REIS",    meta: 7 },
  { id: "cecilia-kuraiem", name: "CECILIA KURAIEM", meta: 4 }
];

let entries      = [];
let currentMonth = "";
let metaCharts   = {};
let targetChart  = null;

function $(id) { return document.getElementById(id); }

// ────── INIT ──────
document.addEventListener("DOMContentLoaded", async function() {
  setCurrentMonth();
  populateAnalistaSelects();
  buildMetaCardsSkeleton();
  bindUI();
  showToast("Conectando ao banco...");
  await loadEntries();
  render();
  showToast("Dados carregados!");
  startMonthWatcher();
});

function setCurrentMonth() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, "0");
  currentMonth = y + "-" + m;
  $("currentMonthLabel").textContent = formatMonthLabel(currentMonth);
}

function formatMonthLabel(ym) {
  var parts  = ym.split("-");
  var y = parts[0], m = parts[1];
  var months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return months[parseInt(m, 10) - 1] + " de " + y;
}

// ────── TROCA AUTOMÁTICA DE MÊS ──────
// Quando o mês do calendário muda (com a página aberta), o painel
// "zera" sozinho (passa a mostrar o novo mês, vazio) sem perder nada:
// os registros do mês anterior continuam salvos e disponíveis em Histórico.
function startMonthWatcher() {
  setInterval(checkMonthChange, 60 * 1000); // checa a cada 1 min
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) checkMonthChange();
  });
}

async function checkMonthChange() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, "0");
  var realMonth = y + "-" + m;
  if (realMonth === currentMonth) return;

  currentMonth = realMonth;
  $("currentMonthLabel").textContent = formatMonthLabel(currentMonth);
  $("inputDate").value = now.toISOString().split("T")[0];
  $("metaDate").value  = now.toISOString().split("T")[0];
  await loadEntries();
  render();
  showToast("Novo mês iniciado — painel reiniciado!");
}

// ────── BIND UI ──────
function bindUI() {
  $("btnAddEntry").onclick    = openModalEntry;
  $("fabAdd").onclick         = openModalEntry;
  $("btnExcel").onclick       = exportExcel;
  $("btnHistory").onclick     = openHistory;
  $("modalClose").onclick     = closeModalEntry;
  $("btnModalCancel").onclick = closeModalEntry;
  $("btnModalSave").onclick   = saveEntry;
  $("historyClose").onclick   = function() { closeOverlay("historyOverlay"); };
  $("filterAnalista").onchange = renderTable;
  $("metaDate").onchange       = function() { renderMetaCharts(this.value); };

  $("modalOverlay").onclick = function(e) {
    if (e.target === $("modalOverlay")) closeModalEntry();
  };
  $("historyOverlay").onclick = function(e) {
    if (e.target === $("historyOverlay")) closeOverlay("historyOverlay");
  };

  $("inputDate").value = new Date().toISOString().split("T")[0];
  $("metaDate").value  = new Date().toISOString().split("T")[0];
}

// ────── SELECTS (analistas fixos) ──────
function populateAnalistaSelects() {
  var sel = $("inputAnalista");
  sel.innerHTML = '<option value="">Selecionar...</option>';
  ANALISTAS.forEach(function(a) {
    var o = document.createElement("option");
    o.value = a.id; o.textContent = a.name;
    sel.appendChild(o);
  });

  var flt = $("filterAnalista");
  flt.innerHTML = '<option value="">Todos</option>';
  ANALISTAS.forEach(function(a) {
    var o = document.createElement("option");
    o.value = a.id; o.textContent = a.name;
    flt.appendChild(o);
  });
}

// ────── ENTRIES ──────
async function loadEntries() {
  try {
    var snap = await db.collection("entries").where("month","==",currentMonth).get();
    entries = [];
    snap.forEach(function(d) { entries.push(Object.assign({ id: d.id }, d.data())); });
    entries.sort(function(a,b) { return a.date.localeCompare(b.date); });
  } catch(e) {
    console.error("loadEntries:", e);
    showToast("Erro ao carregar: " + e.message, "error");
  }
}

async function saveEntry() {
  var date      = $("inputDate").value;
  var analista  = $("inputAnalista").value;
  var reprovada = parseInt($("inputReprovada").value) || 0;
  var finalizada= parseInt($("inputFinalizada").value) || 0;
  var status    = $("inputStatus").value;

  if (!date || !analista) { showToast("Preencha data e analista!", "error"); return; }

  var found = ANALISTAS.find(function(a) { return a.id === analista; });
  var analistaName = found ? found.name : analista;
  var month = date.slice(0,7);
  var id    = date + "_" + analista;
  var entry = { date:date, analista:analista, analistaName:analistaName, reprovada:reprovada, finalizada:finalizada, status:status, month:month };

  try {
    await db.collection("entries").doc(id).set(entry);
    var idx = entries.findIndex(function(e) { return e.id === id; });
    if (idx >= 0) entries[idx] = Object.assign({ id:id }, entry);
    else          entries.push(Object.assign({ id:id }, entry));
    if (month === currentMonth) render();
    closeModalEntry();
    showToast("Salvo!");
  } catch(e) {
    console.error("saveEntry:", e);
    showToast("Erro ao salvar: " + e.message, "error");
  }
}

// ────── RENDER ──────
function render() {
  renderCards();
  renderTable();
  renderMetaCharts($("metaDate").value);
  renderTargetChart();
}

function renderCards() {
  var today  = new Date().toISOString().split("T")[0];
  var activeToday = [];
  entries.forEach(function(e) {
    if (e.date===today && e.status==="normal" && activeToday.indexOf(e.analista)===-1) activeToday.push(e.analista);
  });
  var total=0, reprovadas=0, finalizadas=0;
  entries.forEach(function(e) {
    if (e.status==="normal") { total+=(e.reprovada||0)+(e.finalizada||0); reprovadas+=e.reprovada||0; finalizadas+=e.finalizada||0; }
  });
  $("cardTotal").textContent       = total;
  $("cardReprovadas").textContent  = reprovadas;
  $("cardFinalizadas").textContent = finalizadas;
  $("cardAnalistas").textContent   = activeToday.length || ANALISTAS.length;
}

function renderTable() {
  var filter = $("filterAnalista").value;
  var dates  = [];
  entries.forEach(function(e) { if (dates.indexOf(e.date)===-1) dates.push(e.date); });
  dates.sort();

  var thead = $("tableHead");
  thead.innerHTML = '<th class="td-collab">Colaborador</th>' +
    dates.map(function(d){ return '<th>'+formatDateShort(d)+'</th>'; }).join("") +
    '<th>Total</th><th>Reprovada</th><th>Finalizada</th>';

  var tbody = $("tableBody");
  tbody.innerHTML = "";

  var analistasToShow = filter
    ? ANALISTAS.filter(function(a){ return a.id===filter; })
    : ANALISTAS;

  analistasToShow.forEach(function(analista) {
    var tr = document.createElement("tr");
    var tR=0, tF=0;
    var tdHtml = '<td class="td-collab">'+analista.name+'</td>';

    dates.forEach(function(d) {
      var e = entries.find(function(x){ return x.date===d && x.analista===analista.id; });
      if (!e) {
        tdHtml += '<td><button class="btn-cell" onclick="window.openEditModal(\''+d+'\',\''+analista.id+'\')">+</button></td>';
      } else if (e.status==="DM") {
        tdHtml += '<td><span class="cell-dm">DM</span></td>';
      } else if (e.status==="absent") {
        tdHtml += '<td><span class="cell-absent">—</span></td>';
      } else {
        tR+=e.reprovada||0; tF+=e.finalizada||0;
        tdHtml += '<td><div class="cell-hs"><span class="cell-r">'+(e.reprovada||0)+'R</span><span class="cell-f">'+(e.finalizada||0)+'A/F</span></div>'
          +'<button class="btn-cell" onclick="window.openEditModal(\''+d+'\',\''+analista.id+'\')">✎</button></td>';
      }
    });

    tdHtml += '<td><strong>'+(tR+tF)+'</strong></td><td class="cell-r">'+tR+'</td><td class="cell-f">'+tF+'</td>';
    tr.innerHTML = tdHtml;
    tbody.appendChild(tr);
  });

  var tfoot = $("tableFoot");
  var totByDate = dates.map(function(d) {
    var de = entries.filter(function(e){ return e.date===d && e.status==="normal"; });
    var r  = de.reduce(function(s,e){ return s+(e.reprovada||0); },0);
    var f  = de.reduce(function(s,e){ return s+(e.finalizada||0); },0);
    return { total:r+f, reprovada:r, finalizada:f };
  });
  var grandR = totByDate.reduce(function(s,x){ return s+x.reprovada; },0);
  var grandF = totByDate.reduce(function(s,x){ return s+x.finalizada; },0);

  tfoot.innerHTML =
    '<tr><td>Total</td>'+totByDate.map(function(x){ return '<td><strong>'+x.total+'</strong></td>'; }).join("")+'<td>'+(grandR+grandF)+'</td><td class="cell-r">'+grandR+'</td><td class="cell-f">'+grandF+'</td></tr>'+
    '<tr><td>Reprovada</td>'+totByDate.map(function(x){ return '<td class="cell-r">'+x.reprovada+'</td>'; }).join("")+'<td colspan="3"></td></tr>'+
    '<tr><td>Finalizada</td>'+totByDate.map(function(x){ return '<td class="cell-f">'+x.finalizada+'</td>'; }).join("")+'<td colspan="3"></td></tr>';
}

// ────── GRÁFICOS DE META DIÁRIA ──────
function buildMetaCardsSkeleton() {
  var grid = $("metasGrid");
  grid.innerHTML = ANALISTAS.map(function(a) {
    return '<div class="meta-card" id="metaCardEl-'+a.id+'">' +
        '<div class="meta-chart-wrap"><canvas id="metaChart-'+a.id+'"></canvas></div>' +
        '<div class="meta-info">' +
          '<span class="meta-name">'+a.name+'</span>' +
          '<span class="meta-progress" id="metaProgress-'+a.id+'">0 / '+a.meta+'</span>' +
          '<span class="meta-percent" id="metaPercent-'+a.id+'">0%</span>' +
        '</div>' +
      '</div>';
  }).join("");
}

function renderMetaCharts(dateStr) {
  if (!dateStr) dateStr = new Date().toISOString().split("T")[0];

  ANALISTAS.forEach(function(a) {
    var ents = entries.filter(function(e){ return e.date===dateStr && e.analista===a.id && e.status==="normal"; });
    var realizado = ents.reduce(function(s,e){ return s+(e.reprovada||0)+(e.finalizada||0); },0);
    var meta = a.meta;
    var pct  = meta>0 ? Math.min(realizado/meta,1)*100 : 0;
    var done = realizado >= meta;
    var color = done ? "#059669" : "#2563EB";

    var canvas = $("metaChart-"+a.id);
    if (!canvas) return;
    if (metaCharts[a.id]) metaCharts[a.id].destroy();
    metaCharts[a.id] = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: { datasets: [{ data:[pct, 100-pct], backgroundColor:[color,"#E2E8F0"], borderWidth:0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: { tooltip:{ enabled:false }, legend:{ display:false } }
      }
    });

    var progEl = $("metaProgress-"+a.id);
    if (progEl) progEl.textContent = realizado + " / " + meta;
    var percEl = $("metaPercent-"+a.id);
    if (percEl) percEl.textContent = Math.round(pct) + "%";
    var card = $("metaCardEl-"+a.id);
    if (card) card.classList.toggle("meta-done", done);
  });
}

// ────── GRÁFICO DE COLUNA — TARGET MENSAL POR ANALISTA ──────
// Fixo: sempre olha o mês inteiro (não muda com o seletor de data acima).
// Target do mês = meta diária × dias com registro no mês.
function renderTargetChart() {
  var canvas = $("targetChart");
  if (!canvas) return;

  var dates = [];
  entries.forEach(function(e){ if (dates.indexOf(e.date)===-1) dates.push(e.date); });
  var diasComRegistro = dates.length;

  var labels       = ANALISTAS.map(function(a){ return a.name; });
  var metaData      = ANALISTAS.map(function(a){ return a.meta * diasComRegistro; });
  var realizadoData = ANALISTAS.map(function(a){
    return entries.filter(function(e){ return e.analista===a.id && e.status==="normal"; })
      .reduce(function(s,e){ return s+(e.reprovada||0)+(e.finalizada||0); },0);
  });
  var barColors = realizadoData.map(function(v,i){ return v>=metaData[i] ? "#059669" : "#2563EB"; });

  if (targetChart) targetChart.destroy();
  targetChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label:"Target do Mês", data:metaData,      backgroundColor:"#CBD5E1", borderRadius:6 },
        { label:"Realizado",     data:realizadoData,  backgroundColor:barColors, borderRadius:6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: "bottom" } }
    }
  });
}

// ────── MODALS ──────
function openModalEntry() {
  $("inputDate").value      = new Date().toISOString().split("T")[0];
  $("inputAnalista").value  = "";
  $("inputReprovada").value = 0;
  $("inputFinalizada").value= 0;
  $("inputStatus").value    = "normal";
  $("modalTitle").textContent = "Registrar Análise";
  openOverlay("modalOverlay");
}
function closeModalEntry() { closeOverlay("modalOverlay"); }

window.openEditModal = function(date, analistaId) {
  var e = entries.find(function(x){ return x.date===date && x.analista===analistaId; });
  $("inputDate").value       = date;
  $("inputAnalista").value   = analistaId;
  $("inputReprovada").value  = (e && e.reprovada)  ? e.reprovada  : 0;
  $("inputFinalizada").value = (e && e.finalizada) ? e.finalizada : 0;
  $("inputStatus").value     = (e && e.status)     ? e.status     : "normal";
  $("modalTitle").textContent = "Editar — " + formatDateShort(date);
  openOverlay("modalOverlay");
};

// ────── HISTORY ──────
async function openHistory() {
  openOverlay("historyOverlay");
  $("historyBody").innerHTML = '<p class="loading-msg">Carregando...</p>';
  try {
    var snap = await db.collection("entries").get();
    var byMonth = {};
    snap.forEach(function(d) {
      var data = d.data();
      var m = data.month || (data.date ? data.date.slice(0,7) : null);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(Object.assign({ id:d.id }, data));
    });
    var months = Object.keys(byMonth).sort().reverse();
    if (!months.length) { $("historyBody").innerHTML = '<p class="loading-msg">Sem registros ainda.</p>'; return; }

    var html = "";
    months.forEach(function(m) {
      var ents = byMonth[m];
      var analistaIds = [];
      ents.forEach(function(e){ if(analistaIds.indexOf(e.analista)===-1) analistaIds.push(e.analista); });
      var rows = "";
      analistaIds.forEach(function(aid) {
        var ae    = ents.filter(function(e){ return e.analista===aid && e.status==="normal"; });
        var found = ents.find(function(e){ return e.analista===aid; });
        var aName = found ? found.analistaName : aid;
        var tR = ae.reduce(function(s,e){ return s+(e.reprovada||0); },0);
        var tF = ae.reduce(function(s,e){ return s+(e.finalizada||0); },0);
        rows += '<tr><td>'+aName+'</td><td>'+(tR+tF)+'</td><td>'+tR+'</td><td>'+tF+'</td></tr>';
      });
      var gR = ents.filter(function(e){ return e.status==="normal"; }).reduce(function(s,e){ return s+(e.reprovada||0); },0);
      var gF = ents.filter(function(e){ return e.status==="normal"; }).reduce(function(s,e){ return s+(e.finalizada||0); },0);
      html += '<div class="history-month"><h4>'+formatMonthLabel(m)+'<button class="btn btn-outline" style="float:right;padding:4px 10px;font-size:.75rem" onclick="window.exportHistoryMonth(\''+m+'\')">⬇ Excel</button></h4>'
        +'<div class="history-table-wrap"><table class="history-table"><thead><tr><th>Colaborador</th><th>Total</th><th>Reprovadas</th><th>Finalizadas</th></tr></thead>'
        +'<tbody>'+rows+'</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td>'+(gR+gF)+'</td><td>'+gR+'</td><td>'+gF+'</td></tr></tfoot></table></div></div>';
    });
    $("historyBody").innerHTML = html;
  } catch(e) {
    $("historyBody").innerHTML = '<p class="loading-msg">Erro: '+e.message+'</p>';
  }
}

window.exportHistoryMonth = async function(month) {
  try {
    var snap = await db.collection("entries").where("month","==",month).get();
    var ents = [];
    snap.forEach(function(d){ ents.push(Object.assign({ id:d.id }, d.data())); });
    buildAndDownloadExcel(ents, "Performance_IAIT_"+month);
  } catch(e) { showToast("Erro ao exportar.", "error"); }
};

// ────── EXCEL ──────
function exportExcel() { buildAndDownloadExcel(entries, "Performance_IAIT_"+currentMonth); }

function buildAndDownloadExcel(ents, filename) {
  var dates = [];
  ents.forEach(function(e){ if(dates.indexOf(e.date)===-1) dates.push(e.date); });
  dates.sort();

  var header = ["Colaborador"];
  dates.forEach(function(d){ header.push(formatDateShort(d)+" Reprovada", formatDateShort(d)+" Finalizada"); });
  header.push("Total Reprovadas","Total Finalizadas","Total Geral");
  var rows = [header];

  ANALISTAS.forEach(function(a) {
    var row=[a.name]; var tR=0,tF=0;
    dates.forEach(function(d){
      var e=ents.find(function(x){ return x.date===d&&x.analista===a.id; });
      if(!e||e.status!=="normal"){ row.push(0,0); }
      else{ row.push(e.reprovada||0,e.finalizada||0); tR+=e.reprovada||0; tF+=e.finalizada||0; }
    });
    row.push(tR,tF,tR+tF); rows.push(row);
  });

  var fR=dates.map(function(d){ return ents.filter(function(e){ return e.date===d&&e.status==="normal"; }).reduce(function(s,e){ return s+(e.reprovada||0); },0); });
  var fF=dates.map(function(d){ return ents.filter(function(e){ return e.date===d&&e.status==="normal"; }).reduce(function(s,e){ return s+(e.finalizada||0); },0); });
  var foot=["TOTAL"];
  fR.forEach(function(r,i){ foot.push(r,fF[i]); });
  var gR=fR.reduce(function(s,x){ return s+x; },0);
  var gF=fF.reduce(function(s,x){ return s+x; },0);
  foot.push(gR,gF,gR+gF);
  rows.push(foot);

  var ws=XLSX.utils.aoa_to_sheet(rows);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Performance");

  var daily=[["Data","Reprovada","Finalizada","Total"]];
  dates.forEach(function(d){
    var r=ents.filter(function(e){ return e.date===d&&e.status==="normal"; }).reduce(function(s,e){ return s+(e.reprovada||0); },0);
    var f=ents.filter(function(e){ return e.date===d&&e.status==="normal"; }).reduce(function(s,e){ return s+(e.finalizada||0); },0);
    daily.push([d,r,f,r+f]);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(daily),"Resumo Diário");

  var metas=[["Colaborador","Meta Diária"]];
  ANALISTAS.forEach(function(a){ metas.push([a.name, a.meta]); });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(metas),"Metas");

  XLSX.writeFile(wb,filename+".xlsx");
  showToast("Excel baixado!");
}

// ────── HELPERS ──────
function formatDateShort(dateStr) {
  var parts = dateStr.split("-");
  return parts[2]+"/"+parts[1];
}
function openOverlay(id)  { $(id).classList.add("open"); }
function closeOverlay(id) { $(id).classList.remove("open"); }
function showToast(msg, type) {
  var t = $("toast");
  t.textContent = msg;
  t.style.background = (type==="error") ? "#DC2626" : "#0F172A";
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 3000);
}
