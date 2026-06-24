export function safeNum(v: unknown): number {
    return Number(v) || 0;
}
