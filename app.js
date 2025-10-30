// ============================================
// PDF QUIZ GENERATOR - MAIN APP
// ============================================

// --- GLOBALE VARIABELEN ---
let pdfText = '';           // Tekst uit de PDF
let quizData = [];          // Array met alle vragen
let currentQuestion = 0;    // Huidige vraag index
let userAnswers = [];       // Antwoorden van gebruiker

// --- DOM ELEMENTEN ---
const pdfInput = document.getElementById('pdf-input');
const fileName = document.getElementById('file-name');
const extractBtn = document.getElementById('extract-btn');
const textPreview = document.getElementById('text-preview');
const textLength = document.getElementById('text-length');
const generateBtn = document.getElementById('generate-btn');
const numQuestionsInput = document.getElementById('num-questions');
const loading = document.getElementById('loading');

// Secties
const uploadSection = document.getElementById('upload-section');
const generateSection = document.getElementById('generate-section');
const quizSection = document.getElementById('quiz-section');
const resultsSection = document.getElementById('results-section');

// ============================================
// STAP 1: PDF UPLOAD & TEKST EXTRACTIE
// ============================================

// Wanneer er een PDF wordt geselecteerd
pdfInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        fileName.textContent = `📄 ${file.name}`;
        extractBtn.disabled = false;
    } else {
        fileName.textContent = 'Selecteer een geldig PDF bestand';
        extractBtn.disabled = true;
    }
});

// Tekst uit PDF extraheren
extractBtn.addEventListener('click', async () => {
    const file = pdfInput.files[0];
    if (!file) return;

    extractBtn.disabled = true;
    extractBtn.textContent = 'Bezig met extraheren...';

    try {
        // PDF laden met PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        let fullText = '';
        
        // Door alle pagina's heen lopen
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        pdfText = fullText.trim();
        
        // Preview tonen (eerste 500 karakters)
        textPreview.textContent = pdfText.substring(0, 500) + '...';
        textLength.textContent = pdfText.length;
        
        // Naar volgende sectie
        showSection('generate');
        generateBtn.disabled = false;
        
    } catch (error) {
        alert('Fout bij het lezen van de PDF: ' + error.message);
        console.error(error);
    } finally {
        extractBtn.disabled = false;
        extractBtn.textContent = 'Tekst Extraheren';
    }
});

// ============================================
// STAP 2: VRAGEN GENEREREN MET OPENAI
// ============================================

generateBtn.addEventListener('click', async () => {
    const numQuestions = parseInt(numQuestionsInput.value);
    
    // Validatie
    if (!pdfText) {
        alert('Er is geen tekst gevonden. Upload eerst een PDF.');
        return;
    }
    
    // UI feedback
    generateBtn.disabled = true;
    loading.classList.add('active');
    
    try {
        // API aanroepen (nu via onze Vercel function!)
        const questions = await generateQuestions(pdfText, numQuestions);
        quizData = questions;
        userAnswers = new Array(questions.length).fill(null);
        
        // Quiz opbouwen
        buildQuiz();
        showSection('quiz');
        
    } catch (error) {
        alert('Fout bij het genereren van vragen: ' + error.message);
        console.error(error);
    } finally {
        generateBtn.disabled = false;
        loading.classList.remove('active');
    }
});

// Functie om vragen te genereren via onze Vercel backend
async function generateQuestions(text, numQuestions) {
    // Naar onze eigen API endpoint sturen (Vercel function)
    const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            numQuestions: numQuestions
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API call mislukt');
    }
    
    const data = await response.json();
    return data.questions;
}

// ============================================
// STAP 3: QUIZ INTERFACE
// ============================================

function buildQuiz() {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    
    quizData.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-card';
        if (index === 0) questionDiv.classList.add('active');
        
        questionDiv.innerHTML = `
            <div class="question-text">${index + 1}. ${q.question}</div>
            <div class="answers">
                ${q.answers.map((answer, answerIndex) => `
                    <label class="answer-option">
                        <input type="radio" name="question-${index}" value="${answerIndex}">
                        <span>${answer}</span>
                    </label>
                `).join('')}
            </div>
        `;
        
        quizContainer.appendChild(questionDiv);
        
        // Event listener voor antwoord selectie
        const radioButtons = questionDiv.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                userAnswers[index] = parseInt(e.target.value);
                
                // Visuele feedback
                const labels = questionDiv.querySelectorAll('.answer-option');
                labels.forEach(label => label.classList.remove('selected'));
                e.target.closest('.answer-option').classList.add('selected');
                
                // Check of alle vragen beantwoord zijn
                checkQuizComplete();
            });
        });
    });
    
    updateQuestionCounter();
}

// Navigatie tussen vragen
document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion(currentQuestion);
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentQuestion < quizData.length - 1) {
        currentQuestion++;
        showQuestion(currentQuestion);
    }
});

function showQuestion(index) {
    const questions = document.querySelectorAll('.question-card');
    questions.forEach((q, i) => {
        q.classList.toggle('active', i === index);
    });
    updateQuestionCounter();
}

function updateQuestionCounter() {
    document.getElementById('question-counter').textContent = 
        `Vraag ${currentQuestion + 1} van ${quizData.length}`;
}

function checkQuizComplete() {
    const allAnswered = userAnswers.every(answer => answer !== null);
    const submitBtn = document.getElementById('submit-quiz-btn');
    
    if (allAnswered) {
        submitBtn.classList.add('active');
    }
}

// Quiz indienen
document.getElementById('submit-quiz-btn').addEventListener('click', () => {
    showResults();
    showSection('results');
});

// ============================================
// STAP 4: RESULTATEN
// ============================================

function showResults() {
    let correctCount = 0;
    
    // Score berekenen
    quizData.forEach((q, index) => {
        if (userAnswers[index] === q.correctIndex) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / quizData.length) * 100);
    const passed = percentage >= 60;
    
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = `
        <div class="score-display">
            <div class="score-circle ${passed ? 'pass' : 'fail'}">
                ${percentage}%
            </div>
            <div class="score-text">
                ${passed ? '✅ Geslaagd!' : '❌ Niet gehaald'}
            </div>
            <div class="score-details">
                ${correctCount} van de ${quizData.length} vragen goed
            </div>
        </div>
        
        <h3>Overzicht per vraag:</h3>
        ${quizData.map((q, index) => {
            const isCorrect = userAnswers[index] === q.correctIndex;
            return `
                <div class="result-question ${isCorrect ? 'correct' : 'incorrect'}">
                    <h4>${isCorrect ? '✅' : '❌'} Vraag ${index + 1}: ${q.question}</h4>
                    ${!isCorrect ? `
                        <div class="result-answer user-answer">
                            Jouw antwoord: ${q.answers[userAnswers[index]]}
                        </div>
                    ` : ''}
                    <div class="result-answer correct-answer">
                        Correct antwoord: ${q.answers[q.correctIndex]}
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// Opnieuw proberen
document.getElementById('retry-btn').addEventListener('click', () => {
    userAnswers = new Array(quizData.length).fill(null);
    currentQuestion = 0;
    buildQuiz();
    showSection('quiz');
    document.getElementById('submit-quiz-btn').classList.remove('active');
});

// Nieuwe quiz starten
document.getElementById('new-quiz-btn').addEventListener('click', () => {
    pdfText = '';
    quizData = [];
    userAnswers = [];
    currentQuestion = 0;
    pdfInput.value = '';
    fileName.textContent = '';
    textPreview.textContent = 'Hier komt de tekst uit je PDF...';
    textLength.textContent = '0';
    showSection('upload');
});

// ============================================
// HELPER FUNCTIES
// ============================================

function showSection(sectionName) {
    // Alle secties verbergen
    uploadSection.classList.remove('active');
    generateSection.classList.remove('active');
    quizSection.classList.remove('active');
    resultsSection.classList.remove('active');
    
    // Juiste sectie tonen
    switch(sectionName) {
        case 'upload':
            uploadSection.classList.add('active');
            break;
        case 'generate':
            generateSection.classList.add('active');
            break;
        case 'quiz':
            quizSection.classList.add('active');
            break;
        case 'results':
            resultsSection.classList.add('active');
            break;
    }
}

// ============================================
// INITIALISATIE
// ============================================

// Controleer of PDF.js geladen is
if (typeof pdfjsLib === 'undefined') {
    alert('PDF.js library kon niet worden geladen. Check je internetverbinding.');
}

console.log('📚 Quiz Generator geladen en klaar voor gebruik!');
