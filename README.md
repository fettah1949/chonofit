# ChonoFit

Application locale de gestion de salle de sport : adhérents, abonnements, paiements et pointage.

L'interface est en français. Elle est prévue pour un PC d'accueil, avec un accès possible depuis une tablette du même réseau.

## Prérequis

- Node.js 20 ou plus récent
- Windows, macOS ou Linux

## Installation

Dans le dossier du projet :

```powershell
copy .env.example .env
npm install
npm run setup
```

`npm run setup` crée la base `data/gym.db`, applique les migrations Prisma et ajoute les deux comptes de départ. Aucun adhérent n'est créé.

Sur macOS ou Linux, remplacez la première commande par `cp .env.example .env`.

Générez un secret de session et collez-le dans `AUTH_SECRET` :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Lancer l'application

```powershell
npm run dev
```

Ouvrez [http://localhost:5000](http://localhost:5000).

Le serveur écoute sur toutes les interfaces. Depuis une tablette du même réseau, utilisez `http://ADRESSE-IP-DU-PC:5000`. Autorisez le port 5000 dans le pare-feu Windows si la page ne s'ouvre pas.

Pour un usage quotidien, après un premier test :

```powershell
npm run build
npm start
```

### Comptes de départ

| Rôle | Nom | E-mail |
| --- | --- | --- |
| Admin | Mohamed | admin@chonofit.local |
| Réception | Réception | reception@chonofit.local |
| Coach | Soufiane | soufiane@chonofit.local |
| Coach | Abdelkhalek | abdelkhalek@chonofit.local |

Le seed pose un mot de passe initial, écrit dans `prisma/seed.ts`. La première connexion avec ce mot de passe ouvre seulement l'écran pour en choisir un nouveau. L'écran de connexion ne l'affiche pas. Le réceptionniste gère les adhérents, abonnements, paiements et le pointage. Les paramètres, les utilisateurs et les suppressions sont réservés à l'admin.

Relancer `npm run db:seed` ne réinitialise pas les mots de passe des comptes déjà présents. Cette commande remet en place les quatre séances et les prix du catalogue de départ.

## Modules

- **Tableau de bord** : adhérents actifs, échéances à 7 jours, chiffre du mois, entrées du jour, graphiques.
- **Adhérents** : recherche, filtres actif / expiré / suspendu, fiche, historique. Karaté et kickboxing, assurance, groupes et tenues.
- **Photos** : capture caméra ou galerie. Les fichiers JPG et PNG sont convertis en JPEG, limités à 800 px de large, et enregistrés dans `public/uploads/members`. Seule une session ouverte peut les afficher.
- **Abonnements** : formules avec une durée en jours. `0` signifie illimité. La date de fin inclut le jour de début (30 jours commencés le 1er se terminent le 30).
- **Paiements** : espèces, carte, virement ou autre, avec reçu imprimable.
- **Pointage** : recherche par nom ou téléphone. Une entrée est possible même si l'abonnement n'est pas actif, après confirmation.
- **Paramètres** : salle, formules, utilisateurs, WhatsApp.

Les suppressions demandent une confirmation.

## Photos et caméra

La capture directe utilise la caméra du navigateur. Elle fonctionne sur `localhost`. Depuis une tablette qui ouvre le PC via une adresse `http://192.168...`, Chrome et Safari bloquent la caméra tant que le site n'est pas en HTTPS. L'import depuis la galerie reste disponible dans ce cas.

## Variables d'environnement

Elles sont documentées dans `.env.example` :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Fichier SQLite, relatif au dossier `prisma` |
| `AUTH_SECRET` | Signature des sessions |
| `AUTH_URL` | URL publique de l'application |

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Développement, accessible sur le réseau local |
| `npm run build` puis `npm start` | Version de production |
| `npm run setup` | Migrations + données initiales |
| `npm run db:studio` | Consulter la base |

## Structure

```text
app/                  pages App Router et routes API
components/           interface, dont les composants shadcn/ui
actions/              mutations serveur
lib/                  Prisma, photos, formats
prisma/               schéma, migrations, seed
data/                 base SQLite gym.db
public/uploads/       photos des adhérents et logo
```

La session utilise NextAuth.js avec le fournisseur identifiants (e-mail et mot de passe) et un jeton JWT. Les mots de passe sont hachés avec bcrypt. Les rôles sont Admin et Réceptionniste.
