# Piano Implementazione: Integrazione OAuth per Amazon Ads API Automations

## 🎯 Obiettivo
Integrare completamente l'OAuth "Login with Amazon" con le automazioni Amazon Ads, passando da un sistema globale con refresh token unico a un sistema multi-utente dove ogni user ha i propri token.

---

## 📊 Step di Implementazione

### **STEP 1: Database Schema & Migration**
**Tempo stimato: 30 minuti**

#### 1.1 Aggiornare User Entity
**File:** `src/entities/User.ts`

Aggiungere campi OAuth:
```typescript
@Column({ type: 'varchar', length: 100, unique: true, nullable: true })
amazonUserId: string;

@Column({ type: 'text', nullable: true })
accessToken: string;

@Column({ type: 'text', nullable: true })
refreshToken: string;

@Column({ type: 'bigint', nullable: true })
profileId: number;

@Column({ type: 'varchar', length: 10, nullable: true })
countryCode: string;

@Column({ type: 'varchar', length: 10, nullable: true })
currencyCode: string;

@Column({ type: 'timestamp', nullable: true })
tokenExpiresAt: Date;

@Column({ type: 'timestamp', nullable: true })
lastLoginAt: Date;

@Column({ type: 'boolean', default: true })
isActive: boolean;

@Column({ type: 'varchar', length: 255, nullable: true })
name: string;
```

**Rimuovere:** `passwordHash` (non più necessario con OAuth)

**✅ Checkpoint:** Entity compila senza errori TypeScript

---

#### 1.2 Creare Migration SQL
**File:** `migrations/006_add_oauth_to_users.sql`

```sql
-- Add OAuth columns
ALTER TABLE users
  ADD COLUMN amazon_user_id VARCHAR(100),
  ADD COLUMN access_token TEXT,
  ADD COLUMN refresh_token TEXT,
  ADD COLUMN profile_id BIGINT,
  ADD COLUMN country_code VARCHAR(10),
  ADD COLUMN currency_code VARCHAR(10),
  ADD COLUMN token_expires_at TIMESTAMP,
  ADD COLUMN last_login_at TIMESTAMP,
  ADD COLUMN is_active BOOLEAN DEFAULT true,
  ADD COLUMN name VARCHAR(255);

-- Drop password column (OAuth only)
ALTER TABLE users DROP COLUMN password_hash;

-- Add indexes
CREATE UNIQUE INDEX idx_users_amazon_user_id ON users(amazon_user_id);
CREATE INDEX idx_users_is_active ON users(is_active);
```

**✅ Checkpoint:** Migration eseguita con successo su DB locale

---

### **STEP 2: Creare UserAmazonApiService (Per-User API)**
**Tempo stimato: 2 ore**

#### 2.1 Creare nuovo servizio
**File:** `src/services/UserAmazonApiService.ts`

**Caratteristiche:**
- Accetta `userId` nel constructor
- Carica token dal database per quel user
- Auto-refresh token prima di ogni chiamata
- Supporta multi-region (EU/NA/FE) basato su profileId dell'user
- Implementa TUTTI i metodi di `amazonApi.ts`

**Template:**
```typescript
import axios, { AxiosInstance } from 'axios';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { AmazonAuthService } from './amazon-auth.service';
import { getApiEndpoint } from '../config/amazon';

export class UserAmazonApiService {
  private client: AxiosInstance;
  private userId: string;
  private user: User | null = null;
  private accessToken: string = '';

  constructor(userId: string) {
    this.userId = userId;
    this.client = axios.create({
      headers: { 'Content-Type': 'application/json' }
    });

    // Interceptor: auto-refresh token
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();

      const endpoint = getApiEndpoint(this.user?.countryCode);
      config.baseURL = endpoint;
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      config.headers['Amazon-Advertising-API-ClientId'] = process.env.AMAZON_ADS_CLIENT_ID;
      config.headers['Amazon-Advertising-API-Scope'] = this.user?.profileId?.toString();

      return config;
    });
  }

  private async loadUser(): Promise<User> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: this.userId } });

    if (!user) throw new Error('User not found');
    if (!user.amazonUserId) throw new Error('User not connected to Amazon');

    return user;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.user) {
      this.user = await this.loadUser();
    }

    // Check if token expired
    if (AmazonAuthService.isTokenExpired(this.user.tokenExpiresAt)) {
      await this.refreshAccessToken();
    } else {
      this.accessToken = this.user.accessToken!;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    console.log(`🔄 Refreshing token for user ${this.userId}...`);

    const tokens = await AmazonAuthService.refreshAccessToken(this.user!.refreshToken!);

    // Update database
    const userRepo = AppDataSource.getRepository(User);
    this.user!.accessToken = tokens.access_token;
    this.user!.refreshToken = tokens.refresh_token;
    this.user!.tokenExpiresAt = AmazonAuthService.calculateTokenExpiry(tokens.expires_in);
    await userRepo.save(this.user!);

    this.accessToken = tokens.access_token;
    console.log('✅ Token refreshed');
  }

  // ======== METODI API ========
  // Copia TUTTI i metodi da amazonApi.ts:
  // - getProfiles()
  // - getCampaigns()
  // - getCampaignsForProfile(profileId)
  // - getKeywords(campaignId?)
  // - updateKeywordBid(keywordId, newBid)
  // - getTargets(campaignId?)
  // - updateTargetBid(targetId, newBid)
  // - updateCampaignPlacements(campaignId, placements)
  // - getAutoTargetingGroups(campaignId)
  // - addNegativeKeyword(...)
  // - addNegativeTarget(...)
  // - requestSearchTermsReport(...)
  // - addKeywords(...)
  // - addTargets(...)
  // - requestReport(...)
  // - getReportStatus(reportId)
  // - downloadReport(reportId)
  // - waitAndDownloadReport(reportId, maxAttempts?)

  async getProfiles(): Promise<any[]> {
    const response = await this.client.get('/v2/profiles');
    return response.data;
  }

  async getCampaigns(): Promise<any[]> {
    return this.getCampaignsForProfile(this.user!.profileId!.toString());
  }

  async getCampaignsForProfile(profileId: string): Promise<any[]> {
    const response = await this.client.post('/sp/campaigns/list', {
      maxResults: 1000,
      stateFilter: { include: ['ENABLED', 'PAUSED', 'ARCHIVED'] }
    }, {
      headers: {
        'Content-Type': 'application/vnd.spcampaign.v3+json',
        'Accept': 'application/vnd.spcampaign.v3+json',
        'Amazon-Advertising-API-Scope': profileId
      }
    });
    return response.data.campaigns || [];
  }

  // ... copiare TUTTI gli altri metodi da amazonApi.ts
}
```

**✅ Checkpoint:** Service compila, può essere istanziato, chiama API con token user

---

#### 2.2 Creare Factory Helper
**File:** `src/services/UserAmazonApiFactory.ts`

```typescript
import { UserAmazonApiService } from './UserAmazonApiService';

export function createUserAmazonApiService(userId: string): UserAmazonApiService {
  return new UserAmazonApiService(userId);
}
```

**✅ Checkpoint:** Factory crea istanze correttamente

---

### **STEP 3: Middleware per Amazon Auth**
**Tempo stimato: 1 ora**

#### 3.1 Creare Middleware requireAmazonAuth
**File:** `src/middleware/requireAmazonAuth.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { AmazonAuthService } from '../services/amazon-auth.service';

export interface AuthRequest extends Request {
  userId?: string;
  user?: User;
  amazonAuthValid?: boolean;
}

export const requireAmazonAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Assume authMiddleware già eseguito
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.userId } });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!user.amazonUserId || !user.refreshToken) {
      res.status(403).json({
        error: 'Amazon authentication required',
        message: 'Please connect your Amazon Ads account',
        authUrl: '/api/auth/amazon'
      });
      return;
    }

    // Check token expiry, refresh if needed
    if (AmazonAuthService.isTokenExpired(user.tokenExpiresAt)) {
      try {
        const newTokens = await AmazonAuthService.refreshAccessToken(user.refreshToken);
        user.accessToken = newTokens.access_token;
        user.refreshToken = newTokens.refresh_token;
        user.tokenExpiresAt = AmazonAuthService.calculateTokenExpiry(newTokens.expires_in);
        await userRepo.save(user);
      } catch (error) {
        res.status(401).json({
          error: 'Amazon token expired',
          message: 'Please reconnect your Amazon account',
          authUrl: '/api/auth/amazon'
        });
        return;
      }
    }

    req.user = user;
    req.amazonAuthValid = true;
    next();
  } catch (error) {
    console.error('Amazon auth middleware error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};
```

**✅ Checkpoint:** Middleware blocca richieste senza token Amazon, permette con token validi

---

### **STEP 4: Aggiornare Funzioni Automation**
**Tempo stimato: 1.5 ore**

#### 4.1 Modificare Signature Funzioni
**Files:** `src/automation/functions/func1.ts`, `func2.ts`, `func3.ts`, `func4.ts`, `func5.ts`

**Cambiamenti:**
1. Aggiungere parametro `apiService: UserAmazonApiService`
2. Sostituire tutti i riferimenti a `amazonApiService` con `apiService`

**Esempio func1.ts:**
```typescript
// PRIMA:
import { amazonApiService } from '../../services/amazonApi';

export async function executeFunc1(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  marketplace: string,
  config?: Partial<Func1Config>
): Promise<Func1Result> {
  // ... usa amazonApiService
  const keywords = await amazonApiService.getKeywords(campaignId);
}

// DOPO:
import { UserAmazonApiService } from '../../services/UserAmazonApiService';

export async function executeFunc1(
  campaignId: string,
  campaignType: 1 | 2 | 3 | 4,
  campaignName: string,
  marketplace: string,
  apiService: UserAmazonApiService,  // NUOVO
  config?: Partial<Func1Config>
): Promise<Func1Result> {
  // ... usa apiService passato
  const keywords = await apiService.getKeywords(campaignId);
}
```

**Ripetere per func2, func3, func4, func5**

**✅ Checkpoint:** Tutte le funzioni accettano UserAmazonApiService, compilano senza errori

---

### **STEP 5: Aggiornare Orchestrazione Automation**
**Tempo stimato: 2 ore**

#### 5.1 Aggiungere userId a Campaign Entity
**File:** `src/entities/Campaign.ts` (se esiste) o creare

```typescript
import { User } from './User';

@Entity('campaigns')
export class Campaign {
  // ... campi esistenti ...

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, user => user.campaigns)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

**Migration:** `migrations/007_add_user_to_campaigns.sql`
```sql
ALTER TABLE campaigns ADD COLUMN user_id UUID;
ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
```

**✅ Checkpoint:** Campaign ha relazione con User

---

#### 5.2 Creare runAutomationRulesForUser
**File:** `src/automation/rules.ts`

```typescript
import { createUserAmazonApiService } from '../services/UserAmazonApiFactory';
import { AppDataSource } from '../data-source';
import { Campaign } from '../entities/Campaign';

export async function runAutomationRulesForUser(userId: string): Promise<void> {
  console.log(`🤖 Running automations for user ${userId}...`);

  // Create per-user API service
  const apiService = createUserAmazonApiService(userId);

  // Get user's campaigns
  const campaignRepo = AppDataSource.getRepository(Campaign);
  const campaigns = await campaignRepo.find({
    where: { userId, isActive: true }
  });

  console.log(`Found ${campaigns.length} campaigns for user ${userId}`);

  for (const campaign of campaigns) {
    try {
      // Check warmup periods, frequencies, etc. (existing logic)

      // Execute functions with user's API service
      if (shouldRunFunc1(campaign)) {
        await executeFunc1(
          campaign.amazonCampaignId,
          campaign.type,
          campaign.name,
          campaign.marketplace,
          apiService,  // <-- passa il servizio per-user
          campaign.func1Config
        );
      }

      if (shouldRunFunc2(campaign)) {
        await executeFunc2(campaign.amazonCampaignId, campaign.marketplace, apiService, campaign.func2Config);
      }

      // ... altre funzioni

    } catch (error) {
      console.error(`Error running automation for campaign ${campaign.id}:`, error);
      // Log error but continue with other campaigns
    }
  }

  console.log(`✅ Completed automations for user ${userId}`);
}
```

**✅ Checkpoint:** Automation gira per singolo user con i suoi token

---

#### 5.3 Aggiornare Scheduler
**File:** `src/automation/scheduler.ts`

```typescript
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { IsNull, Not } from 'typeorm';

class AutomationScheduler {
  // ... existing code ...

  async runNow(): Promise<void> {
    console.log('🔄 Starting automation run for ALL users...');

    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      where: {
        isActive: true,
        amazonUserId: Not(IsNull())
      }
    });

    console.log(`Found ${users.length} active users with Amazon auth`);

    for (const user of users) {
      try {
        await runAutomationRulesForUser(user.id);
      } catch (error) {
        console.error(`Failed to run automations for user ${user.id}:`, error);
        // Continue with other users
      }
    }

    console.log('✅ Completed automation run for all users');
  }
}
```

**✅ Checkpoint:** Scheduler esegue automation per tutti gli users attivi

---

### **STEP 6: Aggiornare Routes**
**Tempo stimato: 1.5 ore**

#### 6.1 Aggiornare Campaign Routes
**File:** `src/routes/campaigns.ts`

```typescript
import { authMiddleware } from '../middleware/auth';
import { requireAmazonAuth, AuthRequest } from '../middleware/requireAmazonAuth';
import { createUserAmazonApiService } from '../services/UserAmazonApiFactory';

// GET /api/campaigns/profiles
router.get('/profiles',
  authMiddleware,
  requireAmazonAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const apiService = createUserAmazonApiService(req.userId!);
      const profiles = await apiService.getProfiles();
      res.json({ success: true, data: profiles });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profiles' });
    }
  }
);

// POST /api/campaigns/sync-from-amazon
router.post('/sync-from-amazon',
  authMiddleware,
  requireAmazonAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const apiService = createUserAmazonApiService(req.userId!);

      // Sync campaigns for THIS user only
      const campaigns = await apiService.getCampaigns();

      const campaignRepo = AppDataSource.getRepository(Campaign);

      for (const amazonCampaign of campaigns) {
        let campaign = await campaignRepo.findOne({
          where: {
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            userId: req.userId  // <-- IMPORTANTE: filtra per user
          }
        });

        if (!campaign) {
          campaign = campaignRepo.create({
            userId: req.userId,  // <-- Associa al user
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            // ... altri campi
          });
        }

        // Update fields
        campaign.name = amazonCampaign.name;
        campaign.state = amazonCampaign.state;
        // ...

        await campaignRepo.save(campaign);
      }

      res.json({ success: true, synced: campaigns.length });
    } catch (error) {
      res.status(500).json({ error: 'Sync failed' });
    }
  }
);

// GET /api/campaigns
router.get('/',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const campaignRepo = AppDataSource.getRepository(Campaign);
      const campaigns = await campaignRepo.find({
        where: { userId: req.userId }  // <-- Solo campagne dell'user
      });
      res.json({ success: true, data: campaigns });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  }
);
```

**✅ Checkpoint:** Campaign routes filtrano per userId, usano per-user API service

---

#### 6.2 Aggiornare Automation Routes
**File:** `src/routes/automation.ts`

```typescript
// POST /api/automation/trigger (CRON endpoint - runs for all users)
router.post('/trigger', async (req: Request, res: Response) => {
  const { secret } = req.body;

  if (secret !== process.env.AUTOMATION_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  res.json({ success: true, message: 'Automation triggered for all users' });

  // Run in background
  automationScheduler.runNow().catch(console.error);
});

// POST /api/automation/trigger-user (User-specific manual trigger)
router.post('/trigger-user',
  authMiddleware,
  requireAmazonAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      res.json({ success: true, message: 'Your automation has been queued' });

      // Run in background
      runAutomationRulesForUser(req.userId!).catch(console.error);
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger automation' });
    }
  }
);
```

**✅ Checkpoint:** Automation può essere triggerata globalmente (cron) o per singolo user

---

### **STEP 7: Testing**
**Tempo stimato: 2 ore**

#### 7.1 Test Manuale Flow Completo

1. **Registrazione OAuth:**
   - Vai a `/api/auth/amazon`
   - Completa OAuth Amazon
   - Verifica che token siano salvati in database

2. **Sync Campaigns:**
   - Call `POST /api/campaigns/sync-from-amazon`
   - Verifica che campaigns abbiano `userId` corretto

3. **Trigger Automation Manuale:**
   - Call `POST /api/automation/trigger-user`
   - Verifica nei log che automation giri con i token giusti

4. **Multi-User Test:**
   - Crea secondo user
   - OAuth per secondo user
   - Sync campaigns per secondo user
   - Verifica che campaigns siano separate per user

**✅ Checkpoint:** Tutti i test manuali passano

---

#### 7.2 Test Token Refresh

1. Imposta `tokenExpiresAt` nel passato per un user
2. Fai una chiamata API
3. Verifica che token venga auto-refreshed
4. Verifica che nuovo token sia salvato in DB

**✅ Checkpoint:** Token refresh automatico funziona

---

### **STEP 8: Deployment**
**Tempo stimato: 1 ora**

#### 8.1 Aggiornare Environment Variables su Render

Assicurati che siano impostate:
```
AMAZON_ADS_CLIENT_ID=amzn1.application-oa2-client.xxx
AMAZON_ADS_CLIENT_SECRET=xxx
AMAZON_ADS_REDIRECT_URI_PROD=https://your-app.onrender.com/api/auth/callback
AMAZON_ADS_SCOPES=advertising::campaign_management
```

**✅ Checkpoint:** Env vars configurate

---

#### 8.2 Run Migrations su Production DB

```bash
# Backup database
# Run migration 006
# Run migration 007
# Verify schema
```

**✅ Checkpoint:** Production DB migrato

---

#### 8.3 Deploy to Production

```bash
git add .
git commit -m "Implement OAuth integration for automations"
git push origin main
```

Render auto-deploys.

**✅ Checkpoint:** Production deployment completato

---

## 📋 Checklist Finale

- [ ] User entity ha campi OAuth
- [ ] Migration 006 eseguita (oauth to users)
- [ ] Migration 007 eseguita (user_id to campaigns)
- [ ] UserAmazonApiService creato e testato
- [ ] requireAmazonAuth middleware creato
- [ ] Tutte e 5 le funzioni automation aggiornate
- [ ] rules.ts ha runAutomationRulesForUser()
- [ ] scheduler.ts esegue automation per tutti gli users
- [ ] Campaign routes filtrano per userId
- [ ] Automation routes supportano per-user trigger
- [ ] Auth routes salvano token correttamente
- [ ] Token auto-refresh funziona
- [ ] Multi-user test passato
- [ ] Production deployment fatto

---

## ⏱️ Tempo Totale Stimato
**6-8 ore di lavoro effettivo**

---

## 🚨 Possibili Problemi

### Problema 1: "User entity e User model sono diversi"
**Soluzione:** Il progetto ha sia `src/entities/User.ts` (TypeORM) che `src/models/User.ts` (plain interface). Devi aggiornare l'**entity**, non il model.

### Problema 2: "Migration fallisce su Render"
**Soluzione:** Esegui migration manualmente via SQL direttamente su Supabase Dashboard prima del deploy.

### Problema 3: "Token non si refresha"
**Soluzione:** Verifica che `AMAZON_ADS_CLIENT_SECRET` sia corretto nelle env vars di production.

### Problema 4: "Automation non parte"
**Soluzione:** Controlla che ci siano users con `amazonUserId NOT NULL` e `isActive = true`.

---

## 🎯 Prossimi Step

Vuoi che proceda con l'implementazione step-by-step? Posso:

1. **Iniziare con Step 1** (Database Schema)
2. **Fare tutti gli step in sequenza**
3. **Concentrarmi su uno step specifico**

Dimmi come preferisci procedere!
