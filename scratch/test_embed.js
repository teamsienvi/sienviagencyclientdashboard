async function test() {
    const urls = [
        "https://www.tiktok.com/@tiktok/video/7106594312292453678",
        "https://www.instagram.com/p/CoUuZvauWpH/",
        "https://www.facebook.com/zuck/videos/10114620029513361"
    ];
    for (const url of urls) {
        try {
            const res = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url));
            const data = await res.json();
            console.log(url, "=>", data?.data?.image?.url);
        } catch(e) {
            console.error("Error for", url, e.message);
        }
    }
}
test();
