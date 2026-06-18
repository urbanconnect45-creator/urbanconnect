import { Alert, Platform } from 'react-native';

type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue) {
  const normalizedValue = value == null ? '' : String(value);

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Record<string, CsvValue>>,
) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');

  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
    Alert.alert('Web only', 'CSV export is available from the secure admin web panel.');
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
