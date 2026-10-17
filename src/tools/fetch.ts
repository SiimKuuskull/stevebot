export async function httpGet(
    url: string,
    query: Record<string, string> | undefined,
    headers: Record<string, string | undefined>,
): Promise<{ status: number; body: any }> {
    const response = await fetch(url, { headers });
    const body = await response.json().catch(() => undefined);
    return { status: response.status, body };
}
