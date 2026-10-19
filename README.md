# CirclePlay

CirclePlay contient ses jeux web et un premier serveur Node.js pour les comptes.
Cette étape met en place la création de compte et la connexion ; les parties en
ligne et leur synchronisation seront développées ensuite.

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

Pour un hébergement public, configure `NODE_ENV=production`, une
`SESSION_SECRET` aléatoire et HTTPS ; ne réutilise pas la clé d'exemple. En
développement, une clé temporaire est générée si `SESSION_SECRET` n'est pas
défini, ce qui déconnecte les comptes au redémarrage du serveur. Le fichier
SQLite convient pour démarrer sur une seule instance ; un déploiement
multi-instance demandera une base et un stockage de sessions partagés.
