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
dans le dossier local `data/`, qui n'est pas servi au navigateur. Une couleur
de pseudo est attribuée aléatoirement à l'inscription ; elle peut être changée
parmi 10 couleurs proposées dans le profil et s'affiche dans le chat global.

## Chat global

Le chat apparaît uniquement aux comptes connectés. Il utilise une connexion
temps réel, limite les messages à 500 caractères et à un message par seconde par
compte, puis conserve temporairement les 50 derniers messages en mémoire du
serveur. Les messages et l'historique sont perdus au redémarrage du serveur ;
ils ne sont pas enregistrés dans la base SQLite.

## Qui de nous ? en ligne

Depuis **Jeux → En Ligne**, connecte-toi puis crée un salon en choisissant la
difficulté et le nombre de manches (10 à 50), ou rejoins un salon avec son code
à 6 caractères. Le chef du salon peut lancer la partie à partir de 2 joueurs et
expulser un joueur grâce au bouton situé à côté de son nom dans la liste.
Chaque manche affiche la même question à tous ; les votes restent cachés jusqu'à
ce que tous les joueurs aient voté. Le ou les joueurs ayant reçu le plus de voix
gagnent les points de la question (les égalités donnent les points à chacun).
Les salons et les scores sont conservés en mémoire du serveur et disparaissent
à son redémarrage.

## Undercover en ligne

Depuis **Jeux → En Ligne → Undercover**, connecte-toi puis crée un salon avec
une catégorie et un nombre de manches, ou rejoins un salon avec son code à 6
caractères. Le chef peut lancer la partie à partir de 3 joueurs. À chaque
manche, un joueur reçoit un mot différent de celui des autres ; les mots ne
sont révélés qu'à la fin du vote. Les joueurs ont 3 minutes pour désigner
l'undercover ; celui-ci ne peut pas voter. Le vote se termine plus tôt si tous
les joueurs autorisés ont voté. Le chef lance ensuite la manche suivante.

Les paires de mots sont personnalisables dans
[`data/undercover-categories.js`](./data/undercover-categories.js). Ajoute ou
modifie les catégories et les paires `{ normal, undercover }` dans ce fichier ;
les deux mots d'une paire doivent être différents et chaque catégorie doit
contenir au moins une paire. Redémarre le serveur pour charger les changements.
Une équipe normale gagne un point par joueur si
l'undercover reçoit seul le plus de votes ; sinon l'undercover gagne un point.
Les salons et les scores sont conservés en mémoire du serveur et disparaissent
à son redémarrage.

Pour un hébergement public, configure `NODE_ENV=production`, une
`SESSION_SECRET` aléatoire et HTTPS ; ne réutilise pas la clé d'exemple. En
développement, une clé temporaire est générée si `SESSION_SECRET` n'est pas
défini, ce qui déconnecte les comptes au redémarrage du serveur. Le fichier
SQLite convient pour démarrer sur une seule instance ; un déploiement
multi-instance demandera une base et un stockage de sessions partagés.
