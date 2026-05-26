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
 * Trova le metriche per un item nel report.
 *
 * Il report v3 spTargeting NON è filtrato per campagna (Amazon non supporta
 * campaignIdFilter su questi report) — restituisce TUTTE le righe dell'account
 * con almeno qualche impression negli ultimi 28gg.
 *
 * Quindi è OBBLIGATORIO filtrare prima per campaignId (e quando possibile
 * adGroupId) per evitare falsi positivi tra campagne diverse che usano
 * la stessa keyword o targeting expression.
 *
 * @param reportData - tutte le righe del report (potenzialmente di più campagne)
 * @param item - keyword o target da matchare
 * @param campaignId - campagna corrente; obbligatorio per evitare cross-campaign match
 */
export function findMetricsForItem(reportData: any[], item: any, campaignId?: string): any | undefined {
  const itemId = item.keywordId || item.targetId;
  const itemIdStr = itemId !== undefined && itemId !== null ? String(itemId) : '';
  const matchTarget = extractMatchTarget(item);
  const itemAdGroupId = item.adGroupId !== undefined && item.adGroupId !== null
    ? String(item.adGroupId)
    : '';

  // Filtro 1: restringe alle righe della campagna corrente (se passata)
  const scoped = campaignId
    ? reportData.filter((r: any) => String(r.campaignId) === String(campaignId))
    : reportData;

  return scoped.find((r: any) =>
    // Match per ID (improbabile ma manteniamo per backward compat)
    (itemIdStr && r.keywordId && String(r.keywordId) === itemIdStr) ||
    (itemIdStr && r.targetId && String(r.targetId) === itemIdStr) ||
    // Match per testo, ma SOLO se adGroupId combacia (riduce falsi positivi
    // di keywords/target con stesso testo in ad group diversi della stessa campagna)
    (itemAdGroupId && r.adGroupId && String(r.adGroupId) === itemAdGroupId &&
      matchTargeting(r.targeting, matchTarget)) ||
    // Fallback: match solo testuale se item non ha adGroupId
    (!itemAdGroupId && matchTargeting(r.targeting, matchTarget))
  );
}
