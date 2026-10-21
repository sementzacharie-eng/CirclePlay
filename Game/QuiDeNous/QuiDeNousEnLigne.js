let qdnOnlineSocket = null;
let qdnOnlineRoomState = null;
let qdnOnlineNotice = "";
let qdnOnlineDifficulty = "CHILL";
let qdnOnlineRounds = 10;
let qdnOnlineSelectedVoteId = null;
let qdnOnlineSelectionRound = null;

function escapeQdnOnlineHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getQdnOnlineSocket() {
    if (!circlePlayCurrentUser) {
        throw new Error("Connecte-toi à ton compte pour jouer en ligne.");
    }
    const socket = window.circlePlayChatSocket;
    if (!socket) {
        throw new Error("La connexion au serveur n'est pas disponible. Réessaie dans un instant.");
    }
    if (qdnOnlineSocket !== socket) {
        qdnOnlineSocket = socket;
        socket.on("qdn:state", state => {
            if (state.status !== "voting" || qdnOnlineSelectionRound !== state.round) {
                qdnOnlineSelectedVoteId = null;
            }
            qdnOnlineSelectionRound = state.status === "voting" ? state.round : null;
            qdnOnlineRoomState = state;
            qdnOnlineNotice = state.notice || "";
            renderQdnOnlineRoom(state);
        });
        socket.on("disconnect", () => {
            if (!qdnOnlineRoomState) return;
            qdnOnlineRoomState = null;
            qdnOnlineSelectedVoteId = null;
            qdnOnlineSelectionRound = null;
            qdnOnlineNotice = "Connexion interrompue : tu as quitté le salon. Reconnecte-toi pour en rejoindre un autre.";
            if (document.querySelector(".qdn-online-view")) {
                renderQdnOnlineHome(qdnOnlineNotice);
            }
        });
    }
    if (!socket.connected) {
        throw new Error("Connexion au serveur en cours. Réessaie dans un instant.");
    }
    return socket;
}

function requestQdnOnline(eventName, payload) {
    const socket = getQdnOnlineSocket();
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

function renderQdnOnline(content) {
    const menuContent = document.getElementById("menu-content");
    if (!menuContent) return;
    stopCirclePlaySpeech();
    menuContent.innerHTML = content;
    menuContent.style.opacity = "1";
}

function QuiDeNousEnLigne() {
    qdnOnlineRoomState = null;
    qdnOnlineNotice = "";
    qdnOnlineSelectedVoteId = null;
    qdnOnlineSelectionRound = null;
    renderQdnOnlineHome();
}

function renderQdnOnlineHome(message = qdnOnlineNotice) {
    if (!circlePlayCurrentUser) {
        renderQdnOnline(`
            <section class="qdn-online-view">
                <h2>Qui de nous ? en ligne</h2>
                <p class="qdn-online-status" role="status">Connecte-toi pour créer ou rejoindre un salon.</p>
                <button type="button" data-qdn-login>Se connecter</button>
                <button class="btn-retour" type="button" data-qdn-back>← Retour</button>
            </section>
        `);
        document.querySelector("[data-qdn-login]")?.addEventListener("click", () => showProfile("login"));
        document.querySelector("[data-qdn-back]")?.addEventListener("click", menuDevice);
        return;
    }

    renderQdnOnline(`
        <section class="qdn-online-view">
            <h2>Qui de nous ? en ligne</h2>
            <p class="qdn-online-intro">Crée un salon comme chef ou rejoins tes amis avec leur code.</p>
            <form class="qdn-online-create">
                <h3>Créer un salon</h3>
                <label for="qdn-online-difficulty">Difficulté</label>
                <select id="qdn-online-difficulty" name="difficulty">
                    <option value="CHILL"${qdnOnlineDifficulty === "CHILL" ? " selected" : ""}>CHILL 😆</option>
                    <option value="SOFT"${qdnOnlineDifficulty === "SOFT" ? " selected" : ""}>SOFT 😎</option>
                    <option value="HARD"${qdnOnlineDifficulty === "HARD" ? " selected" : ""}>HARD 😈</option>
                    <option value="EXTREME"${qdnOnlineDifficulty === "EXTREME" ? " selected" : ""}>EXTREME 🔞</option>
                </select>
                <label for="qdn-online-rounds">Nombre de manches</label>
                <select id="qdn-online-rounds" name="rounds">
                    ${[10, 20, 30, 40, 50].map(rounds =>
                        `<option value="${rounds}"${qdnOnlineRounds === rounds ? " selected" : ""}>${rounds} manches</option>`
                    ).join("")}
                </select>
                <button type="submit">Créer le salon</button>
            </form>
            <form class="qdn-online-join">
                <h3>Rejoindre un salon</h3>
                <label for="qdn-online-code">Code du salon</label>
                <input id="qdn-online-code" name="code" type="text" maxlength="6"
                    pattern="[A-HJ-NP-Z2-9]{6}" autocomplete="off" placeholder="Ex. ABC123" required>
                <button type="submit">Rejoindre</button>
            </form>
            <p class="qdn-online-status${message ? " is-error" : ""}" role="${message ? "alert" : "status"}">${escapeQdnOnlineHtml(message)}</p>
            <button class="btn-retour" type="button" data-qdn-back>← Retour</button>
        </section>
    `);

    const createForm = document.querySelector(".qdn-online-create");
    createForm.addEventListener("submit", async event => {
        event.preventDefault();
        qdnOnlineDifficulty = createForm.elements.difficulty.value;
        qdnOnlineRounds = Number(createForm.elements.rounds.value);
        try {
            await requestQdnOnline("qdn:create", {
                difficulty: qdnOnlineDifficulty,
                rounds: qdnOnlineRounds
            });
        } catch (error) {
            renderQdnOnlineHome(error.message);
        }
    });
    document.querySelector(".qdn-online-join").addEventListener("submit", async event => {
        event.preventDefault();
        const code = event.currentTarget.elements.code.value.trim().toUpperCase();
        try {
            await requestQdnOnline("qdn:join", code);
        } catch (error) {
            renderQdnOnlineHome(error.message);
        }
    });
    document.querySelector("[data-qdn-back]").addEventListener("click", menuDevice);
}

function renderQdnOnlineRoom(state) {
    if (!state) return;
    const currentUserId = circlePlayCurrentUser?.id;
    const isHost = state.hostId === currentUserId;
    const playerList = state.players.map(player => `
        <li>
            <span>${escapeQdnOnlineHtml(player.username)}${player.id === state.hostId ? " <em>Chef</em>" : ""}</span>
            <strong>${player.score} pts</strong>
        </li>
    `).join("");
    let body = "";

    if (state.status === "lobby") {
        body = `
            <p class="qdn-online-round">${state.difficulty} · ${state.rounds} manches</p>
            <p class="qdn-online-code-label">Code du salon</p>
            <button class="qdn-online-code" type="button" data-qdn-copy>${escapeQdnOnlineHtml(state.code)}</button>
            <p class="qdn-online-hint">Partage ce code avec tes amis · ${state.players.length}/12 joueurs</p>
            <ol class="qdn-online-players">${playerList}</ol>
            <p class="qdn-online-hint">${isHost
                ? state.players.length < 2
                    ? "Il faut au moins 2 joueurs pour commencer."
                    : "Tout le monde est prêt ? Lance la partie !"
                : "En attente du chef du salon…"
            }</p>
            ${isHost ? `<button type="button" data-qdn-start${state.players.length < 2 ? " disabled" : ""}>Commencer la partie</button>` : ""}
        `;
    } else if (state.status === "voting") {
        const voteButtons = state.players.map(player => `
            <button class="qdn-online-player" type="button" data-qdn-vote="${player.id}"
                aria-pressed="${qdnOnlineSelectedVoteId === player.id}"${state.hasVoted ? " disabled" : ""}>
                ${escapeQdnOnlineHtml(player.username)}
            </button>
        `).join("");
        body = `
            <p class="qdn-online-round">Manche ${state.round} / ${state.rounds} · ${state.difficulty}</p>
            <p class="qdn-online-question">${escapeQdnOnlineHtml(state.question.text)}</p>
            <p class="qdn-online-hint">${state.hasVoted
                ? "Ton vote est enregistré. Attends les autres joueurs."
                : "Choisis une personne, puis confirme ton vote."
            }</p>
            <div class="qdn-online-vote-grid">${voteButtons}</div>
            ${state.hasVoted ? "" : `<button type="button" data-qdn-confirm-vote${qdnOnlineSelectedVoteId === null ? " disabled" : ""}>Confirmer mon choix</button>`}
            <p class="qdn-online-votes" aria-live="polite">${state.votesSubmitted} / ${state.players.length} votes reçus</p>
        `;
    } else if (state.status === "reveal") {
        const resultItems = state.reveal.results.map(result => {
            const receivedPoints = state.reveal.awardedIds.includes(result.playerId);
            return `
                <li>
                    <span>${escapeQdnOnlineHtml(result.username)}${receivedPoints ? " 🏆" : ""}</span>
                    <strong>${result.votes} vote${result.votes === 1 ? "" : "s"}${receivedPoints
                    ? ` · ${state.reveal.points > 0 ? "+" : ""}${state.reveal.points} pts`
                    : ""}</strong>
                </li>
            `;
        }).join("");
        const awardedCount = state.reveal.awardedIds.length;
        body = `
            <p class="qdn-online-round">Résultat de la manche ${state.round} / ${state.rounds}</p>
            <p class="qdn-online-question">${escapeQdnOnlineHtml(state.question.text)}</p>
            <p class="qdn-online-hint">${awardedCount > 1
                ? "Égalité ! Les joueurs en tête reçoivent les points."
                : "Voici le résultat des votes."
            }</p>
            <ol class="qdn-online-players">${resultItems}</ol>
            ${isHost ? `<button type="button" data-qdn-next>${state.round === state.rounds ? "Voir le classement final" : "Manche suivante"}</button>` : '<p class="qdn-online-hint">En attente du chef du salon…</p>'}
        `;
    } else {
        const ranking = [...state.players]
            .sort((first, second) => second.score - first.score || first.username.localeCompare(second.username))
            .map((player, index) => `
                <li>
                    <span>${index + 1}. ${escapeQdnOnlineHtml(player.username)}</span>
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

    renderQdnOnline(`
        <section class="qdn-online-view">
            <h2>Salon ${escapeQdnOnlineHtml(state.code)}</h2>
            ${body}
            <p class="qdn-online-status${qdnOnlineNotice ? " is-error" : ""}" role="${qdnOnlineNotice ? "alert" : "status"}">${escapeQdnOnlineHtml(qdnOnlineNotice)}</p>
            <button class="btn-retour" type="button" data-qdn-leave>Quitter le salon</button>
        </section>
    `);

    document.querySelector("[data-qdn-copy]")?.addEventListener("click", async event => {
        try {
            await navigator.clipboard.writeText(state.code);
            qdnOnlineNotice = "Code copié !";
        } catch {
            qdnOnlineNotice = "Copie indisponible : sélectionne le code pour le partager.";
        }
        renderQdnOnlineRoom(state);
    });
    document.querySelector("[data-qdn-start]")?.addEventListener("click", () => runQdnOnlineAction("qdn:start"));
    document.querySelector("[data-qdn-next]")?.addEventListener("click", () => runQdnOnlineAction("qdn:next"));
    document.querySelectorAll("[data-qdn-vote]").forEach(button => {
        button.addEventListener("click", () => {
            if (qdnOnlineRoomState?.hasVoted) return;
            qdnOnlineSelectedVoteId = Number(button.dataset.qdnVote);
            renderQdnOnlineRoom(qdnOnlineRoomState);
        });
    });
    document.querySelector("[data-qdn-confirm-vote]")?.addEventListener("click", event => {
        const button = event.currentTarget;
        if (qdnOnlineSelectedVoteId === null || qdnOnlineRoomState?.hasVoted) return;
        button.disabled = true;
        button.textContent = "Envoi du vote…";
        submitQdnOnlineVote(qdnOnlineSelectedVoteId);
    });
    document.querySelector("[data-qdn-leave]")?.addEventListener("click", async () => {
        try {
            await requestQdnOnline("qdn:leave", null);
            qdnOnlineRoomState = null;
            qdnOnlineNotice = "";
            renderQdnOnlineHome();
        } catch (error) {
            qdnOnlineNotice = error.message;
            renderQdnOnlineRoom(qdnOnlineRoomState);
        }
    });
}

async function submitQdnOnlineVote(playerId) {
    try {
        await requestQdnOnline("qdn:vote", playerId);
        qdnOnlineSelectedVoteId = null;
    } catch (error) {
        qdnOnlineNotice = error.message;
        renderQdnOnlineRoom(qdnOnlineRoomState);
    }
}

async function runQdnOnlineAction(eventName, payload = null) {
    try {
        await requestQdnOnline(eventName, payload);
    } catch (error) {
        qdnOnlineNotice = error.message;
        renderQdnOnlineRoom(qdnOnlineRoomState);
    }
}
