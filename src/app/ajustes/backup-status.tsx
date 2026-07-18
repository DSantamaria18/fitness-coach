const WARNING_THRESHOLD_DAYS = 30;

function daysSince(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

type BackupStatusProps = {
  lastBackup: string | null;
};

// Backup manual (ver DECISIONS.md): sin cron ni almacenamiento externo, solo
// un aviso si han pasado más de 30 días sin descargar uno.
export function BackupStatus({ lastBackup }: BackupStatusProps) {
  const lastBackupDate = lastBackup ? new Date(lastBackup) : null;
  const days = lastBackupDate ? daysSince(lastBackupDate) : null;
  const needsWarning = days === null || days >= WARNING_THRESHOLD_DAYS;

  const statusText = lastBackupDate
    ? `Último backup: ${formatDaysAgo(days!)}.`
    : "Todavía no se ha hecho ningún backup.";

  return (
    <section className="flex flex-col gap-4">
      <p
        role={needsWarning ? "alert" : undefined}
        className={
          needsWarning ? "text-sm text-red-600 dark:text-red-400" : "text-sm"
        }
      >
        {statusText}
        {needsWarning
          ? " Han pasado más de 30 días — te recomendamos descargar uno ahora."
          : ""}
      </p>

      <a
        href="/api/backup"
        className="rounded-md bg-black px-4 py-2 text-center text-base font-medium text-white dark:bg-white dark:text-black"
      >
        Descargar backup
      </a>
    </section>
  );
}
