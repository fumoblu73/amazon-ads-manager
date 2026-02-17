export default function Help() {
  return (
    <div className="h-full p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-white mb-8">GUIDA</h1>

      <div className="space-y-8 max-w-4xl">
        {/* Dashboard Section */}
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </h2>
          <div className="text-gray-300 space-y-3">
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
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Campaigns
          </h2>
          <div className="text-gray-300 space-y-3">
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
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Activity Log
          </h2>
          <div className="text-gray-300 space-y-3">
            <p><strong>Registro delle attività di automazione</strong></p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Filtri:</strong> Visualizza tutti i log, solo successi o solo fallimenti</li>
              <li><strong>Informazioni Log:</strong> Data/ora, funzione eseguita, azione, target e modifiche applicate</li>
              <li><strong>Ultimi 100 Log:</strong> Il sistema mostra i 100 log più recenti</li>
            </ul>
          </div>
        </section>

        {/* Settings Section */}
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>
          <div className="text-gray-300 space-y-4">
            <p><strong>Configurazione delle 5 funzioni di automazione</strong></p>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2 text-white">F1: Progressive Bidding Increase</h3>
              <p className="mb-2">Aumenta progressivamente il bid per keyword con poche impression (Campagne 1-4)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Bid Increase: Incremento bid (es. 0.02€)</li>
                <li>Frequency: Frequenza in giorni</li>
                <li>Max Impressions: Soglia massima di impression</li>
                <li>Max Clicks: Soglia massima di click</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2 text-white">F2: Placement Optimization</h3>
              <p className="mb-2">Ottimizza i placement basandosi sul FAST ACoS (Tutte le campagne)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe: Periodo di analisi in settimane</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2 text-white">F3: Targeting Optimization</h3>
              <p className="mb-2">Ottimizza e mette in pausa keyword/prodotti (Campagne 1-4)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe A/B/C: Periodi di analisi diversi</li>
                <li>Clicks Pause: Numero click per pausa automatica</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2 text-white">F4: Auto Ad Optimization</h3>
              <p className="mb-2">Ottimizza gruppi di auto targeting (Solo Campagna 5)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Timeframe A/B/C: Periodi di analisi</li>
                <li>Clicks/Spend Negative: Soglie per targeting negativo</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-lg mb-2 text-white">F5: Campaign Feeding</h3>
              <p className="mb-2">Alimenta keyword performanti tra campagne diverse (Tutte)</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Frequency: Frequenza in giorni</li>
                <li>Min Orders: Ordini minimi richiesti</li>
                <li>Bid Broad/Exact/Phrase/Expanded: Bid iniziali per tipo di match</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Automation Schedule Section */}
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Orari Automazioni
          </h2>
          <div className="text-gray-300 space-y-4">
            <p><strong>Programmazione esecuzione automatica delle funzioni F1-F5</strong></p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-orange-500">Giorno</th>
                    <th className="text-left py-2 px-3 text-orange-500">Orario (IT)</th>
                    <th className="text-left py-2 px-3 text-orange-500">Funzioni</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 px-3">Lunedì</td>
                    <td className="py-2 px-3">10:20</td>
                    <td className="py-2 px-3">F1, F2, F3, F4, F5</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 px-3">Lunedì</td>
                    <td className="py-2 px-3">11:20</td>
                    <td className="py-2 px-3">F1, F2, F3, F4, F5</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 px-3">Mercoledì</td>
                    <td className="py-2 px-3">10:20</td>
                    <td className="py-2 px-3">F1, F2, F3, F4, F5</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-2 px-3">Venerdì</td>
                    <td className="py-2 px-3">10:20</td>
                    <td className="py-2 px-3">F1, F2, F3, F4, F5</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h3 className="font-bold text-white mb-2">Funzioni per Tipo Campagna</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-orange-500">Tipo Campagna</th>
                      <th className="text-center py-2 px-3 text-orange-500">F1</th>
                      <th className="text-center py-2 px-3 text-orange-500">F2</th>
                      <th className="text-center py-2 px-3 text-orange-500">F3</th>
                      <th className="text-center py-2 px-3 text-orange-500">F4</th>
                      <th className="text-center py-2 px-3 text-orange-500">F5</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3">1 - Keyword Targeting</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3">2 - Product Targeting</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3">3 - Keyword Super</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3">4 - Product Super</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 px-3">5 - Auto</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-gray-600">-</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                      <td className="text-center py-2 px-3 text-green-500">✓</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm italic mt-3">
              Le automazioni vengono eseguite automaticamente tramite cron job esterni.
              Il Lunedì ha doppia esecuzione per garantire l'esecuzione completa di tutte le funzioni.
            </p>
          </div>
        </section>

        {/* Test Functions Section */}
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Test Funzioni
          </h2>
          <div className="text-gray-300 space-y-4">
            <p><strong>Pagina per testare manualmente le funzioni di automazione F1-F5</strong></p>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Come usare</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong>Seleziona un libro</strong> dal menu a tendina (i libri vengono caricati dal database)</li>
                <li><strong>Scegli il marketplace</strong> (US, UK, DE, ecc.)</li>
                <li><strong>Dry Run</strong> (attivo di default): simula l'esecuzione senza applicare modifiche reali su Amazon. Disattivalo solo quando vuoi eseguire le modifiche effettive</li>
                <li><strong>Clicca sulla funzione</strong> (F1-F5) da testare</li>
                <li>Attendi il risultato (i report Amazon possono richiedere 3-7 minuti)</li>
              </ol>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Override Parametri</h3>
              <p className="mb-2">Cliccando su "Override Parametri" puoi sovrascrivere temporaneamente i valori di configurazione <strong>solo per il test</strong>, senza modificare i parametri di produzione:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>clicksNegative / spendNegative</strong> (F4): soglie per il negative targeting</li>
                <li><strong>skipPart1</strong> (F4): salta la Parte 1 (bid optimization) e testa solo la Parte 2 (negative targeting)</li>
                <li><strong>minOrders</strong> (F5): ordini minimi per considerare un search term performante</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Interpretare i risultati</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><span className="text-green-400">Verde (executed)</span>: la funzione ha trovato dati e ha eseguito (o simulato) le modifiche</li>
                <li><span className="text-gray-400">Grigio (skipped)</span>: la funzione non ha trovato dati rilevanti o la campagna non era idonea</li>
                <li><span className="text-red-400">Rosso (error)</span>: si e' verificato un errore (report timeout, errore API, ecc.)</li>
              </ul>
              <p className="text-sm mt-2">Usa il pulsante <strong>"Copia JSON"</strong> per copiare il risultato completo negli appunti.</p>
            </div>
          </div>
        </section>

        {/* Email Notifications Section */}
        <section className="bg-black rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Notifiche Email
          </h2>
          <div className="text-gray-300 space-y-4">
            <p><strong>Sistema di notifiche automatiche via email (Resend API)</strong></p>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Quando ricevi una email</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Fase 1 - Report inviati:</strong> conferma che i report sono stati richiesti ad Amazon, con elenco delle campagne e funzioni coinvolte</li>
                <li><strong>Fase 2 - Riepilogo automazione:</strong> risultato completo dell'esecuzione con status per ogni campagna (OK, ERRORE, PENDING) e dettagli delle azioni eseguite</li>
                <li><strong>Errori:</strong> se ci sono fallimenti, l'email li evidenzia in rosso con il dettaglio dell'errore</li>
              </ul>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Test Email</h3>
              <p>Nella pagina <strong>Test Funzioni</strong> c'e' il pulsante <strong>"Invia Email Test"</strong> che invia una email di prova con dati simulati per verificare che la configurazione funzioni correttamente.</p>
            </div>

            <div className="ml-4">
              <h3 className="font-bold text-white mb-2">Configurazione (Render env vars)</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>RESEND_API_KEY</strong>: chiave API ottenuta da resend.com</li>
                <li><strong>EMAIL_FROM</strong>: indirizzo mittente (es. <code className="bg-gray-800 px-1 rounded">Amazon Ads Manager &lt;onboarding@resend.dev&gt;</code>)</li>
                <li><strong>EMAIL_TO</strong>: indirizzo destinatario dove ricevere le notifiche</li>
              </ul>
              <p className="text-sm mt-2 text-gray-400">Per inviare da un indirizzo personalizzato (es. @tuodominio.com) serve verificare il dominio su Resend e configurare i record DNS (SPF, DKIM).</p>
            </div>
          </div>
        </section>

        {/* FAST ACoS Info */}
        <section className="bg-black border-2 border-orange-500 rounded-xl p-6">
          <h3 className="font-bold text-lg text-white mb-3">Formula FAST ACoS</h3>
          <p className="text-gray-300">
            <strong>FAST ACoS = Royalty / (Price × 1.22)</strong>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Questa metrica viene utilizzata per valutare la profittabilità delle campagne e ottimizzare i placement.
          </p>
        </section>
      </div>
    </div>
  );
}
