# CirclePlay

CirclePlay contient ses jeux web, un serveur Node.js pour les comptes et un chat
global en temps réel réservé aux comptes connectés.

## Étape 1 — Installer Node.js

Installe une version LTS de Node.js 20 ou plus récente. Vérifie l'installation
dans un terminal :

```powershell
node --version
npm --version
```

## Étape 2 — Installer le serveur

Depuis le dossier du projet :

```powershell
npm install
```

## Étape 3 — Configurer et démarrer

Pour personnaliser les variables d'environnement, copie le modèle :

```powershell
Copy-Item .env.example .env
```

En développement, la configuration par défaut suffit :

```powershell
npm start
```

Ouvre ensuite <http://localhost:3000>. Le jeu doit être ouvert depuis cette
adresse, et non directement depuis `index.html`, pour que les comptes
fonctionnent.

Pour définir explicitement la configuration dans PowerShell :

```powershell
$env:SESSION_SECRET = "une-cle-aleatoire-longue-et-secrete"
$env:PORT = "3000"
npm start
```

## Comptes disponibles

Depuis **Profil**, chacun peut créer un compte avec un pseudo de 3 à 20 lettres,
chiffres ou tirets bas et un mot de passe d'au moins 10 caractères. Les mots de
passe sont hachés avant stockage ; les comptes et les sessions sont conservés
dans le dossier local `data/`, qui n'est pas servi au navigateur.

## Chat global

Le chat apparaît uniquement aux comptes connectés. Il utilise une connexion
temps réel, limite les messages à 500 caractères et à un message par seconde par
compte, puis conserve temporairement les 50 derniers messages en mémoire du
serveur. Les messages et l'historique sont perdus au redémarrage du serveur ;
ils ne sont pas enregistrés dans la base SQLite.

## Qui de nous ? en ligne

Depuis **Jeux → En Ligne**, connecte-toi puis crée un salon en choisissant la
difficulté et le nombre de manches (10 à 50), ou rejoins un salon avec son code
à 6 caractères. Le chef du salon peut lancer la partie à partir de 3 joueurs.
Chaque manche affiche la même question à tous ; les votes restent cachés jusqu'à
ce que tous les joueurs aient voté. Le ou les joueurs ayant reçu le plus de voix
gagnent les points de la question (les égalités donnent les points à chacun).
Les salons et les scores sont conservés en mémoire du serveur et disparaissent
à son redémarrage.

Pour un hébergement public, configure `NODE_ENV=production`, une
`SESSION_SECRET` aléatoire et HTTPS ; ne réutilise pas la clé d'exemple. En
développement, une clé temporaire est générée si `SESSION_SECRET` n'est pas
défini, ce qui déconnecte les comptes au redémarrage du serveur. Le fichier
SQLite convient pour démarrer sur une seule instance ; un déploiement
multi-instance demandera une base et un stockage de sessions partagés.
