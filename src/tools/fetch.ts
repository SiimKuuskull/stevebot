export async function httpGet(
    url: string,
    query: Record<string, string> | undefined,
    headers: Record<string, string | undefined>,
): Promise<any> {
    const response = await fetch(url, { headers });
    return response.json();
}
