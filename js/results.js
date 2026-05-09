// =====================================================
// js/results.js — Results Page Logic
// =====================================================
// Handles: loading quiz info, fetching all results for
//          a quiz, rendering stats table, CSV export
// =====================================================

// ─── DOM References ──────────────────────────────────
const resultsLoading  = document.getElementById('resultsLoading');
const resultsError    = document.getElementById('resultsError');
const resultsContent  = document.getElementById('resultsContent');
const resultsQuizTitle= document.getElementById('resultsQuizTitle');
const resultsMeta     = document.getElementById('resultsMeta');
const statTotal       = document.getElementById('statTotal');
const statAvg         = document.getElementById('statAvg');
const statHighest     = document.getElementById('statHighest');
const statLowest      = document.getElementById('statLowest');
const noResults       = document.getElementById('noResults');
const tableWrap       = document.getElementById('tableWrap');
const resultsTableBody= document.getElementById('resultsTableBody');
const refreshBtn      = document.getElementById('refreshBtn');
const exportCsvBtn    = document.getElementById('exportCsvBtn');
const quizShareLink   = document.getElementById('quizShareLink');
const copyShareLinkBtn= document.getElementById('copyShareLinkBtn');

// ─── State ───────────────────────────────────────────
let quizId    = null;
let quizTitle = '';
let allResults = [];

// ─── Utility: Get URL param ───────────────────────────
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── Utility: Format timestamp ──────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Utility: Grade from percentage ──────────────────
function getGrade(percent) {
  if (percent >= 90) return { grade: 'A+', cls: 'grade-a' };
  if (percent >= 80) return { grade: 'A',  cls: 'grade-a' };
  if (percent >= 70) return { grade: 'B',  cls: 'grade-b' };
  if (percent >= 60) return { grade: 'C',  cls: 'grade-c' };
  if (percent >= 50) return { grade: 'D',  cls: 'grade-d' };
  return               { grade: 'F',  cls: 'grade-d' };
}

// ─── Utility: Build quiz student URL ─────────────────
function buildQuizUrl(id) {
  const base = window.location.origin + window.location.pathname.replace('results.html', '');
  return `${base}quiz.html?id=${id}`;
}

// ─── Show/hide sections ───────────────────────────────
function showState(state) {
  resultsLoading.classList.add('hidden');
  resultsError.classList.add('hidden');
  resultsContent.classList.add('hidden');

  if (state === 'loading') resultsLoading.classList.remove('hidden');
  if (state === 'error')   resultsError.classList.remove('hidden');
  if (state === 'content') resultsContent.classList.remove('hidden');
}

// ─── Load Quiz Title from Firestore ──────────────────
async function loadQuizInfo() {
  quizId = getParam('id');

  if (!quizId) {
    showState('error');
    return;
  }

  try {
    const doc = await db.collection('quizzes').doc(quizId).get();

    if (!doc.exists) {
      showState('error');
      return;
    }

    const data = doc.data();
    quizTitle = data.title;
    resultsQuizTitle.textContent = quizTitle;

    const total = data.questions ? data.questions.length : 0;
    resultsMeta.textContent = `${total} question${total !== 1 ? 's' : ''} · Quiz ID: ${quizId}`;

    // Set share link
    if (quizShareLink) quizShareLink.value = buildQuizUrl(quizId);

    showState('content');
    await loadResults();

  } catch (err) {
    console.error('Error loading quiz info:', err);
    showState('error');
  }
}

// ─── Load All Results for This Quiz ──────────────────
async function loadResults() {
  noResults.classList.add('hidden');
  tableWrap.classList.add('hidden');
  resultsTableBody.innerHTML = '';

  try {
    const snapshot = await db
      .collection('results')
      .where('quizId', '==', quizId)
      .orderBy('submittedAt', 'desc')
      .get();

    allResults = [];
    snapshot.forEach(doc => allResults.push({ id: doc.id, ...doc.data() }));

    if (allResults.length === 0) {
      noResults.classList.remove('hidden');
      updateStats([]);
      return;
    }

    updateStats(allResults);
    renderTable(allResults);
    tableWrap.classList.remove('hidden');

  } catch (err) {
    console.error('Error loading results:', err);
    // Check if index error — Firestore may need composite index
    if (err.code === 'failed-precondition') {
      noResults.classList.remove('hidden');
      noResults.querySelector('p').textContent =
        'Firestore index required. Check the console for a link to create it.';
    }
  }
}

// ─── Update Summary Stats ─────────────────────────────
function updateStats(results) {
  if (results.length === 0) {
    statTotal.textContent   = '0';
    statAvg.textContent     = '—';
    statHighest.textContent = '—';
    statLowest.textContent  = '—';
    return;
  }

  const percents = results.map(r => r.percent ?? Math.round((r.score / r.total) * 100));
  const avg      = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
  const highest  = Math.max(...percents);
  const lowest   = Math.min(...percents);

  statTotal.textContent   = results.length;
  statAvg.textContent     = `${avg}%`;
  statHighest.textContent = `${highest}%`;
  statLowest.textContent  = `${lowest}%`;
}

// ─── Render Results Table ─────────────────────────────
function renderTable(results) {
  resultsTableBody.innerHTML = '';

  results.forEach((result, index) => {
    const score   = result.score ?? 0;
    const total   = result.total ?? 1;
    const percent = result.percent ?? Math.round((score / total) * 100);
    const { grade, cls } = getGrade(percent);
    const dateStr = formatDate(result.submittedAt);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(result.studentName || 'Unknown')}</strong></td>
      <td>${score} / ${total}</td>
      <td>${percent}%</td>
      <td><span class="grade-badge ${cls}">${grade}</span></td>
      <td>${dateStr}</td>
    `;
    resultsTableBody.appendChild(row);
  });
}

// ─── Utility: Escape HTML ────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─── Export to CSV ────────────────────────────────────
function exportCsv() {
  if (allResults.length === 0) {
    alert('No results to export.');
    return;
  }

  const headers = ['#', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade', 'Submitted At'];
  const rows = allResults.map((result, index) => {
    const score   = result.score ?? 0;
    const total   = result.total ?? 1;
    const percent = result.percent ?? Math.round((score / total) * 100);
    const { grade } = getGrade(percent);
    const dateStr = result.submittedAt
      ? (result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt)).toISOString()
      : '';

    return [
      index + 1,
      `"${(result.studentName || '').replace(/"/g, '""')}"`,
      score,
      total,
      `${percent}%`,
      grade,
      dateStr
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', `${quizTitle.replace(/\s+/g, '_')}_results.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Event Listeners ─────────────────────────────────
refreshBtn.addEventListener('click', async () => {
  refreshBtn.textContent = '↻ Refreshing…';
  refreshBtn.disabled = true;
  await loadResults();
  refreshBtn.textContent = '↻ Refresh';
  refreshBtn.disabled = false;
});

exportCsvBtn.addEventListener('click', exportCsv);

if (copyShareLinkBtn) {
  copyShareLinkBtn.addEventListener('click', () => {
    quizShareLink.select();
    navigator.clipboard.writeText(quizShareLink.value).then(() => {
      copyShareLinkBtn.textContent = 'Copied!';
      setTimeout(() => { copyShareLinkBtn.textContent = 'Copy Link'; }, 2000);
    });
  });
}

// ─── Init ────────────────────────────────────────────
loadQuizInfo();
