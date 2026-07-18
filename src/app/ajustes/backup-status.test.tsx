import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackupStatus } from "./backup-status";

const NOW = new Date("2026-07-18T12:00:00.000Z");

describe("BackupStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("avisa cuando nunca se ha hecho un backup", () => {
    render(<BackupStatus lastBackup={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /todavía no se ha hecho ningún backup/i,
    );
  });

  it("no avisa cuando el último backup es reciente", () => {
    render(
      <BackupStatus
        lastBackup={new Date("2026-07-10T12:00:00.000Z").toISOString()}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/hace 8 días/i)).toBeInTheDocument();
  });

  it("muestra 'hoy' cuando el backup se hizo hoy mismo", () => {
    render(<BackupStatus lastBackup={NOW.toISOString()} />);

    expect(screen.getByText(/último backup: hoy/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("avisa cuando han pasado 30 días o más desde el último backup", () => {
    render(
      <BackupStatus
        lastBackup={new Date("2026-06-18T12:00:00.000Z").toISOString()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/hace 30 días/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/más de 30 días/i);
  });

  it("incluye siempre el enlace de descarga hacia /api/backup", () => {
    render(<BackupStatus lastBackup={null} />);

    expect(
      screen.getByRole("link", { name: /descargar backup/i }),
    ).toHaveAttribute("href", "/api/backup");
  });
});
