let undercoverSocket = null;
let undercoverRoomState = null;
let undercoverNotice = "";
let undercoverCategoriesList = [];
let undercoverCategory = "";
let undercoverRounds = 10;
let undercoverSelectedVoteId = null;
let undercoverSelectionRound = null;
let undercoverClock = null;

function escapeUndercoverHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function stopUndercoverClock() {
    if (undercoverClock) clearInterval(undercoverClock);
    undercoverClock = null;
}

function getUndercoverSocket() {
    if (!circlePlayCurrentUser) {
        throw new Error("Connecte-toi à ton compte pour jouer en ligne.");
    }
    const socket = window.circlePlayChatSocket;
    if (!socket) {
        throw new Error("La connexion au serveur n'est pas disponible. Réessaie dans un instant.");
    }
    if (undercoverSocket !== socket) {
        undercoverSocket = socket;
        socket.on("undercover:state", state => {
            if (state.status !== "voting" || undercoverSelectionRound !== state.round) {
                undercoverSelectedVoteId = null;
            }
            undercoverSelectionRound = state.status === "voting" ? state.round : null;
            undercoverRoomState = state;
            undercoverNotice = state.notice || "";
            renderUndercoverRoom(state);
        });
        socket.on("disconnect", () => {
            if (!undercoverRoomState) return;
            undercoverRoomState = null;
            undercoverSelectedVoteId = null;
            undercoverSelectionRound = null;
            undercoverNotice = "Connexion interrompue : tu as quitté le salon. Reconnecte-toi pour en rejoindre un autre.";
            if (document.querySelector(".undercover-online-view")) {
                renderUndercoverHome(undercoverNotice);
            }
        });
        socket.on("undercover:kicked", () => {
            undercoverRoomState = null;
            undercoverSelectedVoteId = null;
            undercoverSelectionRound = null;
            undercoverNotice = "Le chef du salon t'a expulsé.";
            window.alert("Tu as été expulsé du salon par le chef.");
            renderUndercoverHome(undercoverNotice);
        });
    }
    if (!socket.connected) {
        throw new Error("Connexion au serveur en cours. Réessaie dans un instant.");
    }
    return socket;
}

function requestUndercover(eventName, payload = null) {
    const socket = getUndercoverSocket();
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error("Le serveur ne répond pas. Réessaie."));
        }, 8000);
        socket.emit(eventName, payload, result => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (!result || result.error) {
                reject(new Error(result?.error || "La demande a échoué."));
            } else {
                resolve(result);
            }
        });
    });
}

function renderUndercover(content) {
    const menuContent = document.getElementById("menu-content");
    if (!menuContent) return;
    stopUndercoverClock();
    stopCirclePlaySpeech();
    menuContent.innerHTML = content;
    menuContent.style.opacity = "1";
}

async function UndercoverEnLigne() {
    undercoverRoomState = null;
    undercoverNotice = "";
    undercoverSelectedVoteId = null;
    undercoverSelectionRound = null;
    if (!circlePlayCurrentUser) {
        renderUndercoverHome();
        return;
    }

    try {
        const response = await fetch("/api/undercover/categories");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Impossible de charger les catégories.");
        if (!Array.isArray(result.categories) || result.categories.length === 0) {
            throw new Error("Aucune catégorie de mots n'est configurée sur le serveur.");
        }
        undercoverCategoriesList = result.categories;
        if (!undercoverCategoriesList.includes(undercoverCategory)) {
            undercoverCategory = undercoverCategoriesList[0];
        }
        renderUndercoverHome();
    } catch (error) {
        renderUndercoverHome(error.message);
    }
}

function renderUndercoverHome(message = undercoverNotice) {
    if (!circlePlayCurrentUser) {
        renderUndercover(`
            <section class="qdn-online-view undercover-online-view">
                <h2>Undercover en ligne</h2>
                <p class="qdn-online-status" role="status">Connecte-toi pour créer ou rejoindre un salon.</p>
                <button type="button" data-undercover-login>Se connecter</button>
                <button class="btn-retour" type="button" data-undercover-back>← Retour</button>
            </section>
        `);
        document.querySelector("[data-undercover-login]")?.addEventListener("click", () => showProfile("login"));
        document.querySelector("[data-undercover-back]")?.addEventListener("click", WanMenuGames);
        return;
    }

    if (undercoverCategoriesList.length === 0) {
        renderUndercover(`
            <section class="qdn-online-view undercover-online-view">
                <h2>Undercover en ligne</h2>
                <p class="qdn-online-status is-error" role="alert">${escapeUndercoverHtml(message || "Les catégories ne sont pas disponibles.")}</p>
                <button type="button" data-undercover-retry>Réessayer</button>
                <button class="btn-retour" type="button" data-undercover-back>← Retour</button>
            </section>
        `);
        document.querySelector("[data-undercover-retry]")?.addEventListener("click", UndercoverEnLigne);
        document.querySelector("[data-undercover-back]")?.addEventListener("click", WanMenuGames);
        return;
    }

    renderUndercover(`
        <section class="qdn-online-view undercover-online-view">
            <h2>Undercover en ligne</h2>
            <p class="qdn-online-intro">Trouve l'undercover avant la fin du vote ! Chaque manche dure au maximum 3 minutes.</p>
            <form class="qdn-online-create undercover-create">
                <h3>Créer un salon</h3>
                <label for="undercover-category">Catégorie</label>
                <select id="undercover-category" name="category">
                    ${undercoverCategoriesList.map(category =>
                        `<option value="${escapeUndercoverHtml(category)}"${undercoverCategory === category ? " selected" : ""}>${escapeUndercoverHtml(category)}</option>`
                    ).join("")}
                </select>
                <label for="undercover-rounds">Nombre de manches</label>
                <select id="undercover-rounds" name="rounds">
                    ${[10, 20, 30, 40, 50].map(rounds =>
                        `<option value="${rounds}"${undercoverRounds === rounds ? " selected" : ""}>${rounds} manches</option>`
                    ).join("")}
                </select>
                <button type="submit">Créer le salon</button>
            </form>
            <form class="qdn-online-join undercover-join">
                <h3>Rejoindre un salon</h3>
                <label for="undercover-code">Code du salon</label>
                <input id="undercover-code" name="code" type="text" maxlength="6"
                    pattern="[A-HJ-NP-Z2-9]{6}" autocomplete="off" placeholder="Ex. ABC123" required>
                <button type="submit">Rejoindre</button>
            </form>
            <p class="qdn-online-status${message ? " is-error" : ""}" role="${message ? "alert" : "status"}">${escapeUndercoverHtml(message)}</p>
            <button class="btn-retour" type="button" data-undercover-back>← Retour</button>
        </section>
    `);

    const createForm = document.querySelector(".undercover-create");
    createForm.addEventListener("submit", async event => {
        event.preventDefault();
        undercoverCategory = createForm.elements.category.value;
        undercoverRounds = Number(createForm.elements.rounds.value);
        try {
            await requestUndercover("undercover:create", {
                category: undercoverCategory,
                rounds: undercoverRounds
            });
        } catch (error) {
            renderUndercoverHome(error.message);
        }
    });
    document.querySelector(".undercover-join").addEventListener("submit", async event => {
        event.preventDefault();
        const code = event.currentTarget.elements.code.value.trim().toUpperCase();
        try {
            await requestUndercover("undercover:join", code);
        } catch (error) {
            renderUndercoverHome(error.message);
        }
    });
    document.querySelector("[data-undercover-back]").addEventListener("click", WanMenuGames);
}

function renderUndercoverRoom(state) {
    if (!state) return;
    const currentUserId = circlePlayCurrentUser?.id;
    const isHost = state.hostId === currentUserId;
    const roomPlayerName = player => {
        const color = /^#[0-9a-f]{6}$/i.test(player.usernameColor || "")
            ? player.usernameColor
            : "#ffffff";
        return `<span style="color: ${color};">${escapeUndercoverHtml(player.username)}${player.id === state.hostId ? " <em>Chef</em>" : ""}</span>`;
    };
    const roomPlayerList = state.players.map(player => `
        <li>
            ${roomPlayerName(player)}
            <strong>${player.score} pts</strong>
            ${isHost && player.id !== currentUserId
                ? `<button type="button" data-undercover-kick="${player.id}">Expulser</button>`
                : '<span class="qdn-online-kick-placeholder" aria-hidden="true"></span>'}
        </li>
    `).join("");
    let body = "";

    if (state.status === "lobby") {
        body = `
            <p class="qdn-online-round">${escapeUndercoverHtml(state.category)} · ${state.rounds} manches</p>
            <p class="qdn-online-code-label">Code du salon</p>
            <button class="qdn-online-code" type="button" data-undercover-copy>${escapeUndercoverHtml(state.code)}</button>
            <div class="qdn-online-lobby-info">
                <span class="qdn-online-player-count" aria-label="${state.players.length} joueurs sur 12">
                    <strong>${state.players.length}</strong><span class="qdn-online-player-count-total">/12</span>
                    <span class="qdn-online-player-count-label">joueurs · 3 minimum</span>
                </span>
            </div>
            ${isHost ? `<button type="button" data-undercover-start${state.players.length < 3 ? " disabled" : ""}>Commencer la partie</button>` : ""}
        `;
    } else if (state.status === "voting") {
        const voteButtons = state.players.map(player => `
            <button class="qdn-online-player" type="button" data-undercover-vote="${player.id}"
                aria-pressed="${undercoverSelectedVoteId === player.id}"
                ${state.hasVoted || state.isUndercover || player.id === currentUserId ? " disabled" : ""}>
                ${roomPlayerName(player)}
            </button>
        `).join("");
        body = `
            <p class="qdn-online-round">Manche ${state.round} / ${state.rounds} · ${escapeUndercoverHtml(state.category)}</p>
            <div class="undercover-word-card">
                <span>${state.isUndercover ? "Ton mot secret" : "Ton mot"}</span>
                <strong>${escapeUndercoverHtml(state.word)}</strong>
                <small>${state.isUndercover ? "Tu es l'undercover : tu ne peux pas voter." : "Décris ton mot sans le révéler."}</small>
            </div>
            <p class="undercover-timer" data-undercover-timer data-ends-at="${state.endsAt}">${Math.floor(state.remainingSeconds / 60)}:${String(state.remainingSeconds % 60).padStart(2, "0")}</p>
            <p class="qdn-online-hint">${state.isUndercover
                ? "Observe les autres et essaie de rester discret."
                : state.hasVoted
                    ? "Ton vote est enregistré. Attends les autres joueurs ou la fin du chrono."
                    : "Choisis la personne que tu penses être l'undercover."
            }</p>
            ${state.isUndercover ? "" : `<div class="qdn-online-vote-grid">${voteButtons}</div>`}
            ${state.isUndercover || state.hasVoted ? "" : `<button type="button" data-undercover-confirm${undercoverSelectedVoteId === null ? " disabled" : ""}>Confirmer mon vote</button>`}
            <p class="qdn-online-votes" aria-live="polite">${state.votesSubmitted} / ${state.eligibleVoters} votes reçus</p>
        `;
    } else if (state.status === "reveal") {
        const voteItems = state.reveal.votes.map(result => `
            <li>
                <span>${escapeUndercoverHtml(result.username)}${result.playerId === state.reveal.undercoverId ? " 🕵️ Undercover" : ""}</span>
                <strong>${result.count} vote${result.count === 1 ? "" : "s"}</strong>
            </li>
        `).join("");
        body = `
            <p class="qdn-online-round">Résultat de la manche ${state.round} / ${state.rounds}</p>
            <p class="qdn-online-hint">${state.reveal.undercoverFound
                ? "Bien joué, l'undercover a été démasqué !"
                : "L'undercover a échappé au vote."
            }</p>
            <p class="undercover-word-result">Mot normal : <strong>${escapeUndercoverHtml(state.reveal.normalWord)}</strong> · Mot undercover : <strong>${escapeUndercoverHtml(state.reveal.undercoverWord)}</strong></p>
            <ol class="qdn-online-players">${voteItems}</ol>
            ${isHost ? `<button type="button" data-undercover-next>${state.round === state.rounds ? "Voir le classement final" : "Manche suivante"}</button>` : '<p class="qdn-online-hint">En attente du chef du salon…</p>'}
        `;
    } else {
        const ranking = [...state.players]
            .sort((first, second) => second.score - first.score || first.username.localeCompare(second.username))
            .map((player, index) => `
                <li>
                    <span>${index + 1}. ${escapeUndercoverHtml(player.username)}</span>
                    <strong>${player.score} pts</strong>
                </li>
            `).join("");
        body = `
            <p class="qdn-online-round">Partie terminée · ${state.rounds} manches jouées</p>
            <h3>Classement final</h3>
            <ol class="qdn-online-players">${ranking}</ol>
            <p class="qdn-online-hint">Le salon reste ouvert jusqu'au départ de tous les joueurs.</p>
        `;
    }

    renderUndercover(`
        <section class="qdn-online-view undercover-online-view">
            <h2>Salon ${escapeUndercoverHtml(state.code)}</h2>
            ${body}
            <h3 class="qdn-online-player-heading">Joueurs du salon</h3>
            <ol class="qdn-online-players qdn-online-room-players">${roomPlayerList}</ol>
            <p class="qdn-online-status${undercoverNotice ? " is-error" : ""}" role="${undercoverNotice ? "alert" : "status"}">${escapeUndercoverHtml(undercoverNotice)}</p>
            <button class="btn-retour" type="button" data-undercover-leave>Quitter le salon</button>
        </section>
    `);

    if (state.status === "voting") {
        const timer = document.querySelector("[data-undercover-timer]");
        undercoverClock = setInterval(() => {
            if (!timer?.isConnected) return stopUndercoverClock();
            const remaining = Math.max(0, Math.ceil((Number(timer.dataset.endsAt) - Date.now()) / 1000));
            timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
        }, 250);
    }
    document.querySelector("[data-undercover-copy]")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(state.code);
            undercoverNotice = "Code copié !";
        } catch {
            undercoverNotice = "Copie indisponible : sélectionne le code pour le partager.";
        }
        renderUndercoverRoom(state);
    });
    document.querySelector("[data-undercover-start]")?.addEventListener("click", () => runUndercoverAction("undercover:start"));
    document.querySelector("[data-undercover-next]")?.addEventListener("click", () => runUndercoverAction("undercover:next"));
    document.querySelectorAll("[data-undercover-kick]").forEach(button => {
        button.addEventListener("click", () => {
            if (window.confirm(`Expulser ${button.parentElement.querySelector("span").textContent.trim()} du salon ?`)) {
                runUndercoverAction("undercover:kick", Number(button.dataset.undercoverKick));
            }
        });
    });
    document.querySelectorAll("[data-undercover-vote]").forEach(button => {
        button.addEventListener("click", () => {
            if (undercoverRoomState?.hasVoted || undercoverRoomState?.isUndercover) return;
            undercoverSelectedVoteId = Number(button.dataset.undercoverVote);
            renderUndercoverRoom(undercoverRoomState);
        });
    });
    document.querySelector("[data-undercover-confirm]")?.addEventListener("click", event => {
        const button = event.currentTarget;
        if (undercoverSelectedVoteId === null || undercoverRoomState?.hasVoted) return;
        button.disabled = true;
        button.textContent = "Envoi du vote…";
        runUndercoverAction("undercover:vote", undercoverSelectedVoteId);
    });
    document.querySelector("[data-undercover-leave]")?.addEventListener("click", async () => {
        try {
            await requestUndercover("undercover:leave");
            undercoverRoomState = null;
            undercoverNotice = "";
            renderUndercoverHome();
        } catch (error) {
            undercoverNotice = error.message;
            renderUndercoverRoom(undercoverRoomState);
        }
    });
}

async function runUndercoverAction(eventName, payload = null) {
    try {
        await requestUndercover(eventName, payload);
    } catch (error) {
        undercoverNotice = error.message;
        renderUndercoverRoom(undercoverRoomState);
    }
}
