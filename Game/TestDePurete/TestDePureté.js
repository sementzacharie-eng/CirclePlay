/* ----------------------------- */
/* État de la partie et libellés des difficultés. */
/* ----------------------------- */

let pureteDifficulty = "";
let pureteGender = "";
let puretePlayer = "";
let pureteQuestions = [];
let pureteCurrentRound = 0;
let pureteCategoryScores = {};
let pureteAnswerLocked = false;

const pureteDifficultyLabels = {
    CLASSIQUE: "Classique",
    HARD: "Hard",
    SPECIAL_SEX: "Special Sex"
};

/* ----------------------------- */
/* Parcours de préparation du test. */
/* ----------------------------- */

function TestDePurete() {
    fadeMenuContent(`
        <div class="purete-screen">
        <h2>Test de pureté</h2>
        <div id="qdn-difficulty-buttons">
            <button class="btn1" onclick="selectPureteDifficulty('CLASSIQUE')">CLASSIQUE 🙂</button>
            <button class="btn2" onclick="selectPureteDifficulty('HARD')">HARD 😈</button>
            <button class="btn3" onclick="selectPureteDifficulty('SPECIAL_SEX')">SPECIAL SEX 🔞</button>
        </div>
        <button class="btn-retour" onclick="menuGames()">← Retour</button>
        </div>
    `);
}

function selectPureteDifficulty(difficulty) {
    if (!Object.prototype.hasOwnProperty.call(pureteDifficultyLabels, difficulty)) return;
    pureteDifficulty = difficulty;
    showPureteGenderChoices();
}

function showPureteGenderChoices() {
    fadeMenuContent(`
        <div class="purete-screen">
        <h2>Choisissez votre genre</h2>
        <div id="purete-gender-buttons">
            <button id="purete-gender-fille" onclick="selectPureteGender('fille')">Fille 👧</button>
            <button id="purete-gender-garcon" onclick="selectPureteGender('garçon')">Garçon 👦</button>
        </div>
        <button class="btn-retour" onclick="TestDePurete()">← Difficulté</button>
        </div>
    `);
}

function selectPureteGender(gender) {
    if (!["fille", "garçon"].includes(gender)) return;
    pureteGender = gender;
    showPureteNameInput();
}

function showPureteNameInput() {
    fadeMenuContent(`
        <div class="purete-screen">
        <h2>Quel est votre nom ?</h2>
        <div class="player-input-area">
            <input id="purete-name" class="purete-name-input" type="text" placeholder="Nom du joueur" maxlength="20"
                autocomplete="given-name" oninput="checkPureteName()">
        </div>
        <button id="purete-name-next" onclick="continuePureteName()" disabled>Commencer</button>
        <button class="btn-retour" onclick="showPureteGenderChoices()">← Retour</button>
        </div>
    `);
    setTimeout(() => document.getElementById("purete-name")?.focus(), 200);
}

/* ----------------------------- */
/* Validation du pseudo et chargement des questions. */
/* ----------------------------- */

function checkPureteName() {
    const nameInput = document.getElementById("purete-name");
    const nextButton = document.getElementById("purete-name-next");
    if (!nameInput || !nextButton) return;

    const valid = nameInput.value.trim().length > 0;
    nextButton.disabled = !valid;
    nextButton.style.opacity = valid ? "1" : "0.5";
    nextButton.style.cursor = valid ? "pointer" : "not-allowed";
}

function continuePureteName() {
    const nameInput = document.getElementById("purete-name");
    if (!nameInput || !nameInput.value.trim()) return;

    puretePlayer = nameInput.value.trim();
    startPureteGame();
}

/* ----------------------------- */
/* Chargement et vérification des questions par genre. */
/* ----------------------------- */

function getPureteQuestionCategories() {
    const data = window[`${pureteDifficulty.toLowerCase()}TestDePureteData`];
    const categories = data?.categories;
    if (!categories || typeof categories !== "object") {
        throw new Error(`Les questions de la difficulté ${pureteDifficulty} sont introuvables.`);
    }

    const genderKey = pureteGender === "fille" ? "fille" : "garcon";
    if (!["fille", "garçon"].includes(pureteGender)) {
        throw new Error("Choisissez le genre du joueur avant de charger les questions.");
    }

    const entries = Object.entries(categories);
    const hasValidQuestions = questions =>
        Array.isArray(questions) && questions.length > 0 && questions.every(question =>
            question && typeof question.text === "string" &&
            Number.isFinite(question.points) && question.points > 0
        );

    if (entries.length !== 5 || entries.some(([, genderQuestions]) =>
        !genderQuestions ||
        !hasValidQuestions(genderQuestions.fille) ||
        !hasValidQuestions(genderQuestions.garcon)
    )) {
        throw new Error(`La difficulté ${pureteDifficulty} doit contenir 5 catégories avec une liste de questions fille et une liste garçon, au format { text, points }.`);
    }

    return entries.map(([category, genderQuestions]) => [category, genderQuestions[genderKey]]);
}

function startPureteGame() {
    const categories = getPureteQuestionCategories();
    const questions = categories.flatMap(([category, categoryQuestions]) =>
        categoryQuestions.map(question => ({ ...question, category }))
    );

    pureteQuestions = questions;
    pureteCurrentRound = 0;
    pureteCategoryScores = Object.fromEntries(categories.map(([category, categoryQuestions]) => [
        category,
        {
            score: 0,
            maximum: categoryQuestions.reduce((total, question) => total + question.points, 0)
        }
    ]));
    pureteAnswerLocked = false;
    renderPureteQuestion();
}

/* ----------------------------- */
/* Affichage des questions et enregistrement des réponses. */
/* ----------------------------- */

function escapePureteHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function renderPureteQuestion() {
    if (pureteCurrentRound >= pureteQuestions.length) {
        renderPureteResult();
        return;
    }

    const question = pureteQuestions[pureteCurrentRound];
    fadeMenuContent(`
        <div class="purete-screen">
        <h2>Test de pureté</h2>
        <p id="purete-player">${escapePureteHtml(puretePlayer)} · ${pureteGender === "fille" ? "Joueuse" : "Joueur"}</p>
        <p id="purete-progress"><span class="purete-remaining">${pureteCurrentRound + 1}/${pureteQuestions.length}</span><span class="purete-category">${escapePureteHtml(question.category)}</span></p>
        <p id="purete-question">${escapePureteHtml(question.text)}</p>
        <div id="purete-answer-buttons">
            <button class="purete-yes" onclick="answerPureteQuestion(true)">Oui</button>
            <button class="purete-no" onclick="answerPureteQuestion(false)">Non</button>
        </div>
        <button class="btn-retour" onclick="TestDePurete()">← Quitter</button>
        </div>
    `);
    setTimeout(() => {
        pureteAnswerLocked = false;
    }, 200);
}

function answerPureteQuestion(answeredYes) {
    if (pureteAnswerLocked || pureteCurrentRound >= pureteQuestions.length) return;
    pureteAnswerLocked = true;
    document.querySelectorAll("#purete-answer-buttons button").forEach(button => {
        button.disabled = true;
    });

    if (answeredYes) {
        const categoryScore = pureteCategoryScores[pureteQuestions[pureteCurrentRound].category];
        categoryScore.score += pureteQuestions[pureteCurrentRound].points;
    }
    pureteCurrentRound++;
    renderPureteQuestion();
}

/* ----------------------------- */
/* Calcul et affichage des résultats par catégorie. */
/* ----------------------------- */

function renderPureteResult() {
    const categoryRows = Object.entries(pureteCategoryScores).map(([category, result]) => {
        const percentage = Math.round((result.score / result.maximum) * 100);
        return `
            <li><span>${escapePureteHtml(category)}</span><strong>${percentage} %</strong></li>
        `;
    });
    const totalScore = Object.values(pureteCategoryScores)
        .reduce((total, result) => total + result.score, 0);
    const totalMaximum = Object.values(pureteCategoryScores)
        .reduce((total, result) => total + result.maximum, 0);
    const globalPercentage = Math.round((totalScore / totalMaximum) * 100);
    categoryRows.push(`
        <li class="purete-global-score"><span>Score global</span><strong>${globalPercentage} %</strong></li>
    `);

    fadeMenuContent(`
        <div class="purete-screen">
        <h2>Résultats de ${escapePureteHtml(puretePlayer)}</h2>
        <p id="purete-progress">${pureteQuestions.length} questions · ${pureteDifficultyLabels[pureteDifficulty]}</p>
        <ol id="purete-results">${categoryRows.join("")}</ol>
        <button onclick="startPureteGame()">Rejouer</button>
        <button class="btn-retour purete-menu-retour" onclick="menuGames()">← Menu des jeux</button>
        </div>
    `);
}
