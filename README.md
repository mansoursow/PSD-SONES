# SONES · PSD 2026-2030 — Site des entretiens

Site de prise de rendez-vous et de préparation des entretiens stratégiques, organisé autour de l'organigramme de la Direction Générale de la SONES.

- **Accueil = l'organigramme seul**, aux couleurs ADOC. Seuls les pôles listés dans `ACTIVE` (`public/js/departments.js`) sont cliquables et clignotent : actuellement les **20 pôles qui ont un guide dédié** (DG, Coordonnateur Technique, SG, SSI, QSE, CPSM, CCP, CAJ, CCGB, CAICP, CPSE, UGP KMS3, UCP Mamelles, DPES, DTP, DTDA, DPMG, DCE, DCH, DFC). Le Conseiller Spécial (sans guide) est grisé et ne peuvent pas être réservés, même via l'URL. Pour ouvrir un pôle, ajoutez son identifiant dans `ACTIVE`.
- **Parcours** : clic sur le pôle → choix de la date (`/#/s/<pôle>`) → écran « Terminé » avec le bouton « Consulter le questionnaire » → questionnaire (`/#/s/<pôle>/questionnaire`). Le lien de l'e-mail de confirmation mène directement au questionnaire.
- **Réservation** : calendrier, créneaux (lun.–jeu. 09h00 · 11h30 · 15h00, ven. 09h00 · 11h00 · 15h30, heure de Dakar), présentiel ou visio. Un créneau réservé n'est plus proposé aux autres structures.
- **E-mail de confirmation** avec invitation calendrier (.ics) envoyé à l'interviewé(e), avec le consultant en copie. Des e-mails partent aussi en cas de report ou d'annulation.
- **Guide d'entretien** de la structure, avec un champ de réponse par question, enregistré automatiquement. Il est aussi imprimable en PDF.
- **Espace consultant** (`/#/admin`) : tous les rendez-vous et contacts, avancement des réponses, export CSV, compilation imprimable de toutes les réponses, annulation.

- **Chefs de projet (hors organigramme)** : un encart sous l'organigramme mène à `/#/chefs-projet`, qui liste les **11 projets** (`PROJECTS` dans `public/js/departments.js`). Le chef de projet choisit son projet, arrive directement sur son guide `/#/p/projet-<clé>` (guides `proj-*` de `guides.json`), le renseigne (enregistrement automatique) puis le soumet. **Aucun rendez-vous** : la réservation est refusée par l'API pour ces espaces. Il indique son nom (obligatoire pour soumettre) et, facultativement, son e-mail pour recevoir une copie de ses réponses. Les réponses sont communes à un projet (un espace par projet, pas par personne). Les projets apparaissent dans l'espace consultant (avancement, « soumis », compilation, export) mais pas dans la répartition.
- **Autre projet** : un lien « Guide général » en bas de `/#/chefs-projet` conserve le parcours précédent (`/#/chefs-projet/autre` : inscription par e-mail, guide `cp`, rendez-vous possible, `api/chefs-projet.js`, clés `cp:*`) pour les chefs de projet dont le projet n'est pas dans la liste.

20 structures ont leur guide dédié. Le Conseiller Spécial n'est pas ouvert et utiliserait la **trame commune provisoire**.

**Entretiens terminés sans rendez-vous** : la liste `DONE` de `public/js/departments.js` (actuellement DG, CPSM, CCP, CCGB, CAICP, UGP KMS3, UCP Mamelles, DPES, DTP) affiche la structure « ✓ Terminé » dans l'organigramme et bloque toute réservation.

## Mettre à jour les guides

Les guides sont dans `public/data/guides.json` (généré depuis les .docx de `travaux/Guide d'entretien`).
Pour donner un guide dédié à une structure, ajoutez une entrée dans `guides.json`, puis renseignez sa clé dans `guide:` pour la structure concernée dans `public/js/departments.js`.
⚠️ Les réponses sont rattachées aux identifiants de question (`s1q2`, `s3q1c2`…). Si vous modifiez un guide après le début des saisies, **ajoutez** les nouvelles questions en fin de module plutôt que de renuméroter.

## Lancer en local

```bash
npm install
npm run dev
```

Le site est alors accessible sur http://localhost:3000. Les données sont stockées dans `.data/db.json`. Pour l'espace consultant, définissez `ADMIN_PASSWORD` dans `.env`.

## Mise en ligne sur Vercel

1. `vercel` (dans ce dossier) pour créer le projet, puis `vercel --prod`.
2. **Stockage** : Vercel → projet → *Storage* → *Upstash for Redis* (offre gratuite) → *Connect*. Cette étape crée `KV_REST_API_URL` et `KV_REST_API_TOKEN`.
3. **E-mails** : au choix
   - **Resend** (recommandé) : `RESEND_API_KEY` + `MAIL_FROM` avec un domaine vérifié chez Resend ;
   - **SMTP**, par exemple Gmail : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (mot de passe d'application Google).
4. Autres variables : `CONSULTANT_EMAIL`, `ADMIN_PASSWORD`, `SITE_URL` (URL publique), et si besoin `ACCESS_CODE`, `BOOKING_START`, `BOOKING_END` et `MEETING_PLACE` (voir `.env.example`).
5. Redéployez (`vercel --prod`) après avoir ajouté les variables.

`ACCESS_CODE` (recommandé) : si ce code est défini, les visiteurs doivent le saisir une fois avant d'accéder aux pages. Communiquez-le dans l'invitation. Sans ce code, toute personne qui a le lien peut consulter et modifier les réponses d'une structure.
