/* ----------------------------- */
/* Synthèse vocale partagée par les jeux. */
/* ----------------------------- */

let circlePlayVoiceEnabled = true;
let circlePlayCurrentSpeechText = "";

function isCirclePlaySpeechAvailable() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function stopCirclePlaySpeech() {
    if (isCirclePlaySpeechAvailable()) {
        window.speechSynthesis.cancel();
    }
}

function speakCirclePlayText(text = circlePlayCurrentSpeechText) {
    if (typeof text !== "string" || !text.trim()) return;
    circlePlayCurrentSpeechText = text;
    if (!circlePlayVoiceEnabled || !isCirclePlaySpeechAvailable()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.95;

    const frenchVoice = window.speechSynthesis.getVoices()
        .find(voice => voice.lang.toLowerCase().startsWith("fr"));
    if (frenchVoice) utterance.voice = frenchVoice;

    stopCirclePlaySpeech();
    window.speechSynthesis.speak(utterance);
}

function replayCirclePlaySpeech() {
    speakCirclePlayText();
}

function toggleCirclePlayVoice() {
    circlePlayVoiceEnabled = !circlePlayVoiceEnabled;
    const speechAvailable = isCirclePlaySpeechAvailable();

    document.querySelectorAll("[data-voice-toggle]").forEach(button => {
        button.setAttribute("aria-pressed", String(circlePlayVoiceEnabled));
        button.textContent = circlePlayVoiceEnabled ? "🔊 Voix activée" : "🔇 Voix coupée";
    });
    document.querySelectorAll("[data-voice-replay]").forEach(button => {
        button.disabled = !speechAvailable || !circlePlayVoiceEnabled;
    });

    if (circlePlayVoiceEnabled) {
        const replayButton = Array.from(document.querySelectorAll("[data-voice-replay]"))
            .find(button => button.isConnected && button.style.display !== "none");
        if (replayButton) replayCirclePlaySpeech();
    } else {
        stopCirclePlaySpeech();
    }
}

function getVoiceReplayButtonMarkup() {
    const disabled = !isCirclePlaySpeechAvailable() || !circlePlayVoiceEnabled;
    return `<button class="speak-prompt-button" data-voice-replay style="display:none;" onclick="replayCirclePlaySpeech()"${disabled ? " disabled" : ""}>🔊 Réécouter</button>`;
}

function getVoiceControlsFooterMarkup(backLabel, backAction) {
    const label = circlePlayVoiceEnabled ? "🔊 Voix activée" : "🔇 Voix coupée";
    return `
        <div class="voice-controls-footer">
            <button class="btn-retour" onclick="${backAction}">${backLabel}</button>
            <button class="voice-toggle-button" data-voice-toggle type="button" aria-pressed="${circlePlayVoiceEnabled}" onclick="toggleCirclePlayVoice()">${label}</button>
        </div>
    `;
}

/* ----------------------------- */
/* Remplace le contenu du menu avec une courte transition. */
/* ----------------------------- */

function fadeMenuContent(content, onComplete) {
    const menuContent = document.getElementById("menu-content");
    menuContent.style.opacity = "0";
    stopCirclePlaySpeech();

    setTimeout(() => {
        menuContent.innerHTML = content;
        menuContent.style.opacity = "1";
        if (onComplete) onComplete();
    }, 180);
}

/* ----------------------------- */
/* Affiche les entrées principales de l'application. */
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
/* Affiche les modes de jeu disponibles selon l'appareil. */
/* ----------------------------- */

function menuDevice() {
    fadeMenuContent(`
        <h2>Choisissez le nombre d'appareils</h2>
        <button onclick="menuGames()">1 Appareil 💻</button>
        <button onclick="WanMenuGames()">En Ligne 🌐</button>
        <button>Local 👥</button>
        <button class="btn-retour" onclick="showMainMenu()">← Retour</button>
    `);
}


/* ----------------------------- */
/* Affiche la liste des jeux accessibles. */
/* ----------------------------- */

function menuGames() {
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button onclick="ActionVerity()">Action/Vérité ❓</button>
        <button onclick="QuiDeNous()">Qui de nous ? 👥</button>
        <button onclick="TestDePurete()">Test de Pureté ⚖️</button>
        <button class="btn-retour" onclick="menuDevice()">← Retour</button>
    `);
}

/* ----------------------------- */
/* Affiche les jeux proposés en mode en ligne. */
/* ----------------------------- */
function WanMenuGames() {
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button>Action/Vérité ❓</button>
        <button>Qui de nous ? 👥</button>
        <button>Médias Roulette 🎰</button>
        <button class="btn-retour" onclick="menuDevice()">← Retour</button>
    `);
}