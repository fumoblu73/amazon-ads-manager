import nodemailer from 'nodemailer';

// ================================================
// EMAIL SERVICE - Notifiche automazione
// ================================================

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;

  const port = parseInt(process.env.SMTP_PORT || '465');
  const secure = port === 465; // true per SSL (465), false per STARTTLS (587)

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

const transporter = createTransporter();

const EMAIL_FROM = process.env.EMAIL_FROM || 'Amazon Ads Manager <noreply@example.com>';
const EMAIL_TO = process.env.EMAIL_TO || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://amazon-ads-manager-qsio.onrender.com';

function isConfigured(): boolean {
  return !!(transporter && EMAIL_TO);
}

// ================================================
// EMAIL: Test di verifica configurazione
// ================================================

export async function sendTestEmail(): Promise<{ success: boolean; message: string; config: any }> {
  const config = {
    smtpHost: process.env.SMTP_HOST || '(non configurato)',
    smtpPort: process.env.SMTP_PORT || '(non configurato)',
    smtpUser: process.env.SMTP_USER ? '***configurato***' : '(non configurato)',
    smtpPassword: process.env.SMTP_PASSWORD ? '***configurato***' : '(non configurato)',
    emailFrom: EMAIL_FROM,
    emailTo: EMAIL_TO || '(non configurato)',
    frontendUrl: FRONTEND_URL,
  };

  if (!isConfigured()) {
    return { success: false, message: 'Email non configurata. Verifica le variabili SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_TO su Render.', config };
  }

  try {
    const date = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

    // Invia email di test con dati simulati
    const html = buildEmailTemplate({
      title: 'Test Notifica Email',
      date,
      body: `
        <p style="color:#22c55e;font-size:16px;font-weight:bold">La configurazione email funziona correttamente!</p>

        <p style="color:#e5e7eb">Questo e' un test del sistema di notifiche. In produzione riceverai:</p>

        <ul style="color:#e5e7eb;line-height:2">
          <li><strong>Fase 1</strong>: conferma invio report ad Amazon</li>
          <li><strong>Fase 2</strong>: riepilogo con status per campagna</li>
          <li><strong>Errori</strong>: alert con dettagli dei fallimenti</li>
        </ul>

        <h3 style="color:#f97316;margin:20px 0 10px">Esempio riepilogo:</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid #f97316">
              <th style="text-align:left;padding:8px;color:#f97316">Campagna</th>
              <th style="text-align:left;padding:8px;color:#f97316">Funzioni</th>
              <th style="text-align:left;padding:8px;color:#f97316">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">Product - 7/2/2025</td>
              <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">F1, F2, F3</td>
              <td style="padding:8px;border-bottom:1px solid #333">
                <span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">OK</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">Auto - 7/2/2025</td>
              <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">F2, F4</td>
              <td style="padding:8px;border-bottom:1px solid #333">
                <span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">ERRORE</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="background:#450a0a;border:1px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0">
          <h3 style="color:#ef4444;margin:0 0 8px 0">Esempio errore:</h3>
          <div style="color:#fca5a5">&#10060; <strong>Auto - 7/2/2025</strong>: Report not ready after 20 attempts</div>
        </div>

        <p style="color:#9ca3af;font-size:12px;margin-top:20px">
          Configurazione: ${config.smtpHost}:${config.smtpPort} | Da: ${config.emailFrom} | A: ${config.emailTo}
        </p>
      `,
    });

    await transporter!.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: '[ADS Manager] Test notifica email - Configurazione OK',
      html,
    });

    return { success: true, message: `Email di test inviata a ${EMAIL_TO}`, config };
  } catch (error: any) {
    return { success: false, message: `Errore invio: ${error.message}`, config };
  }
}

// ================================================
// INTERFACES
// ================================================

export interface ReportSummaryItem {
  campaignName: string;
  campaignId: string;
  functions: number[];
  status: 'processed' | 'failed' | 'pending';
  error?: string;
  details?: string;
}

export interface SubmitSummaryItem {
  campaignName: string;
  campaignId: string;
  reportId: string;
  functions: number[];
}

// ================================================
// EMAIL: Riepilogo Fase 2 (Process Reports)
// ================================================

export async function sendAutomationSummary(
  items: ReportSummaryItem[],
  stats: { processed: number; failed: number; stillPending: number }
): Promise<void> {
  if (!isConfigured()) {
    console.log('📧 Email non configurata, skip invio riepilogo');
    return;
  }

  try {
    const hasErrors = stats.failed > 0;
    const date = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

    const subject = hasErrors
      ? `[ADS Manager] Automazione completata con ${stats.failed} errori`
      : `[ADS Manager] Automazione completata - ${stats.processed} report processati`;

    const rowsHtml = items.map(item => {
      const statusColor = item.status === 'processed' ? '#22c55e'
        : item.status === 'failed' ? '#ef4444' : '#eab308';
      const statusText = item.status === 'processed' ? 'OK'
        : item.status === 'failed' ? 'ERRORE' : 'PENDING';
      const funcs = item.functions.map(f => `F${f}`).join(', ');

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">${item.campaignName}</td>
        <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">${funcs}</td>
        <td style="padding:8px;border-bottom:1px solid #333">
          <span style="background:${statusColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">${statusText}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #333;color:#9ca3af;font-size:12px">${item.details || item.error || '-'}</td>
      </tr>`;
    }).join('');

    const errorsSection = hasErrors ? `
      <div style="background:#450a0a;border:1px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0">
        <h3 style="color:#ef4444;margin:0 0 8px 0">Errori rilevati</h3>
        ${items.filter(i => i.status === 'failed').map(i => `
          <div style="color:#fca5a5;margin:4px 0">
            &#10060; <strong>${i.campaignName}</strong>: ${i.error || 'Errore sconosciuto'}
          </div>
        `).join('')}
      </div>
    ` : '';

    const html = buildEmailTemplate({
      title: 'Riepilogo Automazione',
      date,
      body: `
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="border-bottom:2px solid #f97316">
              <th style="text-align:left;padding:8px;color:#f97316">Campagna</th>
              <th style="text-align:left;padding:8px;color:#f97316">Funzioni</th>
              <th style="text-align:left;padding:8px;color:#f97316">Status</th>
              <th style="text-align:left;padding:8px;color:#f97316">Dettagli</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div style="color:#9ca3af;margin:16px 0">
          Report processati: <strong style="color:#fff">${stats.processed}</strong> |
          Falliti: <strong style="color:${stats.failed > 0 ? '#ef4444' : '#fff'}">${stats.failed}</strong> |
          Ancora pending: <strong style="color:#fff">${stats.stillPending}</strong>
        </div>

        ${errorsSection}
      `,
    });

    await transporter!.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      html,
    });

    console.log(`📧 Email riepilogo inviata a ${EMAIL_TO}`);
  } catch (error: any) {
    console.error(`📧 Errore invio email riepilogo: ${error.message}`);
  }
}

// ================================================
// EMAIL: Conferma Fase 1 (Submit Reports)
// ================================================

export async function sendSubmitConfirmation(
  items: SubmitSummaryItem[],
  marketplace: string
): Promise<void> {
  if (!isConfigured()) return;

  try {
    const date = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

    const rowsHtml = items.map(item => {
      const funcs = item.functions.map(f => `F${f}`).join(', ');
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">${item.campaignName}</td>
        <td style="padding:8px;border-bottom:1px solid #333;color:#e5e7eb">${funcs}</td>
        <td style="padding:8px;border-bottom:1px solid #333;color:#9ca3af;font-size:12px">${item.reportId.substring(0, 12)}...</td>
      </tr>`;
    }).join('');

    const html = buildEmailTemplate({
      title: 'Report Inviati (Fase 1)',
      date,
      body: `
        <p style="color:#e5e7eb">
          <strong>${items.length}</strong> report inviati ad Amazon per il marketplace <strong>${marketplace}</strong>.
          I risultati saranno processati nella Fase 2.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="border-bottom:2px solid #f97316">
              <th style="text-align:left;padding:8px;color:#f97316">Campagna</th>
              <th style="text-align:left;padding:8px;color:#f97316">Funzioni</th>
              <th style="text-align:left;padding:8px;color:#f97316">Report ID</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `,
    });

    await transporter!.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `[ADS Manager] Fase 1: ${items.length} report inviati (${marketplace})`,
      html,
    });

    console.log(`📧 Email conferma submit inviata a ${EMAIL_TO}`);
  } catch (error: any) {
    console.error(`📧 Errore invio email submit: ${error.message}`);
  }
}

// ================================================
// TEMPLATE HTML
// ================================================

function buildEmailTemplate(params: { title: string; date: string; body: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#111827;border-radius:12px;overflow:hidden;border:1px solid #374151">

    <!-- Header -->
    <div style="background:#f97316;padding:20px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:18px">Amazon Ads Manager</h1>
      <p style="margin:4px 0 0;color:#fff;opacity:0.9;font-size:14px">${params.title}</p>
    </div>

    <!-- Body -->
    <div style="padding:20px">
      <p style="color:#9ca3af;font-size:13px;margin:0 0 16px">${params.date}</p>

      ${params.body}

      <!-- CTA -->
      <div style="text-align:center;margin:24px 0">
        <a href="${FRONTEND_URL}/logs"
           style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
          Vedi dettagli completi nei Log
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 20px;border-top:1px solid #374151;text-align:center">
      <p style="color:#6b7280;font-size:11px;margin:0">
        Amazon Ads Manager | Notifica automatica
        <br>Per disattivare le notifiche, vai nelle <a href="${FRONTEND_URL}/settings" style="color:#f97316">Impostazioni</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}
