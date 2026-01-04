import React, { useState, useEffect, useRef } from 'react';
import {
  AthleteProfile,
  HrZone,
  PowerZone,
  PersonalRecord,
  RaceGoal,
  RunningPaces,
  athleteProfileStore,
  exportProfile,
  importProfile,
} from '../lib/athleteProfileStore';
import { stravaApi, StravaScopeError } from '../lib/stravaApi';

type TabType = 'running' | 'cycling' | 'swimming' | 'goals';

interface AthleteProfilePageProps {
  onNavigate?: (page: 'home' | 'workouts' | 'coach' | 'stats' | 'profile') => void;
}

export function AthleteProfilePage({ onNavigate }: AthleteProfilePageProps) {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('running');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger le profil
  useEffect(() => {
    setProfile(athleteProfileStore.getProfile());
  }, []);

  const refreshProfile = () => {
    setProfile(athleteProfileStore.getProfile());
  };

  // Clear notification after delay
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Export profile
  const handleExport = () => {
    const json = exportProfile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profil-athlete-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ type: 'success', message: 'Profil exporté' });
    setShowSettings(false);
  };

  // Import profile
  const handleImportClick = () => {
    fileInputRef.current?.click();
    setShowSettings(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importProfile(content);
      if (result.success) {
        setNotification({ type: 'success', message: result.message });
        setProfile(result.profile || athleteProfileStore.getProfile());
      } else {
        setNotification({ type: 'error', message: result.message });
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = '';
  };

  // Auto-estimation
  const handleAutoEstimate = () => {
    const result = athleteProfileStore.applyAutoEstimations();
    if (result.applied.length > 0) {
      setNotification({ type: 'success', message: result.applied.join('. ') });
      setProfile(result.profile);
    } else {
      setNotification({ type: 'error', message: 'Aucune estimation possible. Ajoute des records pour estimer VMA/FTP.' });
    }
    setShowSettings(false);
  };

  // Reset profile
  const handleResetProfile = () => {
    if (confirm('Supprimer toutes les données du profil ? Cette action est irréversible.')) {
      athleteProfileStore.resetProfile();
      setProfile(athleteProfileStore.getProfile());
      setNotification({ type: 'success', message: 'Profil réinitialisé' });
    }
    setShowSettings(false);
  };

  // Sync Strava zones
  const handleSyncStrava = async () => {
    if (!stravaApi.isConnected()) {
      setSyncError('Connecte-toi à Strava d\'abord');
      return;
    }

    setSyncing(true);
    setSyncError(null);
    setNeedsReauth(false);

    try {
      const result = await athleteProfileStore.syncHrZonesFromStrava();
      setProfile(result.profile);
      if (!result.success) {
        setSyncError(result.message || 'Impossible de récupérer les zones');
      }
    } catch (err) {
      console.error('Erreur sync Strava:', err);
      if (err instanceof StravaScopeError) {
        setSyncError('Permission refusée. Reconnecte-toi à Strava.');
        setNeedsReauth(true);
      } else {
        setSyncError('Erreur de synchronisation');
      }
    } finally {
      setSyncing(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'running',
      label: 'Course',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'cycling',
      label: 'Vélo',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} />
          <circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17.5l-2-6 4-3 3 1.5M15 9.5l-1-4h3" />
        </svg>
      ),
    },
    {
      id: 'swimming',
      label: 'Natation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2.5 2 5 2 7.5 0s5-2 7.5 0M3 19c2.5 2 5 2 7.5 0s5-2 7.5 0M5 11l3-3 4 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'goals',
      label: 'Objectifs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
  ];

  if (!profile) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profil Athlète</h1>
            <p className="text-gray-600">Configure tes zones et allures de référence</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Settings dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Options"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {showSettings && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSettings(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <div className="py-1">
                      <button
                        onClick={handleAutoEstimate}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Auto-estimer VMA/FTP
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={handleExport}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Exporter le profil
                      </button>
                      <button
                        onClick={handleImportClick}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Importer un profil
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={handleResetProfile}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Réinitialiser le profil
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('stats')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Retour
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-xl p-2 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'running' && (
            <RunningTab
              profile={profile}
              onUpdate={refreshProfile}
              syncing={syncing}
              syncError={syncError}
              needsReauth={needsReauth}
              onSyncStrava={handleSyncStrava}
              onReauth={() => stravaApi.forceReauthentication()}
            />
          )}
          {activeTab === 'cycling' && (
            <CyclingTab profile={profile} onUpdate={refreshProfile} />
          )}
          {activeTab === 'swimming' && (
            <SwimmingTab profile={profile} onUpdate={refreshProfile} />
          )}
          {activeTab === 'goals' && (
            <GoalsTab profile={profile} onUpdate={refreshProfile} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============== RUNNING TAB ==============

interface RunningTabProps {
  profile: AthleteProfile;
  onUpdate: () => void;
  syncing: boolean;
  syncError: string | null;
  needsReauth: boolean;
  onSyncStrava: () => void;
  onReauth: () => void;
}

function RunningTab({ profile, onUpdate, syncing, syncError, needsReauth, onSyncStrava, onReauth }: RunningTabProps) {
  const [maxHr, setMaxHr] = useState(profile.running.maxHr?.toString() || '');
  const [restingHr, setRestingHr] = useState(profile.running.restingHr?.toString() || '');
  const [vma, setVma] = useState(profile.running.vma?.toString() || '');
  const [editingZones, setEditingZones] = useState(false);
  const [tempZones, setTempZones] = useState<HrZone[]>([]);
  const [showAddRecord, setShowAddRecord] = useState(false);

  const runningRecords = profile.personalRecords.filter(r => r.sport === 'running');

  const handleSaveMaxHr = () => {
    const value = parseInt(maxHr);
    if (value && value > 100 && value < 250) {
      athleteProfileStore.updateRunningMaxHr(value);
      onUpdate();
    }
  };

  const handleSaveRestingHr = () => {
    const value = parseInt(restingHr);
    if (value && value > 30 && value < 120) {
      athleteProfileStore.updateRunningRestingHr(value);
      onUpdate();
    }
  };

  const handleSaveVma = () => {
    const value = parseFloat(vma);
    if (value && value > 8 && value < 30) {
      athleteProfileStore.updateRunningVma(value);
      onUpdate();
    }
  };

  const handleEditZones = () => {
    setTempZones([...profile.running.hrZones]);
    setEditingZones(true);
  };

  const handleSaveZones = () => {
    athleteProfileStore.updateRunningHrZones(tempZones);
    setEditingZones(false);
    onUpdate();
  };

  const handleZoneChange = (index: number, field: 'min' | 'max', value: number) => {
    const newZones = [...tempZones];
    newZones[index] = { ...newZones[index], [field]: value };
    setTempZones(newZones);
  };

  return (
    <div className="space-y-8">
      {/* Section FC */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fréquence Cardiaque</h3>

        {/* Sync Strava */}
        <div className="bg-orange-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h4 className="font-medium text-gray-900">Synchroniser depuis Strava</h4>
              <p className="text-sm text-gray-600">Récupère tes zones FC configurées dans Strava</p>
              {profile.running.stravaZonesLastSync && (
                <p className="text-xs text-gray-500 mt-1">
                  Dernière sync: {new Date(profile.running.stravaZonesLastSync).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <button
              onClick={onSyncStrava}
              disabled={syncing}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Sync...' : 'Synchroniser'}
            </button>
          </div>
          {syncError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{syncError}</p>
              {needsReauth && (
                <button
                  onClick={onReauth}
                  className="mt-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  Reconnecter Strava
                </button>
              )}
            </div>
          )}
        </div>

        {/* FC Max et repos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">FC Max (bpm)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={maxHr}
                onChange={(e) => setMaxHr(e.target.value)}
                placeholder="Ex: 185"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveMaxHr}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Formule approximative: 220 - âge</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">FC Repos (bpm)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={restingHr}
                onChange={(e) => setRestingHr(e.target.value)}
                placeholder="Ex: 55"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveRestingHr}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Mesurée au réveil, au repos complet</p>
          </div>
        </div>

        {/* Zones FC */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Zones de fréquence cardiaque</label>
            <div className="flex items-center gap-2">
              {profile.running.hrZonesSource && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  profile.running.hrZonesSource === 'strava' ? 'bg-orange-100 text-orange-700' :
                  profile.running.hrZonesSource === 'manual' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {profile.running.hrZonesSource === 'strava' && 'Strava'}
                  {profile.running.hrZonesSource === 'manual' && 'Manuel'}
                  {profile.running.hrZonesSource === 'calculated' && 'Calculé'}
                </span>
              )}
              {profile.running.hrZones.length > 0 && !editingZones && (
                <button
                  onClick={handleEditZones}
                  className="text-xs px-2 py-1 text-orange-600 hover:bg-orange-50 rounded"
                >
                  Modifier
                </button>
              )}
            </div>
          </div>

          {profile.running.hrZones.length > 0 ? (
            editingZones ? (
              <div className="space-y-2">
                {tempZones.map((zone, index) => (
                  <div key={zone.zone} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      zone.zone === 1 ? 'bg-gray-400' :
                      zone.zone === 2 ? 'bg-blue-400' :
                      zone.zone === 3 ? 'bg-green-500' :
                      zone.zone === 4 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}>
                      Z{zone.zone}
                    </div>
                    <span className="text-sm font-medium w-24">{zone.name}</span>
                    <input
                      type="number"
                      value={zone.min}
                      onChange={(e) => handleZoneChange(index, 'min', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={zone.max === 999 ? '' : zone.max}
                      onChange={(e) => handleZoneChange(index, 'max', parseInt(e.target.value) || 999)}
                      placeholder="max"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span className="text-sm text-gray-500">bpm</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSaveZones}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setEditingZones(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.running.hrZones.map((zone) => (
                  <div key={zone.zone} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      zone.zone === 1 ? 'bg-gray-400' :
                      zone.zone === 2 ? 'bg-blue-400' :
                      zone.zone === 3 ? 'bg-green-500' :
                      zone.zone === 4 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}>
                      Z{zone.zone}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{zone.name}</p>
                      <p className="text-xs text-gray-500">{zone.min} - {zone.max === 999 ? 'max' : zone.max} bpm</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
              Renseigne ta FC Max pour calculer les zones ou synchronise depuis Strava
            </div>
          )}
        </div>
      </section>

      {/* Section VMA et Allures */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">VMA et Allures</h3>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">VMA</label>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => {
                  athleteProfileStore.updateRunningVmaUnit('kmh');
                  onUpdate();
                }}
                className={`px-2 py-1 rounded ${profile.running.vmaUnit === 'kmh' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                km/h
              </button>
              <button
                onClick={() => {
                  athleteProfileStore.updateRunningVmaUnit('minKm');
                  onUpdate();
                }}
                className={`px-2 py-1 rounded ${profile.running.vmaUnit === 'minKm' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                min/km
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={vma}
              onChange={(e) => setVma(e.target.value)}
              placeholder={profile.running.vmaUnit === 'kmh' ? 'Ex: 16.5' : 'Ex: 3.6'}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={handleSaveVma}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Calculer allures
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {profile.running.vma && (
              profile.running.vmaUnit === 'kmh'
                ? `Équivaut à ${formatPace(60 / profile.running.vma)}/km`
                : `Équivaut à ${profile.running.vma.toFixed(1)} km/h`
            )}
          </p>
        </div>

        {/* Allures de référence */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Allures de référence</label>
            {profile.running.referencePaces && Object.keys(profile.running.referencePaces).length > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                profile.running.pacesSource === 'vma' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {profile.running.pacesSource === 'vma' ? 'Calculé VMA' : 'Manuel'}
              </span>
            )}
          </div>
        </div>
        {profile.running.referencePaces && Object.keys(profile.running.referencePaces).length > 0 ? (
          <EditablePaceGrid paces={profile.running.referencePaces} onUpdate={onUpdate} />
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Renseigne ta VMA pour calculer les allures de référence
          </div>
        )}

        {/* Info VMA */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Guide des allures</h4>
          <div className="text-sm text-blue-800 grid grid-cols-2 gap-1">
            <p>Récupération: 60-65% VMA</p>
            <p>Endurance (EF): 65-75% VMA</p>
            <p>Marathon: 80-85% VMA</p>
            <p>Seuil: 85-90% VMA</p>
            <p>Frac. long (3-6min): 95-100% VMA</p>
            <p>Frac. court (30s-2min): 100-110% VMA</p>
          </div>
        </div>
      </section>

      {/* Section Records */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Records Personnels</h3>
          <button
            onClick={() => setShowAddRecord(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>

        {runningRecords.length > 0 ? (
          <div className="space-y-2">
            {runningRecords.map((record) => (
              <RecordRow key={record.id} record={record} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Aucun record enregistré. Ajoute tes meilleurs temps !
          </div>
        )}

        {showAddRecord && (
          <AddRecordModal
            sport="running"
            onClose={() => setShowAddRecord(false)}
            onAdd={onUpdate}
          />
        )}
      </section>
    </div>
  );
}

// ============== CYCLING TAB ==============

interface CyclingTabProps {
  profile: AthleteProfile;
  onUpdate: () => void;
}

function CyclingTab({ profile, onUpdate }: CyclingTabProps) {
  const [ftp, setFtp] = useState(profile.cycling.ftp?.toString() || '');
  const [pma, setPma] = useState(profile.cycling.pma?.toString() || '');
  const [weight, setWeight] = useState(profile.cycling.weight?.toString() || '');
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [editingPowerZones, setEditingPowerZones] = useState(false);
  const [tempPowerZones, setTempPowerZones] = useState<PowerZone[]>([]);

  const cyclingRecords = profile.personalRecords.filter(r => r.sport === 'cycling');

  const handleSaveFtp = () => {
    const value = parseInt(ftp);
    if (value && value > 50 && value < 500) {
      athleteProfileStore.updateCyclingFtp(value);
      onUpdate();
    }
  };

  const handleSavePma = () => {
    const value = parseInt(pma);
    if (value && value > 100 && value < 600) {
      athleteProfileStore.updateCyclingPma(value);
      onUpdate();
    }
  };

  const handleSaveWeight = () => {
    const value = parseFloat(weight);
    if (value && value > 30 && value < 200) {
      athleteProfileStore.updateCyclingWeight(value);
      onUpdate();
    }
  };

  const handleEditPowerZones = () => {
    setTempPowerZones([...profile.cycling.powerZones]);
    setEditingPowerZones(true);
  };

  const handleSavePowerZones = () => {
    athleteProfileStore.updateCyclingPowerZones(tempPowerZones);
    setEditingPowerZones(false);
    onUpdate();
  };

  const handlePowerZoneChange = (index: number, field: 'min' | 'max', value: number) => {
    const newZones = [...tempPowerZones];
    newZones[index] = { ...newZones[index], [field]: value };
    setTempPowerZones(newZones);
  };

  return (
    <div className="space-y-8">
      {/* Section Puissance */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Puissance</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">FTP (watts)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={ftp}
                onChange={(e) => setFtp(e.target.value)}
                placeholder="Ex: 250"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveFtp}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Functional Threshold Power - puissance sur 1h</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PMA (watts)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={pma}
                onChange={(e) => setPma(e.target.value)}
                placeholder="Ex: 330"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSavePma}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Puissance Maximale Aérobie - puissance sur 5min</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Poids (kg)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Ex: 70"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveWeight}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {profile.cycling.ftp && profile.cycling.weight &&
                `${(profile.cycling.ftp / profile.cycling.weight).toFixed(2)} W/kg`
              }
            </p>
          </div>
        </div>

        {/* Zones de puissance */}
        {profile.cycling.powerZones.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Zones de puissance (Coggan)</h4>
              <div className="flex items-center gap-2">
                {profile.cycling.powerZonesSource && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    profile.cycling.powerZonesSource === 'ftp' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {profile.cycling.powerZonesSource === 'ftp' ? 'Calculé FTP' : 'Manuel'}
                  </span>
                )}
                {!editingPowerZones && (
                  <button
                    onClick={handleEditPowerZones}
                    className="text-xs px-2 py-1 text-orange-600 hover:bg-orange-50 rounded"
                  >
                    Modifier
                  </button>
                )}
              </div>
            </div>

            {editingPowerZones ? (
              <div className="space-y-2">
                {tempPowerZones.map((zone, index) => (
                  <div key={zone.zone} className={`flex items-center gap-3 p-2 rounded-lg ${
                    zone.zone === 1 ? 'bg-gray-100' :
                    zone.zone === 2 ? 'bg-blue-100' :
                    zone.zone === 3 ? 'bg-green-100' :
                    zone.zone === 4 ? 'bg-yellow-100' :
                    zone.zone === 5 ? 'bg-orange-100' :
                    zone.zone === 6 ? 'bg-red-100' :
                    'bg-purple-100'
                  }`}>
                    <span className="text-sm font-medium w-32">Z{zone.zone} {zone.name}</span>
                    <input
                      type="number"
                      value={zone.min}
                      onChange={(e) => handlePowerZoneChange(index, 'min', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={zone.max === 9999 ? '' : zone.max}
                      onChange={(e) => handlePowerZoneChange(index, 'max', parseInt(e.target.value) || 9999)}
                      placeholder="∞"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span className="text-sm text-gray-500">W</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSavePowerZones}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setEditingPowerZones(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {profile.cycling.powerZones.map((zone) => (
                  <div key={zone.zone} className={`p-3 rounded-lg ${
                    zone.zone === 1 ? 'bg-gray-100' :
                    zone.zone === 2 ? 'bg-blue-100' :
                    zone.zone === 3 ? 'bg-green-100' :
                    zone.zone === 4 ? 'bg-yellow-100' :
                    zone.zone === 5 ? 'bg-orange-100' :
                    zone.zone === 6 ? 'bg-red-100' :
                    'bg-purple-100'
                  }`}>
                    <p className="text-xs font-medium opacity-75">Z{zone.zone} - {zone.name}</p>
                    <p className="text-lg font-mono font-bold">
                      {zone.min}-{zone.max === 9999 ? '∞' : zone.max}W
                    </p>
                    <p className="text-xs opacity-60">{zone.percentFtp.min}-{zone.percentFtp.max === 999 ? '∞' : zone.percentFtp.max}% FTP</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Renseigne ton FTP pour calculer les zones de puissance
          </div>
        )}
      </section>

      {/* Section Records */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Records Personnels</h3>
          <button
            onClick={() => setShowAddRecord(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>

        {cyclingRecords.length > 0 ? (
          <div className="space-y-2">
            {cyclingRecords.map((record) => (
              <RecordRow key={record.id} record={record} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Aucun record enregistré
          </div>
        )}

        {showAddRecord && (
          <AddRecordModal
            sport="cycling"
            onClose={() => setShowAddRecord(false)}
            onAdd={onUpdate}
          />
        )}
      </section>
    </div>
  );
}

// ============== SWIMMING TAB ==============

interface SwimmingTabProps {
  profile: AthleteProfile;
  onUpdate: () => void;
}

function SwimmingTab({ profile, onUpdate }: SwimmingTabProps) {
  const [cssMin, setCssMin] = useState('');
  const [cssSec, setCssSec] = useState('');
  const [showAddRecord, setShowAddRecord] = useState(false);

  const swimmingRecords = profile.personalRecords.filter(r => r.sport === 'swimming');

  // Init CSS display
  useEffect(() => {
    if (profile.swimming.css) {
      setCssMin(Math.floor(profile.swimming.css / 60).toString());
      setCssSec((profile.swimming.css % 60).toString().padStart(2, '0'));
    }
  }, [profile.swimming.css]);

  const handleSaveCss = () => {
    const min = parseInt(cssMin) || 0;
    const sec = parseInt(cssSec) || 0;
    const totalSec = min * 60 + sec;
    if (totalSec > 60 && totalSec < 300) {
      athleteProfileStore.updateSwimmingCss(totalSec);
      onUpdate();
    }
  };

  const handlePoolLengthChange = (length: 25 | 50) => {
    athleteProfileStore.updateSwimmingPoolLength(length);
    onUpdate();
  };

  return (
    <div className="space-y-8">
      {/* Section CSS */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Critical Swim Speed (CSS)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CSS (allure / 100m)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cssMin}
                onChange={(e) => setCssMin(e.target.value)}
                placeholder="1"
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center"
              />
              <span className="text-gray-500">:</span>
              <input
                type="number"
                value={cssSec}
                onChange={(e) => setCssSec(e.target.value)}
                placeholder="45"
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center"
              />
              <span className="text-sm text-gray-500">/100m</span>
              <button
                onClick={handleSaveCss}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                OK
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Test CSS: (T400 - T200) / 2 où T400 et T200 sont les temps au 400m et 200m
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Longueur bassin</label>
            <div className="flex gap-2">
              <button
                onClick={() => handlePoolLengthChange(25)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  profile.swimming.poolLength === 25
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                25m
              </button>
              <button
                onClick={() => handlePoolLengthChange(50)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  profile.swimming.poolLength === 50
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                50m
              </button>
            </div>
          </div>
        </div>

        {/* Allures de référence */}
        {profile.swimming.referencePaces && profile.swimming.css ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SwimPaceCard label="Endurance" pace={profile.swimming.referencePaces.easy} color="blue" />
            <SwimPaceCard label="CSS" pace={profile.swimming.referencePaces.css} color="green" />
            <SwimPaceCard label="Seuil" pace={profile.swimming.referencePaces.threshold} color="yellow" />
            <SwimPaceCard label="Fractionné" pace={profile.swimming.referencePaces.interval} color="orange" />
            <SwimPaceCard label="Sprint" pace={profile.swimming.referencePaces.sprint} color="red" />
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Renseigne ton CSS pour calculer les allures de référence
          </div>
        )}

        {/* Info CSS */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Comment calculer ton CSS ?</h4>
          <div className="text-sm text-blue-800">
            <p>1. Nage un 400m à fond, note le temps (T400)</p>
            <p>2. Après 10min de récup, nage un 200m à fond (T200)</p>
            <p>3. CSS = (T400 - T200) / 2</p>
            <p className="mt-2 text-blue-600">Exemple: T400 = 6:00, T200 = 2:40 → CSS = (360-160)/2 = 100s = 1:40/100m</p>
          </div>
        </div>
      </section>

      {/* Section Records */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Records Personnels</h3>
          <button
            onClick={() => setShowAddRecord(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>

        {swimmingRecords.length > 0 ? (
          <div className="space-y-2">
            {swimmingRecords.map((record) => (
              <RecordRow key={record.id} record={record} onUpdate={onUpdate} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
            Aucun record enregistré
          </div>
        )}

        {showAddRecord && (
          <AddRecordModal
            sport="swimming"
            onClose={() => setShowAddRecord(false)}
            onAdd={onUpdate}
          />
        )}
      </section>
    </div>
  );
}

// ============== GOALS TAB ==============

interface GoalsTabProps {
  profile: AthleteProfile;
  onUpdate: () => void;
}

function GoalsTab({ profile, onUpdate }: GoalsTabProps) {
  const [showAddGoal, setShowAddGoal] = useState(false);

  // Séparer objectifs passés et futurs
  const now = new Date();
  const upcomingGoals = profile.goals.filter(g => new Date(g.date) >= now);
  const pastGoals = profile.goals.filter(g => new Date(g.date) < now);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Mes Objectifs</h3>
        <button
          onClick={() => setShowAddGoal(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Objectifs à venir */}
      {upcomingGoals.length > 0 ? (
        <div className="space-y-3">
          {upcomingGoals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} onUpdate={onUpdate} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 p-8 bg-gray-50 rounded-lg text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <p>Aucun objectif défini</p>
          <p className="text-xs mt-1">Ajoute une course ou un défi à venir !</p>
        </div>
      )}

      {/* Objectifs passés */}
      {pastGoals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-3">Passés</h4>
          <div className="space-y-2 opacity-60">
            {pastGoals.map((goal) => (
              <GoalRow key={goal.id} goal={goal} onUpdate={onUpdate} isPast />
            ))}
          </div>
        </div>
      )}

      {showAddGoal && (
        <AddGoalModal
          onClose={() => setShowAddGoal(false)}
          onAdd={onUpdate}
        />
      )}
    </div>
  );
}

// ============== COMPOSANTS UTILITAIRES ==============

function PaceCard({ label, pace, pct, color }: { label: string; pace?: number; pct: string; color: string }) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-mono font-bold">
        {pace ? formatPace(pace) : '--'}/km
      </p>
      <p className="text-xs opacity-60">{pct} VMA</p>
    </div>
  );
}

// Grille d'allures éditables
function EditablePaceGrid({ paces, onUpdate }: { paces: RunningPaces; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [tempPaces, setTempPaces] = useState<RunningPaces>({});

  const paceFields: { key: keyof RunningPaces; label: string; color: string; pct: string }[] = [
    { key: 'recovery', label: 'Récupération', color: 'gray', pct: '~62%' },
    { key: 'easy', label: 'Endurance', color: 'blue', pct: '~70%' },
    { key: 'marathon', label: 'Marathon', color: 'green', pct: '~82%' },
    { key: 'threshold', label: 'Seuil', color: 'yellow', pct: '~87%' },
    { key: 'intervalLong', label: 'Frac. long', color: 'orange', pct: '~97%' },
    { key: 'intervalShort', label: 'Frac. court', color: 'red', pct: '~105%' },
    { key: 'sprint', label: 'Sprint', color: 'purple', pct: '~115%' },
  ];

  const handleStartEdit = () => {
    setTempPaces({ ...paces });
    setEditing(true);
  };

  const handleSave = () => {
    athleteProfileStore.updateRunningPaces(tempPaces);
    setEditing(false);
    onUpdate();
  };

  const handlePaceChange = (key: keyof RunningPaces, value: string) => {
    // Parse min:sec format
    const parts = value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      const paceMinKm = mins + secs / 60;
      if (paceMinKm > 2 && paceMinKm < 15) {
        setTempPaces(prev => ({ ...prev, [key]: paceMinKm }));
      }
    }
  };

  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
    green: 'bg-green-100 text-green-700 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {paceFields.map(({ key, label, color }) => (
            <div key={key} className={`p-3 rounded-lg border ${colorClasses[color]}`}>
              <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
              <input
                type="text"
                defaultValue={tempPaces[key] ? formatPace(tempPaces[key]!) : ''}
                onChange={(e) => handlePaceChange(key, e.target.value)}
                placeholder="5:00"
                className="w-full px-2 py-1 text-lg font-mono font-bold bg-white border border-gray-300 rounded text-center"
              />
              <p className="text-xs opacity-60 mt-1">/km</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Enregistrer
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {paceFields.map(({ key, label, color, pct }) => (
          <PaceCard key={key} label={label} pace={paces[key]} pct={pct} color={color} />
        ))}
      </div>
      <button
        onClick={handleStartEdit}
        className="mt-3 text-sm text-orange-600 hover:text-orange-700"
      >
        Modifier les allures manuellement
      </button>
    </div>
  );
}

function SwimPaceCard({ label, pace, color }: { label: string; pace?: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-mono font-bold">
        {pace ? formatSwimPace(pace) : '--'}
      </p>
      <p className="text-xs opacity-60">/100m</p>
    </div>
  );
}

function RecordRow({ record, onUpdate }: { record: PersonalRecord; onUpdate: () => void }) {
  const handleDelete = () => {
    if (confirm('Supprimer ce record ?')) {
      athleteProfileStore.deletePersonalRecord(record.id);
      onUpdate();
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="font-medium">{record.distance}</p>
        {record.date && (
          <p className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString('fr-FR')}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <p className="font-mono font-bold">{formatTime(record.time)}</p>
        <button
          onClick={handleDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function GoalRow({ goal, onUpdate, isPast }: { goal: RaceGoal; onUpdate: () => void; isPast?: boolean }) {
  const handleDelete = () => {
    if (confirm('Supprimer cet objectif ?')) {
      athleteProfileStore.deleteGoal(goal.id);
      onUpdate();
    }
  };

  const daysUntil = Math.ceil((new Date(goal.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const sportIcons: Record<string, string> = {
    running: '🏃',
    cycling: '🚴',
    swimming: '🏊',
    triathlon: '🏆',
  };

  const priorityColors: Record<string, string> = {
    A: 'bg-red-100 text-red-700 border-red-300',
    B: 'bg-orange-100 text-orange-700 border-orange-300',
    C: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  return (
    <div className={`p-4 bg-white border rounded-lg ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{sportIcons[goal.sport]}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{goal.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityColors[goal.priority]}`}>
                {goal.priority}
              </span>
            </div>
            <p className="text-sm text-gray-600">{goal.distance}</p>
            <p className="text-sm text-gray-500">
              {new Date(goal.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {!isPast && daysUntil > 0 && (
                <span className="ml-2 text-orange-600 font-medium">J-{daysUntil}</span>
              )}
            </p>
            {goal.targetTime && (
              <p className="text-sm text-orange-600 mt-1">Objectif: {formatTime(goal.targetTime)}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============== MODALS ==============

interface AddRecordModalProps {
  sport: 'running' | 'cycling' | 'swimming';
  onClose: () => void;
  onAdd: () => void;
}

function AddRecordModal({ sport, onClose, onAdd }: AddRecordModalProps) {
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [date, setDate] = useState('');

  const distanceOptions: Record<string, string[]> = {
    running: ['5K', '10K', 'Semi-marathon', 'Marathon', '1500m', '3000m', '1 mile'],
    cycling: ['20km', '40km', '90km', '180km', 'Montée', 'Contre-la-montre'],
    swimming: ['100m', '200m', '400m', '800m', '1500m', '50m'],
  };

  const handleSubmit = () => {
    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (distance && totalSeconds > 0) {
      athleteProfileStore.addPersonalRecord({
        distance,
        time: totalSeconds,
        date: date || undefined,
        sport,
      });
      onAdd();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Ajouter un record</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Distance</label>
            <select
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Sélectionner...</option>
              {distanceOptions[sport].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="custom">Autre...</option>
            </select>
            {distance === 'custom' && (
              <input
                type="text"
                placeholder="Distance personnalisée"
                onChange={(e) => setDistance(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temps</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="HH"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
              <span>:</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="MM"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
              <span>:</span>
              <input
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="SS"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date (optionnel)</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddGoalModalProps {
  onClose: () => void;
  onAdd: () => void;
}

function AddGoalModal({ onClose, onAdd }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState<'running' | 'cycling' | 'swimming' | 'triathlon'>('running');
  const [distance, setDistance] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C'>('B');

  const distanceOptions: Record<string, string[]> = {
    running: ['5K', '10K', 'Semi-marathon', 'Marathon', 'Trail', 'Ultra'],
    cycling: ['Cyclosportive', 'Granfondo', 'Course', 'Contre-la-montre'],
    swimming: ['1km', '2km', '5km', 'Traversée'],
    triathlon: ['Sprint', 'Olympique', 'Half Ironman', 'Ironman'],
  };

  const handleSubmit = () => {
    if (name && distance && date) {
      const targetSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
      athleteProfileStore.addGoal({
        name,
        sport,
        distance,
        date,
        targetTime: targetSeconds > 0 ? targetSeconds : undefined,
        priority,
      });
      onAdd();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Ajouter un objectif</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'épreuve</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marathon de Paris"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sport</label>
            <div className="grid grid-cols-4 gap-2">
              {(['running', 'cycling', 'swimming', 'triathlon'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSport(s)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    sport === s ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {s === 'running' && '🏃 Course'}
                  {s === 'cycling' && '🚴 Vélo'}
                  {s === 'swimming' && '🏊 Natation'}
                  {s === 'triathlon' && '🏆 Tri'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Distance/Format</label>
            <select
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Sélectionner...</option>
              {distanceOptions[sport].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temps objectif (optionnel)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="HH"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
              <span>:</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="MM"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
              <span>:</span>
              <input
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="SS"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priorité</label>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    priority === p
                      ? p === 'A' ? 'bg-red-500 text-white' :
                        p === 'B' ? 'bg-orange-500 text-white' :
                        'bg-gray-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {p} - {p === 'A' ? 'Prioritaire' : p === 'B' ? 'Important' : 'Secondaire'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== FORMATAGE ==============

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSwimPace(secPer100m: number): string {
  const mins = Math.floor(secPer100m / 60);
  const secs = Math.round(secPer100m % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
