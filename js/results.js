// =====================================================
// js/results.js — Results Page (Accordion Edition)
// =====================================================
// Features:
//   • Per-student collapsible accordion cards
//   • Full per-question review: selected / correct / indicator / explanation
//   • Search by student name
//   • Sort by date / score / name
//   • Expand All / Collapse All toggle
//   • Summary stats (total, avg, highest, lowest)
//   • CSV export with full detail
// =====================================================

// ─── DOM References ──────────────────────────────────
const resultsLoading   = document.getElementById('resultsLoading');
const resultsError     = document.getElementById('resultsError');
const resultsContent   = document.getElementById('resultsContent');
const resultsQuizTitle = document.getElementById('resultsQuizTitle');
const resultsMeta      = document.getElementById('resultsMeta');
const statTotal        = document.getElementById('statTotal');
const statAvg          = document.getElementById('statAvg');
const statHighest      = document.getElementById('statHighest');
const statLowest       = document.getElementById('statLowest');
const noResults        = document.getElementById('noResults');
const noSearchMatch    = document.getElementById('noSearchMatch');
const noSearchMatchText= document.getElementById('noSearchMatchText');
const studentList      = document.getElementById('studentList');
const resultsToolbar   = document.getElementById('resultsToolbar');
const refreshBtn       = document.getElementById('refreshBtn');
const expandAllBtn     = document.getElementById('expandAllBtn');
const exportCsvBtn     = document.getElementById('exportCsvBtn');
const searchInput      = document.getElementById('searchInput');
const sortSelect       = document.getElementById('sortSelect');
const quizShareLink    = document.getElementById('quizShareLink');
const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');

// ─── State ───────────────────────────────────────────
let quizId     = null;
let quizTitle  = '';
let allResults = [];          // Full fetched result list
let allExpanded = false;      // Track expand-all state

// ─── Utility: URL param ───────────────────────────────
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── Utility: Format Firestore timestamp ─────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Utility: Grade from percentage ──────────────────
function getGrade(pct) {
  if (pct >= 90) return { grade: 'A+', cls: 'grade-a' };
  if (pct >= 80) return { grade: 'A',  cls: 'grade-a' };
  if (pct >= 70) return { grade: 'B',  cls: 'grade-b' };
  if (pct >= 60) return { grade: 'C',  cls: 'grade-c' };
  if (pct >= 50) return { grade: 'D',  cls: 'grade-d' };
  return               { grade: 'F',  cls: 'grade-d' };
}

// ─── Utility: Safe HTML escape ───────────────────────
function esc(str) {
  if (!str && str !== 0) return '—';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

// ─── Utility: Build quiz student URL ─────────────────
function buildQuizUrl(id) {
  const base = window.location.origin + window.location.pathname.replace('results.html', '');
  return `${base}quiz.html?id=${id}`;
}

// ─── Show/hide page sections ──────────────────────────
function showState(state) {
  resultsLoading.classList.add('hidden');
  resultsError.classList.add('hidden');
  resultsContent.classList.add('hidden');
  if (state === 'loading') resultsLoading.classList.remove('hidden');
  if (state === 'error')   resultsError.classList.remove('hidden');
  if (state === 'content') resultsContent.classList.remove('hidden');
}

// ─── Load Quiz Meta from Firestore ───────────────────
async function loadQuizInfo() {
  quizId = getParam('id');
  if (!quizId) { showState('error'); return; }

  try {
    const doc = await db.collection('quizzes').doc(quizId).get();
    if (!doc.exists) { showState('error'); return; }

    const data = doc.data();
    quizTitle = data.title;
    resultsQuizTitle.textContent = quizTitle;

    const qCount = data.questions ? data.questions.length : 0;
    resultsMeta.textContent = `${qCount} question${qCount !== 1 ? 's' : ''} · Quiz ID: ${quizId}`;

    if (quizShareLink) quizShareLink.value = buildQuizUrl(quizId);

    showState('content');
    await loadResults();

  } catch (err) {
    console.error('Error loading quiz:', err);
    showState('error');
  }
}

// ─── Load All Results from Firestore ─────────────────
async function loadResults() {
  // Reset UI
  noResults.classList.add('hidden');
  noSearchMatch.classList.add('hidden');
  studentList.classList.add('hidden');
  studentList.innerHTML = '';
  resultsToolbar.classList.add('hidden');

  try {
    const snapshot = await db
      .collection('results')
      .where('quizId', '==', quizId)
      .orderBy('submittedAt', 'desc')
      .get();

    allResults = [];
    snapshot.forEach(doc => allResults.push({ id: doc.id, ...doc.data() }));

    updateStats(allResults);

    if (allResults.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }

    resultsToolbar.classList.remove('hidden');
    renderStudentList(allResults);

  } catch (err) {
    console.error('Error loading results:', err);
    // If composite index missing, Firebase logs the creation URL in console
    if (err.code === 'failed-precondition') {
      noResults.classList.remove('hidden');
      noResults.querySelector('p').textContent =
        'A Firestore index is required. Check the browser console for a direct link to create it.';
    }
  }
}

// ─── Update Summary Stats ─────────────────────────────
function updateStats(results) {
  if (!results.length) {
    statTotal.textContent = '0';
    statAvg.textContent = statHighest.textContent = statLowest.textContent = '—';
    return;
  }

  const pcts = results.map(r => r.percent ?? Math.round((r.score / (r.total || 1)) * 100));
  const avg  = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);

  statTotal.textContent   = results.length;
  statAvg.textContent     = `${avg}%`;
  statHighest.textContent = `${Math.max(...pcts)}%`;
  statLowest.textContent  = `${Math.min(...pcts)}%`;
}

// ─── Render Student Accordion List ───────────────────
function renderStudentList(results) {
  studentList.innerHTML = '';
  studentList.classList.remove('hidden');
  noSearchMatch.classList.add('hidden');

  if (!results.length) {
    studentList.classList.add('hidden');
    noSearchMatch.classList.remove('hidden');
    return;
  }

  results.forEach((result, index) => {
    const card = buildStudentCard(result, index);
    studentList.appendChild(card);
  });
}

// ─── Build One Student Accordion Card ────────────────
function buildStudentCard(result, index) {
  const score   = result.score   ?? 0;
  const total   = result.total   ?? (result.answers ? result.answers.length : 1);
  const percent = result.percent ?? Math.round((score / total) * 100);
  const { grade, cls } = getGrade(percent);
  const dateStr = formatDate(result.submittedAt);
  const answers = result.answers || [];

  // Correct / wrong counts from stored answers
  const correctCount = answers.filter(a => a.isCorrect).length;
  const wrongCount   = answers.length - correctCount;

  // ── Outer wrapper
  const card = document.createElement('div');
  card.className = 'student-card';
  card.setAttribute('data-result-id', result.id);

  // ── Score ring color class
  const ringCls = percent >= 70 ? 'ring-green' : percent >= 50 ? 'ring-yellow' : 'ring-red';

  // ── Header (always visible, click to toggle)
  const header = document.createElement('div');
  header.className = 'student-card-header';
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.innerHTML = `
    <div class="sc-left">
      <div class="sc-avatar">${esc(result.studentName?.[0]?.toUpperCase() || '?')}</div>
      <div class="sc-info">
        <div class="sc-name">${esc(result.studentName)}</div>
        <div class="sc-meta">${dateStr}</div>
      </div>
    </div>
    <div class="sc-right">
      <div class="sc-mini-pills">
        <span class="mini-pill pill-correct">✓ ${correctCount} correct</span>
        <span class="mini-pill pill-wrong">✗ ${wrongCount} wrong</span>
      </div>
      <div class="sc-score-ring ${ringCls}">
        <span class="sc-score-num">${score}</span>
        <span class="sc-score-denom">/${total}</span>
      </div>
      <span class="grade-badge ${cls}">${grade}</span>
      <div class="sc-chevron">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  `;

  // ── Body (collapsible question review)
  const body = document.createElement('div');
  body.className = 'student-card-body';

  // Progress bar inside card
  const progressPct = Math.round((score / total) * 100);
  const progressBar = `
    <div class="sc-progress-wrap">
      <div class="sc-progress-track">
        <div class="sc-progress-fill ${ringCls}" style="width: ${progressPct}%"></div>
      </div>
      <span class="sc-progress-label">${percent}% · ${score}/${total} correct</span>
    </div>
  `;

  // Per-question review items
  const questionHTML = answers.length
    ? answers.map((a, i) => buildQuestionReview(a, i)).join('')
    : '<p class="sc-no-detail">No per-question data saved for this submission.</p>';

  // Wrap in a single inner div — required for grid-template-rows: 0fr → 1fr animation
  body.innerHTML = `<div class="student-card-body-inner">${progressBar}<div class="question-review-list">${questionHTML}</div></div>`;

  // ── Toggle behaviour
  header.addEventListener('click', () => {
    const isOpen = card.classList.contains('expanded');
    card.classList.toggle('expanded', !isOpen);
    header.setAttribute('aria-expanded', String(!isOpen));
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// ─── Build One Question Review Row ────────────────────
function buildQuestionReview(answer, index) {
  const isCorrect   = answer.isCorrect;
  const statusCls   = isCorrect ? 'qr-correct' : 'qr-wrong';
  const statusIcon  = isCorrect ? '✓' : '✗';
  const statusLabel = isCorrect ? 'Correct' : 'Incorrect';

  // Build options list with indicators
  const optionsHTML = (answer.options || []).map(opt => {
    const isSelected = opt === answer.selected;
    const isCorrectOpt = opt === answer.correct;
    let optCls = 'qr-option';
    let optIcon = '';

    if (isCorrectOpt && isSelected) {
      optCls += ' qr-opt-correct-selected';
      optIcon = '<span class="opt-icon opt-icon-correct">✓</span>';
    } else if (isCorrectOpt) {
      optCls += ' qr-opt-correct';
      optIcon = '<span class="opt-icon opt-icon-correct">✓</span>';
    } else if (isSelected && !isCorrectOpt) {
      optCls += ' qr-opt-wrong-selected';
      optIcon = '<span class="opt-icon opt-icon-wrong">✗</span>';
    }

    const selectedDot = isSelected
      ? `<span class="qr-selected-dot" title="Student selected this"></span>`
      : `<span class="qr-selected-dot qr-dot-empty"></span>`;

    return `<div class="${optCls}">${selectedDot}${esc(opt)}${optIcon}</div>`;
  }).join('');

  // Explanation block (only if present)
  const explanationHTML = answer.explanation
    ? `<div class="qr-explanation">
         <span class="qr-explanation-icon">💡</span>
         <span>${esc(answer.explanation)}</span>
       </div>`
    : '';

  return `
    <div class="question-review-item ${statusCls}">
      <div class="qr-header">
        <div class="qr-header-left">
          <span class="qr-number">Q${answer.questionNumber ?? index + 1}</span>
          <span class="qr-question-text">${esc(answer.question)}</span>
        </div>
        <div class="qr-status-badge ${statusCls}">
          <span class="qr-status-icon">${statusIcon}</span>
          <span>${statusLabel}</span>
        </div>
      </div>
      <div class="qr-options">${optionsHTML}</div>
      ${explanationHTML}
    </div>
  `;
}

// ─── Search + Sort + Re-render ────────────────────────
function getFilteredSorted() {
  const query = (searchInput.value || '').trim().toLowerCase();
  const sort  = sortSelect.value;

  let list = allResults.filter(r =>
    !query || (r.studentName || '').toLowerCase().includes(query)
  );

  list.sort((a, b) => {
    const pctA = a.percent ?? Math.round((a.score / (a.total || 1)) * 100);
    const pctB = b.percent ?? Math.round((b.score / (b.total || 1)) * 100);
    const tsA  = a.submittedAt?.seconds ?? 0;
    const tsB  = b.submittedAt?.seconds ?? 0;

    if (sort === 'date-desc')  return tsB - tsA;
    if (sort === 'date-asc')   return tsA - tsB;
    if (sort === 'score-desc') return pctB - pctA;
    if (sort === 'score-asc')  return pctA - pctB;
    if (sort === 'name-asc')   return (a.studentName || '').localeCompare(b.studentName || '');
    return 0;
  });

  return list;
}

function refreshList() {
  const filtered = getFilteredSorted();

  if (allResults.length === 0) return; // No data at all, handled elsewhere

  if (filtered.length === 0) {
    studentList.classList.add('hidden');
    noSearchMatch.classList.remove('hidden');
    noSearchMatchText.textContent = `No students match "${searchInput.value.trim()}".`;
  } else {
    noSearchMatch.classList.add('hidden');
    renderStudentList(filtered);
  }
}

searchInput.addEventListener('input', refreshList);
sortSelect.addEventListener('change', refreshList);

// ─── Expand / Collapse All ────────────────────────────
expandAllBtn.addEventListener('click', () => {
  allExpanded = !allExpanded;
  const cards   = studentList.querySelectorAll('.student-card');
  const headers = studentList.querySelectorAll('.student-card-header');

  cards.forEach(c => c.classList.toggle('expanded', allExpanded));
  headers.forEach(h => h.setAttribute('aria-expanded', String(allExpanded)));

  expandAllBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
});

// ─── Refresh Button ───────────────────────────────────
refreshBtn.addEventListener('click', async () => {
  refreshBtn.textContent = '↻ Refreshing…';
  refreshBtn.disabled = true;
  allExpanded = false;
  expandAllBtn.textContent = 'Expand All';
  searchInput.value = '';
  await loadResults();
  refreshBtn.textContent = '↻ Refresh';
  refreshBtn.disabled = false;
});

// ─── Copy Share Link ──────────────────────────────────
if (copyShareLinkBtn) {
  copyShareLinkBtn.addEventListener('click', () => {
    quizShareLink.select();
    navigator.clipboard.writeText(quizShareLink.value).then(() => {
      copyShareLinkBtn.textContent = 'Copied!';
      setTimeout(() => { copyShareLinkBtn.textContent = 'Copy Link'; }, 2000);
    });
  });
}

// ─── Export CSV ───────────────────────────────────────
exportCsvBtn.addEventListener('click', () => {
  if (!allResults.length) { alert('No results to export.'); return; }

  const rows = [];

  // Header
  rows.push([
    '#', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade',
    'Q#', 'Question', 'Selected Answer', 'Correct Answer', 'Is Correct', 'Explanation',
    'Submitted At'
  ].join(','));

  allResults.forEach((result, idx) => {
    const score   = result.score ?? 0;
    const total   = result.total ?? 1;
    const percent = result.percent ?? Math.round((score / total) * 100);
    const { grade } = getGrade(percent);
    const dateStr = result.submittedAt
      ? (result.submittedAt.toDate ? result.submittedAt.toDate() : new Date(result.submittedAt)).toISOString()
      : '';

    const answers = result.answers || [];

    if (!answers.length) {
      // Row with no question breakdown
      rows.push([
        idx + 1,
        csvCell(result.studentName),
        score, total, `${percent}%`, grade,
        '', '', '', '', '', '', csvCell(dateStr)
      ].join(','));
    } else {
      answers.forEach((a, qi) => {
        rows.push([
          qi === 0 ? idx + 1 : '',
          qi === 0 ? csvCell(result.studentName) : '',
          qi === 0 ? score : '',
          qi === 0 ? total : '',
          qi === 0 ? `${percent}%` : '',
          qi === 0 ? grade : '',
          a.questionNumber ?? qi + 1,
          csvCell(a.question),
          csvCell(a.selected),
          csvCell(a.correct),
          a.isCorrect ? 'Yes' : 'No',
          csvCell(a.explanation),
          qi === 0 ? csvCell(dateStr) : ''
        ].join(','));
      });
    }
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${quizTitle.replace(/\s+/g, '_')}_results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

function csvCell(val) {
  if (val === null || val === undefined) return '';
  return `"${String(val).replace(/"/g, '""')}"`;
}

// ─── Init ────────────────────────────────────────────
loadQuizInfo();
