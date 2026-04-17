import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    try {
        // Handle TikTok specifically via their public OEmbed API
        if (targetUrl.includes('tiktok.com')) {
            const tiktokRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`);
            if (tiktokRes.ok) {
                const data = await tiktokRes.json();
                if (data.thumbnail_url) {
                    return NextResponse.json({ url: data.thumbnail_url });
                }
            }
        }

        // Generic OpenGraph Scraper fallback (bypasses browser CORS)
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch the target URL' }, { status: response.status });
        }

        const html = await response.text();
        
        // Regex to extract og:image
        // Looks for <meta property="og:image" content="...">
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

        if (ogImageMatch && ogImageMatch[1]) {
            // Some platforms escape HTML entities in the URL
            const cleanUrl = ogImageMatch[1].replace(/&amp;/g, '&');
            return NextResponse.json({ url: cleanUrl });
        }

        return NextResponse.json({ error: 'No thumbnail found' }, { status: 404 });

    } catch (error) {
        console.error('Thumbnail fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
