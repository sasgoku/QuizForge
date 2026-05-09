// =====================================================
// js/teacher.js — Teacher Panel Logic
// =====================================================
// Handles: JSON validation, quiz creation, quiz listing,
//          link generation, copy-to-clipboard, delete quiz
// =====================================================

// ─── Sample JSON template ───────────────────────────
const SAMPLE_JSON = {
  title: "Classification of Mathematical Sets Quiz",
  questions: [
    {
      type: "single_choice",
      question: "What is the definition of a singleton set?",
      options: [
        "A set with no elements",
        "A set with exactly one element",
        "A set with an unlimited number of elements",
        "A set containing only prime numbers"
      ],
      correct: "A set with exactly one element",
      explanation: "A singleton set is specifically defined as a set that contains exactly one member or element."
    },
    {
      type: "single_choice",
      question: "Which of the following is an example of an empty (null) set?",
      options: [
        "The set of all even prime numbers",
        "The set of all integers greater than 5",
        "The set of all dogs with six legs",
        "The set of all natural numbers less than 10"
      ],
      correct: "The set of all dogs with six legs",
      explanation: "An empty set contains no elements. Dogs with six legs do not exist, making this a null set."
    },
    {
      type: "single_choice",
      question: "A finite set is best described as:",
      options: [
        "A set that goes on forever",
        "A set with a countable, limited number of elements",
        "A set containing only prime numbers",
        "A set with at least 100 elements"
      ],
      correct: "A set with a countable, limited number of elements",
      explanation: "Finite sets have a specific number of elements that can be counted and listed completely."
    }
  ]
};

// ─── DOM Element References ──────────────────────────
const quizJsonEl       = document.getElementById('quizJson');
const jsonErrorEl      = document.getElementById('jsonError');
const createQuizBtn    = document.getElementById('createQuizBtn');
const btnText          = createQuizBtn.querySelector('.btn-text');
const btnSpinner       = createQuizBtn.querySelector('.btn-spinner');
const successBox       = document.getElementById('successBox');
const quizLinkEl       = document.getElementById('quizLink');
const copyLinkBtn      = document.getElementById('copyLinkBtn');
const loadTemplateBtn  = document.getElementById('loadTemplate');
const quizListLoading  = document.getElementById('quizListLoading');
const quizListEmpty    = document.getElementById('quizListEmpty');
const quizListContainer = document.getElementById('quizListContainer');

// ─── Utility: Generate a unique quiz ID ─────────────
function generateQuizId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── Utility: Build student quiz URL ────────────────
function buildQuizUrl(quizId) {
  const base = window.location.origin + window.location.pathname.replace('teacher.html', '');
  return `${base}quiz.html?id=${quizId}`;
}

// ─── Utility: Format timestamp ──────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Load Sample JSON into textarea ─────────────────
loadTemplateBtn.addEventListener('click', () => {
  quizJsonEl.value = JSON.stringify(SAMPLE_JSON, null, 2);
  hideError();
});

// ─── Validate JSON input ─────────────────────────────
function validateQuizJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: 'Invalid JSON — check for missing commas, brackets, or quotes.' };
  }

  if (!parsed.title || typeof parsed.title !== 'string') {
    return { valid: false, error: 'Missing or invalid "title" field.' };
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    return { valid: false, error: 'Missing or empty "questions" array.' };
  }

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.question) return { valid: false, error: `Question ${i + 1} is missing the "question" field.` };
    if (!Array.isArray(q.options) || q.options.length < 2) return { valid: false, error: `Question ${i + 1} must have at least 2 options.` };
    if (!q.correct) return { valid: false, error: `Question ${i + 1} is missing the "correct" field.` };
    if (!q.options.includes(q.correct)) return { valid: false, error: `Question ${i + 1}: "correct" value must match one of the options exactly.` };
  }

  return { valid: true, data: parsed };
}

// ─── Show/hide error message ─────────────────────────
function showError(msg) {
  jsonErrorEl.textContent = '⚠ ' + msg;
  jsonErrorEl.classList.remove('hidden');
  quizJsonEl.style.borderColor = 'var(--red)';
}

function hideError() {
  jsonErrorEl.classList.add('hidden');
  quizJsonEl.style.borderColor = '';
}

// ─── Set button loading state ────────────────────────
function setLoading(isLoading) {
  createQuizBtn.disabled = isLoading;
  btnText.classList.toggle('hidden', isLoading);
  btnSpinner.classList.toggle('hidden', !isLoading);
}

// ─── Create Quiz: Main Handler ───────────────────────
createQuizBtn.addEventListener('click', async () => {
  hideError();
  successBox.classList.add('hidden');

  const raw = quizJsonEl.value.trim();

  if (!raw) {
    showError('Please paste your quiz JSON first.');
    return;
  }

  // Validate
  const result = validateQuizJson(raw);
  if (!result.valid) {
    showError(result.error);
    return;
  }

  const quizData = result.data;

  // Start loading
  setLoading(true);

  try {
    const quizId = generateQuizId();

    // Save to Firestore under collection "quizzes" with the custom ID
    await db.collection('quizzes').doc(quizId).set({
      title: quizData.title,
      questions: quizData.questions,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Build and show the shareable link
    const quizUrl = buildQuizUrl(quizId);
    quizLinkEl.value = quizUrl;
    successBox.classList.remove('hidden');

    // Refresh the quiz list
    loadQuizList();

  } catch (err) {
    console.error('Error creating quiz:', err);
    showError('Failed to save quiz to Firebase. Check your Firebase config and Firestore rules.');
  } finally {
    setLoading(false);
  }
});

// ─── Copy Link Button ────────────────────────────────
copyLinkBtn.addEventListener('click', () => {
  quizLinkEl.select();
  navigator.clipboard.writeText(quizLinkEl.value).then(() => {
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => { copyLinkBtn.textContent = 'Copy'; }, 2000);
  });
});

// ─── Delete Quiz ─────────────────────────────────────
async function deleteQuiz(quizId, quizTitle) {
  const confirmed = confirm(`Delete "${quizTitle}"?\nThis will also remove all student results.`);
  if (!confirmed) return;

  try {
    // Delete quiz document
    await db.collection('quizzes').doc(quizId).delete();

    // Also delete associated results
    const results = await db.collection('results').where('quizId', '==', quizId).get();
    const batch = db.batch();
    results.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    loadQuizList();
  } catch (err) {
    console.error('Error deleting quiz:', err);
    alert('Failed to delete quiz. Try again.');
  }
}

// ─── Render a Single Quiz Card ───────────────────────
function renderQuizCard(quizId, quizData) {
  const card = document.createElement('div');
  card.className = 'quiz-item-card';
  card.setAttribute('data-quiz-id', quizId);

  const questionsCount = quizData.questions ? quizData.questions.length : 0;
  const dateStr = formatDate(quizData.createdAt);
  const resultsUrl = `results.html?id=${quizId}`;

  card.innerHTML = `
    <div class="quiz-item-info">
      <div class="quiz-item-title" title="${quizData.title}">${quizData.title}</div>
      <div class="quiz-item-meta">${questionsCount} question${questionsCount !== 1 ? 's' : ''} &nbsp;·&nbsp; Created ${dateStr}</div>
    </div>
    <div class="quiz-item-actions">
      <a href="${resultsUrl}" class="btn btn-ghost btn-sm">Results</a>
      <button class="btn btn-danger btn-sm" onclick="deleteQuiz('${quizId}', ${JSON.stringify(quizData.title)})">Delete</button>
    </div>
  `;

  return card;
}

// ─── Load All Quizzes from Firestore ─────────────────
async function loadQuizList() {
  quizListLoading.classList.remove('hidden');
  quizListEmpty.classList.add('hidden');
  quizListContainer.classList.add('hidden');
  quizListContainer.innerHTML = '';

  try {
    const snapshot = await db
      .collection('quizzes')
      .orderBy('createdAt', 'desc')
      .get();

    quizListLoading.classList.add('hidden');

    if (snapshot.empty) {
      quizListEmpty.classList.remove('hidden');
      return;
    }

    snapshot.forEach(doc => {
      const card = renderQuizCard(doc.id, doc.data());
      quizListContainer.appendChild(card);
    });

    quizListContainer.classList.remove('hidden');

  } catch (err) {
    console.error('Error loading quizzes:', err);
    quizListLoading.classList.add('hidden');
    quizListEmpty.classList.remove('hidden');
    quizListEmpty.querySelector('p').textContent =
      'Error loading quizzes. Check your Firebase config.';
  }
}

// ─── Init: Load quiz list on page load ───────────────
loadQuizList();
