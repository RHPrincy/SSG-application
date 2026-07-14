# Prerender Manager

Application web centralisée pour piloter le **pré-rendu** et le **déploiement
Vercel** de sites Lovable (SPA). Elle réutilise le script de pré-rendu
`scripts/clone.js` (Playwright) fourni, expose un dashboard protégé par code
d'accès, détecte l'obsolescence des copies Vercel et permet de relancer le
pré-rendu + déploiement en un clic.

> Le problème résolu : une SPA Lovable n'expose pas son contenu dans le
> *view source*, donc elle est mal crawlée. On en génère une copie statique
> crawlable, déployée sur Vercel. À chaque modification du site sur Lovable la
> copie devient obsolète — cette app permet de la régénérer sans relancer le
> script à la main pour chaque site.

## Stack

- **Next.js (App Router)** + **TypeScript** — front + API routes dans un seul projet.
- **Tailwind CSS v4** + composants maison (style shadcn/ui).
- **Playwright** — pré-rendu (`clone.js`) et vérification d'obsolescence.
- **jose** — signature/vérification des jetons de session (JWT HS256).
- **Vercel CLI** — déploiement des copies statiques.

## Architecture

```
prerender-manager/
├─ scripts/
│  ├─ clone.js          # script de pré-rendu fourni, réutilisé tel quel
│  └─ serve.js          # aperçu local d'un clone (facultatif)
├─ src/
│  ├─ app/
│  │  ├─ login/         # écran de connexion (code d'accès)
│  │  ├─ dashboard/     # liste des sites, statut, mise à jour
│  │  ├─ settings/      # gestion des sites + rappel des secrets serveur
│  │  └─ api/           # routes protégées (auth, sites, prerender, jobs, status)
│  ├─ lib/              # auth, store JSON, jobs, obsolescence, pipeline prerender
│  └─ components/       # UI (cards, badges de statut, console de logs…)
├─ data/                # état persistant (state.json) + sorties clonées (volume)
├─ Dockerfile
├─ docker-compose.yml
├─ ecosystem.config.js  # alternative pm2
└─ .env.example
```

### Comment le script de pré-rendu est réutilisé

`clone.js` n'est **pas réécrit** : il est appelé côté serveur via
`child_process.spawn(node, [clone.js, <urlLovable>, <dossierSortie>, --js])`
depuis `src/lib/prerender.ts`. Sa sortie (stdout/stderr) est diffusée en direct
dans la console de logs du dashboard. Le flag `--js` est activé pour conserver
les textes révélés au scroll et les interactions.

### Pipeline de mise à jour d'un site

1. **Clone** — `clone.js` génère la copie statique dans `data/output/<siteId>`.
2. **Post-traitement SEO** — réécriture des `canonical` / `og:url` / `twitter:url`
   et de toute URL absolue Lovable vers la cible Vercel, suppression d'un
   éventuel `noindex` hérité, génération de `robots.txt` + `sitemap.xml`.
3. **Déploiement** — `vercel deploy <dossier> --prod --yes` (token depuis `.env`).
4. **Empreinte** — capture du hash du rendu Lovable pour les vérifications
   d'obsolescence ultérieures ; mise à jour de la date et du statut.

Les tâches sont **asynchrones** : l'API renvoie un `jobId`, le client interroge
`/api/jobs/:id` pour l'avancement (en cours / succès / échec) et les logs, sans
bloquer l'interface.

## Sécurité & authentification

- Le **code d'accès** (`ACCESS_CODE`) est vérifié **exclusivement côté serveur**
  (`/api/auth/login`), en comparaison à temps constant. Code erroné → **HTTP 403**.
- En cas de succès, le serveur signe un **JWT court** (HS256, `AUTH_SECRET`)
  renvoyé au client et stocké en **`sessionStorage`**.
- Toutes les routes API sensibles vérifient ce jeton (`Authorization: Bearer …`)
  → **403** sinon. Aucune fonctionnalité n'est accessible sans jeton valide.
- La **déconnexion** vide le `sessionStorage` et renvoie à l'écran de connexion.
- Les secrets restent dans `.env`, **jamais** envoyés au navigateur.

## Détection d'obsolescence — fiabilité

L'app rend la page Lovable en direct (vrai navigateur), extrait le **texte
visible** (`body.innerText`), le normalise et le hache (SHA-256), puis compare
au hash capturé lors du dernier pré-rendu réussi.

On hache le **texte visible** et non le HTML brut, car le HTML rendu d'une SPA
change à chaque chargement pour des raisons sans rapport avec le contenu (nonces
CSP, marqueurs d'hydratation, ids aléatoires, noms de bundles hachés) — le
hacher provoquerait de faux « obsolète ».

**Limites (signalées comme « statut inconnu » plutôt qu'une info fausse) :**

- Seule l'URL d'entrée est vérifiée, pas chaque page crawlée.
- Un A/B test, un feature flag ou du contenu tournant peut modifier le texte
  sans « vraie » édition → faux « obsolète » possible.
- Si le rendu échoue ou expire, le statut est **« inconnu »** (jamais un faux
  « à jour »). Idem tant qu'aucun pré-rendu n'a établi d'empreinte de référence.

## Variables d'environnement

Copiez `.env.example` en `.env` et renseignez :

| Variable         | Rôle                                                            |
|------------------|-----------------------------------------------------------------|
| `ACCESS_CODE`    | Code d'accès de connexion (vérifié côté serveur).               |
| `AUTH_SECRET`    | Clé de signature des JWT (`openssl rand -base64 48`).           |
| `TOKEN_TTL`      | Durée de vie du jeton (ex. `8h`).                               |
| `VERCEL_TOKEN`   | Token Vercel (https://vercel.com/account/tokens).               |
| `VERCEL_ORG_ID`  | (Optionnel) équipe/scope Vercel.                                |
| `VERCEL_SCOPE`   | (Optionnel) scope passé au CLI.                                 |
| `VERCEL_BIN`     | Chemin du binaire Vercel (défaut `vercel`).                     |
| `DATA_DIR`       | Dossier d'état + sorties clonées (défaut `./data`).             |
| `CLONE_SCRIPT`   | Chemin du script de pré-rendu (défaut `./scripts/clone.js`).    |

## Développement

```bash
cd prerender-manager
npm install
npx playwright install chromium     # navigateur pour clone.js + obsolescence
cp .env.example .env                # puis remplir les valeurs
npm run dev                         # http://localhost:3000
```

Connexion : saisir le `ACCESS_CODE` défini dans `.env`.

## Déploiement sur VPS

### Option A — Docker (recommandé)

```bash
cd prerender-manager
cp .env.example .env        # remplir ACCESS_CODE, AUTH_SECRET, VERCEL_TOKEN…
docker compose up -d --build
```

- Image basée sur `mcr.microsoft.com/playwright` : Chromium et ses dépendances
  système sont déjà présents ; le Vercel CLI est installé dans l'image.
- L'état (`data/`) est persisté dans un volume Docker (`prerender_data`).
- L'app écoute sur le port `3000`. Placez un reverse proxy (Nginx/Caddy) devant
  pour le TLS.

### Option B — pm2

```bash
cd prerender-manager
npm ci && npm run build
npx playwright install --with-deps chromium
npm i -g vercel
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## Notes d'exploitation

- **Instance unique** : l'état des tâches/logs vit en mémoire du process ; ne pas
  scaler horizontalement (ou externaliser l'état au préalable).
- Le premier lancement crée `data/state.json` avec les 3 sites par défaut ;
  ajoutez/supprimez-en ensuite depuis **Paramètres**.
- Prérequis légal/SEO (voir la doc du script) : ne déployer une copie que de
  sites dont vous détenez les droits ; réécrire les `canonical` (fait
  automatiquement) et idéalement mettre une redirection 301 depuis l'original.
```
