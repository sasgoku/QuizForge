// =====================================================
// js/results.js  --  Results Page (Accordion Edition)
// =====================================================
// Shows all student submissions for a quiz.
// Each student card is collapsible and contains a
// per-question review with:
//   * Student's selected answer  (green correct / red wrong)
//   * Correct answer row         (only shown when student was wrong)
//   * Explanation                (from the quiz JSON)
// Features: search, sort, expand-all, CSV export.
// =====================================================

// ─── DOM References ───────────────────────────────────
const resultsLoading    = document.getElementById('resultsLoading');
const resultsError      = document.getElementById('resultsError');
const resultsContent    = document.getElementById('resultsContent');
const resultsQuizTitle  = document.getElementById('resultsQuizTitle');
const resultsMeta       = document.getElementById('resultsMeta');
const statTotal         = document.getElementById('statTotal');
const statAvg           = document.getElementById('statAvg');
const statHighest       = document.getElementById('statHighest');
const statLowest        = document.getElementById('statLowest');
const noResults         = document.getElementById('noResults');
const noSearchMatch     = document.getElementById('noSearchMatch');
const noSearchMatchText = document.getElementById('noSearchMatchText');
const studentList       = document.getElementById('studentList');
const resultsToolbar    = document.getElementById('resultsToolbar');
const refreshBtn        = document.getElementById('refreshBtn');
const expandAllBtn      = document.getElementById('expandAllBtn');
const exportCsvBtn      = document.getElementById('exportCsvBtn');
const searchInput       = document.getElementById('searchInput');
const sortSelect        = document.getElementById('sortSelect');
const quizShareLink     = document.getElementById('quizShareLink');
const copyShareLinkBtn  = document.getElementById('copyShareLinkBtn');

// ─── State ────────────────────────────────────────────
let quizId      = null;
let quizTitle   = '';
let allResults  = [];     // Full list fetched from Firestore
let allExpanded = false;  // Current expand-all state

// ─── Utility: Read URL query param ────────────────────
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── Utility: Format Firestore timestamp ──────────────
function formatDate(ts) {
  if (!ts) return '--';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Utility: Letter grade from percentage ────────────
function getGrade(pct) {
  if (pct >= 90) return { grade: 'A+', cls: 'grade-a' };
  if (pct >= 80) return { grade: 'A',  cls: 'grade-a' };
  if (pct >= 70) return { grade: 'B',  cls: 'grade-b' };
  if (pct >= 60) return { grade: 'C',  cls: 'grade-c' };
  if (pct >= 50) return { grade: 'D',  cls: 'grade-d' };
  return               { grade: 'F',  cls: 'grade-d' };
}

// ─── Utility: Safe HTML escape ─────────────────────────
// Prevents XSS when rendering student-supplied text.
function esc(str) {
  if (str === null || str === undefined || str === '') return '--';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

// ─── Utility: Build quiz student URL ──────────────────
function buildQuizUrl(id) {
  const base = window.location.origin
    + window.location.pathname.replace('results.html', '');
  return base + 'quiz.html?id=' + id;
}

// ─── Show/hide top-level page sections ────────────────
function showState(state) {
  resultsLoading.classList.add('hidden');
  resultsError.classList.add('hidden');
  resultsContent.classList.add('hidden');
  if (state === 'loading') resultsLoading.classList.remove('hidden');
  if (state === 'error')   resultsError.classList.remove('hidden');
  if (state === 'content') resultsContent.classList.remove('hidden');
}

// ─── Load quiz title / metadata from Firestore ────────
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
    resultsMeta.textContent =
      qCount + ' question' + (qCount !== 1 ? 's' : '') + ' · Quiz ID: ' + quizId;

    if (quizShareLink) quizShareLink.value = buildQuizUrl(quizId);

    showState('content');
    await loadResults();

  } catch (err) {
    console.error('Error loading quiz:', err);
    showState('error');
  }
}

// ─── Load all results for this quiz from Firestore ────
async function loadResults() {
  // Reset UI to a clean slate
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
    snapshot.forEach(function(doc) {
      allResults.push(Object.assign({ id: doc.id }, doc.data()));
    });

    updateStats(allResults);

    if (allResults.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }

    resultsToolbar.classList.remove('hidden');
    renderStudentList(allResults);

  } catch (err) {
    console.error('Error loading results:', err);
    // Firestore composite index missing -- it prints the creation link in console
    if (err.code === 'failed-precondition') {
      noResults.classList.remove('hidden');
      noResults.querySelector('p').textContent =
        'A Firestore index is required. Open the browser console for a direct creation link.';
    }
  }
}

// ─── Update the four summary stat cards ───────────────
function updateStats(results) {
  if (!results.length) {
    statTotal.textContent = '0';
    statAvg.textContent = statHighest.textContent = statLowest.textContent = '--';
    return;
  }
  var pcts = results.map(function(r) {
    return r.percent != null ? r.percent : Math.round((r.score / (r.total || 1)) * 100);
  });
  var avg = Math.round(pcts.reduce(function(a, b) { return a + b; }, 0) / pcts.length);
  statTotal.textContent   = results.length;
  statAvg.textContent     = avg + '%';
  statHighest.textContent = Math.max.apply(null, pcts) + '%';
  statLowest.textContent  = Math.min.apply(null, pcts) + '%';
}

// ─── Render the full list of student accordion cards ──
function renderStudentList(results) {
  studentList.innerHTML = '';
  noSearchMatch.classList.add('hidden');

  if (!results.length) {
    studentList.classList.add('hidden');
    noSearchMatch.classList.remove('hidden');
    return;
  }

  studentList.classList.remove('hidden');
  results.forEach(function(result, index) {
    studentList.appendChild(buildStudentCard(result, index));
  });
}

// ─── Build one collapsible student card ───────────────
function buildStudentCard(result, index) {
  var score   = result.score   != null ? result.score   : 0;
  var total   = result.total   != null ? result.total   : (result.answers ? result.answers.length : 1);
  var percent = result.percent != null ? result.percent : Math.round((score / total) * 100);
  var gradeInfo = getGrade(percent);
  var dateStr   = formatDate(result.submittedAt);
  var answers   = result.answers || [];

  // Count correct and wrong from stored answer data
  var correctCount = answers.filter(function(a) { return a.isCorrect; }).length;
  var wrongCount   = answers.length - correctCount;

  // Color class for the score ring and progress bar
  var ringCls = percent >= 70 ? 'ring-green' : (percent >= 50 ? 'ring-yellow' : 'ring-red');

  // ── Outer card wrapper
  var card = document.createElement('div');
  card.className = 'student-card';
  card.setAttribute('data-result-id', result.id);

  // ── Clickable header (always visible)
  var header = document.createElement('div');
  header.className = 'student-card-header';
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.innerHTML =
    '<div class="sc-left">' +
      '<div class="sc-avatar">' + esc((result.studentName || '?')[0].toUpperCase()) + '</div>' +
      '<div class="sc-info">' +
        '<div class="sc-name">' + esc(result.studentName) + '</div>' +
        '<div class="sc-meta">' + dateStr + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="sc-right">' +
      '<div class="sc-mini-pills">' +
        '<span class="mini-pill pill-correct">&#10003; ' + correctCount + ' correct</span>' +
        '<span class="mini-pill pill-wrong">&#10007; ' + wrongCount + ' wrong</span>' +
      '</div>' +
      '<div class="sc-score-ring ' + ringCls + '">' +
        '<span class="sc-score-num">' + score + '</span>' +
        '<span class="sc-score-denom">/' + total + '</span>' +
      '</div>' +
      '<span class="grade-badge ' + gradeInfo.cls + '">' + gradeInfo.grade + '</span>' +
      '<div class="sc-chevron">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
          '<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2"' +
               ' stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</div>' +
    '</div>';

  // ── Collapsible body
  var body = document.createElement('div');
  body.className = 'student-card-body';

  // Score progress bar at the top of the body
  var progressPct = Math.round((score / total) * 100);
  var progressBar =
    '<div class="sc-progress-wrap">' +
      '<div class="sc-progress-track">' +
        '<div class="sc-progress-fill ' + ringCls + '" style="width:' + progressPct + '%"></div>' +
      '</div>' +
      '<span class="sc-progress-label">' + percent + '% &nbsp;&middot;&nbsp; ' + score + '/' + total + ' correct</span>' +
    '</div>';

  // Per-question review items
  var questionHTML = answers.length
    ? answers.map(function(a, i) { return buildQuestionReview(a, i); }).join('')
    : '<p class="sc-no-detail">No per-question data was saved for this submission.</p>';

  // Single inner wrapper is required for the grid-template-rows animation
  body.innerHTML =
    '<div class="student-card-body-inner">' +
      progressBar +
      '<div class="question-review-list">' + questionHTML + '</div>' +
    '</div>';

  // Toggle open/closed on header click
  header.addEventListener('click', function() {
    var isOpen = card.classList.contains('expanded');
    card.classList.toggle('expanded', !isOpen);
    header.setAttribute('aria-expanded', String(!isOpen));
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// ─── Build one question review block ──────────────────
// Layout (per user spec):
//
//   [ Q1 ]  Question text here?                  [ Correct / Incorrect ]
//   -----------------------------------------------------------------------
//   Student's Answer  |  What the student picked                    [v/x]
//   Correct Answer    |  The right answer         (only if wrong)   [ v ]
//   -----------------------------------------------------------------------
//   💡 Explanation text (from quiz JSON, if present)
//
function buildQuestionReview(answer, index) {
  var isCorrect   = answer.isCorrect;
  var selected    = answer.selected || 'Not Answered';
  var correct     = answer.correct  || '--';
  var qNum        = answer.questionNumber != null ? answer.questionNumber : index + 1;

  // Status badge text and CSS class
  var statusCls   = isCorrect ? 'qr-correct' : 'qr-wrong';
  var statusLabel = isCorrect ? '&#10003; Correct' : '&#10007; Incorrect';

  // Student answer row uses green (correct) or red (wrong) background
  var studentRowCls = isCorrect ? 'qr-answer-selected-correct' : 'qr-answer-selected-wrong';
  var studentIcon   = isCorrect ? '&#10003;' : '&#10007;';

  // Correct answer row — only rendered when the student was wrong
  // This directly shows what the right answer was
  var correctRow = '';
  if (!isCorrect) {
    correctRow =
      '<div class="qr-answer-row qr-answer-correct">' +
        '<span class="qr-answer-label">Correct Answer</span>' +
        '<span class="qr-answer-value">' + esc(correct) + '</span>' +
        '<span class="qr-answer-indicator qr-ind-correct">&#10003;</span>' +
      '</div>';
  }

  // Explanation block — rendered when explanation exists in quiz JSON
  var explanationBlock = '';
  if (answer.explanation) {
    explanationBlock =
      '<div class="qr-explanation">' +
        '<span class="qr-explanation-icon">&#x1F4A1;</span>' +
        '<span>' + esc(answer.explanation) + '</span>' +
      '</div>';
  }

  return (
    '<div class="question-review-item ' + statusCls + '">' +

      // Header row: Q badge + question text + status badge
      '<div class="qr-header">' +
        '<div class="qr-header-left">' +
          '<span class="qr-number">Q' + qNum + '</span>' +
          '<span class="qr-question-text">' + esc(answer.question) + '</span>' +
        '</div>' +
        '<span class="qr-status-badge ' + statusCls + '">' + statusLabel + '</span>' +
      '</div>' +

      // Answer comparison rows
      '<div class="qr-answers-body">' +

        // Row 1: Student's selected answer (always shown)
        '<div class="qr-answer-row ' + studentRowCls + '">' +
          '<span class="qr-answer-label">Student\'s Answer</span>' +
          '<span class="qr-answer-value">' + esc(selected) + '</span>' +
          '<span class="qr-answer-indicator">' + studentIcon + '</span>' +
        '</div>' +

        // Row 2: Correct answer (only shown when student was wrong)
        correctRow +

      '</div>' +

      // Explanation from quiz JSON
      explanationBlock +

    '</div>'
  );
}

// ─── Filter + sort allResults then re-render ──────────
function getFilteredSorted() {
  var query = (searchInput.value || '').trim().toLowerCase();
  var sort  = sortSelect.value;

  var list = allResults.filter(function(r) {
    return !query || (r.studentName || '').toLowerCase().indexOf(query) !== -1;
  });

  list.sort(function(a, b) {
    var pA  = a.percent != null ? a.percent : Math.round((a.score / (a.total || 1)) * 100);
    var pB  = b.percent != null ? b.percent : Math.round((b.score / (b.total || 1)) * 100);
    var tsA = (a.submittedAt && a.submittedAt.seconds) ? a.submittedAt.seconds : 0;
    var tsB = (b.submittedAt && b.submittedAt.seconds) ? b.submittedAt.seconds : 0;

    if (sort === 'date-desc')  return tsB - tsA;
    if (sort === 'date-asc')   return tsA - tsB;
    if (sort === 'score-desc') return pB - pA;
    if (sort === 'score-asc')  return pA - pB;
    if (sort === 'name-asc')   return (a.studentName || '').localeCompare(b.studentName || '');
    return 0;
  });

  return list;
}

function refreshList() {
  if (!allResults.length) return;
  var filtered = getFilteredSorted();

  if (!filtered.length) {
    studentList.classList.add('hidden');
    noSearchMatch.classList.remove('hidden');
    noSearchMatchText.textContent =
      'No students match "' + searchInput.value.trim() + '".';
  } else {
    noSearchMatch.classList.add('hidden');
    renderStudentList(filtered);
  }
}

searchInput.addEventListener('input',  refreshList);
sortSelect.addEventListener('change',  refreshList);

// ─── Expand All / Collapse All ─────────────────────────
expandAllBtn.addEventListener('click', function() {
  allExpanded = !allExpanded;
  var cards   = studentList.querySelectorAll('.student-card');
  var headers = studentList.querySelectorAll('.student-card-header');
  cards.forEach(function(c)   { c.classList.toggle('expanded', allExpanded); });
  headers.forEach(function(h) { h.setAttribute('aria-expanded', String(allExpanded)); });
  expandAllBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
});

// ─── Refresh button ────────────────────────────────────
refreshBtn.addEventListener('click', async function() {
  refreshBtn.textContent = 'Refreshing...';
  refreshBtn.disabled = true;
  allExpanded = false;
  expandAllBtn.textContent = 'Expand All';
  searchInput.value = '';
  await loadResults();
  refreshBtn.textContent = 'Refresh';
  refreshBtn.disabled = false;
});

// ─── Copy share link ───────────────────────────────────
if (copyShareLinkBtn) {
  copyShareLinkBtn.addEventListener('click', function() {
    quizShareLink.select();
    navigator.clipboard.writeText(quizShareLink.value).then(function() {
      copyShareLinkBtn.textContent = 'Copied!';
      setTimeout(function() { copyShareLinkBtn.textContent = 'Copy Link'; }, 2000);
    });
  });
}

// ─── Export CSV ────────────────────────────────────────
// Generates a spreadsheet with one row per question per student.
// Columns: #, Name, Score, Total, %, Grade, Q#, Question,
//          Student Answer, Correct Answer, Correct?, Explanation, Submitted At
exportCsvBtn.addEventListener('click', function() {
  if (!allResults.length) { alert('No results to export.'); return; }

  var rows = [];
  rows.push([
    '#', 'Student Name', 'Score', 'Total', 'Percentage', 'Grade',
    'Q#', 'Question', 'Student Answer', 'Correct Answer', 'Correct?',
    'Explanation', 'Submitted At'
  ].join(','));

  allResults.forEach(function(result, idx) {
    var score   = result.score   != null ? result.score   : 0;
    var total   = result.total   != null ? result.total   : 1;
    var percent = result.percent != null ? result.percent : Math.round((score / total) * 100);
    var grade   = getGrade(percent).grade;
    var dateStr = result.submittedAt
      ? (result.submittedAt.toDate
          ? result.submittedAt.toDate()
          : new Date(result.submittedAt)
        ).toISOString()
      : '';

    var answers = result.answers || [];

    if (!answers.length) {
      rows.push([
        idx + 1, csv(result.studentName),
        score, total, percent + '%', grade,
        '', '', '', '', '', '', csv(dateStr)
      ].join(','));
    } else {
      answers.forEach(function(a, qi) {
        rows.push([
          qi === 0 ? idx + 1 : '',
          qi === 0 ? csv(result.studentName) : '',
          qi === 0 ? score : '',
          qi === 0 ? total : '',
          qi === 0 ? percent + '%' : '',
          qi === 0 ? grade : '',
          a.questionNumber != null ? a.questionNumber : qi + 1,
          csv(a.question),
          csv(a.selected),
          csv(a.correct),
          a.isCorrect ? 'Yes' : 'No',
          csv(a.explanation),
          qi === 0 ? csv(dateStr) : ''
        ].join(','));
      });
    }
  });

  var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = quizTitle.replace(/\s+/g, '_') + '_results.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// Wrap a value for CSV (quotes + escape internal quotes)
function csv(val) {
  if (val === null || val === undefined) return '';
  return '"' + String(val).replace(/"/g, '""') + '"';
}

// ─── Init ─────────────────────────────────────────────
loadQuizInfo();
