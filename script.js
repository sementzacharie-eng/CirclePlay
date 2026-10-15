/* ----------------------------- */
/* Remplace le contenu du menu avec une courte transition. */
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

/* Affiche les jeux proposés en mode en ligne. */
function WanMenuGames() {
    fadeMenuContent(`
        <h2>Choisissez votre jeux</h2>
        <button>Action/Vérité ❓</button>
        <button>Qui de nous ? 👥</button>
        <button>Médias Roulette 🎰</button>
        <button class="btn-retour" onclick="showMainMenu()">← Retour</button>
    `);
}