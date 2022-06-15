import fetch from 'node-fetch';

export async function httpGet(url: string, query, headers) {
    const response = await fetch(url, { headers });
    return response.json();
}
