# Workout Builder - Notes de projet

## Contexte
Application web pour créer des séances d'entraînement (course, vélo, natation) avec parsing IA et synchronisation Garmin.
Déployé sur **enduzo.com** (Vercel).

---

## Workflow Git

- **`main`** = production (enduzo.com) - NE JAMAIS COMMITTER DIRECTEMENT
- **`dev`** = développement - déployé automatiquement en preview sur Vercel

Processus:
1. Travailler uniquement sur `dev`
2. Push sur `dev` → déploiement preview automatique
3. Merger `dev` → `main` quand validé pour la prod

---

## Travail récent (février 2025)

### Terminé
- [x] **Détection automatique des intervalles** dans l'analyse de séance
  - Fichier principal : `src/lib/activityAnalysisService.ts` → fonction `detectWorkoutStructure()`
  - Algorithme : lissage vitesse → détection points de changement → fusion segments → classification bimodale
  - Support des intervalles basés sur le temps (ex: 1'/2')
- [x] **Serverless functions Vercel** pour toutes les routes API
- [x] **Fix OAuth Strava** : Redirection correcte vers enduzo.com en prod
- [x] **Optimisation serverless** : Limite de 12 fonctions sur Hobby plan respectée
- [x] **Phases 1-4 : Gestion de compte** (voir section dédiée ci-dessous)
- [x] **Migration API Garmin v2** dans `api/garmin/[action].js`
  - Détection automatique des blocs de répétitions (`detectAllRepeatBlocks`)
  - Mapping des types : warmup→WARMUP, active→ACTIVE, recovery→RECOVERY, cooldown→COOLDOWN, rest→REST, other→INTERVAL
  - `skipLastRestStep: false` pour garder toutes les récups
  - Description = `step.notes` ou `step.name` pour type "other"
- [x] **Page "Mes séances"** (`/saved-workouts`)
  - Nouveau composant `SavedWorkoutsPage.tsx`
  - Liste des séances avec expand/collapse, sync Garmin, suppression
  - Navigation : "Créer" + "Séances" dans le Header
- [x] **Bouton Sauvegarder** dans `WorkoutForm.tsx`
  - Sauvegarde manuelle avant sync
  - Sauvegarde automatique quand on clique "Sync Garmin"

### En cours / À faire
- [ ] **Unifier la détection des répétitions** (preview = Garmin) — voir détail ci-dessous
- [ ] La détection d'intervalles peut encore être améliorée pour des séances complexes (blocs mixtes)
- [ ] Afficher la structure détectée dans l'UI (actuellement juste dans le summary texte)
- [ ] Merger `dev` → `main` quand validé pour la prod

#### Détail : Unification détection des répétitions

**Problème** : Les répétitions sont détectées 2x indépendamment avec des algos différents :
- Client (`WorkoutPreview.tsx` L68-189) : pattern sizes 1-4, gère patterns partiels
- Serveur (`api/garmin/[action].js` L120-225) : pattern sizes 1-3, pas de patterns partiels
→ Risque de divergence entre preview et Garmin

**Solution** : Détecter 1 seule fois côté client, envoyer steps structurés à l'API.

**Étapes** :
1. **Créer `src/lib/repeatDetection.ts`**
   - Extraire `stepsAreSimilar()` et `detectRepeatBlocks()` depuis `WorkoutPreview.tsx`
   - Exporter aussi le type `DisplayBlock`
   - Utiliser la version client (la plus complète : sizes 1-4, patterns partiels)

2. **Modifier `src/components/WorkoutPreview.tsx`**
   - Supprimer `stepsAreSimilar` (L68-94), `detectRepeatBlocks` (L97-189), type `DisplayBlock` (L9-13)
   - Importer depuis `../lib/repeatDetection`
   - Le reste du composant ne change pas

3. **Modifier `src/components/GarminSyncModal.tsx`**
   - Importer `detectRepeatBlocks` depuis `../lib/repeatDetection`
   - Dans `syncWorkoutToGarmin()`, structurer les steps avant envoi :
     - `detectRepeatBlocks(workout.steps)` → pour chaque bloc repeat, créer un step avec `repetitions` + `steps`
     - Envoyer les steps structurés au lieu des steps plats

4. **Simplifier `api/garmin/[action].js`**
   - Supprimer `stepsAreSimilar`, `findRepeatBlock`, `detectAllRepeatBlocks` (~106 lignes)
   - Simplifier `convertToGarminFormat` : supprimer logique warmup/main/cooldown + détection
   - Simple boucle sur steps : `buildGarminStep` gère déjà les steps imbriqués (L348-358)

**Note** : `buildGarminStep` dans `api/garmin/[action].js` gère déjà `step.steps && step.steps.length > 0` → `WorkoutRepeatStep`, donc la conversion serveur fonctionnera directement avec les steps structurés.

---

## Gestion de compte utilisateur

### Objectifs
1. L'utilisateur doit se connecter (Garmin ou Strava) pour utiliser l'app
2. Stocker le profil et les séances côté serveur (plus localStorage)
3. Savoir qui utilise l'application

### Phase 1 : Auth obligatoire - TERMINÉE
- [x] Créer modèle User dans Vercel KV : `user_{provider}_{id}`
- [x] Créer `api/_lib/auth.js` : utilitaires partagés (session, user CRUD, provider lookup)
- [x] Modifier `api/garmin/[action].js` (callback) : créer User + cookie `enduzo_session`
- [x] Modifier `api/strava/callback.js` : créer User + cookie session + **fix sécurité** (tokens en KV, plus dans URL)
- [x] Créer `api/auth/[action].js` : endpoints `me` et `logout` consolidés
- [x] Créer `src/lib/authContext.tsx` : AuthProvider + hook useAuth()
- [x] Créer `src/components/LoginPage.tsx` : page de connexion Garmin/Strava
- [x] Modifier `src/App.tsx` : auth guard, loading spinner, redirection login
- [x] Modifier `src/components/Header.tsx` : nom utilisateur + bouton déconnexion

**Architecture implémentée :**
- Cookie session : `enduzo_session` (HttpOnly, 90 jours)
- User ID : `{provider}_{providerId}` (ex: `garmin_12345`, `strava_67890`)
- Stockage KV : `user_{userId}` + `provider_lookup_{provider}_{id}`
- Pages protégées : workouts, coach, stats, profile
- Pages publiques : home, privacy, login

### Phase 2 : Profil côté serveur - TERMINÉE
- [x] Consolider Strava OAuth (auth+callback+refresh) en `api/strava/[action].js` (-2 fonctions)
- [x] Créer `api/profile/[action].js` : actions `get` et `save`
- [x] Modèle KV : `profile_{userId}` avec running/cycling/swimming settings
- [x] Modifier `src/lib/athleteProfileStore.ts` :
  - `saveProfile()` : sync localStorage + fire-and-forget vers serveur
  - `syncProfileFromServer()` : merge intelligent (plus récent gagne)
  - `fetchProfileFromServer()` / `saveProfileToServer()` : API calls
- [x] Trigger sync dans `authContext.tsx` après login réussi

### Phase 3 : Séances côté serveur - TERMINÉE
- [x] Créer `api/workouts/[action].js` : actions `list`, `create`, `update`, `delete`, `sync`
- [x] Modèle KV : `workouts_{userId}` avec array de SavedWorkout
- [x] Modifier `src/lib/workoutStore.ts` :
  - Toutes les opérations sync localStorage + fire-and-forget serveur
  - `syncWorkoutsFromServer()` : merge intelligent local/serveur
- [x] Trigger sync dans `authContext.tsx` après login (parallel avec profile)

### Phase 4 : UX Compte & Connectivité - TERMINÉE
**Concept** : Séparer compte Enduzo (identité) des connexions externes (sources de données)
- Compte Enduzo = cookie `enduzo_session`, créé via Garmin OU Strava
- Connexions Garmin/Strava = indépendantes, peuvent rester actives après logout

**Implémenté** :
- [x] Header avec dropdown menu utilisateur (avatar + nom + chevron)
  - Profil athlète → `/profile`
  - Compte & Connectivité → `/account`
  - Déconnexion
- [x] `src/components/AccountPage.tsx` :
  - Infos compte (nom, provider d'origine, date création)
  - Section Connectivité : état Garmin + Strava avec boutons connect/disconnect
  - Zone de danger avec bouton déconnexion
- [x] Route `/account` ajoutée dans App.tsx (page protégée)
- [x] Profil accessible via dropdown (indépendant de Stats/Strava)

### À faire : Récupérer le nom des utilisateurs Garmin
- Actuellement les comptes Garmin ont tous `name: "Athlete"` car on ne fetch pas le profil
- L'API Garmin expose `GET https://apis.garmin.com/wellness-api/rest/user/profile` (scope `CONNECT_READ`, déjà accordé)
- Renvoie `displayName`, `userName`, etc.
- **Implémentation** : dans `handleCallback` de `api/garmin/[action].js`, après l'échange de tokens, appeler cette API et stocker le `displayName` dans le user au lieu du "Athlete" en dur
- Un seul fetch supplémentaire au moment de la connexion, pas d'impact UI

### Hors scope immédiat
- [ ] Migrer conversations coach IA côté serveur
- [ ] Migrer config dashboard côté serveur
- [ ] Admin : voir liste des utilisateurs
- [ ] RGPD : suppression de compte + export données

### Décisions techniques
- **Pas Auth0** : Garmin/Strava OAuth suffisent et sont déjà en place
- **Vercel KV** : suffisant pour le moment (clé-valeur). Migration Postgres possible plus tard
- **Session** : Cookie HttpOnly `enduzo_session` avec userId
- **Limite 12 fonctions** : utiliser `api/_lib/` pour code partagé (ignoré par Vercel), consolider endpoints avec `[action].js`
- **Fonctions actuelles** : 12/12 (limite atteinte)

---

## Autres tâches techniques

### Priorité haute
- [ ] Utiliser le FTP réel de l'athlète au lieu du hardcodé 200W (`server/index.js:207`)
- [ ] Tester les rate limits Groq sous charge

### Priorité moyenne
- [ ] Générateur de plans d'entraînement multi-semaines (périodisation)
- [ ] Indicateurs de fatigue/surentraînement
- [ ] Améliorer détection d'intervalles pour séances complexes (blocs mixtes)

### Nice-to-have
- [ ] Mode sombre
- [ ] Mode hors-ligne (service workers)
- [ ] Export TrainingPeaks/Golden Cheetah

---

## Tâches administratives

### Création auto-entrepreneur (activité libérale)
- [ ] Refaire la demande sur **autoentrepreneur.urssaf.fr** (pas formalites.entreprises.gouv.fr)
- [ ] Sélectionner "Profession libérale" comme nature d'activité
- [ ] Choisir un code APE en 62.xx (développement) ou 70.22Z (conseil)
- [ ] Le dossier ira à l'URSSAF (pas au greffe du tribunal de commerce)

**Note**: La demande précédente a été rejetée car orientée vers activité commerciale au lieu de libérale.
