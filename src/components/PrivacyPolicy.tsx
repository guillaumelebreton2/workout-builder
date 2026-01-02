export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <header className="mb-8">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            &larr; Retour à l'application
          </a>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Privacy Policy
          </h1>
          <p className="text-gray-600 mt-2">Last updated: January 2025</p>
        </header>

        <main className="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              1. Introduction
            </h2>
            <p className="text-gray-700">
              Workout Builder ("we", "our", or "the application") is committed to
              protecting your privacy. This Privacy Policy explains how we collect,
              use, and safeguard your information when you use our web application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              2. Information We Collect
            </h2>
            <p className="text-gray-700 mb-2">
              We may collect the following types of information:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>
                <strong>Garmin Connect Credentials:</strong> If you choose to sync
                workouts with Garmin Connect, we temporarily process your Garmin
                credentials to authenticate with Garmin's services. These credentials
                are encrypted locally on your device and are never stored on our servers.
              </li>
              <li>
                <strong>Workout Data:</strong> The workout information you create
                (exercise names, durations, intensities) is processed to generate
                training files compatible with Garmin devices.
              </li>
              <li>
                <strong>Activity Data:</strong> If you connect your Garmin or Strava
                account, we may access your training activities to provide personalized
                coaching and analysis features.
              </li>
              <li>
                <strong>API Keys:</strong> If you provide your own API keys (e.g., Groq),
                they are stored locally in your browser and never transmitted to our servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              3. How We Use Your Information
            </h2>
            <p className="text-gray-700 mb-2">We use your information to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>Generate structured workout files (.FIT format)</li>
              <li>Sync workouts to your Garmin Connect account</li>
              <li>Provide AI-powered workout analysis and coaching recommendations</li>
              <li>Improve our services and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              4. Data Storage and Security
            </h2>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>
                Your Garmin credentials are encrypted using AES-GCM encryption with a
                PIN you choose. The encrypted data is stored only in your browser's
                local storage.
              </li>
              <li>
                We do not store your personal data, workout history, or credentials on
                our servers.
              </li>
              <li>
                Workout data is processed in real-time and is not retained after your
                session ends.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              5. Third-Party Services
            </h2>
            <p className="text-gray-700 mb-2">
              Our application integrates with the following third-party services:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>
                <strong>Garmin Connect:</strong> To sync workouts and retrieve activity
                data. Subject to{" "}
                <a
                  href="https://www.garmin.com/privacy"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Garmin's Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>AI Services (Groq, OpenAI):</strong> To analyze workout
                descriptions and provide coaching. Workout descriptions are sent to
                these services for processing.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              6. Data Sharing
            </h2>
            <p className="text-gray-700">
              We do not sell, trade, or otherwise transfer your personal information
              to third parties. Your data is only shared with the third-party services
              mentioned above, solely for the purpose of providing our core features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              7. Your Rights
            </h2>
            <p className="text-gray-700 mb-2">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
              <li>
                <strong>Delete your data:</strong> Clear your browser's local storage
                to remove all stored credentials and preferences.
              </li>
              <li>
                <strong>Disconnect services:</strong> Revoke access to Garmin Connect
                or Strava at any time through their respective account settings.
              </li>
              <li>
                <strong>Access your data:</strong> Contact us to request information
                about what data we process.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              8. Children's Privacy
            </h2>
            <p className="text-gray-700">
              Our service is not intended for children under 16 years of age. We do
              not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Changes to This Policy
            </h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify
              users of any material changes by updating the "Last updated" date at
              the top of this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              10. Contact Us
            </h2>
            <p className="text-gray-700">
              If you have any questions about this Privacy Policy, please contact us
              at:{" "}
              <a
                href="mailto:contact@workout-builder.com"
                className="text-blue-600 hover:underline"
              >
                contact@workout-builder.com
              </a>
            </p>
          </section>
        </main>

        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Workout Builder. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
