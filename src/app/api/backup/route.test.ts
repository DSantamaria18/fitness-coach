import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, writeFileSync } from "node:fs";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/create-backup", () => ({
  createBackup: vi.fn(),
}));

import { auth } from "@/auth";
import { createBackup } from "@/lib/create-backup";
import { GET } from "./route";

// `auth` es una función sobrecargada (uso directo y como middleware); vi.mocked
// infiere una intersección inservible para mockResolvedValue, así que se trata
// como un mock genérico (mismo patrón que el resto de rutas).
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const createBackupMock = vi.mocked(createBackup);

describe("GET /api/backup", () => {
  beforeEach(() => {
    authMock.mockReset();
    createBackupMock.mockReset();
  });

  it("responde 401 cuando no hay sesión, sin generar ningún backup", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(createBackupMock).not.toHaveBeenCalled();
  });

  it("sirve el fichero de backup como descarga y lo borra del disco tras enviarlo", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    createBackupMock.mockImplementation(async (_userId, destinationPath) => {
      writeFileSync(destinationPath, "contenido-de-prueba");
      return {
        success: true,
        data: { createdAt: new Date("2026-07-18T10:00:00.000Z") },
      };
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "fitness-coach-backup-2026-07-18.db",
    );
    const body = await response.text();
    expect(body).toBe("contenido-de-prueba");

    // Usa el userId de la sesión, nunca uno recibido del cliente.
    expect(createBackupMock).toHaveBeenCalledWith("user-1", expect.any(String));
    const destinationPath = createBackupMock.mock.calls[0][1];
    expect(existsSync(destinationPath)).toBe(false);
  });

  it("responde 500 con un error estructurado cuando no se puede generar el backup", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    createBackupMock.mockResolvedValue({
      success: false,
      error: "No se pudo generar el backup.",
    });

    const response = await GET();

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });
});
