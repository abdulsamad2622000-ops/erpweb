export interface FixtureRequest {
  method: string;
  url: string;
  body: unknown;
}

export interface FixtureResponse {
  status: number;
  body: unknown;
}

export type FixtureHandler = (req: FixtureRequest) => FixtureResponse;

export const ok = (body: unknown = null): FixtureResponse => ({ status: 200, body });
export const fail = (status: number, message: string): FixtureResponse => ({ status, body: { message } });