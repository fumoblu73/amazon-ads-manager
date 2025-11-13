/**
 * Script di test per verificare le automazioni
 * Esegue test su tutte le 5 funzioni senza modificare dati reali
 */

import dotenv from 'dotenv';
import { initializeDatabase } from '../config/database';
import { func1ProgressiveBidding } from '../automation/functions/func1';
import { func2PlacementOptimization } from '../automation/functions/func2';
import { func3TargetingOptimization } from '../automation/functions/func3';
import { func4AutoAdOptimization } from '../automation/functions/func4';
import { func5CampaignFeeding } from '../automation/functions/func5';

dotenv.config();

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Logger colorato per test
 */
const testLogger = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}${'='.repeat(60)}${colors.reset}\n`),
};

/**
 * Interfaccia per risultati test
 */
interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Esegue una funzione di automazione e traccia il risultato
 */
async function testAutomationFunction(
  name: string,
  fn: () => Promise<void>,
  dryRun: boolean = true
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    testLogger.info(`Avvio test: ${name}...`);

    if (dryRun) {
      testLogger.warn('Modalità DRY RUN attiva - nessuna modifica verrà effettuata');
    }

    await fn();

    const duration = Date.now() - startTime;
    testLogger.success(`Test completato: ${name} (${duration}ms)`);

    return {
      name,
      status: 'success',
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testLogger.error(`Test fallito: ${name} - ${error.message}`);

    return {
      name,
      status: 'error',
      duration,
      error: error.message,
    };
  }
}

/**
 * Test completo di tutte le funzioni
 */
async function runAllTests(dryRun: boolean = true): Promise<TestResult[]> {
  const results: TestResult[] = [];

  testLogger.section('TEST AUTOMAZIONI AMAZON ADS MANAGER');

  // Test 1: Progressive Bidding
  testLogger.section('Test 1: Progressive Bidding (Funzione 1)');
  results.push(await testAutomationFunction(
    'Progressive Bidding',
    () => func1ProgressiveBidding(),
    dryRun
  ));

  // Test 2: Placement Optimization
  testLogger.section('Test 2: Placement Optimization (Funzione 2)');
  results.push(await testAutomationFunction(
    'Placement Optimization',
    () => func2PlacementOptimization(),
    dryRun
  ));

  // Test 3: Targeting Optimization
  testLogger.section('Test 3: Targeting Optimization (Funzione 3)');
  results.push(await testAutomationFunction(
    'Targeting Optimization',
    () => func3TargetingOptimization(),
    dryRun
  ));

  // Test 4: Auto Ad Optimization
  testLogger.section('Test 4: Auto Ad Optimization (Funzione 4)');
  results.push(await testAutomationFunction(
    'Auto Ad Optimization',
    () => func4AutoAdOptimization(),
    dryRun
  ));

  // Test 5: Campaign Feeding
  testLogger.section('Test 5: Campaign Feeding (Funzione 5)');
  results.push(await testAutomationFunction(
    'Campaign Feeding',
    () => func5CampaignFeeding(),
    dryRun
  ));

  return results;
}

/**
 * Test singola funzione
 */
async function testSingleFunction(funcNumber: number, dryRun: boolean = true): Promise<void> {
  testLogger.section(`TEST FUNZIONE ${funcNumber}`);

  let result: TestResult;

  switch (funcNumber) {
    case 1:
      result = await testAutomationFunction('Progressive Bidding', () => func1ProgressiveBidding(), dryRun);
      break;
    case 2:
      result = await testAutomationFunction('Placement Optimization', () => func2PlacementOptimization(), dryRun);
      break;
    case 3:
      result = await testAutomationFunction('Targeting Optimization', () => func3TargetingOptimization(), dryRun);
      break;
    case 4:
      result = await testAutomationFunction('Auto Ad Optimization', () => func4AutoAdOptimization(), dryRun);
      break;
    case 5:
      result = await testAutomationFunction('Campaign Feeding', () => func5CampaignFeeding(), dryRun);
      break;
    default:
      testLogger.error(`Funzione ${funcNumber} non esiste. Usa 1-5.`);
      return;
  }

  printSummary([result]);
}

/**
 * Stampa riepilogo risultati
 */
function printSummary(results: TestResult[]): void {
  testLogger.section('RIEPILOGO TEST');

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n${colors.cyan}Test totali:${colors.reset} ${results.length}`);
  console.log(`${colors.green}Successi:${colors.reset} ${successCount}`);
  console.log(`${colors.red}Errori:${colors.reset} ${errorCount}`);
  console.log(`${colors.yellow}Durata totale:${colors.reset} ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)\n`);

  // Dettaglio per ogni test
  results.forEach(result => {
    const icon = result.status === 'success' ? '✓' : '✗';
    const color = result.status === 'success' ? colors.green : colors.red;

    console.log(`${color}${icon} ${result.name}${colors.reset} - ${result.duration}ms`);

    if (result.error) {
      console.log(`  ${colors.red}Errore: ${result.error}${colors.reset}`);
    }
  });

  console.log('');
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dryRun = !args.includes('--live'); // Default dry run

  try {
    // Connetti al database
    testLogger.info('Connessione al database...');
    await initializeDatabase();
    testLogger.success('Database connesso');

    if (dryRun) {
      testLogger.warn('⚠️  MODALITÀ DRY RUN - Nessuna modifica verrà applicata');
    } else {
      testLogger.warn('⚠️  MODALITÀ LIVE - Le modifiche verranno applicate realmente!');
    }

    // Esegui i test
    if (command === 'all' || !command) {
      // Test tutte le funzioni
      const results = await runAllTests(dryRun);
      printSummary(results);
    } else if (command.startsWith('func')) {
      // Test singola funzione (func1, func2, etc.)
      const funcNumber = parseInt(command.replace('func', ''));
      if (isNaN(funcNumber) || funcNumber < 1 || funcNumber > 5) {
        testLogger.error('Funzione non valida. Usa: func1, func2, func3, func4, func5');
        process.exit(1);
      }
      await testSingleFunction(funcNumber, dryRun);
    } else {
      testLogger.error('Comando non valido. Usa: all, func1, func2, func3, func4, func5');
      process.exit(1);
    }

    testLogger.success('Test completati!');
    process.exit(0);
  } catch (error: any) {
    testLogger.error(`Errore durante i test: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  main();
}

export { runAllTests, testSingleFunction };
