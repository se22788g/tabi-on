export function checkEnv(env: Record<string, string | undefined>, opts: { production: boolean }): { errors: string[]; warnings: string[] };
