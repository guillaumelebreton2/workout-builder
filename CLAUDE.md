# Workout Builder - Notes de projet

## Contexte
Application web pour créer des séances d'entraînement (course, vélo, natation) avec parsing IA et synchronisation Garmin.

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
