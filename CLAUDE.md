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
- [x] **Serverless functions Vercel** pour toutes les routes API
- [x] **Fix OAuth Strava** : Redirection correcte vers enduzo.com en prod
- [x] **Optimisation serverless** : Limite de 12 fonctions sur Hobby plan respectée
- [x] **Phase 1 : Auth obligatoire** (voir section dédiée ci-dessous)

### En cours / À améliorer
- [ ] La détection d'intervalles peut encore être améliorée pour des séances complexes (blocs mixtes)
- [ ] Afficher la structure détectée dans l'UI (actuellement juste dans le summary texte)
- [ ] **Tester Phases 1-3 en preview avant merge sur main** (auth + sync profil + sync workouts)

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

### Phase 4 : UX Compte & Connectivité (en cours)
**Concept** : Séparer compte Enduzo (identité) des connexions externes (sources de données)
- Compte Enduzo = cookie `enduzo_session`, créé via Garmin OU Strava
- Connexions Garmin/Strava = indépendantes, peuvent rester actives après logout

**Tâches** :
- [ ] Modifier Header : dropdown menu utilisateur au lieu de nav linéaire
  - Profil athlète
  - Compte & Connectivité
  - Déconnexion
- [ ] Créer `src/components/AccountPage.tsx` :
  - Infos compte (nom, provider d'origine, date création)
  - Section Connectivité : état Garmin + Strava avec boutons connect/disconnect
  - Bouton déconnexion compte
- [ ] Ajouter route `/account` dans App.tsx
- [ ] Profil accessible via dropdown (plus besoin de passer par Stats)

**Navigation cible** :
```
Header: [Accueil] [Workouts] [Coach] [Stats]     [👤 Jean ▼]
                                                     ├─ Profil athlète
                                                     ├─ Compte & Connectivité
                                                     └─ Déconnexion
```

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
