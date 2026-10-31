const env = import.meta.env;

export const config = {
  authApi: (env.MAGICSTACK_AUTH_API as string) || 'https://auth.magicrunez.com',
  ttsApi: ((env.MAGICSTACK_TTS_API as string) || '/api').replace(/\/$/, ''),
  tenantId: env.TENANT_ID as string,
};
