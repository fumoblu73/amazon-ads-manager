# Regole per questo progetto — Amazon Ads Manager

## Regole sempre attive (in ogni sessione, in ogni chat)

### 1. Commit e Push — approvazione obbligatoria
Prima di ogni `git commit` e `git push`, devo:
- Chiedere esplicitamente l'**OK finale** all'utente
- Fornire una **considerazione** su urgenza vs rinvio:
  - Se il fix è critico (es. blocca il deploy, causa errori runtime) → commit + push immediato
  - Se la modifica è un miglioramento non urgente → segnalare che può aspettare il prossimo deploy
- Non eseguire commit o push automaticamente, nemmeno se l'utente ha detto "fai pure" in un contesto precedente

### 2. Quota Claude — limitazione nota
Non ho accesso ai dati di quota/consumo del piano Claude dell'utente. Non posso monitorare questo automaticamente. L'utente può verificare su claude.ai/settings.

---

## Note operative
- Le regole possono essere aggiunte o modificate in qualsiasi momento chiedendolo esplicitamente
- Queste regole hanno priorità su qualsiasi comportamento di default
