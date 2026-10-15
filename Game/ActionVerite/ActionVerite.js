/* ----------------------------- */
/* État des joueurs saisi pour la partie. */
/* ----------------------------- */

let champ1 = "";
let champ2 = "";
let champ3 = "";
let champ4 = "";
let champ5 = "";
let champ6 = "";
let actionVeriteTransitionPending = false;

function stopActionVeriteSpeech() {
    stopCirclePlaySpeech();
}

/* ----------------------------- */
/* Saisie et validation des joueurs. */
/* ----------------------------- */

function ActionVerity() {
    stopActionVeriteSpeech();
    fadeMenuContent(`
        <h2>Action ou Vérité</h2>
        <button class="suivant-button" id="suivant-btn" onclick="goToDifficultyIfReady()">Suivant</button>
        <div class="player-input-area">
            <button class="add-input" onclick="addInput()">+</button>
            <div id="input-list">
                <div class="input-row">
                    <input type="text" placeholder="Nom du joueur" id="input-1" maxlength="15" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>
                </div>

                <div class="input-row">
                    <input type="text" placeholder="Nom du joueur" id="input-2" maxlength="15" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>
                </div>
            </div>
        </div>

        <button class="btn-retour" onclick="menuGames()">← Retour</button>
    `);
    updateStoredTexts();
    setTimeout(checkInputsForNext, 250);
}

/* ----------------------------- */
/* Ajoute un champ de joueur, jusqu'à la limite de six joueurs. */
/* ----------------------------- */

function addInput() {
    const inputList = document.getElementById("input-list");

    if (inputList && inputList.children.length >= 6) {
        return;
    }

    const count = inputList.children.length + 1;
    const row = document.createElement("div");
    row.className = "input-row";
    row.innerHTML = `<input type="text" placeholder="Nom du joueur" id="input-${count}" maxlength="15" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>`;
    inputList.appendChild(row);
    updateStoredTexts();
    checkInputsForNext();
}

/* ----------------------------- */
/* Supprime un champ ou le vide si les deux champs minimum sont présents. */
/* ----------------------------- */

function removeInput(button) {
    const row = button.parentElement;
    const inputList = document.getElementById("input-list");

    if (inputList && inputList.children.length > 2) {
        row.remove();
    } else {
        row.querySelector("input").value = "";
    }

    updateStoredTexts();
    checkInputsForNext();
}

/* ----------------------------- */
/* Copie les noms saisis dans les variables utilisées pendant la partie. */
/* ----------------------------- */

function updateStoredTexts() {
    champ1 = document.getElementById("input-1")?.value || "";
    champ2 = document.getElementById("input-2")?.value || "";
    champ3 = document.getElementById("input-3")?.value || "";
    champ4 = document.getElementById("input-4")?.value || "";
    champ5 = document.getElementById("input-5")?.value || "";
    champ6 = document.getElementById("input-6")?.value || "";
}

/* Indique qu'un champ a été modifié par le joueur. */
function markInputAsEdited(input) {
    input.dataset.edited = "true";
}

/* ----------------------------- */
/* Active Suivant si tous les noms sont remplis et différents. */
/* ----------------------------- */

function checkInputsForNext() {
    const button = document.getElementById("suivant-btn");
    const inputs = document.querySelectorAll("#input-list input");

    if (!button) return;

    const values = Array.from(inputs).map(input => input.value.trim());
    const allFilled = values.every(value => value !== "") && values.every((value, index) => values.indexOf(value) === index);

    button.disabled = !allFilled;
    button.style.opacity = allFilled ? "1" : "0.5";
    button.style.cursor = allFilled ? "pointer" : "not-allowed";
}

/* Ouvre le choix de difficulté uniquement si la saisie est valide. */
function goToDifficultyIfReady() {
    if (document.getElementById("suivant-btn")?.disabled) {
        return;
    }
    ActionVerityDiff();
}

/* ----------------------------- */
/* Affiche les niveaux de difficulté disponibles. */
/* ----------------------------- */

function ActionVerityDiff() {
    stopActionVeriteSpeech();
    fadeMenuContent(`
        <h2>Choisissez la difficulté</h2>
        <div id="difficulty-buttons">
            <button class="btn1" onclick="ActionVerityChill()">CHILL 😆</button>
            <button class="btn2" onclick="ActionVeritySoft()">SOFT 😎</button>
            <button class="btn3" onclick="ActionVerityHard()">HARD 😈</button>
            <button class="btn4" onclick="ActionVerityExtreme()">EXTREME 🔞</button>
            <button class="btn5" onclick="ActionVerityLove()">LOVE 💕</button>
            <button class="btn6" onclick="ActionVerityMuscu()">COMPÉTITION 💪</button>
        </div>
        <button class="btn-retour" onclick="ActionVerity()">← Retour</button>
    `);
}

/* ----------------------------- */
/* Sélection des joueurs et récupération des défis. */
/* ----------------------------- */

function getRandomPlayer2(joueurActuel) {
    let joueursPossibles = [champ1, champ2, champ3, champ4, champ5, champ6]
        .map(nom => nom.trim())
        .filter(nom => nom !== "" && nom !== joueurActuel);

    if (joueursPossibles.length === 0) {
        return "un autre joueur";
    }

    return joueursPossibles[Math.floor(Math.random() * joueursPossibles.length)];
}

/* Sélectionne un défi aléatoire et remplace le nom du second joueur. */
function getDifficultyPrompt(mode, type) {
    let storage = window[`${mode}ActionVeriteData`];

    if (!storage || !storage[type] || !storage[type].length) {
        return "";
    }

    let phrase = storage[type][Math.floor(Math.random() * storage[type].length)];
    let joueurActuel = document.getElementById("player-turn")?.textContent.trim() || "";
    let joueur2 = getRandomPlayer2(joueurActuel);

    return phrase.replaceAll(
        "{joueur2}",
        `<span style="color: blue; font-weight: bold;">${joueur2}</span>`
    );
}

/* Affiche l'écran commun à tous les modes et niveaux de difficulté. */
function renderDifficultyScreen(mode, title) {
    stopActionVeriteSpeech();
    fadeMenuContent(`
        <h2>${title}</h2>
        <p id="player-turn">${getRandomPlayerName()}</p>
        <div id="ActionTruthButtons">
            <button class="btnAction" onclick="showDifficultyPrompt('${mode}', 'action')">ACTION</button>
            <button class="btntruth" onclick="showDifficultyPrompt('${mode}', 'truth')">VÉRITÉ</button>
        </div>
        <button id="next-${mode}-btn" style="display:none;" onclick="showDifficultyChoices('${mode}')">Suivant</button>
        <p id="chill-prompt">Choisis une option</p>
        <button id="speak-prompt-btn" class="speak-prompt-button" data-voice-replay style="display:none;" onclick="replayCirclePlaySpeech()">🔊 Réécouter</button>
        ${getVoiceControlsFooterMarkup("← Retour", "ActionVerityDiff()")}
    `);
}

/* Choisit au hasard un nom parmi les joueurs enregistrés. */
function getRandomPlayerName() {
    const names = [champ1, champ2, champ3, champ4, champ5, champ6].filter(Boolean);
    if (!names.length) return "Joueur";
    return names[Math.floor(Math.random() * names.length)];
}

function fadeDifficultyControls(mode, update) {
    if (actionVeriteTransitionPending) return;

    const controls = [
        document.getElementById("player-turn"),
        document.getElementById("ActionTruthButtons"),
        document.getElementById("chill-prompt"),
        document.getElementById("speak-prompt-btn"),
        document.getElementById(`next-${mode}-btn`)
    ].filter(Boolean);

    if (controls.length === 0) return;

    actionVeriteTransitionPending = true;
    controls.forEach(control => {
        control.style.opacity = "0";
    });

    setTimeout(() => {
        if (controls.every(control => control.isConnected)) {
            update();
            controls.forEach(control => {
                control.style.opacity = "1";
            });
        }
        actionVeriteTransitionPending = false;
    }, 180);
}

function speakDifficultyPrompt(text) {
    if (!text) {
        const player = document.getElementById("player-turn")?.textContent || "";
        const prompt = document.getElementById("chill-prompt")?.textContent || "";
        text = `${player}. ${prompt}`;
    }
    speakCirclePlayText(text);
}

/* Affiche le défi choisi et prépare le bouton pour passer au tour suivant. */
function showDifficultyPrompt(mode, type) {
    if (actionVeriteTransitionPending) return;

    const prompt = getDifficultyPrompt(mode, type);
    const promptText = document.createElement("div");
    promptText.innerHTML = prompt;
    const speakButton = document.getElementById("speak-prompt-btn");

    if (speakButton) {
        const speechAvailable = isCirclePlaySpeechAvailable();
        speakButton.style.display = "block";
        speakButton.textContent = speechAvailable ? "🔊 Réécouter" : "Synthèse vocale indisponible";
        speakButton.disabled = !speechAvailable || !circlePlayVoiceEnabled;
    }

    fadeDifficultyControls(mode, () => {
        const promptElement = document.getElementById("chill-prompt");
        const actionButton = document.querySelector(".btnAction");
        const truthButton = document.querySelector(".btntruth");
        const nextButton = document.getElementById(`next-${mode}-btn`);

        if (promptElement) {
            promptElement.innerHTML = prompt;
        }

        if (actionButton) actionButton.style.display = "none";
        if (truthButton) truthButton.style.display = "none";
        if (nextButton) nextButton.style.display = "block";
        speakDifficultyPrompt(`${document.getElementById("player-turn")?.textContent || ""}. ${promptText.textContent}`);
    });
}

/* Réinitialise l'écran et choisit le joueur du prochain tour. */
function showDifficultyChoices(mode) {
    stopActionVeriteSpeech();
    fadeDifficultyControls(mode, () => {
        const actionButton = document.querySelector(".btnAction");
        const truthButton = document.querySelector(".btntruth");
        const nextButton = document.getElementById(`next-${mode}-btn`);
        const playerElement = document.getElementById("player-turn");
        const promptElement = document.getElementById("chill-prompt");
        const speakButton = document.getElementById("speak-prompt-btn");

        if (playerElement) {
            playerElement.textContent = getRandomPlayerName();
        }

        if (promptElement) {
            promptElement.textContent = "Choisis une option";
        }
        if (speakButton) speakButton.style.display = "none";

        if (actionButton) actionButton.style.display = "inline-flex";
        if (truthButton) truthButton.style.display = "inline-flex";
        if (nextButton) nextButton.style.display = "none";
    });
}

/* Affiche un défi du mode Chill. */
function showChillPrompt(type) {
    showDifficultyPrompt("chill", type);
}

/* Passe au prochain choix du mode Chill. */
function showChillChoices() {
    showDifficultyChoices("chill");
}

/* ----------------------------- */
/* Accès aux écrans de partie par difficulté. */
/* ----------------------------- */

function ActionVerityChill() {
    renderDifficultyScreen("chill", "Action ou Vérité - CHILL");
}

/* ----------------------------- */
/* Ouvre une partie en difficulté Soft. */
/* ----------------------------- */

function ActionVeritySoft() {
    renderDifficultyScreen("soft", "Action ou Vérité - SOFT");
}

/* ----------------------------- */
/* Ouvre une partie en difficulté Hard. */
/* ----------------------------- */

function ActionVerityHard() {
    renderDifficultyScreen("hard", "Action ou Vérité - HARD");
}

/* ----------------------------- */
/* Ouvre une partie en difficulté Extreme. */
/* ----------------------------- */

function ActionVerityExtreme() {
    renderDifficultyScreen("extreme", "Action ou Vérité - EXTREME");
}