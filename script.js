let champ1 = "";
let champ2 = "";
let champ3 = "";
let champ4 = "";
let champ5 = "";
let champ6 = "";

/* ----------------------------- */
/* FADE IN/OUT DU CONTENU DU MENU */
/* ----------------------------- */

function fadeMenuContent(content) {
    const menuContent = document.getElementById("menu-content");
    menuContent.style.opacity = "0";

    setTimeout(() => {
        menuContent.innerHTML = content;
        menuContent.style.opacity = "1";
    }, 180);
}

/* ----------------------------- */
/* MENU PRINCIPAL */
/* ----------------------------- */

function showMainMenu() {
    fadeMenuContent(`
        <h2>Menu Principal</h2>
        <button onclick="menuDevice()">Jeux 🎮</button>
        <button onclick="showProfile()">Profil ⚙️</button>
        <button onclick="showCredits()">Crédits 👑</button>
    `);
}

/* ----------------------------- */
/* MENU DES APPAREILS */
/* ----------------------------- */

function menuDevice() {
    fadeMenuContent(`
        <h2>Choisissez le nombre d'appareils</h2>
        <button onclick="menuGames()">1 Appareil 💻</button>
        <button>En Ligne 🌐</button>
        <button>Local 👥</button>
        <button class="btn-retour" onclick="showMainMenu()">← Retour</button>
    `);
}


/* ----------------------------- */
/* MENU DES JEUX */
/* ----------------------------- */

function menuGames() {
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button onclick="ActionVerity()">Action/Vérité ❓</button>
        <button>Qui de nous ? 👥</button>
        <button>Test de Pureté ⚖️</button>
        <button class="btn-retour" onclick="menuDevice()">← Retour</button>
    `);
}

/* ----------------------------- */
/* PAGE ACTION / VÉRITÉ */
/* ----------------------------- */

function ActionVerity() {
    fadeMenuContent(`
        <h2>Action ou Vérité</h2>
        <button class="suivant-button" id="suivant-btn" onclick="goToDifficultyIfReady()">Suivant</button>
        <div id="input-list">
            <div class="input-row">
                <input type="text" placeholder="Nom du joueur" id="input-1" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>
            </div>

            <div class="input-row">
                <input type="text" placeholder="Nom du joueur" id="input-2" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>
            </div>
        </div>
        <button class="add-input" onclick="addInput()">+</button>
        
        <button class="btn-retour" onclick="menuGames()">← Retour</button>
    `);
    updateStoredTexts();
    setTimeout(checkInputsForNext, 250);
}

/* ----------------------------- */
/* AJOUT D'UN CHAMP DU ACTION/VÉRITÉ */
/* ----------------------------- */

function addInput() {
    const inputList = document.getElementById("input-list");

    if (inputList && inputList.children.length >= 6) {
        return;
    }

    const count = inputList.children.length + 1;
    const row = document.createElement("div");
    row.className = "input-row";
    row.innerHTML = `<input type="text" placeholder="Nom du joueur" id="input-${count}" data-edited="false" oninput="updateStoredTexts(); markInputAsEdited(this); checkInputsForNext()"><button class="delete-input" onclick="removeInput(this)">×</button>`;
    inputList.appendChild(row);
    updateStoredTexts();
    checkInputsForNext();
}

/* ----------------------------- */
/* SUPPRESSION D'UN CHAMP DU ACTION/VÉRITÉ */
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
/* STOCKAGE DES NOMS DU ACTION/VÉRITÉ */
/* ----------------------------- */

function updateStoredTexts() {
    champ1 = document.getElementById("input-1")?.value || "";
    champ2 = document.getElementById("input-2")?.value || "";
    champ3 = document.getElementById("input-3")?.value || "";
    champ4 = document.getElementById("input-4")?.value || "";
    champ5 = document.getElementById("input-5")?.value || "";
    champ6 = document.getElementById("input-6")?.value || "";
}

function markInputAsEdited(input) {
    input.dataset.edited = "true";
}

/* ----------------------------- */
/* VÉRIFICATION DES CHAMPS */
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

function goToDifficultyIfReady() {
    if (document.getElementById("suivant-btn")?.disabled) {
        return;
    }
    ActionVerityDiff();
}

/* ----------------------------- */
/* SELECTION DE LA DIFFICULTÉ DU ACTION/VÉRITÉ */
/* ----------------------------- */

function ActionVerityDiff() {
    fadeMenuContent(`
        <h2>Choisissez la difficulté</h2>
        <div id="difficulty-buttons">
            <button class="btn1" onclick="ActionVerityChill()">CHILL 😆</button>
            <button class="btn2" onclick="ActionVeritySoft()">SOFT 😎</button>
            <button class="btn3" onclick="ActionVerityHard()">HARD 😈</button>
            <button class="btn4" onclick="ActionVerityExtreme()">EXTREME 🔞</button>
        </div>
        <button class="btn-retour" onclick="ActionVerity()">← Retour</button>
    `);
}

/* ----------------------------- */
/* JEU ACTION/VÉRITÉ */
/* ----------------------------- */

function getDifficultyPrompt(mode, type) {
    const storage = window[`${mode}ActionVeriteData`];
    if (!storage || !storage[type] || !storage[type].length) return "";
    return storage[type][Math.floor(Math.random() * storage[type].length)];
}

function renderDifficultyScreen(mode, title) {
    fadeMenuContent(`
        <h2>${title}</h2>
        <p id="player-turn">${getRandomPlayerName()}</p>
        <div id="ActionTruthButtons">
            <button class="btnAction" onclick="showDifficultyPrompt('${mode}', 'action')">ACTION</button>
            <button class="btntruth" onclick="showDifficultyPrompt('${mode}', 'truth')">VÉRITÉ</button>
        </div>
        <button id="next-${mode}-btn" style="display:none;" onclick="showDifficultyChoices('${mode}')">Suivant</button>
        <p id="chill-prompt">Choisis une option</p>
        <button class="btn-retour" onclick="ActionVerityDiff()">← Retour</button>
    `);
}

function getRandomPlayerName() {
    const names = [champ1, champ2, champ3, champ4, champ5, champ6].filter(Boolean);
    if (!names.length) return "Joueur";
    return names[Math.floor(Math.random() * names.length)];
}

function showDifficultyPrompt(mode, type) {
    const promptElement = document.getElementById("chill-prompt");
    const actionButton = document.querySelector(".btnAction");
    const truthButton = document.querySelector(".btntruth");
    const nextButton = document.getElementById(`next-${mode}-btn`);

    if (promptElement) {
        promptElement.textContent = getDifficultyPrompt(mode, type);
    }

    if (actionButton) actionButton.style.display = "none";
    if (truthButton) truthButton.style.display = "none";
    if (nextButton) nextButton.style.display = "block";
}

function showDifficultyChoices(mode) {
    const actionButton = document.querySelector(".btnAction");
    const truthButton = document.querySelector(".btntruth");
    const nextButton = document.getElementById(`next-${mode}-btn`);
    const playerElement = document.getElementById("player-turn");
    const promptElement = document.getElementById("chill-prompt");

    if (playerElement) {
        playerElement.textContent = getRandomPlayerName();
    }

    if (promptElement) {
        promptElement.textContent = "Choisis une option";
    }

    if (actionButton) actionButton.style.display = "inline-flex";
    if (truthButton) truthButton.style.display = "inline-flex";
    if (nextButton) nextButton.style.display = "none";
}

function showChillPrompt(type) {
    showDifficultyPrompt("chill", type);
}

function showChillChoices() {
    showDifficultyChoices("chill");
}

/* ----------------------------- */
/* JEU ACTION/VÉRITÉ CHILL*/
/* ----------------------------- */

function ActionVerityChill() {
    renderDifficultyScreen("chill", "Action ou Vérité - CHILL");
}

/* ----------------------------- */
/* JEU ACTION/VÉRITÉ SOFT*/
/* ----------------------------- */

function ActionVeritySoft() {
    renderDifficultyScreen("soft", "Action ou Vérité - SOFT");
}

/* ----------------------------- */
/* JEU ACTION/VÉRITÉ HARD*/
/* ----------------------------- */

function ActionVerityHard() {
    renderDifficultyScreen("hard", "Action ou Vérité - HARD");
}

/* ----------------------------- */
/* JEU ACTION/VÉRITÉ EXTREME*/
/* ----------------------------- */

function ActionVerityExtreme() {
    renderDifficultyScreen("extreme", "Action ou Vérité - EXTREME");
}