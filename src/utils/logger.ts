import winston from 'winston';
import path from 'path';

// Formato personalizzato per i log
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Aggiungi metadata se presenti
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    // Aggiungi stack trace per errori
    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  })
);

// Formato colorato per console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let emoji = '';

    // Aggiungi emoji in base al livello
    switch (level.toLowerCase().replace(/\x1B\[\d+m/g, '')) {
      case 'error': emoji = '❌'; break;
      case 'warn': emoji = '⚠️'; break;
      case 'info': emoji = '✅'; break;
      case 'debug': emoji = '🔍'; break;
      default: emoji = 'ℹ️';
    }

    let msg = `${emoji} ${timestamp} ${level}: ${message}`;

    // Aggiungi metadata se presenti
    if (Object.keys(metadata).length > 0 && metadata.timestamp === undefined) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }

    return msg;
  })
);

// Crea directory logs se non esiste
const logsDir = path.join(process.cwd(), 'logs');

// Configurazione Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console output (sempre attivo)
    new winston.transports.Console({
      format: consoleFormat
    }),

    // File per tutti i log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File solo per errori
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // File per automazioni (livello info e superiore)
    new winston.transports.File({
      filename: path.join(logsDir, 'automation.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],

  // Gestione eccezioni non catturate
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],

  // Gestione promise rejections non catturate
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Helper methods per logging specifico
export const logAutomation = {
  start: (functionName: string, details?: any) => {
    logger.info(`🚀 Automazione avviata: ${functionName}`, { type: 'automation_start', function: functionName, ...details });
  },

  success: (functionName: string, details?: any) => {
    logger.info(`✅ Automazione completata: ${functionName}`, { type: 'automation_success', function: functionName, ...details });
  },

  error: (functionName: string, error: Error, details?: any) => {
    logger.error(`❌ Errore automazione: ${functionName} - ${error.message}`, {
      type: 'automation_error',
      function: functionName,
      error: error.message,
      stack: error.stack,
      ...details
    });
  },

  action: (action: string, target: string, details?: any) => {
    logger.info(`📊 Azione eseguita: ${action} su ${target}`, { type: 'automation_action', action, target, ...details });
  }
};

export const logApi = {
  request: (method: string, url: string, details?: any) => {
    logger.debug(`📤 API Request: ${method} ${url}`, { type: 'api_request', method, url, ...details });
  },

  response: (method: string, url: string, status: number, details?: any) => {
    logger.debug(`📥 API Response: ${method} ${url} - Status ${status}`, { type: 'api_response', method, url, status, ...details });
  },

  error: (method: string, url: string, error: Error, details?: any) => {
    logger.error(`❌ API Error: ${method} ${url} - ${error.message}`, {
      type: 'api_error',
      method,
      url,
      error: error.message,
      stack: error.stack,
      ...details
    });
  }
};

export const logDatabase = {
  query: (query: string, duration?: number) => {
    logger.debug(`🗄️  Database Query: ${query}`, { type: 'db_query', query, duration });
  },

  error: (operation: string, error: Error, details?: any) => {
    logger.error(`❌ Database Error: ${operation} - ${error.message}`, {
      type: 'db_error',
      operation,
      error: error.message,
      stack: error.stack,
      ...details
    });
  }
};

export const logScheduler = {
  start: (schedule: string, functionName: string) => {
    logger.info(`⏰ Scheduler configurato: ${functionName} - ${schedule}`, { type: 'scheduler_start', schedule, function: functionName });
  },

  trigger: (functionName: string, scheduledTime?: Date) => {
    logger.info(`🔔 Scheduler trigger: ${functionName}`, { type: 'scheduler_trigger', function: functionName, scheduledTime });
  },

  error: (functionName: string, error: Error) => {
    logger.error(`❌ Scheduler Error: ${functionName} - ${error.message}`, {
      type: 'scheduler_error',
      function: functionName,
      error: error.message,
      stack: error.stack
    });
  }
};

// Stream per Morgan (HTTP request logging)
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  }
};

export default logger;
