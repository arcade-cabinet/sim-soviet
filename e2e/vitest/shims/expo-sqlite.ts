type SqliteResult = {
  rows?: unknown[];
  rowsAffected?: number;
};

type SqliteStatement = {
  executeSync: () => SqliteResult;
  finalizeSync: () => void;
};

type SqliteDatabase = {
  closeSync: () => void;
  serializeSync: () => Uint8Array;
  prepareSync: () => SqliteStatement;
  execSync: () => void;
  withTransactionSync: <T>(task: () => T) => T;
};

function unsupported(): never {
  throw new Error('expo-sqlite is disabled in Vitest browser proof runs; pass autosave:false.');
}

function createDatabase(): SqliteDatabase {
  return {
    closeSync: () => {},
    serializeSync: () => new Uint8Array(),
    prepareSync: () => ({
      executeSync: unsupported,
      finalizeSync: () => {},
    }),
    execSync: () => {},
    withTransactionSync: (task) => task(),
  };
}

export function openDatabaseSync(): SqliteDatabase {
  return createDatabase();
}

export function deserializeDatabaseSync(): SqliteDatabase {
  return createDatabase();
}

export function addDatabaseChangeListener(): { remove: () => void } {
  return { remove: () => {} };
}
