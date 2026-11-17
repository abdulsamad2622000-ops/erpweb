// Sab fixtures isi folder mein (baad mein remove karna aasan)
export type FixtureHandler = (req: { method: string; url: string; body: unknown }) => unknown;

export const FIXTURES: Record<string, FixtureHandler> = {
  'GET /health': () => ({ status: 'ok', mock: true }),
};