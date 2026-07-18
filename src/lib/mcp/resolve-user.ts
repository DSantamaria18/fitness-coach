// Misma interfaz mínima de Prisma que verify-credentials.ts, para poder
// testear con un mock simple en vez de una base de datos real.
interface UserLookup {
  user: {
    findUnique: (args: { where: { username: string } }) => Promise<{
      id: string;
      username: string;
      passwordHash: string;
    } | null>;
  };
}

// El servidor MCP resuelve el userId único de la app (ADMIN_USERNAME) una
// vez por petición, en vez de derivarlo dentro de cada función de dominio
// (ver DECISIONS.md/CLAUDE.md: userId siempre explícito).
export async function resolveMcpUserId(
  prismaLike: UserLookup,
  username: string,
): Promise<string | null> {
  const user = await prismaLike.user.findUnique({ where: { username } });
  return user?.id ?? null;
}
