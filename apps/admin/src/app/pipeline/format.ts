export function formatBytes(bytes?: number): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return "-";
  return `${width}×${height}`;
}
