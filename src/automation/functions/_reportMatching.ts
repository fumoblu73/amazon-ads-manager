// ================================================
// SHARED REPORT MATCHING HELPER
// ================================================
// Helper condiviso fra F1/F3/F4 per matchare le righe del report v3 spTargeting
// con keywords/targets recuperati via API.
//
// Problema risolto: il report v3 spTargeting NON contiene 'keywordId' né 'targetId'
// (sono filtrate via in invalidColumns di requestReportV3), e il campo 'targeting' contiene
// il TESTO della keyword (es. "best seller"), non l'ID numerico.
// Match per ID quindi fallisce sempre → metrics undefined → defaults a 0.

/**
 * Confronta il campo 'targeting' del report (testo keyword o espressione ASIN)
 * con il matchTarget dell'item (keywordText o resolvedExpression value).
 *
 * API v3 usa formati come: 'asin="B0XXXX"', 'keyword text', ecc.
 * quindi serve un match flessibile (esatto, includes in entrambe le direzioni).
 */
export function matchTargeting(reportTargeting: string | undefined | null, itemMatchTarget: string | undefined | null): boolean {
  if (!reportTargeting || !itemMatchTarget) return false;
  if (reportTargeting === itemMatchTarget) return true;
  if (reportTargeting.includes(itemMatchTarget)) return true;
  if (itemMatchTarget.includes(reportTargeting)) return true;
  return false;
}

/**
 * Estrae il "match target" usabile per il matching da un item (keyword o target).
 */
export function extractMatchTarget(item: any): string {
  return item.keywordText
    || item.resolvedExpression?.value
    || item.expression?.[0]?.value
    || '';
}

/**
 * Trova le metriche per un item nel report. Prova prima il match per ID
 * (per backward compat se mai un report contenesse keywordId/targetId),
 * poi fallback su matching testuale via 'targeting'.
 */
export function findMetricsForItem(reportData: any[], item: any): any | undefined {
  const itemId = item.keywordId || item.targetId;
  const itemIdStr = itemId !== undefined && itemId !== null ? String(itemId) : '';
  const matchTarget = extractMatchTarget(item);

  return reportData.find((r: any) =>
    (itemIdStr && r.keywordId && String(r.keywordId) === itemIdStr) ||
    (itemIdStr && r.targetId && String(r.targetId) === itemIdStr) ||
    matchTargeting(r.targeting, matchTarget)
  );
}
