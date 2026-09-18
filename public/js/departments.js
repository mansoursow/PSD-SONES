// Structures de l'organigramme de la Direction Générale SONES (Rapport d'activités au 30 juin 2026, fig. 1).
// `guide` = clé dans data/guides.json ; null = guide générique provisoire.
// `interview: false` = structure affichée dans l'organigramme mais non concernée par les entretiens.

export const DEPARTMENTS = [
  // Sommet
  { slug: 'dg', group: 'top', short: 'DG', name: 'Direction Générale', lead: 'Directeur Général', guide: 'dg' },
  { slug: 'assistante-dg', group: 'staff', short: 'Assistante DG', name: 'Assistante DG', lead: 'Assistante du Directeur Général', interview: false },
  { slug: 'conseiller-special', group: 'staff', short: 'Conseiller Spécial', name: 'Conseiller Spécial', lead: 'Conseiller Spécial du DG', guide: null },

  // Coordination technique & Secrétariat général
  { slug: 'coordonnateur-technique', group: 'ct', short: 'Coordonnateur Technique', name: 'Coordonnateur Technique', lead: 'Coordonnateur Technique', guide: 'ct' },
  { slug: 'secretariat-general', group: 'sg', short: 'SG', name: 'Secrétariat Général', lead: 'Secrétaire Général', guide: 'sg' },
  { slug: 'ssi', group: 'sg-child', short: 'SSI', name: "Service des Systèmes d'Informations", lead: 'Chef du Service des Systèmes d\'Informations', guide: 'ssi' },
  { slug: 'qse', group: 'sg-child', short: 'QSE', name: 'Chargé QSE', lead: 'Chargé Qualité, Sécurité et Environnement', guide: 'qse' },

  // Cellules rattachées à la DG
  { slug: 'cpsm', group: 'cell', short: 'CPSM', name: 'Cellule Passation et Suivi des Marchés', lead: 'Responsable de la Cellule', guide: 'cpsm' },
  { slug: 'ccp', group: 'cell', short: 'CCP', name: 'Cellule de Communication et Partenariats', lead: 'Coordonnateur de la Cellule', guide: 'ccp' },
  { slug: 'caj', group: 'cell', short: 'CAJ', name: 'Cellule Affaires Juridiques', lead: 'Coordonnateur de la Cellule', guide: 'caj' },
  { slug: 'ccgb', group: 'cell', short: 'CCGB', name: 'Cellule Contrôle de Gestion et Budget', lead: 'Coordonnateur de la Cellule', guide: 'ccgb' },
  { slug: 'caicp', group: 'cell', short: 'CAICP', name: 'Cellule Audit Interne et Contrôle Permanent', lead: 'Coordonnateur de la Cellule', guide: 'caicp' },
  { slug: 'cpse', group: 'cell', short: 'CPSE', name: 'Programmation et Suivi-Évaluation', lead: 'Responsable du Service', guide: 'cpse' },

  // Directions et unités de projet
  { slug: 'ugp-kms3', group: 'dir', short: 'UGP KMS3', name: 'Unité de Gestion du Projet KMS3', lead: "Coordonnateur de l'UGP", guide: null },
  { slug: 'ucp-mamelles', group: 'dir', short: 'UCP Mamelles', name: "Unité de Coordination du Projet de Dessalement de l'Eau de mer des Mamelles", lead: "Coordonnateur de l'UCP", guide: null },
  { slug: 'dpes', group: 'dir', short: 'DPES', name: 'Direction Planification et des Études Stratégiques', lead: 'Directeur', guide: null },
  { slug: 'dtp', group: 'dir', short: 'DTP', name: 'Direction des Travaux de Production', lead: 'Directeur', guide: null },
  { slug: 'dtda', group: 'dir', short: 'DTDA', name: "Direction des Travaux de Distribution et d'Accès", lead: 'Directeur', guide: null },
  { slug: 'dpmg', group: 'dir', short: 'DPMG', name: 'Direction du Patrimoine et des Moyens Généraux', lead: 'Directeur', guide: null },
  { slug: 'dce', group: 'dir', short: 'DCE', name: "Direction du Contrôle de l'Exploitation", lead: 'Directeur', guide: null },
  { slug: 'dch', group: 'dir', short: 'DCH', name: 'Direction du Capital Humain', lead: 'Directeur', guide: null },
  { slug: 'dfc', group: 'dir', short: 'DFC', name: 'Direction des Finances et de la Comptabilité', lead: 'Directeur', guide: null },
];

export const bySlug = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, d]));
export const isInterviewed = (d) => d && d.interview !== false;

// Pôles ouverts à la prise de rendez-vous (les autres sont grisés dans l'organigramme).
// Pour ouvrir un pôle, ajoutez son slug ici.
export const ACTIVE = [
  'dg', 'coordonnateur-technique',
  'secretariat-general', 'ssi', 'qse',
  'cpsm', 'ccp', 'caj', 'ccgb', 'caicp', 'cpse',
];
export const isActive = (d) => isInterviewed(d) && ACTIVE.includes(d.slug);

// Créneaux proposés (heure de Dakar = UTC, pas d'heure d'été). Entretiens de 1 h 30 à 2 h.
export const SLOTS = {
  1: ['09:00', '11:30', '15:00'], // lundi
  2: ['09:00', '11:30', '15:00'],
  3: ['09:00', '11:30', '15:00'],
  4: ['09:00', '11:30', '15:00'],
  5: ['09:00', '11:00', '15:30'], // vendredi (pause de la prière)
};
export const DURATION_MIN = 120;
