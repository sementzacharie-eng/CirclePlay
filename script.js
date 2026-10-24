/* ----------------------------- */
/* Synthèse vocale partagée par les jeux. */
/* ----------------------------- */

let circlePlayVoiceEnabled = true;
let circlePlayCurrentSpeechText = "";
let circlePlayCurrentUser = null;
const circlePlayFriendAccountNames = new Set([
    "zacharie",
    "ilan",
    "allan",
    "nina",
    "nathan",
    "julia"
]);
const circlePlayUsernameColors = [
    { value: "#ff6b6b", name: "Rouge corail" },
    { value: "#ff9f43", name: "Orange" },
    { value: "#feca57", name: "Jaune doré" },
    { value: "#1dd1a1", name: "Turquoise" },
    { value: "#48dbfb", name: "Bleu clair" },
    { value: "#54a0ff", name: "Bleu" },
    { value: "#5f27cd", name: "Violet" },
    { value: "#c56cf0", name: "Lavande" },
    { value: "#ff6bcb", name: "Rose" },
    { value: "#f5c7d7", name: "Rose poudré" }
];

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

const circlePlayGameRules = {
    actionTruth: {
        title: "Action ou Vérité",
        subtitle: "À plusieurs sur un appareil",
        items: [
            ["Préparez la partie", "Entrez les noms de 2 à 6 joueurs. Les noms doivent être différents."],
            ["Choisissez une difficulté", "Sélectionnez Chill, Soft, Hard ou Extreme selon l'ambiance souhaitée."],
            ["Choisissez Action ou Vérité", "Le joueur affiché sélectionne l'un des deux choix et réalise le défi ou répond à la question."],
            ["Passez au tour suivant", "Appuyez sur Suivant pour afficher un nouveau joueur et recommencer."]
        ]
    },
    quiDeNous: {
        title: "Qui de nous ?",
        subtitle: "À plusieurs sur un appareil",
        items: [
            ["Préparez la partie", "Entrez les noms de 2 à 6 joueurs, puis choisissez une difficulté et un nombre de manches."],
            ["Lisez la question", "Chaque manche affiche une question commune au groupe."],
            ["Désignez la personne concernée", "Discutez puis choisissez le joueur qui correspond le mieux à la question."],
            ["Comptez les points", "Validez votre choix : une réponse peut rapporter 2 points ou en retirer 1. Le classement s'affiche à la fin."]
        ]
    },
    quiDeNousOnline: {
        title: "Qui de nous ? en ligne",
        subtitle: "Règles du salon",
        items: [
            ["Créez ou rejoignez un salon", "Le chef choisit la difficulté et le nombre de manches. Les autres joueurs rejoignent avec le code à 6 caractères."],
            ["Lancez la partie", "Le chef peut démarrer dès que deux joueurs sont présents."],
            ["Répondez chacun de votre côté", "À chaque question, chaque joueur vote pour la personne qui correspond le mieux. Les votes restent cachés."],
            ["Découvrez le résultat", "Quand tout le monde a voté, les joueurs en tête reçoivent les points de la question. En cas d'égalité, chacun reçoit les points."],
            ["Continuez jusqu'au classement", "Le chef lance la manche suivante après chaque résultat."]
        ]
    },
    purity: {
        title: "Test de pureté",
        subtitle: "Questions personnelles, à une personne",
        items: [
            ["Choisissez une difficulté", "Sélectionnez Classique, Hard ou Special Sex."],
            ["Préparez le profil", "Choisissez le genre demandé par le jeu et saisissez le nom de la personne qui répond."],
            ["Répondez aux questions", "Répondez Oui ou Non à chaque question. Les réponses Oui ajoutent les points indiqués à leur catégorie."],
            ["Consultez le résultat", "À la fin, le jeu affiche un pourcentage pour chacune des cinq catégories et un score global."]
        ]
    },
    undercover: {
        title: "Undercover en ligne",
        subtitle: "Le déroulement d'une manche",
        items: [
            ["Découvrez votre mot — 20 secondes", "Chaque joueur voit son mot secret. Gardez-le pour vous : ne le montrez pas et ne le prononcez pas."],
            ["Décrivez votre mot — 15 secondes chacun", "Suivez l'ordre des joueurs affiché à l'écran. Donnez un indice qui montre que vous connaissez le mot, sans le révéler directement."],
            ["Repérez l'Undercover", "L'Undercover reçoit un mot différent, mais lié au même thème. Il doit écouter les autres et improviser pour ne pas se faire repérer."],
            ["Votez après le tour de table", "Choisissez le joueur que vous soupçonnez. Les choix restent secrets jusqu'à la fin du vote. L'Undercover ne vote pas."],
            ["Découvrez le résultat et marquez des points", "Si l'Undercover reçoit seul le plus de votes, chaque autre joueur gagne 1 point. Sinon, égalité comprise, l'Undercover gagne 1 point."],
            ["Nouvelle manche", "Le chef du salon lance la manche suivante : les mots et le rôle d'Undercover sont redistribués."]
        ]
    }
};

let gameRulesCollapsed = window.matchMedia("(max-width: 768px)").matches;

function setGameRulesCollapsed(collapsed) {
    const panel = document.getElementById("game-rules-panel");
    const toggle = document.getElementById("game-rules-toggle");
    if (!panel || !toggle) return;

    panel.classList.toggle("is-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Afficher les règles" : "Réduire les règles");
    toggle.textContent = collapsed ? "+" : "−";
}

function showGameRules(gameKey) {
    const rules = circlePlayGameRules[gameKey];
    const panel = document.getElementById("game-rules-panel");
    if (!rules || !panel) return;

    document.getElementById("game-rules-title").textContent = `Règles : ${rules.title}`;
    document.getElementById("game-rules-subtitle").textContent = rules.subtitle;
    document.getElementById("game-rules-body").innerHTML = `
        <ol>${rules.items.map(([heading, explanation]) => `
            <li><strong>${heading}</strong><span>${explanation}</span></li>
        `).join("")}</ol>
    `;
    panel.setAttribute("aria-label", `Règles du jeu ${rules.title}`);
    panel.hidden = false;
    gameRulesCollapsed = window.matchMedia("(max-width: 768px)").matches || gameRulesCollapsed;
    setGameRulesCollapsed(gameRulesCollapsed);
}

function hideGameRules() {
    const panel = document.getElementById("game-rules-panel");
    if (panel) panel.hidden = true;
}

document.getElementById("game-rules-toggle")?.addEventListener("click", () => {
    gameRulesCollapsed = !document.getElementById("game-rules-panel")?.classList.contains("is-collapsed");
    setGameRulesCollapsed(gameRulesCollapsed);
});

/* ----------------------------- */
/* Affiche les entrées principales de l'application. */
/* ----------------------------- */

function showMainMenu() {
    hideGameRules();
    const chatPanel = document.getElementById("global-chat");
    if (chatPanel && circlePlayCurrentUser) chatPanel.hidden = false;
    fadeMenuContent(`
        <h2>Menu Principal</h2>
        <button onclick="menuDevice()">Jeux 🎮</button>
        <button onclick="showProfile()">Profil ⚙️</button>
        ${circlePlayCurrentUser?.isAdmin ? '<button onclick="showAdminDashboard()">Administration 🛡️</button>' : ""}
        <button onclick="showCredits()">Crédits 👑</button>
    `);
}

function showAdminDashboard() {
    if (!circlePlayCurrentUser?.isAdmin) {
        showMainMenu();
        return;
    }
    if (window.matchMedia("(max-width: 768px)").matches) {
        const chatPanel = document.getElementById("global-chat");
        const chatToggle = document.getElementById("chat-toggle");
        if (chatPanel && chatToggle) {
            chatPanel.hidden = true;
            chatPanel.classList.add("is-collapsed");
            chatToggle.setAttribute("aria-expanded", "false");
            chatToggle.setAttribute("aria-label", "Ouvrir le chat");
            chatToggle.textContent = "+";
        }
    }
    hideGameRules();
    fadeMenuContent(`
        <section class="admin-dashboard" aria-labelledby="admin-dashboard-title">
            <h2 id="admin-dashboard-title">Administration</h2>
            <p class="admin-dashboard-note">Comptes connectés et comptes amis. Les mots de passe ne sont jamais affichés.</p>
            <p class="admin-dashboard-status" role="status" aria-live="polite">Chargement des comptes…</p>
            <section class="admin-account-section">
                <h3>En ligne <span data-admin-online-count>0</span></h3>
                <ul class="admin-account-list" data-admin-connected-list></ul>
            </section>
            <section class="admin-account-section">
                <h3>Comptes amis</h3>
                <ul class="admin-account-list admin-friend-list" data-admin-friend-list></ul>
            </section>
            <div class="admin-dashboard-actions">
                <button type="button" data-admin-refresh>Actualiser</button>
                <button class="btn-retour" type="button" data-admin-back>← Menu</button>
            </div>
        </section>
    `, () => {
        document.querySelector("[data-admin-back]")?.addEventListener("click", showMainMenu);
        document.querySelector("[data-admin-refresh]")?.addEventListener("click", refreshAdminDashboard);
        refreshAdminDashboard();
    });
}

async function refreshAdminDashboard() {
    const dashboard = document.querySelector(".admin-dashboard");
    if (!dashboard || !circlePlayCurrentUser?.isAdmin) return;
    const status = dashboard.querySelector(".admin-dashboard-status");
    status.textContent = "Chargement des comptes…";
    status.classList.remove("is-error");

    try {
        const response = await fetch("/api/admin/accounts");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Impossible de charger les comptes.");
        if (!dashboard.isConnected) return;

        const connectedList = dashboard.querySelector("[data-admin-connected-list]");
        const friendList = dashboard.querySelector("[data-admin-friend-list]");
        const onlineCount = dashboard.querySelector("[data-admin-online-count]");
        connectedList.replaceChildren();
        friendList.replaceChildren();
        onlineCount.textContent = String(result.connectedAccounts.length);
        status.textContent = result.connectedAccounts.length
            ? "Comptes connectés à CirclePlay."
            : "Aucun compte connecté.";

        const appendAccount = (list, account, isOnline) => {
            const item = document.createElement("li");
            item.className = "admin-account-card";
            const name = document.createElement("strong");
            name.textContent = account.username;
            if (/^#[0-9a-f]{6}$/i.test(account.usernameColor || "")) {
                name.style.color = account.usernameColor;
            }
            const state = document.createElement("span");
            state.className = isOnline ? "admin-account-state is-online" : "admin-account-state";
            state.textContent = isOnline ? "En ligne" : "Hors ligne";
            item.append(name, state);
            if (isOnline) {
                const disconnect = document.createElement("button");
                disconnect.className = "admin-disconnect-button";
                disconnect.type = "button";
                disconnect.textContent = "Déconnecter";
                disconnect.setAttribute("aria-label", `Déconnecter ${account.username}`);
                disconnect.addEventListener("click", async () => {
                    if (!window.confirm(`Déconnecter ${account.username} ?`)) return;
                    disconnect.disabled = true;
                    try {
                        const kickResponse = await fetch(
                            `/api/admin/accounts/${account.id}/disconnect`,
                            { method: "POST" }
                        );
                        const kickResult = await kickResponse.json();
                        if (!kickResponse.ok) {
                            throw new Error(kickResult.error || "La déconnexion a échoué.");
                        }
                        status.textContent = `${account.username} a été déconnecté.`;
                        await refreshAdminDashboard();
                    } catch (error) {
                        status.textContent = error.message;
                        status.classList.add("is-error");
                        disconnect.disabled = false;
                    }
                });
                item.appendChild(disconnect);
            }
            list.appendChild(item);
        };

        result.connectedAccounts.forEach(account => appendAccount(connectedList, account, true));
        result.friendAccounts.forEach(account => appendAccount(friendList, account, account.isOnline));
        if (result.connectedAccounts.length === 0) {
            const empty = document.createElement("li");
            empty.className = "admin-account-empty";
            empty.textContent = "Personne n’est connecté pour le moment.";
            connectedList.appendChild(empty);
        }
    } catch (error) {
        if (!dashboard.isConnected) return;
        status.textContent = error.message;
        status.classList.add("is-error");
    }
}

function setAccountIndicator(user) {
    circlePlayCurrentUser = user;
    const indicator = document.getElementById("account-indicator");
    if (indicator) {
        indicator.replaceChildren();
        const isFriendAccount = user &&
            circlePlayFriendAccountNames.has(user.username.toLocaleLowerCase("fr"));
        indicator.classList.toggle("is-friend-account", Boolean(isFriendAccount));
        if (user) {
            if (isFriendAccount) {
                const label = document.createElement("span");
                label.className = "friend-account-label";
                label.textContent = "Compte d’ami";
                const username = document.createElement("strong");
                username.className = "friend-account-name";
                username.textContent = user.username;
                indicator.append(label, username);
            } else {
                indicator.append("Connecté en tant que ");
                const username = document.createElement("strong");
                username.textContent = user.username;
                if (/^#[0-9a-f]{6}$/i.test(user.usernameColor || "")) {
                    username.style.color = user.usernameColor;
                }
                indicator.appendChild(username);
            }
        }
        indicator.hidden = !user;
    }
    setGlobalChatAccount(user);
    if (document.querySelector("#menu-content > h2")?.textContent === "Menu Principal") {
        showMainMenu();
    }
    if (user) restoreCirclePlayActiveRoom();
}

const circlePlayActiveRoomStorageKeyPrefix = "circleplay:active-room:";

function getCirclePlayActiveRoom() {
    if (!circlePlayCurrentUser) return null;

    const storageKey = `${circlePlayActiveRoomStorageKeyPrefix}${circlePlayCurrentUser.id}`;
    try {
        const savedRoom = localStorage.getItem(storageKey);
        if (!savedRoom) return null;
        const room = JSON.parse(savedRoom);
        if (!room || !["qdn-online", "undercover-online"].includes(room.game) ||
            !/^[A-HJ-NP-Z2-9]{6}$/.test(room.code)) {
            throw new Error("Les informations du salon sauvegardées sont invalides.");
        }
        return room;
    } catch (error) {
        console.error("Impossible de lire le salon sauvegardé.", error);
        try {
            localStorage.removeItem(storageKey);
        } catch (storageError) {
            console.error("Impossible d'effacer le salon sauvegardé invalide.", storageError);
        }
        return null;
    }
}

function saveCirclePlayActiveRoom(game, code) {
    if (!circlePlayCurrentUser || !["qdn-online", "undercover-online"].includes(game) ||
        !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return;

    try {
        localStorage.setItem(
            `${circlePlayActiveRoomStorageKeyPrefix}${circlePlayCurrentUser.id}`,
            JSON.stringify({ game, code })
        );
    } catch (error) {
        console.error("Impossible de sauvegarder le salon en cours.", error);
    }
}

function clearCirclePlayActiveRoom(game, code) {
    if (!circlePlayCurrentUser) return;
    const storageKey = `${circlePlayActiveRoomStorageKeyPrefix}${circlePlayCurrentUser.id}`;
    const savedRoom = getCirclePlayActiveRoom();
    if (!savedRoom || savedRoom.game !== game || (code && savedRoom.code !== code)) return;

    try {
        localStorage.removeItem(storageKey);
    } catch (error) {
        console.error("Impossible d'effacer le salon sauvegardé.", error);
    }
}

function restoreCirclePlayActiveRoom() {
    const savedRoom = getCirclePlayActiveRoom();
    if (!savedRoom) return;

    if (savedRoom.game === "qdn-online") {
        restoreQdnOnlineRoom(savedRoom.code);
    } else if (savedRoom.game === "undercover-online") {
        restoreUndercoverRoom(savedRoom.code);
    }
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
    if (/^#[0-9a-f]{6}$/i.test(message.usernameColor || "")) {
        username.style.color = message.usernameColor;
    }
    if (Number.isInteger(message.userId)) item.dataset.userId = String(message.userId);
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

    socket.on("account:disconnected-by-admin", acknowledge => {
        if (typeof acknowledge === "function") acknowledge();
        setAccountIndicator(null);
        window.alert("Un administrateur a fermé cette session.");
        showProfile("login");
    });
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
    socket.on("chat:profile", profile => {
        if (!profile || !Number.isInteger(profile.userId) ||
            !/^#[0-9a-f]{6}$/i.test(profile.usernameColor || "")) return;
        document.querySelectorAll(`.chat-message[data-user-id="${profile.userId}"] strong`)
            .forEach(username => { username.style.color = profile.usernameColor; });
    });
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

function renderSignedInProfile(profileView, user) {
    const selectedUsernameColor = circlePlayUsernameColors.some(color => color.value === user.usernameColor)
        ? user.usernameColor
        : circlePlayUsernameColors[0].value;
    profileView.innerHTML = `
        <div class="auth-avatar" aria-hidden="true">☺</div>
        <h2>Mon compte</h2>
        <p class="auth-status">Connecté en tant que <strong></strong>.</p>
        <form class="auth-color-form">
            <label for="profile-username-color">Couleur de mon pseudo</label>
            <div class="auth-color-control">
            <input id="profile-username-color" name="usernameColor" type="hidden" value="${selectedUsernameColor}">
            <details class="auth-color-dropdown">
                <summary aria-label="Choisir une couleur de pseudo">
                    <span class="auth-color-swatch" style="background-color: ${selectedUsernameColor};"></span>
                    <span class="auth-color-chevron" aria-hidden="true">▾</span>
                </summary>
                <div class="auth-color-options">
                ${circlePlayUsernameColors.map(color => `
                    <button class="auth-color-option" type="button" data-username-color="${color.value}"
                        aria-label="${color.name}" title="${color.name}">
                        <span style="background-color: ${color.value};"></span>
                    </button>
                `).join("")}
                </div>
            </details>
            <button class="auth-color-submit" type="submit">Enregistrer la couleur</button>
        </div>
            <p class="auth-color-status" role="status" aria-live="polite"></p>
        </form>
        <button class="auth-logout" type="button">Se déconnecter</button>
    `;
    profileView.querySelector(".auth-status strong").textContent = user.username;
    const profileUsername = profileView.querySelector(".auth-status strong");
    profileUsername.style.color = user.usernameColor;
    profileView.querySelector(".auth-color-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const colorInput = form.elements.usernameColor;
        const submitButton = form.querySelector('button[type="submit"]');
        const status = form.querySelector(".auth-color-status");
        submitButton.disabled = true;
        status.textContent = "Enregistrement...";
        status.classList.remove("auth-error");
        try {
            const response = await fetch("/api/profile/color", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ color: colorInput.value })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "La couleur n'a pas pu être enregistrée.");
            setAccountIndicator(result.user);
            profileUsername.style.color = result.user.usernameColor;
            status.textContent = "Couleur enregistrée.";
        } catch (error) {
            status.textContent = error.message;
            status.classList.add("auth-error");
        } finally {
            submitButton.disabled = false;
        }
    });
    const colorForm = profileView.querySelector(".auth-color-form");
    const colorInput = colorForm.elements.usernameColor;
    const colorDropdown = colorForm.querySelector(".auth-color-dropdown");
    const colorSwatch = colorDropdown.querySelector(".auth-color-swatch");
    colorForm.querySelectorAll("[data-username-color]").forEach(option => {
        option.addEventListener("click", () => {
            colorInput.value = option.dataset.usernameColor;
            colorSwatch.style.backgroundColor = colorInput.value;
            colorDropdown.open = false;
            profileUsername.style.color = colorInput.value;
            setAccountIndicator({ ...circlePlayCurrentUser, usernameColor: colorInput.value });
        });
    });
    profileView.querySelector(".auth-logout").addEventListener("click", logoutProfile);
    setAccountIndicator(user);
}

/* ----------------------------- */
/* Connexion et création de compte CirclePlay. */
/* ----------------------------- */

function showProfile(mode = "login") {
    hideGameRules();
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
            renderSignedInProfile(profileView, user);
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
            <input id="auth-password" name="password" type="password"${isRegistering ? ' minlength="5"' : ""}
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
            renderSignedInProfile(profileView, result.user);
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
    hideGameRules();
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
    hideGameRules();
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button onclick="ActionVerity()">Action ou Vérité 🎲</button>
        <button onclick="QuiDeNous()">Qui de nous ? 👥</button>
        <button onclick="TestDePurete()">Test de Pureté ⚖️</button>
        <button class="btn-retour" onclick="menuDevice()">← Retour</button>
    `);
}

/* ----------------------------- */
/* Affiche les jeux proposés en mode en ligne. */
/* ----------------------------- */
function WanMenuGames() {
    hideGameRules();
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button onclick="UndercoverEnLigne()">Undercover 🕵️</button>
        <button onclick="QuiDeNousEnLigne()">Qui de nous ? 👥</button>
        <button>Médias Roulette 🎰</button>
        <button class="btn-retour" onclick="menuDevice()">← Retour</button>
    `);
}