# Induvision

Outil de sélection caméra/objectif pour la vision industrielle : simulation optique,
comparaison de configurations et estimation du débit GigE. Le site est statique,
sans base de données, sans compte et sans API serveur.

## Démarrer

Node.js 22.18 ou plus récent est recommandé, notamment pour les tests TypeScript.

```sh
cd web
npm ci
npm run dev
```

Le catalogue est validé et généré automatiquement avant le démarrage et la compilation.
Après une modification d’une fiche JSON pendant le développement, lancer
`npm run catalog:build` pour actualiser le catalogue.

```sh
npm test
npm run lint
npm run build
npm start
```

`npm start` sert le dossier compilé sur `http://127.0.0.1:3000`.
Les mêmes commandes sont disponibles via `just setup`, `just dev`, `just catalog`,
`just test`, `just lint`, `just build` et `just start` depuis la racine.

## Charte visuelle

L’interface reprend la charte de `../yokainco.com/site/static/styles.css` : fond
`#f7f8f6`, texte `#132126`, orange `#e95420`, cyan `#168ba0` et famille de polices
`Inter, "Avenir Next", "Segoe UI", Arial, sans-serif`. L’en-tête horizontal, les
titres, les formulaires, les fiches et les graphiques utilisent cette même palette.

Le pied de page attribue l’outil à Yokaï Robotics et renvoie vers
`https://yokainco.com/`. Le logo officiel du site est copié dans
`web/public/logo-yokai-robotics.png` pour rester disponible dans l’export statique.

Les variables de référence et les composants communs sont dans
`web/app/globals.css` ; les utilitaires de couleur et de rayon sont définis dans
`web/tailwind.config.ts`. Les panneaux ont un rayon de 18 px et les boutons et
champs un rayon de 7 px. La mise en page s’adapte aux écrans mobiles.

## Maintenir le catalogue

La source de référence est un fichier JSON par modèle :

- `web/data/cameras/<marque>/<identifiant>.json`
- `web/data/lenses/<marque>/<identifiant>.json`

Pour ajouter un modèle, copier une fiche existante, renseigner ses caractéristiques,
attribuer un `id` unique et stable (lettres minuscules, chiffres et tirets), puis lancer
`npm run catalog:build` dans `web`. Conserver l’identifiant lors des corrections : les
études y font référence. Les marques et modèles doivent être uniques par catalogue.

Les valeurs numériques inconnues sont `null`, jamais `0` ni une chaîne. Les dimensions
et distances sont en millimètres, la taille du pixel en micromètres, la résolution en
pixels et la cadence en images par seconde. Les champs catégoriels optionnels peuvent
être vides pour les informations inconnues. Une URL source doit utiliser HTTP ou HTTPS.
Le validateur contrôle les types, doublons, plages d’ouverture et la cohérence des
dimensions du capteur avec la résolution et la taille du pixel.

`web/data/catalog.generated.json` est généré automatiquement et exclu de Git.
Le catalogue public est en lecture seule. Une modification d’une fiche nécessite une
nouvelle compilation et un redéploiement pour apparaître chez tous les visiteurs.

Les scripts de collecte restent utilisables localement :

```sh
python3 scripts/scrape_basler_cameras.py --test
python3 scripts/scrape_basler_lenses.py --test
```

Leur sortie est placée dans `scripts/staging/`, exclu de Git. Relire les caractéristiques,
renseigner l’identifiant stable et normaliser les valeurs avant de transférer une fiche
dans le catalogue. Ces scripts ne modifient jamais directement les données du site.

## Études personnelles

Les études sont sauvegardées explicitement avec « Enregistrer sur ce navigateur » dans
`localStorage`, sous la clé `induvision.studies.v1`. Elles ne sont ni envoyées à un serveur
ni synchronisées entre appareils. L’effacement des données du navigateur les supprime.

« Exporter cette étude » et « Exporter toutes les études » téléchargent un fichier JSON
versionné contenant aussi les modifications en cours, les filtres, les sélections et
les comparaisons. « Importer des études JSON » ajoute des études sans écraser les études
existantes ; un identifiant déjà utilisé produit une copie. Le format est
`{"version":1,"studies":[...]}`. Les imports sont limités à 2 Mo et 1 000 études.

Si un modèle a disparu, sa sélection est remplacée et les comparaisons concernées sont
retirées. Si le stockage est illisible ou indisponible, les données existantes sont
préservées et l’enregistrement local est désactivé ; l’export reste disponible. Une
modification dans un autre onglet bloque l’écriture : exporter les changements puis
recharger la page avant de les réimporter.

Le champ historique `objectSpeedMmS` du JSON contient une vitesse en **m/s**, comme le
champ affiché dans l’interface ; ce nom est conservé pour la compatibilité des études.

## Déployer

Depuis `web`, lancer `npm ci` puis `npm run build` et publier **uniquement `web/out/`**
sur un hébergement statique avec HTTPS. Aucun processus Node.js, volume persistant,
secret ni variable `DATABASE_URL` n’est nécessaire en production. Configuration
de compilation : répertoire de travail `web`, commande `npm run build`, sortie `out`.

Le workflow `.github/workflows/check.yml` valide le catalogue, exécute les tests, vérifie
le code et produit une archive `induvision-static` du site compilé. Il ne publie pas
automatiquement. L’hébergeur et le domaine restent à choisir.

Le site utilise l’[export statique Next.js](https://nextjs.org/docs/app/guides/static-exports).
Le serveur local fourni est destiné à la prévisualisation ; l’hébergeur sert les fichiers
statiques en production.

## Migration initiale

Le catalogue réconcilié contient 55 caméras et 96 objectifs. Pour les modèles communs,
les valeurs de la base existante ont priorité afin de conserver les corrections locales.
Les identifiants sont désormais stables et les valeurs numériques inconnues sont `null`.

Les sauvegardes de migration sont locales et exclues de Git et de la sortie du site :

- `backups/migration/dev.db` : copie de la base d’origine.
- `backups/migration/sqlite-export.json` : export complet des anciennes tables.
- `backups/migration/original-files/` : fichiers sources avant réconciliation.
- `backups/migration/conflicts.json` : différences entre les fichiers et la base.
- `backups/migration/studies.json` : les deux études avec les identifiants remappés,
  à importer depuis l’interface pour les retrouver dans ce navigateur.

Ces fichiers personnels ne doivent pas être publiés. L’application ne dépend plus de
SQLite ou de Prisma.

## Testing ethernet speed

~940 Mbit/s → Gigabit link (1 Gb/s) operating correctly.
~2.3 Gbit/s → 2.5 Gigabit link.
~9.4 Gbit/s → 10 Gigabit link.
~95 Mbit/s → Something is limiting the connection to 100 Mb/s (cable, port, or configuration).

### Linux server

```
sudo ip addr add 192.168.10.1/24 dev eno2
sudo ip link set eno2 up
iperf3 -s
```

### Mac OS client

```
sudo networksetup -setmanual "AX88179A" 192.168.10.2 255.255.255.0

iperf3 -c 192.168.10.1
```



