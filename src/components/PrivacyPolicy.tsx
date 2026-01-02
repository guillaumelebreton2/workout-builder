import { useState, useEffect } from 'react';

type Language = 'en' | 'fr' | 'es' | 'de' | 'it';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const translations: Record<Language, {
  title: string;
  lastUpdated: string;
  backToApp: string;
  sections: {
    title: string;
    content: string | string[];
  }[];
}> = {
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: January 2025',
    backToApp: '← Back to application',
    sections: [
      {
        title: '1. Introduction',
        content: 'Workout Builder ("we", "our", or "the application") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our web application.',
      },
      {
        title: '2. Information We Collect',
        content: [
          '<strong>Garmin Connect:</strong> If you choose to sync workouts with Garmin Connect, we use Garmin\'s official OAuth authentication. You authorize our app directly on Garmin\'s website - we never see or store your Garmin password. We only receive an access token to sync workouts on your behalf.',
          '<strong>Workout Data:</strong> The workout information you create (exercise names, durations, intensities) is processed to generate training files compatible with Garmin devices.',
          '<strong>Activity Data:</strong> If you connect your Garmin or Strava account, we may access your training activities to provide personalized coaching and analysis features.',
        ],
      },
      {
        title: '3. How We Use Your Information',
        content: [
          'Generate structured workout files (.FIT format)',
          'Sync workouts to your Garmin Connect account',
          'Provide AI-powered workout analysis and coaching recommendations',
          'Improve our services and user experience',
        ],
      },
      {
        title: '4. Data Storage and Security',
        content: [
          'Access tokens from Garmin and Strava are stored securely and used only to sync data on your behalf.',
          'We do not store your personal data, workout history, or passwords on our servers.',
          'Workout data is processed in real-time and is not retained after your session ends.',
        ],
      },
      {
        title: '5. Third-Party Services',
        content: [
          '<strong>Garmin Connect:</strong> To sync workouts and retrieve activity data. Subject to <a href="https://www.garmin.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Garmin\'s Privacy Policy</a>.',
          '<strong>AI Services (Groq, OpenAI):</strong> To analyze workout descriptions and provide coaching. Workout descriptions are sent to these services for processing.',
        ],
      },
      {
        title: '6. Data Sharing',
        content: 'We do not sell, trade, or otherwise transfer your personal information to third parties. Your data is only shared with the third-party services mentioned above, solely for the purpose of providing our core features.',
      },
      {
        title: '7. Your Rights',
        content: [
          '<strong>Delete your data:</strong> Contact us to request deletion of any data associated with your account.',
          '<strong>Disconnect services:</strong> Revoke access to Garmin Connect or Strava at any time through their respective account settings.',
          '<strong>Access your data:</strong> Contact us to request information about what data we process.',
        ],
      },
      {
        title: '8. Children\'s Privacy',
        content: 'Our service is not intended for children under 16 years of age. We do not knowingly collect personal information from children.',
      },
      {
        title: '9. Changes to This Policy',
        content: 'We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last updated" date at the top of this policy.',
      },
      {
        title: '10. Contact Us',
        content: 'If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:workoutbuilder.contact@gmail.com" class="text-blue-600 hover:underline">workoutbuilder.contact@gmail.com</a>',
      },
    ],
  },
  fr: {
    title: 'Politique de Confidentialité',
    lastUpdated: 'Dernière mise à jour : Janvier 2025',
    backToApp: '← Retour à l\'application',
    sections: [
      {
        title: '1. Introduction',
        content: 'Workout Builder ("nous", "notre" ou "l\'application") s\'engage à protéger votre vie privée. Cette Politique de Confidentialité explique comment nous collectons, utilisons et protégeons vos informations lorsque vous utilisez notre application web.',
      },
      {
        title: '2. Informations que nous collectons',
        content: [
          '<strong>Garmin Connect :</strong> Si vous choisissez de synchroniser vos séances avec Garmin Connect, nous utilisons l\'authentification OAuth officielle de Garmin. Vous autorisez notre application directement sur le site de Garmin - nous ne voyons ni ne stockons jamais votre mot de passe Garmin. Nous recevons uniquement un jeton d\'accès pour synchroniser les séances en votre nom.',
          '<strong>Données d\'entraînement :</strong> Les informations de séances que vous créez (noms d\'exercices, durées, intensités) sont traitées pour générer des fichiers compatibles avec les appareils Garmin.',
          '<strong>Données d\'activité :</strong> Si vous connectez votre compte Garmin ou Strava, nous pouvons accéder à vos activités d\'entraînement pour fournir des recommandations personnalisées.',
        ],
      },
      {
        title: '3. Comment nous utilisons vos informations',
        content: [
          'Générer des fichiers d\'entraînement structurés (format .FIT)',
          'Synchroniser les séances avec votre compte Garmin Connect',
          'Fournir des analyses et recommandations d\'entraînement par IA',
          'Améliorer nos services et l\'expérience utilisateur',
        ],
      },
      {
        title: '4. Stockage et sécurité des données',
        content: [
          'Les jetons d\'accès de Garmin et Strava sont stockés de manière sécurisée et utilisés uniquement pour synchroniser les données en votre nom.',
          'Nous ne stockons pas vos données personnelles, historique d\'entraînement ou mots de passe sur nos serveurs.',
          'Les données d\'entraînement sont traitées en temps réel et ne sont pas conservées après la fin de votre session.',
        ],
      },
      {
        title: '5. Services tiers',
        content: [
          '<strong>Garmin Connect :</strong> Pour synchroniser les séances et récupérer les données d\'activité. Soumis à la <a href="https://www.garmin.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Politique de Confidentialité de Garmin</a>.',
          '<strong>Services IA (Groq, OpenAI) :</strong> Pour analyser les descriptions d\'entraînement et fournir du coaching. Les descriptions sont envoyées à ces services pour traitement.',
        ],
      },
      {
        title: '6. Partage des données',
        content: 'Nous ne vendons, n\'échangeons ni ne transférons vos informations personnelles à des tiers. Vos données sont uniquement partagées avec les services tiers mentionnés ci-dessus, dans le seul but de fournir nos fonctionnalités principales.',
      },
      {
        title: '7. Vos droits',
        content: [
          '<strong>Supprimer vos données :</strong> Contactez-nous pour demander la suppression de toutes les données associées à votre compte.',
          '<strong>Déconnecter les services :</strong> Révoquez l\'accès à Garmin Connect ou Strava à tout moment via leurs paramètres de compte respectifs.',
          '<strong>Accéder à vos données :</strong> Contactez-nous pour demander des informations sur les données que nous traitons.',
        ],
      },
      {
        title: '8. Confidentialité des enfants',
        content: 'Notre service n\'est pas destiné aux enfants de moins de 16 ans. Nous ne collectons pas sciemment d\'informations personnelles auprès d\'enfants.',
      },
      {
        title: '9. Modifications de cette politique',
        content: 'Nous pouvons mettre à jour cette Politique de Confidentialité de temps en temps. Nous informerons les utilisateurs de tout changement important en mettant à jour la date de "Dernière mise à jour" en haut de cette politique.',
      },
      {
        title: '10. Nous contacter',
        content: 'Si vous avez des questions concernant cette Politique de Confidentialité, veuillez nous contacter à : <a href="mailto:workoutbuilder.contact@gmail.com" class="text-blue-600 hover:underline">workoutbuilder.contact@gmail.com</a>',
      },
    ],
  },
  es: {
    title: 'Política de Privacidad',
    lastUpdated: 'Última actualización: Enero 2025',
    backToApp: '← Volver a la aplicación',
    sections: [
      {
        title: '1. Introducción',
        content: 'Workout Builder ("nosotros", "nuestro" o "la aplicación") se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos su información cuando utiliza nuestra aplicación web.',
      },
      {
        title: '2. Información que recopilamos',
        content: [
          '<strong>Garmin Connect:</strong> Si elige sincronizar entrenamientos con Garmin Connect, utilizamos la autenticación OAuth oficial de Garmin. Usted autoriza nuestra aplicación directamente en el sitio web de Garmin - nunca vemos ni almacenamos su contraseña de Garmin. Solo recibimos un token de acceso para sincronizar entrenamientos en su nombre.',
          '<strong>Datos de entrenamiento:</strong> La información de entrenamiento que crea (nombres de ejercicios, duraciones, intensidades) se procesa para generar archivos compatibles con dispositivos Garmin.',
          '<strong>Datos de actividad:</strong> Si conecta su cuenta de Garmin o Strava, podemos acceder a sus actividades de entrenamiento para proporcionar recomendaciones personalizadas.',
        ],
      },
      {
        title: '3. Cómo usamos su información',
        content: [
          'Generar archivos de entrenamiento estructurados (formato .FIT)',
          'Sincronizar entrenamientos con su cuenta de Garmin Connect',
          'Proporcionar análisis y recomendaciones de entrenamiento con IA',
          'Mejorar nuestros servicios y la experiencia del usuario',
        ],
      },
      {
        title: '4. Almacenamiento y seguridad de datos',
        content: [
          'Los tokens de acceso de Garmin y Strava se almacenan de forma segura y se utilizan solo para sincronizar datos en su nombre.',
          'No almacenamos sus datos personales, historial de entrenamientos o contraseñas en nuestros servidores.',
          'Los datos de entrenamiento se procesan en tiempo real y no se retienen después de que termina su sesión.',
        ],
      },
      {
        title: '5. Servicios de terceros',
        content: [
          '<strong>Garmin Connect:</strong> Para sincronizar entrenamientos y recuperar datos de actividad. Sujeto a la <a href="https://www.garmin.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Política de Privacidad de Garmin</a>.',
          '<strong>Servicios de IA (Groq, OpenAI):</strong> Para analizar descripciones de entrenamiento y proporcionar coaching. Las descripciones se envían a estos servicios para procesamiento.',
        ],
      },
      {
        title: '6. Compartir datos',
        content: 'No vendemos, intercambiamos ni transferimos su información personal a terceros. Sus datos solo se comparten con los servicios de terceros mencionados anteriormente, únicamente para proporcionar nuestras funcionalidades principales.',
      },
      {
        title: '7. Sus derechos',
        content: [
          '<strong>Eliminar sus datos:</strong> Contáctenos para solicitar la eliminación de cualquier dato asociado con su cuenta.',
          '<strong>Desconectar servicios:</strong> Revoque el acceso a Garmin Connect o Strava en cualquier momento a través de sus respectivas configuraciones de cuenta.',
          '<strong>Acceder a sus datos:</strong> Contáctenos para solicitar información sobre los datos que procesamos.',
        ],
      },
      {
        title: '8. Privacidad de los niños',
        content: 'Nuestro servicio no está destinado a niños menores de 16 años. No recopilamos conscientemente información personal de niños.',
      },
      {
        title: '9. Cambios a esta política',
        content: 'Podemos actualizar esta Política de Privacidad de vez en cuando. Notificaremos a los usuarios de cualquier cambio importante actualizando la fecha de "Última actualización" en la parte superior de esta política.',
      },
      {
        title: '10. Contáctenos',
        content: 'Si tiene alguna pregunta sobre esta Política de Privacidad, contáctenos en: <a href="mailto:workoutbuilder.contact@gmail.com" class="text-blue-600 hover:underline">workoutbuilder.contact@gmail.com</a>',
      },
    ],
  },
  de: {
    title: 'Datenschutzrichtlinie',
    lastUpdated: 'Zuletzt aktualisiert: Januar 2025',
    backToApp: '← Zurück zur Anwendung',
    sections: [
      {
        title: '1. Einführung',
        content: 'Workout Builder ("wir", "unser" oder "die Anwendung") verpflichtet sich, Ihre Privatsphäre zu schützen. Diese Datenschutzrichtlinie erklärt, wie wir Ihre Informationen sammeln, verwenden und schützen, wenn Sie unsere Webanwendung nutzen.',
      },
      {
        title: '2. Informationen, die wir sammeln',
        content: [
          '<strong>Garmin Connect:</strong> Wenn Sie Workouts mit Garmin Connect synchronisieren, verwenden wir die offizielle OAuth-Authentifizierung von Garmin. Sie autorisieren unsere App direkt auf der Garmin-Website - wir sehen oder speichern niemals Ihr Garmin-Passwort. Wir erhalten nur ein Zugriffstoken, um Workouts in Ihrem Namen zu synchronisieren.',
          '<strong>Trainingsdaten:</strong> Die Trainingsinformationen, die Sie erstellen (Übungsnamen, Dauer, Intensitäten), werden verarbeitet, um Dateien zu generieren, die mit Garmin-Geräten kompatibel sind.',
          '<strong>Aktivitätsdaten:</strong> Wenn Sie Ihr Garmin- oder Strava-Konto verbinden, können wir auf Ihre Trainingsaktivitäten zugreifen, um personalisierte Empfehlungen zu geben.',
        ],
      },
      {
        title: '3. Wie wir Ihre Informationen verwenden',
        content: [
          'Strukturierte Trainingsdateien generieren (.FIT-Format)',
          'Workouts mit Ihrem Garmin Connect-Konto synchronisieren',
          'KI-gestützte Trainingsanalysen und Coaching-Empfehlungen bereitstellen',
          'Unsere Dienste und Benutzererfahrung verbessern',
        ],
      },
      {
        title: '4. Datenspeicherung und Sicherheit',
        content: [
          'Zugriffstoken von Garmin und Strava werden sicher gespeichert und nur verwendet, um Daten in Ihrem Namen zu synchronisieren.',
          'Wir speichern keine persönlichen Daten, Trainingshistorie oder Passwörter auf unseren Servern.',
          'Trainingsdaten werden in Echtzeit verarbeitet und nach Ende Ihrer Sitzung nicht aufbewahrt.',
        ],
      },
      {
        title: '5. Drittanbieterdienste',
        content: [
          '<strong>Garmin Connect:</strong> Zum Synchronisieren von Workouts und Abrufen von Aktivitätsdaten. Unterliegt der <a href="https://www.garmin.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Datenschutzrichtlinie von Garmin</a>.',
          '<strong>KI-Dienste (Groq, OpenAI):</strong> Zur Analyse von Trainingsbeschreibungen und Bereitstellung von Coaching. Trainingsbeschreibungen werden zur Verarbeitung an diese Dienste gesendet.',
        ],
      },
      {
        title: '6. Datenweitergabe',
        content: 'Wir verkaufen, tauschen oder übertragen Ihre persönlichen Informationen nicht an Dritte. Ihre Daten werden nur mit den oben genannten Drittanbieterdiensten geteilt, ausschließlich zum Zweck der Bereitstellung unserer Kernfunktionen.',
      },
      {
        title: '7. Ihre Rechte',
        content: [
          '<strong>Ihre Daten löschen:</strong> Kontaktieren Sie uns, um die Löschung aller mit Ihrem Konto verbundenen Daten zu beantragen.',
          '<strong>Dienste trennen:</strong> Widerrufen Sie den Zugriff auf Garmin Connect oder Strava jederzeit über deren jeweilige Kontoeinstellungen.',
          '<strong>Auf Ihre Daten zugreifen:</strong> Kontaktieren Sie uns, um Informationen über die von uns verarbeiteten Daten anzufordern.',
        ],
      },
      {
        title: '8. Datenschutz für Kinder',
        content: 'Unser Dienst ist nicht für Kinder unter 16 Jahren bestimmt. Wir sammeln wissentlich keine persönlichen Informationen von Kindern.',
      },
      {
        title: '9. Änderungen dieser Richtlinie',
        content: 'Wir können diese Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Wir werden Benutzer über wesentliche Änderungen informieren, indem wir das Datum "Zuletzt aktualisiert" oben in dieser Richtlinie aktualisieren.',
      },
      {
        title: '10. Kontaktieren Sie uns',
        content: 'Wenn Sie Fragen zu dieser Datenschutzrichtlinie haben, kontaktieren Sie uns unter: <a href="mailto:workoutbuilder.contact@gmail.com" class="text-blue-600 hover:underline">workoutbuilder.contact@gmail.com</a>',
      },
    ],
  },
  it: {
    title: 'Informativa sulla Privacy',
    lastUpdated: 'Ultimo aggiornamento: Gennaio 2025',
    backToApp: '← Torna all\'applicazione',
    sections: [
      {
        title: '1. Introduzione',
        content: 'Workout Builder ("noi", "nostro" o "l\'applicazione") si impegna a proteggere la tua privacy. Questa Informativa sulla Privacy spiega come raccogliamo, utilizziamo e proteggiamo le tue informazioni quando utilizzi la nostra applicazione web.',
      },
      {
        title: '2. Informazioni che raccogliamo',
        content: [
          '<strong>Garmin Connect:</strong> Se scegli di sincronizzare gli allenamenti con Garmin Connect, utilizziamo l\'autenticazione OAuth ufficiale di Garmin. Autorizzi la nostra app direttamente sul sito web di Garmin - non vediamo né memorizziamo mai la tua password Garmin. Riceviamo solo un token di accesso per sincronizzare gli allenamenti per tuo conto.',
          '<strong>Dati di allenamento:</strong> Le informazioni sugli allenamenti che crei (nomi degli esercizi, durate, intensità) vengono elaborate per generare file compatibili con i dispositivi Garmin.',
          '<strong>Dati delle attività:</strong> Se colleghi il tuo account Garmin o Strava, potremmo accedere alle tue attività di allenamento per fornire raccomandazioni personalizzate.',
        ],
      },
      {
        title: '3. Come utilizziamo le tue informazioni',
        content: [
          'Generare file di allenamento strutturati (formato .FIT)',
          'Sincronizzare gli allenamenti con il tuo account Garmin Connect',
          'Fornire analisi degli allenamenti e raccomandazioni di coaching basate su IA',
          'Migliorare i nostri servizi e l\'esperienza utente',
        ],
      },
      {
        title: '4. Archiviazione e sicurezza dei dati',
        content: [
          'I token di accesso di Garmin e Strava sono memorizzati in modo sicuro e utilizzati solo per sincronizzare i dati per tuo conto.',
          'Non memorizziamo i tuoi dati personali, la cronologia degli allenamenti o le password sui nostri server.',
          'I dati degli allenamenti vengono elaborati in tempo reale e non vengono conservati dopo la fine della sessione.',
        ],
      },
      {
        title: '5. Servizi di terze parti',
        content: [
          '<strong>Garmin Connect:</strong> Per sincronizzare gli allenamenti e recuperare i dati delle attività. Soggetto all\'<a href="https://www.garmin.com/privacy" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Informativa sulla Privacy di Garmin</a>.',
          '<strong>Servizi IA (Groq, OpenAI):</strong> Per analizzare le descrizioni degli allenamenti e fornire coaching. Le descrizioni vengono inviate a questi servizi per l\'elaborazione.',
        ],
      },
      {
        title: '6. Condivisione dei dati',
        content: 'Non vendiamo, scambiamo o trasferiamo in altro modo le tue informazioni personali a terzi. I tuoi dati vengono condivisi solo con i servizi di terze parti menzionati sopra, esclusivamente allo scopo di fornire le nostre funzionalità principali.',
      },
      {
        title: '7. I tuoi diritti',
        content: [
          '<strong>Eliminare i tuoi dati:</strong> Contattaci per richiedere l\'eliminazione di qualsiasi dato associato al tuo account.',
          '<strong>Disconnettere i servizi:</strong> Revoca l\'accesso a Garmin Connect o Strava in qualsiasi momento attraverso le rispettive impostazioni dell\'account.',
          '<strong>Accedere ai tuoi dati:</strong> Contattaci per richiedere informazioni sui dati che elaboriamo.',
        ],
      },
      {
        title: '8. Privacy dei minori',
        content: 'Il nostro servizio non è destinato a bambini di età inferiore ai 16 anni. Non raccogliamo consapevolmente informazioni personali da bambini.',
      },
      {
        title: '9. Modifiche a questa informativa',
        content: 'Potremmo aggiornare questa Informativa sulla Privacy di tanto in tanto. Informeremo gli utenti di eventuali modifiche sostanziali aggiornando la data di "Ultimo aggiornamento" in cima a questa informativa.',
      },
      {
        title: '10. Contattaci',
        content: 'Se hai domande su questa Informativa sulla Privacy, contattaci all\'indirizzo: <a href="mailto:workoutbuilder.contact@gmail.com" class="text-blue-600 hover:underline">workoutbuilder.contact@gmail.com</a>',
      },
    ],
  },
};

function detectLanguage(): Language {
  const browserLang = navigator.language.split('-')[0];
  if (browserLang in translations) {
    return browserLang as Language;
  }
  return 'en';
}

export function PrivacyPolicy() {
  const [lang, setLang] = useState<Language>(detectLanguage);
  const t = translations[lang];

  useEffect(() => {
    // Update URL with language parameter
    const url = new URL(window.location.href);
    const urlLang = url.searchParams.get('lang') as Language;
    if (urlLang && urlLang in translations) {
      setLang(urlLang);
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <header className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800"
            >
              {t.backToApp}
            </a>

            {/* Language selector */}
            <div className="flex gap-1 flex-wrap justify-end">
              {LANGUAGES.map(({ code, label, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  className={`px-2 py-1 rounded text-sm transition-colors ${
                    lang === code
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  title={label}
                >
                  {flag} {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {t.title}
          </h1>
          <p className="text-gray-600 mt-2">{t.lastUpdated}</p>
        </header>

        <main className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
          {t.sections.map((section, index) => (
            <section key={index}>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                {section.title}
              </h2>
              {Array.isArray(section.content) ? (
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  {section.content.map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              ) : (
                <p
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              )}
            </section>
          ))}
        </main>

        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Workout Builder. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
