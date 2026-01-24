# Workout Builder - Notes de projet

## Contexte
Application web pour créer des séances d'entraînement (course, vélo, natation) avec parsing IA et synchronisation Garmin.
Déployé sur **enduzo.com** (Vercel).

---

## Travail récent (14 janvier 2025)

### Terminé
- [x] **Fix OAuth Strava** : Corrigé la redirection vers localhost au lieu de enduzo.com
  - Modifié `stravaApi.ts` et `aiService.ts` : `import.meta.env.PROD ? '' : 'http://localhost:3001'`
- [x] **Création des serverless functions Vercel** pour toutes les routes API :
  - `api/strava/auth.js`, `callback.js`, `refresh.js`
  - `api/strava/activities/index.js`, `[id]/index.js`, `[id]/streams.js`, `[id]/laps.js`
  - `api/strava/athlete/index.js`, `zones.js`
  - `api/ai/chat.js`
- [x] **Détection automatique des intervalles** dans l'analyse de séance
  - Fichier principal : `src/lib/activityAnalysisService.ts` → fonction `detectWorkoutStructure()`
  - Algorithme : lissage vitesse → détection points de changement → fusion segments → classification bimodale
  - **Fix classification bimodale** : Au lieu d'utiliser l'allure moyenne globale, on cherche le plus grand écart entre les allures triées pour séparer les efforts rapides (95% VMA) des récups actives (60% VMA)

### En cours / À améliorer
- [ ] La détection d'intervalles peut encore être améliorée pour des séances complexes (blocs mixtes)
- [ ] Afficher la structure détectée dans l'UI (actuellement juste dans le summary texte)

---

## Tâches techniques restantes

### Priorité haute
- [ ] **Gestion de compte utilisateur avec Auth0**
  - Authentification (login/signup)
  - Persistance des données utilisateur côté serveur
  - Lier le profil athlète au compte
- [ ] Utiliser le FTP réel de l'athlète au lieu du hardcodé 200W (`server/index.js:207`)
- [ ] Validation/sanitization des credentials Garmin
- [ ] Tester les rate limits Groq sous charge

### Priorité moyenne
- [ ] Archivage des séances côté serveur (actuellement localStorage)
- [ ] Générateur de plans d'entraînement multi-semaines (périodisation)
- [ ] Indicateurs de fatigue/surentraînement
- [ ] Améliorer support natation (CSS, longueur bassin)

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
