/* ----------------------------- */
/* État des joueurs, manches et scores. */
/* ----------------------------- */

let quiDeNousPlayers = [];
let quiDeNousDifficulty = "";
let quiDeNousRounds = 0;
let quiDeNousRoundsPlayed = 0;
let quiDeNousQuestionQueue = [];
let quiDeNousLastQuestion = "";
let quiDeNousScores = [];
let quiDeNousSelectedPlayer = null;

/* ----------------------------- */
/* Saisie, ajout et validation des joueurs. */
/* ----------------------------- */

function QuiDeNous() {
    fadeMenuContent(`
        <h2>Qui de nous ?</h2>
        <button class="suivant-button" id="qdn-suivant-btn" onclick="goToQuiDeNousDifficultyIfReady()" disabled>Suivant</button>
        <div class="player-input-area">
            <button class="add-input" onclick="addQuiDeNousInput()">+</button>
            <div id="qdn-input-list">
                <div class="input-row">
                    <input type="text" placeholder="Nom du joueur" maxlength="15" oninput="checkQuiDeNousInputs()"><button class="delete-input" onclick="removeQuiDeNousInput(this)">×</button>
                </div>
                <div class="input-row">
                    <input type="text" placeholder="Nom du joueur" maxlength="15" oninput="checkQuiDeNousInputs()"><button class="delete-input" onclick="removeQuiDeNousInput(this)">×</button>
                </div>
            </div>
        </div>
        <button class="btn-retour" onclick="menuGames()">← Retour</button>
    `);
    checkQuiDeNousInputs();
}

function addQuiDeNousInput() {
    const inputList = document.getElementById("qdn-input-list");
    if (!inputList || inputList.children.length >= 6) return;

    const row = document.createElement("div");
    row.className = "input-row";
    row.innerHTML = `<input type="text" placeholder="Nom du joueur" maxlength="15" oninput="checkQuiDeNousInputs()"><button class="delete-input" onclick="removeQuiDeNousInput(this)">×</button>`;
    inputList.appendChild(row);
    checkQuiDeNousInputs();
}

function removeQuiDeNousInput(button) {
    const row = button.parentElement;
    const inputList = document.getElementById("qdn-input-list");
    if (!row || !inputList) return;

    if (inputList.children.length > 2) {
        row.remove();
    } else {
        row.querySelector("input").value = "";
    }
    checkQuiDeNousInputs();
}

function checkQuiDeNousInputs() {
    const button = document.getElementById("qdn-suivant-btn");
    const inputs = document.querySelectorAll("#qdn-input-list input");
    if (!button) return;

    const names = Array.from(inputs, input => input.value.trim());
    const valid = names.every(Boolean) && new Set(names).size === names.length;
    button.disabled = !valid;
    button.style.opacity = valid ? "1" : "0.5";
    button.style.cursor = valid ? "pointer" : "not-allowed";
}

function goToQuiDeNousDifficultyIfReady() {
    const inputs = document.querySelectorAll("#qdn-input-list input");
    const names = Array.from(inputs, input => input.value.trim());
    if (names.length < 2 || names.some(name => !name) || new Set(names).size !== names.length) return;

    quiDeNousPlayers = names;
    quiDeNousDifficulty = "";
    quiDeNousRounds = 0;
    QuiDeNousDiff();
}

/* ----------------------------- */
/* Choix de difficulté et du nombre de manches. */
/* ----------------------------- */

function QuiDeNousDiff() {
    fadeMenuContent(`
        <h2>Choisissez la difficulté</h2>
        <div id="qdn-difficulty-buttons">
            <button class="btn1" aria-pressed="false" onclick="selectQuiDeNousDifficulty('CHILL')">CHILL 😆</button>
            <button class="btn2" aria-pressed="false" onclick="selectQuiDeNousDifficulty('SOFT')">SOFT 😎</button>
            <button class="btn3" aria-pressed="false" onclick="selectQuiDeNousDifficulty('HARD')">HARD 😈</button>
            <button class="btn4" aria-pressed="false" onclick="selectQuiDeNousDifficulty('EXTREME')">EXTREME 🔞</button>
        </div>
        <button class="btn-retour" onclick="QuiDeNous()">← Retour</button>
    `);
}

function selectQuiDeNousDifficulty(difficulty) {
    if (!["CHILL", "SOFT", "HARD", "EXTREME"].includes(difficulty)) return;

    quiDeNousDifficulty = difficulty;
    quiDeNousRounds = 0;
    quiDeNousRoundsPlayed = 0;
    quiDeNousLastQuestion = "";
    showQuiDeNousRoundChoices();
}

function showQuiDeNousRoundChoices() {
    fadeMenuContent(`
        <h2>Choisissez le nombre de manches</h2>
        <div id="qdn-round-buttons">
            <button class="btn1" aria-pressed="false" onclick="selectQuiDeNousRounds(10)">10</button>
            <button class="btn2" aria-pressed="false" onclick="selectQuiDeNousRounds(20)">20</button>
            <button class="btn3" aria-pressed="false" onclick="selectQuiDeNousRounds(30)">30</button>
            <button class="btn4" aria-pressed="false" onclick="selectQuiDeNousRounds(40)">40</button>
            <button class="btn5" aria-pressed="false" onclick="selectQuiDeNousRounds(50)">50</button>
        </div>
        <button class="btn-retour" onclick="QuiDeNousDiff()">← Retour</button>
    `);
}

function selectQuiDeNousRounds(rounds) {
    if (![10, 20, 30, 40, 50].includes(rounds)) return;

    quiDeNousRounds = rounds;
    quiDeNousRoundsPlayed = 0;
    quiDeNousQuestionQueue = [];
    quiDeNousLastQuestion = "";
    quiDeNousScores = quiDeNousPlayers.map(() => 0);
    renderQuiDeNousRound();
}

/* ----------------------------- */
/* Sélection et validation des questions. */
/* ----------------------------- */

function escapeQuiDeNousHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getNextQuiDeNousQuestion() {
    const difficultyKey = quiDeNousDifficulty.toLowerCase();
    const data = window[`${difficultyKey}QuiDeNousData`];
    const questions = data?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error(`Aucune question n'est disponible pour la difficulté ${quiDeNousDifficulty}.`);
    }

    if (quiDeNousQuestionQueue.length === 0) {
        quiDeNousQuestionQueue = [...questions];
        for (let index = quiDeNousQuestionQueue.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [quiDeNousQuestionQueue[index], quiDeNousQuestionQueue[randomIndex]] =
                [quiDeNousQuestionQueue[randomIndex], quiDeNousQuestionQueue[index]];
        }

        if (quiDeNousQuestionQueue.length > 1 && quiDeNousQuestionQueue[0] === quiDeNousLastQuestion) {
            [quiDeNousQuestionQueue[0], quiDeNousQuestionQueue[1]] =
                [quiDeNousQuestionQueue[1], quiDeNousQuestionQueue[0]];
        }
    }

    quiDeNousLastQuestion = quiDeNousQuestionQueue.pop();
    return quiDeNousLastQuestion;
}

/* ----------------------------- */
/* Affichage des manches et du classement final. */
/* ----------------------------- */

function renderQuiDeNousRound() {
    if (quiDeNousRoundsPlayed >= quiDeNousRounds) {
        const ranking = quiDeNousPlayers
            .map((player, index) => ({ player, score: quiDeNousScores[index], index }))
            .sort((first, second) => second.score - first.score || first.index - second.index);
        const rankingItems = ranking.map(({ player, score }) => `
            <li><span>${escapeQuiDeNousHtml(player)}</span><strong>${score} point${Math.abs(score) === 1 ? "" : "s"}</strong></li>
        `).join("");

        fadeMenuContent(`
            <h2>Classement final</h2>
            <p id="qdn-round-count">${quiDeNousRounds} manches jouées</p>
            <ol id="qdn-leaderboard">${rankingItems}</ol>
            <button onclick="selectQuiDeNousRounds(${quiDeNousRounds})">Rejouer</button>
            <button class="btn-retour" onclick="showMainMenu()">⌂ Accueil</button>
        `);
        return;
    }

    quiDeNousSelectedPlayer = null;
    const question = getNextQuiDeNousQuestion();
    if (!question || typeof question.text !== "string" || ![2, -1].includes(question.points)) {
        throw new Error(`Question invalide pour la difficulté ${quiDeNousDifficulty}.`);
    }
    const playerButtons = quiDeNousPlayers.map((player, index) => `
        <button class="qdn-player-button" aria-pressed="false" onclick="selectQuiDeNousPlayer(${index})">${escapeQuiDeNousHtml(player)}</button>
    `).join("");

    fadeMenuContent(`
        <h2>Qui de nous ?</h2>
        <p id="qdn-round-count">Manche ${quiDeNousRoundsPlayed + 1} / ${quiDeNousRounds}</p>
        <p id="qdn-question">${escapeQuiDeNousHtml(question.text)}</p>
        <div id="qdn-player-buttons">${playerButtons}</div>
        <p id="qdn-player-selection" aria-live="polite">Choisissez un joueur.</p>
        <button id="qdn-next-round" onclick="completeQuiDeNousRound()" disabled>Manche suivante</button>
        ${getVoiceReplayButtonMarkup()}
        ${getVoiceControlsFooterMarkup("← Difficultés", "QuiDeNousDiff()")}
    `, () => {
        document.querySelector("[data-voice-replay]")?.style.setProperty("display", "block");
        speakCirclePlayText(`Qui de nous ? ${question.text}`);
    });
}

/* ----------------------------- */
/* Sélection du joueur et validation de la manche. */
/* ----------------------------- */

function selectQuiDeNousPlayer(playerIndex) {
    if (quiDeNousRoundsPlayed >= quiDeNousRounds || !quiDeNousPlayers[playerIndex]) return;

    quiDeNousSelectedPlayer = playerIndex;
    const playerButtons = document.querySelectorAll("#qdn-player-buttons button");
    playerButtons.forEach((button, index) => {
        const selected = index === playerIndex;
        button.setAttribute("aria-pressed", String(selected));
    });

    const selection = document.getElementById("qdn-player-selection");
    const points = quiDeNousLastQuestion.points;
    const pointLabel = points > 0 ? `+${points} points` : `${points} point`;
    if (selection) selection.textContent = `${quiDeNousPlayers[playerIndex]} : ${pointLabel}`;
    speakCirclePlayText(`${quiDeNousPlayers[playerIndex]}. ${quiDeNousLastQuestion.text}. ${pointLabel}`);

    const nextButton = document.getElementById("qdn-next-round");
    if (nextButton) {
        nextButton.disabled = false;
        nextButton.textContent = quiDeNousRoundsPlayed + 1 >= quiDeNousRounds ? "Terminer" : "Valider et continuer";
    }
}

function completeQuiDeNousRound() {
    if (quiDeNousSelectedPlayer === null || quiDeNousRoundsPlayed >= quiDeNousRounds) return;

    quiDeNousScores[quiDeNousSelectedPlayer] += quiDeNousLastQuestion.points;
    quiDeNousRoundsPlayed++;
    renderQuiDeNousRound();
}