import bcrypt from "bcryptjs";

// Firma mínima que necesitamos de Prisma aquí, para poder testear esta
// función con un mock simple en vez de una base de datos real.
interface UserLookup {
  user: {
    findUnique: (args: { where: { username: string } }) => Promise<{
      id: string;
      username: string;
      passwordHash: string;
    } | null>;
  };
}

export interface VerifiedUser {
  id: string;
  username: string;
}

// Aislada del provider de NextAuth para poder testear la lógica de
// verificación (hash, credenciales vacías/desconocidas) sin depender del
// ciclo de vida de Auth.js.
export async function verifyCredentials(
  prisma: UserLookup,
  username: string,
  password: string,
): Promise<VerifiedUser | null> {
  if (!username || !password) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return { id: user.id, username: user.username };
}
