export function toDayString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function workoutDayToDate(workoutDay: string): Date {
    const [y, m, d] = workoutDay.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
