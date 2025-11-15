export default function Help() {
  return (
    <div className="h-full p-8 overflow-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Guida all'uso - Amazon Ads Manager</h1>

      <div className="space-y-8 max-w-4xl">
        {/* Dashboard Section */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </h2>
          <div className="text-gray-700 space-y-3">
            <p><strong>Panoramica generale del sistema</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Stato Sistema:</strong> Indica se lo scheduler è attivo e se ci sono errori</li>
              <li><strong>Automazioni:</strong> Mostra lo stato dello scheduler e il numero di tasks attivi</li>
              <li><strong>Statistiche Campagne:</strong> Numero totale di campagne, attive, in pausa e budget giornaliero</li>
              <li><strong>Log Attività:</strong> Statistiche sui log di successo e falliti</li>
            </ul>
            <p className="text-sm italic mt-3">La Dashboard si aggiorna automaticamente ogni 30 secondi</p>
          </div>
        </section>

        {/* Campaigns Section */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Campaigns
          </h2>
          <div className="text-gray-700 space-y-3">
            <p><strong>Gestione delle campagne pubblicitarie</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Filtri:</strong> Visualizza tutte le campagne, solo quelle attive o in pausa</li>
              <li><strong>Tipi di Campagna:</strong>
                <ul className="list-circle list-inside ml-6 mt-2">
                  <li>Tipo 1: Keyword Targeting</li>
                  <li>Tipo 2: Product Targeting</li>
                  <li>Tipo 3: Keyword Super</li>
                  <li>Tipo 4: Product Super</li>
                  <li>Tipo 5: AD Automatica</li>
                </ul>
              </li>
              <li><strong>Badge Automazioni:</strong> I badge F1-F5 indicano quali funzioni di automazione sono attive per ogni campagna</li>
            </ul>
          </div>
        </section>

        {/* Logs Section */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Activity Log
          </h2>
          <div className="text-gray-700 space-y-3">
            <p><strong>Registro delle attività di automazione</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Filtri:</strong> Visualizza tutti i log, solo successi o solo fallimenti</li>
              <li><strong>Informazioni Log:</strong> Data/ora, funzione eseguita, azione, target e modifiche applicate</li>
              <li><strong>Ultimi 100 Log:</strong> Il sistema mostra i 100 log più recenti</li>
            </ul>
          </div>
        </section>

        {/* Settings Section */}
        <section className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>
          <div className="text-gray-700 space-y-4">
            <p><strong>Configurazione delle 5 funzioni di automazione</strong></p>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2">F1: Progressive Bidding Increase</h3>
              <p className="mb-2">Aumenta progressivamente il bid per keyword con poche impression (Campagne 1-4)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Bid Increase: Incremento bid (es. 0.02€)</li>
                <li>Frequency: Frequenza in giorni</li>
                <li>Max Impressions: Soglia massima di impression</li>
                <li>Max Clicks: Soglia massima di click</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2">F2: Placement Optimization</h3>
              <p className="mb-2">Ottimizza i placement basandosi sul FAST ACoS (Tutte le campagne)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe: Periodo di analisi in settimane</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2">F3: Targeting Optimization</h3>
              <p className="mb-2">Ottimizza e mette in pausa keyword/prodotti (Campagne 1-4)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe A/B/C: Periodi di analisi diversi</li>
                <li>Clicks Pause: Numero click per pausa automatica</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2">F4: Auto Ad Optimization</h3>
              <p className="mb-2">Ottimizza gruppi di auto targeting (Solo Campagna 5)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe A/B/C: Periodi di analisi</li>
                <li>Clicks/Spend Negative: Soglie per targeting negativo</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2">F5: Campaign Feeding</h3>
              <p className="mb-2">Alimenta keyword performanti tra campagne diverse (Tutte)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Min Orders: Ordini minimi richiesti</li>
                <li>Bid Broad/Exact/Phrase/Expanded: Bid iniziali per tipo di match</li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAST ACoS Info */}
        <section className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-6">
          <h3 className="font-bold text-lg text-blue-900 mb-3">Formula FAST ACoS</h3>
          <p className="text-blue-800">
            <strong>FAST ACoS = Royalty / (Price × 1.22)</strong>
          </p>
          <p className="text-sm text-blue-700 mt-2">
            Questa metrica viene utilizzata per valutare la profittabilità delle campagne e ottimizzare i placement.
          </p>
        </section>
      </div>
    </div>
  );
}
