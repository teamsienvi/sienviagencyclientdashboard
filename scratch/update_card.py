import os

def update_card():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update imports to include useEffect and useState if not present
    if "useEffect" not in content and "useState" not in content:
        # Actually React is probably imported somewhere. Let's find "import React" or "import { useState"
        pass # we'll just use React.useEffect and React.useState for safety if we don't want to mess up hooks

    # 2. Add state for the dynamic thumbnail
    state_injection = """
    // Dynamic thumbnail fetching
    const [fetchedThumbnail, setFetchedThumbnail] = useState<string | null>(null);

    useEffect(() => {
        const fetchDynamicThumbnail = async () => {
            if (!topPosts || topPosts.length === 0) return;
            const hero = topPosts[0];
            if (!hero.post_url) return;
            
            // If Youtube, do it natively without hitting the API
            const nativeThumb = getThumbnailUrl(hero.post_url, hero.platform);
            if (nativeThumb) {
                setFetchedThumbnail(nativeThumb);
                return;
            }

            // Otherwise, hit our generic proxy API route
            try {
                const res = await fetch(`/api/thumbnail?url=${encodeURIComponent(hero.post_url)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.url) {
                        setFetchedThumbnail(data.url);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch thumbnail", err);
            }
        };

        fetchDynamicThumbnail();
    }, [topPosts]);

    const thumbnailUrl = fetchedThumbnail;
    """

    # We previously added:
    old_thumb_logic = """
    const thumbnailUrl = topPosts && topPosts.length > 0 ? getThumbnailUrl(topPosts[0].post_url, topPosts[0].platform) : null;
    """

    content = content.replace(old_thumb_logic, state_injection)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

update_card()
