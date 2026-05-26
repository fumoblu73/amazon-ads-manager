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
 * Confronta il campo 'targeting' del report con il matchTarget dell'item.
 *
 * Il report v3 spTargeting usa formati diversi a seconda del tipo:
 *   - Keyword: 'amish survival guide' (testo nudo)
 *   - ASIN target: 'asin="B0XXXX"'
 *   - Categoria target: 'category="123456"' o simili
 *   - Auto target: 'queryHighRelMatches', 'queryBroadRelMatches', etc
 *
 * L'item dall'API ha:
 *   - keyword: item.keywordText = 'amish survival guide'
 *   - ASIN target: item.expression = [{type:'ASIN_SAME_AS', value:'B0XXXX'}]
 *   - Auto target: item.expression = [{type:'QUERY_HIGH_REL_MATCHES'}] (no value)
 *
 * Strategia di matching:
 *   1. Se item.keywordText: match esatto (case-insensitive) con reportTargeting
 *   2. Se report ha 'asin="X"' e item ha expression ASIN_SAME_AS con value Y: confronta esatto X===Y
 *   3. Se report ha 'category="X"' e item ha expression CATEGORY con value Y: confronta esatto X===Y
 *   4. Altrimenti: match esatto plain (per auto targets che hanno testo simile in entrambi)
 *
 * Questo evita falsi positivi quando keyword/target hanno testi che sono prefisso
 * o suffisso di altri (es. 'amish' matchava 'amish survival guide' con il vecchio
 * algoritmo bidirectional-includes).
 */
export function matchTargeting(reportTargeting: string | undefined | null, itemMatchTarget: string | undefined | null): boolean {
  if (!reportTargeting || !itemMatchTarget) return false;

  const r = String(reportTargeting).trim();
  const t = String(itemMatchTarget).trim();

  // Match esatto (incluso ASIN nudo o keyword nuda)
  if (r.toLowerCase() === t.toLowerCase()) return true;

  // Pattern Amazon: 'asin="B0XXXX"' o 'category="123"' - estrai il valore tra virgolette
  const quotedMatch = r.match(/^[a-zA-Z]+="([^"]+)"$/);
  if (quotedMatch) {
    const innerValue = quotedMatch[1];
    if (innerValue.toLowerCase() === t.toLowerCase()) return true;
  }

  return false;
}

/**
 * Estrae il "match target" da un item. Per keyword usa keywordText;
 * per target ASIN/categoria usa il primo expression.value.
 *
 * NB: expression è un ARRAY (non un oggetto) — il bug precedente in
 * resolvedExpression?.value (oggetto vs array) restituiva sempre undefined.
 */
export function extractMatchTarget(item: any): string {
  if (item.keywordText) return String(item.keywordText);

  // expression e resolvedExpression sono array
  const exprArray = Array.isArray(item.resolvedExpression) ? item.resolvedExpression
                  : Array.isArray(item.expression) ? item.expression
                  : null;
  if (exprArray && exprArray.length > 0 && exprArray[0]?.value) {
    return String(exprArray[0].value);
  }

  return '';
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
