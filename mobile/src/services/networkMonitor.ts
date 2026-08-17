import { getStoredPreferences } from './storage';

export async function isOffline(): Promise<boolean> {
  try {
    const prefs = await getStoredPreferences();
    const apiUrl = prefs.customApiUrl || 'http://10.0.2.2:3000';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return !response.ok;
  } catch (error) {
    return true; // if fetch fails or aborts, we are offline
  }
}

export async function getNetworkStatus(): Promise<{ isConnected: boolean; lastChecked: string }> {
  const offline = await isOffline();
  return {
    isConnected: !offline,
    lastChecked: new Date().toISOString()
  };
}
