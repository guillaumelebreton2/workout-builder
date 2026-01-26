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

## Travail récent (janvier 2025)

### Terminé
- [x] **Détection automatique des intervalles** dans l'analyse de séance
  - Fichier principal : `src/lib/activityAnalysisService.ts` → fonction `detectWorkoutStructure()`
  - Algorithme : lissage vitesse → détection points de changement → fusion segments → classification bimodale
  - Support des intervalles basés sur le temps (ex: 1'/2')
- [x] **Serverless functions Vercel** pour toutes les routes API :
  - `api/strava/auth.js`, `callback.js`, `refresh.js`
  - `api/strava/activities/index.js`, `[id]/index.js`, `[id]/streams.js`, `[id]/laps.js`
  - `api/strava/athlete/index.js`, `zones.js`
  - `api/ai/chat.js`
  - `api/sync-garmin.js`
- [x] **Fix OAuth Strava** : Redirection correcte vers enduzo.com en prod
- [x] **Optimisation serverless** : Limite de 12 fonctions sur Hobby plan respectée

### En cours / À améliorer
- [ ] La détection d'intervalles peut encore être améliorée pour des séances complexes (blocs mixtes)
- [ ] Afficher la structure détectée dans l'UI (actuellement juste dans le summary texte)

---

## Gestion de compte utilisateur (à implémenter)

### Objectifs
1. L'utilisateur doit se connecter (Garmin ou Strava) pour utiliser l'app
2. Stocker le profil et les séances côté serveur (plus localStorage)
3. Savoir qui utilise l'application

### Phase 1 : Auth obligatoire (priorité haute)
- [ ] Créer modèle User dans Vercel KV : `user_{id}` avec authProvider, name, email, createdAt
- [ ] Modifier `api/garmin/[action].js` (callback) : créer User + cookie session
- [ ] Modifier `api/strava/callback.js` : créer User + cookie session
- [ ] Créer `api/auth/me.js` : retourne l'utilisateur connecté ou 401
- [ ] Créer `src/components/LoginPage.tsx` : page de connexion
- [ ] Modifier `src/App.tsx` : vérifier auth au chargement, rediriger vers login si non connecté

### Phase 2 : Profil côté serveur (priorité haute)
- [ ] Créer `api/profile.js` : GET/PUT profil athlète
- [ ] Modèle KV : `profile_{userId}` avec running/cycling/swimming settings
- [ ] Modifier `src/lib/athleteProfileStore.ts` : appeler API au lieu de localStorage

### Phase 3 : Séances côté serveur (priorité moyenne)
- [ ] Créer `api/workouts/index.js` : GET (liste) / POST (créer)
- [ ] Créer `api/workouts/[id].js` : PUT / DELETE
- [ ] Modèle KV : `workouts_{userId}` avec array de SavedWorkout
- [ ] Modifier `src/lib/workoutStore.ts` : appeler API au lieu de localStorage

### Phase 4 : UX connexion Garmin (priorité moyenne)
- [ ] Modifier WorkoutForm : message si pas connecté Garmin avant création
- [ ] Modifier Header : afficher nom utilisateur + bouton déconnexion

### Hors scope immédiat
- [ ] Migrer conversations coach IA côté serveur
- [ ] Migrer config dashboard côté serveur
- [ ] Admin : voir liste des utilisateurs
- [ ] RGPD : suppression de compte + export données

### Décisions techniques
- **Pas Auth0** : Garmin/Strava OAuth suffisent et sont déjà en place
- **Vercel KV** : suffisant pour le moment (clé-valeur). Migration Postgres possible plus tard
- **Session** : Cookie HttpOnly `enduzo_session` avec userId

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
