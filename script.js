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

function setAccountIndicator(user) {
    const indicator = document.getElementById("account-indicator");
    if (indicator) {
        indicator.textContent = user ? `Connecté en tant que ${user.username}` : "";
        indicator.hidden = !user;
    }
    setGlobalChatAccount(user);
}

function appendChatMessage(message) {
    const messages = document.getElementById("chat-messages");
    if (!messages || !message) return;

    const item = document.createElement("li");
    item.className = "chat-message";

    const heading = document.createElement("div");
    heading.className = "chat-message-heading";

    const username = document.createElement("strong");
    username.textContent = message.username;
    heading.appendChild(username);

    const time = document.createElement("time");
    const sentAt = new Date(message.sentAt);
    if (!Number.isNaN(sentAt.getTime())) {
        time.dateTime = sentAt.toISOString();
        time.textContent = sentAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    heading.appendChild(time);

    const text = document.createElement("p");
    text.textContent = message.text;
    item.append(heading, text);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}

function setGlobalChatAccount(user) {
    const panel = document.getElementById("global-chat");
    if (!panel) return;

    if (!user) {
        panel.hidden = true;
        if (window.circlePlayChatSocket) {
            window.circlePlayChatSocket.disconnect();
            window.circlePlayChatSocket = null;
        }
        return;
    }

    panel.hidden = false;
    if (window.circlePlayChatSocket || typeof window.io !== "function") return;

    const socket = window.io();
    window.circlePlayChatSocket = socket;
    const status = document.getElementById("chat-status");
    const messages = document.getElementById("chat-messages");
    const presence = document.getElementById("chat-presence");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const toggle = document.getElementById("chat-toggle");

    if (window.matchMedia("(max-width: 768px)").matches) {
        panel.classList.add("is-collapsed");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Ouvrir le chat");
        toggle.textContent = "+";
    }

    toggle.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", collapsed ? "Ouvrir le chat" : "Réduire le chat");
        toggle.textContent = collapsed ? "+" : "−";
    });

    socket.on("connect", () => {
        status.textContent = "Chat en direct.";
        status.classList.remove("chat-error");
    });
    socket.on("connect_error", error => {
        if (error.message === "AUTH_REQUIRED") {
            status.textContent = "Connecte-toi pour accéder au chat.";
            presence.textContent = "Connexion requise";
            socket.disconnect();
            return;
        }
        presence.textContent = "Serveur du chat indisponible";
        status.textContent = "Connexion impossible. Nouvelle tentative en cours...";
    });
    socket.on("disconnect", () => {
        if (panel.isConnected && !panel.hidden && socket.active) {
            presence.textContent = "Reconnexion...";
            status.textContent = "Connexion interrompue. Nouvelle tentative en cours...";
        }
    });
    socket.on("chat:history", history => {
        messages.replaceChildren();
        history.forEach(appendChatMessage);
    });
    socket.on("chat:message", appendChatMessage);
    socket.on("chat:presence", count => {
        presence.textContent = `${count} ${count === 1 ? "personne en ligne" : "personnes en ligne"}`;
    });

    form.addEventListener("submit", event => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message || !socket.connected) {
            status.textContent = socket.connected
                ? "Écris un message avant de l'envoyer."
                : "Le chat est déconnecté, reconnexion en cours...";
            return;
        }

        socket.emit("chat:send", message, result => {
            if (result && result.error) {
                status.textContent = result.error;
                status.classList.add("chat-error");
                return;
            }
            status.textContent = "Chat en direct.";
            status.classList.remove("chat-error");
            input.value = "";
        });
    });
}

async function refreshAccountIndicator() {
    try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Impossible de vérifier la session.");
        const { user } = await response.json();
        setAccountIndicator(user);
    } catch {
        setAccountIndicator(null);
    }
}

function renderSignedInProfile(profileView, username) {
    profileView.innerHTML = `
        <div class="auth-avatar" aria-hidden="true">☺</div>
        <h2>Mon compte</h2>
        <p class="auth-status">Connecté en tant que <strong></strong>.</p>
        <button class="auth-logout" type="button">Se déconnecter</button>
    `;
    profileView.querySelector(".auth-status strong").textContent = username;
    profileView.querySelector(".auth-logout").addEventListener("click", logoutProfile);
    setAccountIndicator({ username });
}

/* ----------------------------- */
/* Connexion et création de compte CirclePlay. */
/* ----------------------------- */

function showProfile(mode = "login") {
    fadeMenuContent(`
        <div class="auth-view" data-profile-view>
            <div class="auth-avatar" aria-hidden="true">☺</div>
            <h2>Mon compte</h2>
            <p class="auth-status" role="status">Vérification de ton compte...</p>
        </div>
        <button class="btn-retour" onclick="showMainMenu()">← Retour</button>
    `, () => loadProfile(mode));
}

async function loadProfile(mode) {
    const menuContent = document.getElementById("menu-content");
    const profileView = menuContent.querySelector("[data-profile-view]");
    if (!profileView) return;

    try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Le serveur ne répond pas correctement.");
        const { user } = await response.json();
        if (!profileView.isConnected) return;

        if (user) {
            renderSignedInProfile(profileView, user.username);
        } else {
            setAccountIndicator(null);
            renderProfileForm(profileView, mode);
        }
    } catch (error) {
        if (profileView.isConnected) {
            profileView.innerHTML = `
                <h2>Mon compte</h2>
                <p class="auth-status auth-error" role="alert">${error.message}</p>
                <button class="auth-retry" type="button">Réessayer</button>
            `;
            profileView.querySelector(".auth-retry").addEventListener("click", () => loadProfile(mode));
        }
    }
}

function renderProfileForm(profileView, mode, message = "") {
    const isRegistering = mode === "register";
    profileView.innerHTML = `
        <div class="auth-avatar" aria-hidden="true">☺</div>
        <h2>${isRegistering ? "Créer un compte" : "Connexion"}</h2>
        <p class="auth-hint">${isRegistering ? "Rejoins CirclePlay pour retrouver ton compte en ligne." : "Ravi de te revoir sur CirclePlay."}</p>
        <form class="auth-form">
            <label for="auth-username">Pseudo</label>
            <input id="auth-username" name="username" type="text" minlength="3" maxlength="20"
                pattern="[A-Za-z0-9_]{3,20}" autocomplete="username" placeholder="Ton pseudo" required>
            <label for="auth-password">Mot de passe</label>
            <input id="auth-password" name="password" type="password" minlength="10"
                autocomplete="${isRegistering ? "new-password" : "current-password"}" placeholder="Ton mot de passe" required>
            <button class="auth-submit" type="submit">${isRegistering ? "Créer mon compte" : "Se connecter"}</button>
        </form>
        <p class="auth-status ${message ? "auth-error" : ""}" role="${message ? "alert" : "status"}">${message}</p>
        <button class="auth-switch" type="button">${isRegistering ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire"}</button>
    `;

    profileView.querySelector(".auth-switch").addEventListener("click", () => {
        renderProfileForm(profileView, isRegistering ? "login" : "register");
    });
    profileView.querySelector(".auth-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = form.querySelector('button[type="submit"]');
        const status = profileView.querySelector(".auth-status");
        const formData = new FormData(form);
        submitButton.disabled = true;
        status.textContent = "Connexion en cours...";
        status.classList.remove("auth-error");

        try {
            const response = await fetch(`/api/auth/${isRegistering ? "register" : "login"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: formData.get("username"),
                    password: formData.get("password")
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "La connexion a échoué.");
            if (!profileView.isConnected) return;
            renderSignedInProfile(profileView, result.user.username);
        } catch (error) {
            if (!profileView.isConnected) return;
            status.textContent = error.message;
            status.classList.add("auth-error");
            submitButton.disabled = false;
        }
    });
}

async function logoutProfile() {
    try {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (!response.ok) throw new Error("La déconnexion a échoué.");
        setAccountIndicator(null);
        showProfile("login");
    } catch (error) {
        const profileView = document.querySelector("[data-profile-view]");
        if (!profileView) return;
        const status = profileView.querySelector(".auth-status");
        status.textContent = error.message;
        status.classList.add("auth-error");
    }
}

refreshAccountIndicator();

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