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
  { slug: 'ugp-kms3', group: 'dir', short: 'UGP KMS3', name: 'Unité de Gestion du Projet KMS3', lead: "Coordonnateur de l'UGP", guide: 'ugp' },
  { slug: 'ucp-mamelles', group: 'dir', short: 'UCP Mamelles', name: "Unité de Coordination du Projet de Dessalement de l'Eau de mer des Mamelles", lead: "Coordonnateur de l'UCP", guide: 'ucp' },
  { slug: 'dpes', group: 'dir', short: 'DPES', name: 'Direction Planification et des Études Stratégiques', lead: 'Directeur', guide: 'dpes' },
  { slug: 'dtp', group: 'dir', short: 'DTP', name: 'Direction des Travaux de Production', lead: 'Directeur', guide: 'dtp' },
  { slug: 'dtda', group: 'dir', short: 'DTDA', name: "Direction des Travaux de Distribution et d'Accès", lead: 'Directeur', guide: 'dtda' },
  { slug: 'dpmg', group: 'dir', short: 'DPMG', name: 'Direction du Patrimoine et des Moyens Généraux', lead: 'Directeur', guide: 'dpmg' },
  { slug: 'dce', group: 'dir', short: 'DCE', name: "Direction du Contrôle de l'Exploitation", lead: 'Directeur', guide: 'dce' },
  { slug: 'dch', group: 'dir', short: 'DCH', name: 'Direction du Capital Humain', lead: 'Directeur', guide: 'dch' },
  { slug: 'dfc', group: 'dir', short: 'DFC', name: 'Direction des Finances et de la Comptabilité', lead: 'Directeur', guide: 'dfc' },
];

// Chefs de projet : hors organigramme. Chaque chef de projet a son propre espace (guide, réponses, rendez-vous),
// identifié par `cp-<empreinte de l'e-mail>`. Le modèle ci-dessous n'est jamais affiché dans l'organigramme.
export const CP_TEMPLATE = { slug: 'chefs-projet', group: 'projet', short: 'Chef de projet', name: 'Chef de projet', lead: 'Chef de projet', guide: 'cp' };
export const CP_RE = /^cp-[a-f0-9]{10}$/;
export const isCp = (slug) => CP_RE.test(slug || '');
// `profile` = { name, project } enregistrés lors de l'inscription du chef de projet.
export const cpDept = (slug, profile = {}) => ({
  ...CP_TEMPLATE,
  slug,
  cp: true,
  short: profile.name || CP_TEMPLATE.short,
  name: `Chef de projet${profile.project ? ` — ${profile.project}` : profile.name ? ` — ${profile.name}` : ''}`,
});

// Projets des chefs de projet : un espace par projet (guide dédié `proj-<clé>` dans guides.json), sans rendez-vous.
// Le chef de projet y entre depuis /#/chefs-projet, renseigne son guide et le soumet.
const PROJECT_LIST = [
  { key: 'bs-extension', short: 'BS & Extension', name: 'Branchements sociaux et extension de réseaux', desc: 'Programme de 137 000 branchements sociaux et extension des réseaux tertiaires' },
  { key: '4cf', short: '4CF', name: 'AEP des Centres Fluviaux du Nord (4CF)', desc: 'Richard-Toll, Dagana, Podor et Matam' },
  { key: 'grande-cote', short: 'Grande Côte', name: 'Dessalement de la Grande Côte', desc: "Usine de 400 000 m³/j, PPP ACWA Power et transition énergétique" },
  { key: 'diogo-fandene', short: 'Diogo–Fandène', name: 'Système Diogo – Tivaouane/Pire – Fandène', desc: 'Forages, réservoirs et adduction' },
  { key: 'diourbel-tamba-touba', short: 'Diourbel · Tambacounda · Touba', name: 'AEP de Diourbel, Tambacounda et MOD de Touba', desc: "Maîtrise d'ouvrage déléguée de Touba" },
  { key: 'gte', short: 'GTE', name: "Grand Transfert d'Eau (GTE)", desc: 'Grand Transfert Bleu, montage PPP et schémas directeurs' },
  { key: 'insulaires-rse-solaire', short: 'Insulaires · RSE · Solaire', name: 'Projets insulaires, RSE et solaires', desc: 'Gorée, Diender, centrales PV KMS et Méouane' },
  { key: 'khombole', short: 'Khombole', name: 'Système Khombole', desc: 'Transfert d’eau douce Khombole – Fandène' },
  { key: 'pisea', short: 'PISEA', name: "Projet intégré de sécurité de l'eau et de l'assainissement (PISEA)", desc: 'Financement Banque mondiale, réduction des pertes et comptage' },
  { key: 'sep-covid-bei', short: 'SEP & COVID-19 (BEI)', name: 'Programme SEP et COVID-19 (BEI)', desc: 'Financement BEI : Saint-Louis, Kaolack, Kolda' },
  { key: 'malicounda', short: 'Malicounda', name: 'Transfert de Malicounda et AEP de la Petite Côte', desc: 'Conduite DN700, réservoirs et surpresseurs' },
];
export const PROJECTS = PROJECT_LIST.map((p) => ({
  slug: `projet-${p.key}`, group: 'projet', project: true, short: p.short, name: p.name, desc: p.desc, lead: 'Chef de projet', guide: `proj-${p.key}`,
}));
export const projectBySlug = Object.fromEntries(PROJECTS.map((p) => [p.slug, p]));
export const isProject = (slug) => slug in projectBySlug;
// Chemin de l'espace d'une structure, d'un projet ou d'un chef de projet « autre projet ».
export const deptPath = (d) => (d.project ? `#/p/${d.slug}` : `#/s/${d.slug}`);

export const bySlug = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, d]));
export const isInterviewed = (d) => d && d.interview !== false;

// Pôles ouverts à la prise de rendez-vous (les autres sont grisés dans l'organigramme).
// Pour ouvrir un pôle, ajoutez son slug ici.
export const ACTIVE = [
  'dg', 'coordonnateur-technique',
  'secretariat-general', 'ssi', 'qse',
  'cpsm', 'ccp', 'caj', 'ccgb', 'caicp', 'cpse',
  'ugp-kms3', 'ucp-mamelles', 'dpes', 'dtp', 'dtda', 'dpmg', 'dce', 'dch', 'dfc',
];
export const isActive = (d) => isInterviewed(d) && ACTIVE.includes(d.slug);

// Entretiens déjà réalisés sans passer par la prise de rendez-vous : affichés « Terminé », non réservables.
export const DONE = ['cpsm', 'ccp', 'ccgb', 'caicp', 'dg', 'ugp-kms3', 'ucp-mamelles', 'dpes', 'dtp'];
export const isDone = (d) => !!d && DONE.includes(d.slug);

// Journées fermées (consultant indisponible) : aucun créneau n'est proposé, la date est grisée.
export const BLOCKED_DATES = [
  '2026-10-06', // mardi 6 octobre — équipe indisponible
];

// Créneaux proposés (heure de Dakar = UTC, pas d'heure d'été). Entretiens de 1 h 30 à 2 h.
export const SLOTS = {
  1: ['09:00', '11:30', '15:00'], // lundi
  2: ['09:00', '11:30', '15:00'],
  3: ['09:00', '11:30', '15:00'],
  4: ['09:00', '11:30', '15:00'],
  5: ['09:00', '11:00', '15:30'], // vendredi (pause de la prière)
};
export const DURATION_MIN = 120;
