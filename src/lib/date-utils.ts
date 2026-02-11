/**
 * Standardizes date formatting to prevent hydration mismatches.
 * Uses a fixed format YYYY. MM. DD. regardless of system locale.
 */
export function formatDate(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

    if (isNaN(date.getTime())) {
        return 'N/A';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}. ${month}. ${day}.`;
}
