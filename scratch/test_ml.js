async function test() {
    const urls = [
        "https://www.tiktok.com/@tiktok/video/7106594312292453678",
        "https://www.instagram.com/p/CoUuZvauWpH/",
        "https://www.facebook.com/zuck/videos/10114620029513361"
    ];
    for (const url of urls) {
        try {
            const endpoint = "https://api.microlink.io/?url=" + encodeURIComponent(url);
            const res = await fetch(endpoint);
            if (!res.ok) {
                console.log(url, "Failed:", res.status);
                continue;
            }
            const data = await res.json();
            console.log(url, "=> image:", data.data?.image?.url);
        } catch(e) {
            console.error("Error for", url, e.message);
        }
    }
}
test();
