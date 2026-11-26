import { ConfigManager } from './config-manager.js';
export async function loadManagedConfig(root: string) { const manager = new ConfigManager(root); await manager.migrate(); return manager.load(); }
