export async function httpGet(url: string, query, headers): Promise<any> {
    const response = await fetch(url, { headers });
    return response.json();
}
