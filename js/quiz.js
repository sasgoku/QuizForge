// =====================================================
// js/quiz.js — Student Quiz Page Logic
// =====================================================
// Handles: loading quiz, name gate, rendering questions,
//          tracking answers, scoring, saving results
// =====================================================

// ─── App State ───────────────────────────────────────
let quizData     = null;   // Full quiz object from Firestore
let quizId       = null;   // Quiz ID from URL param
let studentName  = '';     // Student's name
let currentIndex = 0;      // Which question we're on
let answers      = [];     // Student's answer for each question (or null)

// ─── DOM References ──────────────────────────────────
const quizLoading    = document.getElementById('quizLoading');
const quizError      = document.getElementById('quizError');
const nameGate       = document.getElementById('nameGate');
const nameGateTitle  = document.getElementById('nameGateTitle');
const questionCount  = document.getElementById('questionCount');
const studentNameEl  = document.getElementById('studentName');
const nameError      = document.getElementById('nameError');
const startQuizBtn   = document.getElementById('startQuizBtn');
const quizMain       = document.getElementById('quizMain');
const quizTitleNav   = document.getElementById('quizTitleNav');
const progressLabel  = document.getElementById('progressLabel');
const progressPercent= document.getElementById('progressPercent');
const progressBar    = document.getElementById('progressBar');
const questionBadge  = document.getElementById('questionBadge');
const questionText   = document.getElementById('questionText');
const optionsList    = document.getElementById('optionsList');
const questionWarning= document.getElementById('questionWarning');
const prevBtn        = document.getElementById('prevBtn');
const nextBtn        = document.getElementById('nextBtn');
const submitBtn      = document.getElementById('submitBtn');
const dotNav         = document.getElementById('dotNav');
const quizResult     = document.getElementById('quizResult');

// ─── Utility: Get URL param ───────────────────────────
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── Utility: Grade from percentage ──────────────────
function getGrade(percent) {
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
}

// ─── Utility: Trophy emoji from score ────────────────
function getTrophy(percent) {
  if (percent >= 90) return '🏆';
  if (percent >= 70) return '🌟';
  if (percent >= 50) return '👍';
  return '💪';
}

// ─── Load Quiz from Firestore ─────────────────────────
async function loadQuiz() {
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

    quizData = doc.data();

    // Initialize answers array with null (unanswered)
    answers = new Array(quizData.questions.length).fill(null);

    // Show name gate
    nameGateTitle.textContent = quizData.title;
    quizTitleNav.textContent  = quizData.title;
    questionCount.textContent = `${quizData.questions.length}`;
    showState('nameGate');

  } catch (err) {
    console.error('Error loading quiz:', err);
    showState('error');
  }
}

// ─── Show/hide sections ───────────────────────────────
function showState(state) {
  quizLoading.classList.add('hidden');
  quizError.classList.add('hidden');
  nameGate.classList.add('hidden');
  quizMain.classList.add('hidden');
  quizResult.classList.add('hidden');

  if (state === 'loading')  quizLoading.classList.remove('hidden');
  if (state === 'error')    quizError.classList.remove('hidden');
  if (state === 'nameGate') nameGate.classList.remove('hidden');
  if (state === 'quiz')     quizMain.classList.remove('hidden');
  if (state === 'result')   quizResult.classList.remove('hidden');
}

// ─── Start Quiz (after name entry) ───────────────────
startQuizBtn.addEventListener('click', () => {
  const name = studentNameEl.value.trim();

  if (!name) {
    nameError.classList.remove('hidden');
    studentNameEl.focus();
    return;
  }

  nameError.classList.add('hidden');
  studentName = name;

  showState('quiz');
  renderQuestion(0);
  renderDots();
});

// Allow pressing Enter in name field
studentNameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startQuizBtn.click();
});

// ─── Render a Question ────────────────────────────────
function renderQuestion(index) {
  const q = quizData.questions[index];
  const total = quizData.questions.length;

  // Update progress
  const progressPct = Math.round((index / total) * 100);
  progressLabel.textContent  = `Question ${index + 1} of ${total}`;
  progressPercent.textContent = `${progressPct}%`;
  progressBar.style.width    = `${progressPct}%`;

  // Update badge and question text
  questionBadge.textContent = `Q${index + 1}`;
  questionText.textContent  = q.question;

  // Hide warning
  questionWarning.classList.add('hidden');

  // Build options
  optionsList.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E'];

  q.options.forEach((option, i) => {
    const item = document.createElement('div');
    item.className = 'option-item';
    if (answers[index] === option) item.classList.add('selected');

    item.innerHTML = `
      <span class="option-letter">${letters[i] || i + 1}</span>
      <span class="option-text">${option}</span>
    `;

    item.addEventListener('click', () => selectOption(index, option));
    optionsList.appendChild(item);
  });

  // Update navigation buttons
  prevBtn.style.display  = index === 0 ? 'none' : '';
  nextBtn.classList.toggle('hidden', index === total - 1);
  submitBtn.classList.toggle('hidden', index !== total - 1);

  // Update dots
  updateDots(index);

  currentIndex = index;
}

// ─── Select an Option ────────────────────────────────
function selectOption(questionIndex, selectedOption) {
  answers[questionIndex] = selectedOption;

  // Update visual selection
  const items = optionsList.querySelectorAll('.option-item');
  items.forEach(item => {
    const text = item.querySelector('.option-text').textContent;
    item.classList.toggle('selected', text === selectedOption);
  });

  // Hide warning if shown
  questionWarning.classList.add('hidden');

  // Update dot for this question
  updateDots(currentIndex);
}

// ─── Navigation: Previous ────────────────────────────
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    renderQuestion(currentIndex - 1);
  }
});

// ─── Navigation: Next ────────────────────────────────
nextBtn.addEventListener('click', () => {
  if (answers[currentIndex] === null) {
    questionWarning.textContent = 'Please select an answer before continuing.';
    questionWarning.classList.remove('hidden');
    return;
  }
  if (currentIndex < quizData.questions.length - 1) {
    renderQuestion(currentIndex + 1);
  }
});

// ─── Submit Quiz ──────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  // Check last question answered
  if (answers[currentIndex] === null) {
    questionWarning.textContent = 'Please select an answer before submitting.';
    questionWarning.classList.remove('hidden');
    return;
  }

  // Check all questions answered
  const unanswered = answers.indexOf(null);
  if (unanswered !== -1) {
    const goBack = confirm(
      `You have not answered question ${unanswered + 1}. Submit anyway?`
    );
    if (!goBack) {
      renderQuestion(unanswered);
      return;
    }
  }

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  // Calculate score
  let score = 0;
  quizData.questions.forEach((q, i) => {
    if (answers[i] === q.correct) score++;
  });

  const total   = quizData.questions.length;
  const percent = Math.round((score / total) * 100);

  // Build complete per-question answer record for Firestore
  // Includes all fields needed for teacher review on results page
  const answersRecord = quizData.questions.map((q, i) => ({
    questionNumber: i + 1,
    question:       q.question,
    options:        q.options || [],
    selected:       answers[i] || 'Not answered',
    correct:        q.correct,
    isCorrect:      answers[i] === q.correct,
    explanation:    q.explanation || ''
  }));

  try {
    // Save result to Firestore
    await db.collection('results').add({
      quizId:      quizId,
      studentName: studentName,
      score:       score,
      total:       total,
      percent:     percent,
      answers:     answersRecord,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('Error saving result:', err);
    // Show result anyway even if save fails
  }

  // Show result screen
  showResultScreen(score, total, percent);
});

// ─── Render Dot Navigation ────────────────────────────
function renderDots() {
  dotNav.innerHTML = '';
  quizData.questions.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.title = `Question ${i + 1}`;
    dot.addEventListener('click', () => renderQuestion(i));
    dotNav.appendChild(dot);
  });
  updateDots(0);
}

function updateDots(currentIdx) {
  const dots = dotNav.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('current', 'answered');
    if (i === currentIdx) dot.classList.add('current');
    else if (answers[i] !== null) dot.classList.add('answered');
  });
}

// ─── Show Result Screen ───────────────────────────────
function showResultScreen(score, total, percent) {
  showState('result');

  // Update progress bar to 100%
  progressBar.style.width = '100%';
  progressPercent.textContent = '100%';

  // Fill result card
  document.getElementById('resultTrophy').textContent = getTrophy(percent);
  document.getElementById('resultName').textContent   = `Well done, ${studentName}!`;
  document.getElementById('resultScoreNum').textContent  = score;
  document.getElementById('resultScoreTotal').textContent = `/ ${total}`;
  document.getElementById('resultPercent').textContent = `${percent}%`;
  document.getElementById('resultGrade').textContent   = `Grade: ${getGrade(percent)}`;

  // Build review list
  const reviewList = document.getElementById('reviewList');
  reviewList.innerHTML = '';

  quizData.questions.forEach((q, i) => {
    const isCorrect = answers[i] === q.correct;
    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'correct' : 'wrong'}`;

    item.innerHTML = `
      <div class="review-q">${i + 1}. ${q.question}</div>
      <div class="review-your-answer">
        Your answer: <strong>${answers[i] || 'Not answered'}</strong>
        ${isCorrect ? ' ✓' : ' ✗'}
      </div>
      ${!isCorrect ? `<div class="review-correct-answer">Correct: ${q.correct}</div>` : ''}
      ${q.explanation ? `<div class="review-explanation">💡 ${q.explanation}</div>` : ''}
    `;

    reviewList.appendChild(item);
  });
}

// ─── Init ────────────────────────────────────────────
loadQuiz();
