let recovery: Promise<{ bytes: number; sessions: number }> | null = null;
export function recoverLegacySpeed() {
  recovery ??= import('../../speed/src/legacy-sync.mjs').then(module => module.syncLegacySpeed()).catch(error => { recovery = null; throw error; });
  return recovery;
}
