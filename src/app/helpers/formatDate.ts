export function formatDate(timestamp: Date): string {
  const day = timestamp.getDate().toString().padStart(2, "0");
  const month = (timestamp.getMonth() + 1).toString().padStart(2, "0");
  const year = timestamp.getFullYear();
  const hours = timestamp.getHours().toString().padStart(2, "0");
  const minutes = timestamp.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatShortDate(timestamp: Date | string | number): string {
  const date =
    timestamp instanceof Date
      ? timestamp
      : new Date(timestamp);

  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${day}/${month}`;
}

export function formatDateZ(timestamp: Date | string | number): string {
  const date =
    timestamp instanceof Date
      ? timestamp
      : new Date(timestamp);

  // Convertir a hora de Argentina (UTC-3)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const argentinaDate = new Date(utc - 3 * 60 * 60000);

  const month = (argentinaDate.getMonth() + 1).toString().padStart(2, "0");
  const day = argentinaDate.getDate().toString().padStart(2, "0");
  const hours = argentinaDate.getHours().toString().padStart(2, "0");
  const minutes = argentinaDate.getMinutes().toString().padStart(2, "0");

  return `${day}/${month} ${hours}:${minutes}`;
}