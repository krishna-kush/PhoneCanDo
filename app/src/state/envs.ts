import AsyncStorage from '@react-native-async-storage/async-storage';

export type Env = {
  id: string;
  name: string;
  directory: string;
};

const ENVS_KEY = 'phonecando.envs.v1';
const ACTIVE_ENV_ID_KEY = 'phonecando.activeEnvId.v1';

export const DEFAULT_ENV: Env = {
  id: 'default',
  name: 'default',
  directory: '~/agents/opencode/',
};

export async function loadEnvs(): Promise<{ envs: Env[]; activeEnvId: string }> {
  const raw = await AsyncStorage.getItem(ENVS_KEY);
  let envs: Env[] = [DEFAULT_ENV];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Env[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        envs = parsed.some((e) => e.id === 'default') ? parsed : [DEFAULT_ENV, ...parsed];
      }
    } catch {
      // corrupted payload -> fall back to default env
    }
  }
  const activeId = (await AsyncStorage.getItem(ACTIVE_ENV_ID_KEY)) ?? 'default';
  const activeEnvId = envs.some((e) => e.id === activeId) ? activeId : 'default';
  return { envs, activeEnvId };
}

export async function saveEnvs(envs: Env[], activeEnvId: string): Promise<void> {
  await AsyncStorage.setItem(ENVS_KEY, JSON.stringify(envs));
  await AsyncStorage.setItem(ACTIVE_ENV_ID_KEY, activeEnvId);
}
