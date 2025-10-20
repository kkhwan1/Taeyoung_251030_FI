/**
 * Coating Status Constants
 *
 * Centralized constants for coating status enum values and labels.
 * Used across database, API, validation, and UI layers.
 */

// Type-safe coating status literal union
export type CoatingStatus = 'no_coating' | 'before_coating' | 'after_coating';

// Valid coating status values (including null/empty for validation)
export const VALID_COATING_STATUSES = [
  'no_coating',
  'before_coating',
  'after_coating',
  '',
  null,
  undefined
] as const;

// Default coating status value
export const DEFAULT_COATING_STATUS: CoatingStatus = 'no_coating';

// Coating status options for UI dropdowns (Korean labels)
export const COATING_STATUS_OPTIONS = [
  { value: '', label: '전체 도장상태' },
  { value: 'no_coating' as CoatingStatus, label: '도장 불필요' },
  { value: 'before_coating' as CoatingStatus, label: '도장 전' },
  { value: 'after_coating' as CoatingStatus, label: '도장 후' }
] as const;

// Korean label mapping for display and exports
export const COATING_STATUS_LABELS: Record<CoatingStatus, string> = {
  no_coating: '도장 불필요',
  before_coating: '도장 전',
  after_coating: '도장 후'
};

// Color mapping for UI badges (Tailwind CSS classes)
export const COATING_STATUS_COLORS: Record<CoatingStatus, string> = {
  no_coating: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  before_coating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  after_coating: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
};

// Helper function to get Korean label
export function getCoatingStatusLabel(status: CoatingStatus | null | undefined): string {
  if (!status) return '-';
  return COATING_STATUS_LABELS[status] || '-';
}

// Helper function to get badge color classes
export function getCoatingStatusColor(status: CoatingStatus | null | undefined): string {
  if (!status) return COATING_STATUS_COLORS.no_coating;
  return COATING_STATUS_COLORS[status] || COATING_STATUS_COLORS.no_coating;
}

// Helper function to validate coating status
export function isValidCoatingStatus(value: unknown): value is CoatingStatus {
  return (
    typeof value === 'string' &&
    (value === 'no_coating' || value === 'before_coating' || value === 'after_coating')
  );
}

// Helper function to normalize coating status (apply default)
export function normalizeCoatingStatus(value: unknown): CoatingStatus {
  if (isValidCoatingStatus(value)) {
    return value;
  }
  return DEFAULT_COATING_STATUS;
}
