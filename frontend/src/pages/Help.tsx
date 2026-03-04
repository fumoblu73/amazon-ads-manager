import { useState } from 'react';

// ─── Componente sezione collassabile ─────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-orange-500">{icon}</span>
          <span className="text-lg font-bold text-white">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-6 text-gray-300">
          <div className="border-t border-gray-700 pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabella stilizzata ───────────────────────────────────────────────────────

function Table({ headers, rows }: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2.5 px-4 text-orange-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2.5 px-4 text-gray-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ok = <span className="text-green-400 font-bold">✓</span>;
const no = <span className="text-gray-600">—</span>;

// ─── Pagina Help ──────────────────────────────────────────────────────────────

export default function Help() {
  return (
    <div className="h-full p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-white uppercase mb-6">Guida</h1>

      <div className="space-y-3 max-w-4xl">

        {/* ── DASHBOARD ── */}
        <Section defaultOpen title="Dashboard (Amazon Ads)" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }>
          <div className="space-y-4">
            <p>La dashboard principale mostra in un unico schermo tutte le informazioni operative.</p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-white mb-1">Calendario 14 giorni</p>
                <p className="text-sm">Ogni cerchio rappresenta un giorno. Il numero <span className="text-green-400">verde</span> indica le operazioni riuscite, il numero <span className="text-red-400">rosso</span> quelle fallite. Il cerchio arancione indica oggi. Sotto ogni cerchio: giorno della settimana e data dd/MM.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Pulsante "Esegui Ora"</p>
                <p className="text-sm">Forza l'esecuzione immediata delle automazioni per il tuo account, indipendente dal calendario cron. Utile per test o esecuzioni straordinarie.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Statistiche Campagne</p>
                <p className="text-sm">Numero di campagne attive / in pausa / archiviate. Spesa 7 giorni suddivisa per tipo (SP, SD, SB) con media giornaliera e ACOS calcolato.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Log Attività</p>
                <p className="text-sm">Sotto la griglia principale trovi il log completo degli ultimi 14 giorni, organizzato per data (sempre espanso) e per libro (collassabile). Filtri: Tutti / Successi / Falliti.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── FUNZIONI AUTOMAZIONE ── */}
        <Section title="Funzioni di Automazione (F1–F5)" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }>
          <div className="space-y-5">
            <p>Le funzioni vengono eseguite automaticamente su ogni campagna compatibile. Ognuna ha la propria frequenza configurabile in <strong className="text-white">Impostazioni</strong>.</p>

            {/* Tabella compatibilità */}
            <div>
              <p className="font-semibold text-white mb-2">Compatibilità per tipo campagna</p>
              <Table
                headers={['Tipo Campagna', 'F1', 'F2', 'F3', 'F4', 'F5']}
                rows={[
                  ['1 – Keyword Targeting', ok, ok, ok, no, ok],
                  ['2 – Product Targeting', ok, ok, ok, no, ok],
                  ['3 – Keyword Super', ok, ok, ok, no, ok],
                  ['4 – Product Super', ok, ok, ok, no, ok],
                  ['5 – Auto', no, ok, no, ok, ok],
                ]}
              />
            </div>

            {/* Dettaglio funzioni */}
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-bold text-white mb-1">F1 — Progressive Bidding Increase</p>
                <p className="text-sm mb-2">Aumenta progressivamente il bid delle keyword/target con traffico basso (poche impressioni e click). Aiuta a "scalare" nel ranking di Amazon per posizionamenti non ancora rodati.</p>
                <p className="text-xs text-gray-400">Parametri: <span className="text-gray-300">Bid Increase</span> (incremento fisso per esecuzione), <span className="text-gray-300">Max Impressions</span> e <span className="text-gray-300">Max Clicks</span> (soglie massime oltre le quali non si aumenta), <span className="text-gray-300">Frequency</span> (giorni tra un'esecuzione e l'altra).</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-bold text-white mb-1">F2 — Placement Optimization</p>
                <p className="text-sm mb-2">Ottimizza le percentuali di bid per i placement (Top of Search, Rest of Search, Product Pages) in base al FAST ACoS. Un placement con ACOS favorevole riceve un bid più alto, uno sfavorevole viene ridotto.</p>
                <p className="text-xs text-gray-400">Parametri: <span className="text-gray-300">Frequency</span>, <span className="text-gray-300">Timeframe</span> (settimane di dati da analizzare).</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-bold text-white mb-1">F3 — Targeting Optimization</p>
                <p className="text-sm mb-2">Mette in pausa keyword/ASIN con troppi click e zero ordini (spreco di budget). Aumenta il bid dei target performanti (ordini presenti). Usa un timeframe dinamico basato sul volume di impressioni giornaliere:</p>
                <ul className="text-xs text-gray-400 list-disc list-inside mb-2">
                  <li>&lt; 2.000 imp/giorno → 30 giorni di analisi</li>
                  <li>2.000–3.000 → 25 giorni</li>
                  <li>3.000–4.000 → 20 giorni</li>
                  <li>≥ 5.000 → 15 giorni</li>
                </ul>
                <p className="text-xs text-gray-400">Usa anche i dati a 65 giorni (doppio report in parallelo) per intercettare target lenti ma performanti.</p>
                <p className="text-xs text-gray-400 mt-1">Parametri: <span className="text-gray-300">Clicks Pause</span> (click senza ordini → pausa), <span className="text-gray-300">Clicks 65gg</span>, <span className="text-gray-300">Timeframe A/B/C</span>.</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-bold text-white mb-1">F4 — Auto Ad Optimization</p>
                <p className="text-sm mb-2">Ottimizza le campagne Auto (tipo 5). Aggiunge keyword/ASIN negative per eliminare traffico non pertinente, e aggiusta i bid per targeting group (close match, loose match, substitutes, complements).</p>
                <p className="text-xs text-gray-400">Parametri: <span className="text-gray-300">Clicks Negative</span> e <span className="text-gray-300">Spend Negative</span> (soglie per aggiungere negativi), <span className="text-gray-300">Timeframe A/B/C</span>, <span className="text-gray-300">Frequency</span>.</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-bold text-white mb-1">F5 — Campaign Feeding</p>
                <p className="text-sm mb-2">Pesca i search term performanti dalla campagna Auto e li aggiunge come keyword alle campagne manuali (Broad, Exact, Phrase) con i bid configurati. Garantisce che i termini che convertono nell'auto vengano catturati nelle campagne manuali.</p>
                <p className="text-xs text-gray-400">Parametri: <span className="text-gray-300">Min Orders</span> (ordini minimi del search term), <span className="text-gray-300">Bid Broad / Exact / Phrase / Expanded</span>, <span className="text-gray-300">Frequency</span>.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── PIANIFICAZIONE CRON ── */}
        <Section title="Pianificazione & Orari (cron-job.org)" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }>
          <div className="space-y-5">
            <p>Le automazioni sono gestite da <strong className="text-white">cron-job.org</strong> tramite 3 endpoint. Il server Render non esegue nulla autonomamente: è sempre cron-job.org a fare il trigger.</p>

            <Table
              headers={['Step', 'Endpoint', 'Orario (CET)', 'Giorni', 'Descrizione']}
              rows={[
                [
                  <span className="font-semibold text-blue-400">1 – Refresh Spend</span>,
                  <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">POST /refresh-spend</code>,
                  '09:20',
                  'ogni giorno',
                  'Aggiorna la cache della spesa pubblicitaria per tutti i marketplace'
                ],
                [
                  <span className="font-semibold text-orange-400">2 – Submit Reports</span>,
                  <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">POST /submit-reports</code>,
                  '09:30',
                  'lun / mer / ven',
                  'Sincronizza le campagne e richiede i report ad Amazon (generazione: ~60–90 min)'
                ],
                [
                  <span className="font-semibold text-green-400">3 – Process Reports</span>,
                  <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">POST /process-reports</code>,
                  '11:00 → 13:00 (ogni 15 min)',
                  'lun / mer / ven',
                  'Controlla se i report sono pronti ed esegue le funzioni F1–F5 sulle campagne'
                ],
              ]}
            />

            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-white">Perché il gap 09:30 → 11:00?</p>
              <p className="text-gray-400">Amazon impiega mediamente 60–90 minuti per generare i report. Submit-reports parte alle 9:30 e invia subito la richiesta; process-reports inizia a controllare dalle 11:00 per trovare i report già pronti. Se alle 11:00 non sono ancora pronti, riprova ogni 15 minuti fino alle 13:00.</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2">
              <p className="font-semibold text-white">UptimeRobot (keep-alive)</p>
              <p className="text-gray-400">Il server Render è tenuto sveglio da UptimeRobot (ping GET /health ogni 5 minuti), così non va mai in hibernate e i cron trovano sempre il server pronto.</p>
            </div>
          </div>
        </Section>

        {/* ── TEST FUNZIONI ── */}
        <Section title="Test Funzioni" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        }>
          <div className="space-y-4">
            <p>Permette di eseguire manualmente qualsiasi funzione F1–F5 su un libro specifico, con o senza modifiche reali.</p>

            <div>
              <p className="font-semibold text-white mb-2">Come usare</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm">
                <li>Seleziona il <strong className="text-white">libro</strong> (ASIN) dal menu</li>
                <li>Scegli il <strong className="text-white">marketplace</strong> (US, UK, DE…)</li>
                <li>Lascia <strong className="text-white">Dry Run attivo</strong> per simulare senza toccare Amazon</li>
                <li>Clicca su <strong className="text-white">F1 / F2 / F3 / F4 / F5</strong></li>
                <li>La risposta arriva in pochi secondi (F1, F3, F4, F5 richiedono report Amazon → risultati nei <strong className="text-white">Render logs</strong> dopo 5–10 minuti)</li>
              </ol>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 text-sm">
              <p className="font-semibold text-white mb-1">Comportamento asincrono (F1, F3, F4, F5)</p>
              <p className="text-gray-400">Per le funzioni che richiedono report Amazon (generazione 3–7 min), l'app risponde immediatamente con un messaggio di conferma. L'esecuzione reale avviene in background: controlla i <strong className="text-white">Render Logs</strong> su render.com per vedere i risultati dettagliati.</p>
            </div>

            <div>
              <p className="font-semibold text-white mb-2">Override parametri</p>
              <p className="text-sm text-gray-400 mb-2">Attivando "Override Parametri" puoi modificare temporaneamente i valori solo per quel test, senza toccare le impostazioni di produzione:</p>
              <ul className="list-disc list-inside text-sm space-y-1 text-gray-400">
                <li><span className="text-gray-300">clicksNegative / spendNegative</span> (F4): soglie per il negative targeting</li>
                <li><span className="text-gray-300">skipPart1</span> (F4): salta bid optimization, testa solo negative targeting</li>
                <li><span className="text-gray-300">minOrders</span> (F5): ordini minimi per promuovere un search term</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-white mb-2">Leggere i risultati</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><span className="text-green-400">executed</span> — funzione eseguita (o simulata in dry run), modifiche applicate</li>
                <li><span className="text-gray-400">skipped</span> — campagna non idonea o nessun dato rilevante</li>
                <li><span className="text-red-400">error</span> — errore API o timeout report</li>
              </ul>
              <p className="text-sm mt-2">Usa <strong className="text-white">"Copia JSON"</strong> per salvare il risultato completo negli appunti.</p>
            </div>
          </div>
        </Section>

        {/* ── IMPOSTAZIONI ── */}
        <Section title="Impostazioni" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }>
          <div className="space-y-4">
            <p>Tutti i parametri delle funzioni F1–F5 e le impostazioni generali dell'account.</p>
            <Table
              headers={['Parametro', 'Funzione', 'Descrizione']}
              rows={[
                ['Bid Increase', 'F1', 'Incremento fisso del bid per ogni esecuzione (es. $0.02)'],
                ['Max Impressions', 'F1', 'Impressioni massime: sopra questa soglia F1 non aumenta il bid'],
                ['Max Clicks', 'F1', 'Click massimi: sopra questa soglia F1 non aumenta il bid'],
                ['Placement Timeframe', 'F2', 'Settimane di dati usati per calcolare le performance dei placement'],
                ['Clicks Pause', 'F3', 'Numero di click senza ordini oltre cui la keyword/ASIN viene messa in pausa'],
                ['Clicks 65gg', 'F3', 'Soglia click sullo storico a 65 giorni per la pausa'],
                ['Clicks Negative', 'F4', 'Click senza ordini oltre cui il search term diventa negativo nella campagna auto'],
                ['Spend Negative', 'F4', 'Spesa senza ordini oltre cui il search term diventa negativo'],
                ['Min Orders', 'F5', 'Ordini minimi richiesti a un search term per promuoverlo nelle campagne manuali'],
                ['Bid Broad/Exact/Phrase', 'F5', 'Bid iniziale assegnato al search term promosso per ogni tipo di match'],
                ['Frequency (tutti)', 'F1–F5', 'Giorni minimi tra un\'esecuzione e la successiva della stessa funzione sulla stessa campagna'],
                ['VAT %', 'Generale', 'Percentuale IVA da includere nel calcolo del FAST ACoS (se abilitato)'],
              ]}
            />
          </div>
        </Section>

        {/* ── NOTIFICHE EMAIL ── */}
        <Section title="Notifiche Email" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }>
          <div className="space-y-4">
            <p>Il sistema invia email automatiche tramite <strong className="text-white">Resend API</strong> per ogni ciclo di automazione.</p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-white mb-1">Email Fase 1 (Submit Reports)</p>
                <p className="text-gray-400">Conferma che i report sono stati richiesti ad Amazon, con elenco campagne e funzioni coinvolte.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Email Fase 2 (Process Reports)</p>
                <p className="text-gray-400">Riepilogo completo dell'esecuzione: status per ogni campagna (OK / ERRORE), azioni applicate, bid modificati, keyword/ASIN messi in pausa o promossi.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Test Email</p>
                <p className="text-gray-400">Nella pagina <strong className="text-white">Test</strong> trovi il pulsante <strong className="text-white">"Invia Email Test"</strong> per verificare la configurazione.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── FAST ACOS ── */}
        <Section title="Formula FAST ACoS" icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }>
          <div className="space-y-3 text-sm">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="font-mono text-orange-300 text-base mb-2">FAST ACoS = Royalty netta / Prezzo di vendita</p>
              <p className="text-gray-400">dove <span className="text-gray-300">Royalty netta = Royalty lorda − Costo di stampa</span> (calcolato in base a pagine, formato, ink type e marketplace).</p>
            </div>
            <p>Rappresenta l'ACoS massimo sostenibile prima di andare in perdita. Se l'ACoS delle campagne è inferiore al FAST ACoS, il libro è in profitto.</p>
            <p>Viene usato da <strong className="text-white">F2</strong> per decidere come aggiustare i placement, e da <strong className="text-white">F3</strong> per calcolare i bid ottimali sui target performanti.</p>
            <p>Il campo <strong className="text-white">VAT</strong> nelle impostazioni permette di includere l'IVA nel calcolo (es. 22% per l'Italia).</p>
          </div>
        </Section>

      </div>
    </div>
  );
}
