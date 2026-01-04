/**
 * Store pour le profil athlète multi-sport
 * Gère les données personnelles pour Course, Vélo, Natation
 */

import { StravaAthleteZones, stravaApi } from './stravaApi';

// ============== TYPES COMMUNS ==============

export interface HrZone {
  zone: number;      // 1-5
  name: string;
  min: number;       // bpm
  max: number;       // bpm
}

export interface PowerZone {
  zone: number;      // 1-7
  name: string;
  min: number;       // watts
  max: number;       // watts
  percentFtp: { min: number; max: number }; // % FTP
}

export interface PersonalRecord {
  id: string;
  distance: string;     // "5K", "10K", "Semi", "Marathon", "100m", etc.
  time: number;         // secondes
  date?: string;        // ISO date
  sport: 'running' | 'cycling' | 'swimming';
  notes?: string;
}

export interface RaceGoal {
  id: string;
  name: string;
  sport: 'running' | 'cycling' | 'swimming' | 'triathlon';
  distance: string;
  date: string;         // ISO date
  targetTime?: number;  // secondes
  priority: 'A' | 'B' | 'C'; // Priorité de l'objectif
}

// ============== PROFIL COURSE ==============

export interface RunningPaces {
  recovery?: number;      // Récupération (~60-65% VMA)
  easy?: number;          // Endurance fondamentale (~65-75% VMA)
  marathon?: number;      // Allure marathon (~80-85% VMA)
  threshold?: number;     // Seuil (~85-90% VMA)
  intervalLong?: number;  // Fractionné long 3-6min (~95-100% VMA)
  intervalShort?: number; // Fractionné court 30s-2min (~100-110% VMA)
  sprint?: number;        // Sprint <30s (~110-120% VMA)
}

export interface RunningProfile {
  // Données cardiaques
  maxHr?: number;
  restingHr?: number;
  hrZones: HrZone[];
  hrZonesSource: 'strava' | 'manual' | 'calculated';
  stravaZonesLastSync?: string;

  // VMA et allures
  vma?: number;             // VMA en km/h
  vmaUnit: 'kmh' | 'minKm'; // Unité d'affichage préférée
  referencePaces: RunningPaces;
  pacesSource: 'vma' | 'manual';
}

// ============== PROFIL VÉLO ==============

export interface CyclingProfile {
  ftp?: number;             // Functional Threshold Power (watts)
  pma?: number;             // Puissance Maximale Aérobie (watts)
  maxHr?: number;           // FC Max vélo (peut différer de course)
  weight?: number;          // Poids en kg (pour W/kg)
  powerZones: PowerZone[];
  powerZonesSource: 'ftp' | 'manual';
}

// ============== PROFIL NATATION ==============

export interface SwimmingPaces {
  easy?: number;        // Endurance (sec/100m)
  css?: number;         // Critical Swim Speed (sec/100m)
  threshold?: number;   // Seuil (sec/100m)
  interval?: number;    // Fractionné (sec/100m)
  sprint?: number;      // Sprint (sec/100m)
}

export interface SwimmingProfile {
  css?: number;             // Critical Swim Speed en sec/100m
  poolLength: 25 | 50;      // Longueur bassin préférée
  referencePaces: SwimmingPaces;
  pacesSource: 'css' | 'manual';
}

// ============== PROFIL COMPLET ==============

export interface AthleteProfile {
  // Infos générales
  name?: string;
  birthYear?: number;
  weight?: number;          // kg

  // Profils par sport
  running: RunningProfile;
  cycling: CyclingProfile;
  swimming: SwimmingProfile;

  // Records personnels (tous sports)
  personalRecords: PersonalRecord[];

  // Objectifs
  goals: RaceGoal[];

  // Métadonnées
  lastUpdated: string;
}

// ============== CONSTANTES ==============

const STORAGE_KEY = 'workout-builder-athlete-profile';

const HR_ZONE_NAMES = [
  'Récupération',
  'Endurance',
  'Tempo',
  'Seuil',
  'VO2max',
];

const POWER_ZONE_NAMES = [
  'Récupération active',
  'Endurance',
  'Tempo',
  'Seuil',
  'VO2max',
  'Anaérobie',
  'Neuromusculaire',
];

// Zones de puissance Coggan (% FTP)
const POWER_ZONE_PERCENTAGES = [
  { min: 0, max: 55 },      // Z1
  { min: 55, max: 75 },     // Z2
  { min: 75, max: 90 },     // Z3
  { min: 90, max: 105 },    // Z4
  { min: 105, max: 120 },   // Z5
  { min: 120, max: 150 },   // Z6
  { min: 150, max: 999 },   // Z7
];

// ============== FONCTIONS DE CALCUL ==============

/**
 * Calculer les zones FC à partir de FCMax et FC repos (méthode Karvonen)
 */
export function calculateHrZonesFromMax(maxHr: number, restingHr?: number): HrZone[] {
  if (restingHr) {
    // Méthode Karvonen avec réserve cardiaque
    const hrReserve = maxHr - restingHr;
    return [
      { zone: 1, name: HR_ZONE_NAMES[0], min: restingHr, max: Math.round(restingHr + hrReserve * 0.6) },
      { zone: 2, name: HR_ZONE_NAMES[1], min: Math.round(restingHr + hrReserve * 0.6), max: Math.round(restingHr + hrReserve * 0.7) },
      { zone: 3, name: HR_ZONE_NAMES[2], min: Math.round(restingHr + hrReserve * 0.7), max: Math.round(restingHr + hrReserve * 0.8) },
      { zone: 4, name: HR_ZONE_NAMES[3], min: Math.round(restingHr + hrReserve * 0.8), max: Math.round(restingHr + hrReserve * 0.9) },
      { zone: 5, name: HR_ZONE_NAMES[4], min: Math.round(restingHr + hrReserve * 0.9), max: maxHr },
    ];
  }

  // Pourcentages simples de FC max
  return [
    { zone: 1, name: HR_ZONE_NAMES[0], min: 0, max: Math.round(maxHr * 0.6) },
    { zone: 2, name: HR_ZONE_NAMES[1], min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7) },
    { zone: 3, name: HR_ZONE_NAMES[2], min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8) },
    { zone: 4, name: HR_ZONE_NAMES[3], min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9) },
    { zone: 5, name: HR_ZONE_NAMES[4], min: Math.round(maxHr * 0.9), max: maxHr },
  ];
}

/**
 * Calculer les zones de puissance à partir du FTP (zones Coggan)
 */
export function calculatePowerZonesFromFtp(ftp: number): PowerZone[] {
  return POWER_ZONE_PERCENTAGES.map((pct, index) => ({
    zone: index + 1,
    name: POWER_ZONE_NAMES[index],
    min: Math.round(ftp * pct.min / 100),
    max: pct.max === 999 ? 9999 : Math.round(ftp * pct.max / 100),
    percentFtp: pct,
  }));
}

/**
 * Calculer les allures de course à partir de la VMA
 * VMA en km/h, retourne les allures en min/km
 */
export function calculateRunningPacesFromVma(vmaKmh: number): RunningPaces {
  const vmaMinKm = 60 / vmaKmh; // min/km à VMA (100%)

  return {
    recovery: vmaMinKm / 0.625,      // ~62.5% VMA
    easy: vmaMinKm / 0.70,           // ~70% VMA
    marathon: vmaMinKm / 0.825,      // ~82.5% VMA
    threshold: vmaMinKm / 0.875,     // ~87.5% VMA
    intervalLong: vmaMinKm / 0.975,  // ~97.5% VMA
    intervalShort: vmaMinKm / 1.05,  // ~105% VMA
    sprint: vmaMinKm / 1.15,         // ~115% VMA
  };
}

/**
 * Calculer les allures de natation à partir du CSS
 * CSS en sec/100m
 */
export function calculateSwimmingPacesFromCss(cssSec100m: number): SwimmingPaces {
  return {
    easy: Math.round(cssSec100m * 1.15),       // +15%
    css: cssSec100m,
    threshold: Math.round(cssSec100m * 0.95),  // -5%
    interval: Math.round(cssSec100m * 0.90),   // -10%
    sprint: Math.round(cssSec100m * 0.80),     // -20%
  };
}

/**
 * Convertir les zones Strava en notre format
 */
export function convertStravaZones(stravaZones: StravaAthleteZones): HrZone[] {
  if (!stravaZones.heart_rate?.zones) return [];

  return stravaZones.heart_rate.zones.map((zone, index) => ({
    zone: index + 1,
    name: HR_ZONE_NAMES[index] || `Zone ${index + 1}`,
    min: zone.min,
    max: zone.max === -1 ? 999 : zone.max,
  }));
}

// ============== PROFIL PAR DÉFAUT ==============

function getDefaultProfile(): AthleteProfile {
  return {
    running: {
      hrZones: [],
      hrZonesSource: 'calculated',
      vmaUnit: 'kmh',
      referencePaces: {},
      pacesSource: 'vma',
    },
    cycling: {
      powerZones: [],
      powerZonesSource: 'ftp',
    },
    swimming: {
      poolLength: 25,
      referencePaces: {},
      pacesSource: 'css',
    },
    personalRecords: [],
    goals: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ============== PERSISTENCE ==============

export function getAthleteProfile(): AthleteProfile {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return getDefaultProfile();
    const stored = JSON.parse(data);
    // Merge avec défauts pour assurer la compatibilité
    return { ...getDefaultProfile(), ...stored };
  } catch {
    return getDefaultProfile();
  }
}

function saveProfile(profile: AthleteProfile): void {
  profile.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

// ============== ACTIONS COURSE ==============

export function updateRunningMaxHr(maxHr: number, recalculateZones = true): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.maxHr = maxHr;

  if (recalculateZones && profile.running.hrZonesSource !== 'strava') {
    profile.running.hrZones = calculateHrZonesFromMax(maxHr, profile.running.restingHr);
    profile.running.hrZonesSource = 'calculated';
  }

  saveProfile(profile);
  return profile;
}

export function updateRunningRestingHr(restingHr: number, recalculateZones = true): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.restingHr = restingHr;

  if (recalculateZones && profile.running.maxHr && profile.running.hrZonesSource !== 'strava') {
    profile.running.hrZones = calculateHrZonesFromMax(profile.running.maxHr, restingHr);
    profile.running.hrZonesSource = 'calculated';
  }

  saveProfile(profile);
  return profile;
}

export function updateRunningHrZones(zones: HrZone[]): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.hrZones = zones;
  profile.running.hrZonesSource = 'manual';
  saveProfile(profile);
  return profile;
}

export function updateRunningVma(vmaKmh: number, recalculatePaces = true): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.vma = vmaKmh;

  if (recalculatePaces && profile.running.pacesSource !== 'manual') {
    profile.running.referencePaces = calculateRunningPacesFromVma(vmaKmh);
    profile.running.pacesSource = 'vma';
  }

  saveProfile(profile);
  return profile;
}

export function updateRunningVmaUnit(unit: 'kmh' | 'minKm'): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.vmaUnit = unit;
  saveProfile(profile);
  return profile;
}

export function updateRunningPaces(paces: Partial<RunningPaces>): AthleteProfile {
  const profile = getAthleteProfile();
  profile.running.referencePaces = { ...profile.running.referencePaces, ...paces };
  profile.running.pacesSource = 'manual';
  saveProfile(profile);
  return profile;
}

export interface SyncResult {
  success: boolean;
  profile: AthleteProfile;
  message?: string;
}

export async function syncHrZonesFromStrava(): Promise<SyncResult> {
  const profile = getAthleteProfile();

  try {
    const stravaZones = await stravaApi.getAthleteZones();

    if (stravaZones.heart_rate?.zones && stravaZones.heart_rate.zones.length > 0) {
      profile.running.hrZones = convertStravaZones(stravaZones);
      profile.running.hrZonesSource = 'strava';
      profile.running.stravaZonesLastSync = new Date().toISOString();

      // Extraire la FC max de la zone la plus haute
      const maxZone = profile.running.hrZones[profile.running.hrZones.length - 1];
      if (maxZone && maxZone.max < 999) {
        profile.running.maxHr = maxZone.max;
      }

      saveProfile(profile);
      return { success: true, profile, message: 'Zones synchronisées avec succès' };
    } else {
      return {
        success: false,
        profile,
        message: 'Aucune zone FC configurée dans Strava. Configure tes zones dans les paramètres Strava ou entre ta FC Max manuellement.',
      };
    }
  } catch (error) {
    console.error('Erreur sync zones Strava:', error);
    return {
      success: false,
      profile,
      message: 'Erreur de connexion à Strava. Vérifie ta connexion et réessaie.',
    };
  }
}

// ============== ACTIONS VÉLO ==============

export function updateCyclingFtp(ftp: number, recalculateZones = true): AthleteProfile {
  const profile = getAthleteProfile();
  profile.cycling.ftp = ftp;

  if (recalculateZones && profile.cycling.powerZonesSource !== 'manual') {
    profile.cycling.powerZones = calculatePowerZonesFromFtp(ftp);
    profile.cycling.powerZonesSource = 'ftp';
  }

  saveProfile(profile);
  return profile;
}

export function updateCyclingPma(pma: number): AthleteProfile {
  const profile = getAthleteProfile();
  profile.cycling.pma = pma;

  // Si on a la PMA mais pas le FTP, estimer FTP à ~75% PMA
  if (!profile.cycling.ftp && pma) {
    profile.cycling.ftp = Math.round(pma * 0.75);
    profile.cycling.powerZones = calculatePowerZonesFromFtp(profile.cycling.ftp);
  }

  saveProfile(profile);
  return profile;
}

export function updateCyclingMaxHr(maxHr: number): AthleteProfile {
  const profile = getAthleteProfile();
  profile.cycling.maxHr = maxHr;
  saveProfile(profile);
  return profile;
}

export function updateCyclingWeight(weight: number): AthleteProfile {
  const profile = getAthleteProfile();
  profile.cycling.weight = weight;
  saveProfile(profile);
  return profile;
}

export function updateCyclingPowerZones(zones: PowerZone[]): AthleteProfile {
  const profile = getAthleteProfile();
  profile.cycling.powerZones = zones;
  profile.cycling.powerZonesSource = 'manual';
  saveProfile(profile);
  return profile;
}

// ============== ACTIONS NATATION ==============

export function updateSwimmingCss(cssSec100m: number, recalculatePaces = true): AthleteProfile {
  const profile = getAthleteProfile();
  profile.swimming.css = cssSec100m;

  if (recalculatePaces && profile.swimming.pacesSource !== 'manual') {
    profile.swimming.referencePaces = calculateSwimmingPacesFromCss(cssSec100m);
    profile.swimming.pacesSource = 'css';
  }

  saveProfile(profile);
  return profile;
}

export function updateSwimmingPoolLength(length: 25 | 50): AthleteProfile {
  const profile = getAthleteProfile();
  profile.swimming.poolLength = length;
  saveProfile(profile);
  return profile;
}

export function updateSwimmingPaces(paces: Partial<SwimmingPaces>): AthleteProfile {
  const profile = getAthleteProfile();
  profile.swimming.referencePaces = { ...profile.swimming.referencePaces, ...paces };
  profile.swimming.pacesSource = 'manual';
  saveProfile(profile);
  return profile;
}

// ============== ACTIONS RECORDS ==============

export function addPersonalRecord(record: Omit<PersonalRecord, 'id'>): AthleteProfile {
  const profile = getAthleteProfile();
  const newRecord: PersonalRecord = {
    ...record,
    id: `pr-${Date.now()}`,
  };
  profile.personalRecords.push(newRecord);
  saveProfile(profile);
  return profile;
}

export function updatePersonalRecord(id: string, updates: Partial<PersonalRecord>): AthleteProfile {
  const profile = getAthleteProfile();
  const index = profile.personalRecords.findIndex(r => r.id === id);
  if (index >= 0) {
    profile.personalRecords[index] = { ...profile.personalRecords[index], ...updates };
    saveProfile(profile);
  }
  return profile;
}

export function deletePersonalRecord(id: string): AthleteProfile {
  const profile = getAthleteProfile();
  profile.personalRecords = profile.personalRecords.filter(r => r.id !== id);
  saveProfile(profile);
  return profile;
}

// ============== ACTIONS OBJECTIFS ==============

export function addGoal(goal: Omit<RaceGoal, 'id'>): AthleteProfile {
  const profile = getAthleteProfile();
  const newGoal: RaceGoal = {
    ...goal,
    id: `goal-${Date.now()}`,
  };
  profile.goals.push(newGoal);
  // Trier par date
  profile.goals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  saveProfile(profile);
  return profile;
}

export function updateGoal(id: string, updates: Partial<RaceGoal>): AthleteProfile {
  const profile = getAthleteProfile();
  const index = profile.goals.findIndex(g => g.id === id);
  if (index >= 0) {
    profile.goals[index] = { ...profile.goals[index], ...updates };
    profile.goals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    saveProfile(profile);
  }
  return profile;
}

export function deleteGoal(id: string): AthleteProfile {
  const profile = getAthleteProfile();
  profile.goals = profile.goals.filter(g => g.id !== id);
  saveProfile(profile);
  return profile;
}

// ============== UTILITAIRES ==============

export function isProfileConfigured(): boolean {
  const profile = getAthleteProfile();
  return !!(
    profile.running.maxHr ||
    profile.running.vma ||
    profile.cycling.ftp ||
    profile.swimming.css
  );
}

export function resetProfile(): AthleteProfile {
  const profile = getDefaultProfile();
  saveProfile(profile);
  return profile;
}

// ============== IMPORT/EXPORT ==============

export function exportProfile(): string {
  const profile = getAthleteProfile();
  return JSON.stringify(profile, null, 2);
}

export function importProfile(jsonString: string): { success: boolean; message: string; profile?: AthleteProfile } {
  try {
    const imported = JSON.parse(jsonString);

    // Validation basique
    if (!imported || typeof imported !== 'object') {
      return { success: false, message: 'Format JSON invalide' };
    }

    // Vérifier les champs essentiels
    if (!imported.running && !imported.cycling && !imported.swimming) {
      return { success: false, message: 'Le fichier ne semble pas être un profil athlète' };
    }

    // Fusionner avec les valeurs par défaut pour assurer la compatibilité
    const profile: AthleteProfile = {
      ...getDefaultProfile(),
      ...imported,
      running: { ...getDefaultProfile().running, ...imported.running },
      cycling: { ...getDefaultProfile().cycling, ...imported.cycling },
      swimming: { ...getDefaultProfile().swimming, ...imported.swimming },
      personalRecords: imported.personalRecords || [],
      goals: imported.goals || [],
      lastUpdated: new Date().toISOString(),
    };

    saveProfile(profile);
    return { success: true, message: 'Profil importé avec succès', profile };
  } catch (error) {
    console.error('Erreur import profil:', error);
    return { success: false, message: 'Erreur lors de la lecture du fichier JSON' };
  }
}

// ============== AUTO-ESTIMATION ==============

/**
 * Estimer la VMA à partir des records de course
 * Utilise les formules de Mercier/Léger
 */
export function estimateVmaFromRecords(): { vma: number | null; source: string | null } {
  const profile = getAthleteProfile();
  const runningRecords = profile.personalRecords.filter(r => r.sport === 'running');

  if (runningRecords.length === 0) {
    return { vma: null, source: null };
  }

  // Distances connues avec leurs coefficients de conversion VMA
  // VMA = distance (m) / temps (s) * coefficient
  const vmaEstimations: { vma: number; source: string }[] = [];

  for (const record of runningRecords) {
    let distance: number | null = null;
    let coefficient = 1;

    // Parser la distance
    const distLower = record.distance.toLowerCase();
    if (distLower.includes('5k') || distLower === '5000m') {
      distance = 5000;
      coefficient = 1.08; // 5K ~92% VMA
    } else if (distLower.includes('10k') || distLower === '10000m') {
      distance = 10000;
      coefficient = 1.12; // 10K ~89% VMA
    } else if (distLower.includes('semi') || distLower.includes('half') || distLower === '21.1km') {
      distance = 21097;
      coefficient = 1.18; // Semi ~85% VMA
    } else if (distLower.includes('marathon') && !distLower.includes('semi')) {
      distance = 42195;
      coefficient = 1.22; // Marathon ~82% VMA
    } else if (distLower.includes('1500')) {
      distance = 1500;
      coefficient = 1.02; // 1500m ~98% VMA
    } else if (distLower.includes('3000')) {
      distance = 3000;
      coefficient = 1.04; // 3000m ~96% VMA
    } else if (distLower.includes('mile') || distLower === '1609m') {
      distance = 1609;
      coefficient = 1.02;
    }

    if (distance && record.time > 0) {
      // Vitesse moyenne en km/h
      const avgSpeed = (distance / 1000) / (record.time / 3600);
      // VMA estimée
      const estimatedVma = avgSpeed * coefficient;

      if (estimatedVma > 10 && estimatedVma < 28) {
        vmaEstimations.push({
          vma: estimatedVma,
          source: record.distance,
        });
      }
    }
  }

  if (vmaEstimations.length === 0) {
    return { vma: null, source: null };
  }

  // Prendre la meilleure estimation (VMA la plus haute = meilleure performance relative)
  const best = vmaEstimations.reduce((a, b) => a.vma > b.vma ? a : b);
  return {
    vma: Math.round(best.vma * 10) / 10, // Arrondi à 0.1
    source: best.source,
  };
}

/**
 * Estimer le FTP à partir des records de puissance vélo
 * FTP ≈ 95% de la puissance moyenne sur 20min
 */
export function estimateFtpFromRecords(): { ftp: number | null; source: string | null } {
  const profile = getAthleteProfile();
  const cyclingRecords = profile.personalRecords.filter(r => r.sport === 'cycling');

  // Pour l'instant, on ne peut pas vraiment estimer le FTP sans données de puissance
  // On retourne null - une future version pourrait intégrer des données de puissance
  if (cyclingRecords.length === 0) {
    return { ftp: null, source: null };
  }

  // Si on a la PMA, on peut estimer le FTP à ~75%
  if (profile.cycling.pma) {
    return {
      ftp: Math.round(profile.cycling.pma * 0.75),
      source: 'Estimé depuis PMA (75%)',
    };
  }

  return { ftp: null, source: null };
}

/**
 * Appliquer les estimations automatiques au profil
 */
export function applyAutoEstimations(): { applied: string[]; profile: AthleteProfile } {
  const applied: string[] = [];
  let profile = getAthleteProfile();

  // Estimer VMA si pas définie
  if (!profile.running.vma) {
    const vmaEst = estimateVmaFromRecords();
    if (vmaEst.vma) {
      profile = updateRunningVma(vmaEst.vma);
      applied.push(`VMA estimée à ${vmaEst.vma} km/h depuis ${vmaEst.source}`);
    }
  }

  // Estimer FTP si pas défini
  if (!profile.cycling.ftp) {
    const ftpEst = estimateFtpFromRecords();
    if (ftpEst.ftp) {
      profile = updateCyclingFtp(ftpEst.ftp);
      applied.push(`FTP estimé à ${ftpEst.ftp}W depuis ${ftpEst.source}`);
    }
  }

  return { applied, profile };
}

// ============== EXPORT ==============

export const athleteProfileStore = {
  getProfile: getAthleteProfile,
  saveProfile,
  isConfigured: isProfileConfigured,
  resetProfile,

  // Course
  updateRunningMaxHr,
  updateRunningRestingHr,
  updateRunningHrZones,
  updateRunningVma,
  updateRunningVmaUnit,
  updateRunningPaces,
  syncHrZonesFromStrava,

  // Vélo
  updateCyclingFtp,
  updateCyclingPma,
  updateCyclingMaxHr,
  updateCyclingWeight,
  updateCyclingPowerZones,

  // Natation
  updateSwimmingCss,
  updateSwimmingPoolLength,
  updateSwimmingPaces,

  // Records
  addPersonalRecord,
  updatePersonalRecord,
  deletePersonalRecord,

  // Objectifs
  addGoal,
  updateGoal,
  deleteGoal,

  // Calculs
  calculateHrZonesFromMax,
  calculatePowerZonesFromFtp,
  calculateRunningPacesFromVma,
  calculateSwimmingPacesFromCss,

  // Import/Export
  exportProfile,
  importProfile,

  // Auto-estimation
  estimateVmaFromRecords,
  estimateFtpFromRecords,
  applyAutoEstimations,
};
