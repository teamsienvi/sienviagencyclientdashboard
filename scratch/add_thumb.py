import os

def add_thumbnail():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add the thumbnail generation logic right after formatNumber
    thumbnail_logic = """
    // Extract thumbnail for YouTube videos
    const getThumbnailUrl = (url: string | null | undefined, platform: string | null | undefined) => {
        if (!url || !platform) return null;
        if (platform.toLowerCase() === 'youtube') {
            let videoId = '';
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0];
            } else if (url.includes('youtube.com/shorts/')) {
                videoId = url.split('shorts/')[1]?.split('?')[0];
            }
            if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
        return null;
    };
    
    const thumbnailUrl = topPosts && topPosts.length > 0 ? getThumbnailUrl(topPosts[0].post_url, topPosts[0].platform) : null;
    """

    if "const getThumbnailUrl" not in content:
        content = content.replace(
            "const formatNumber = (num: number) => {",
            thumbnail_logic + "\n    const formatNumber = (num: number) => {"
        )

    # Replace the hero background with the thumbnail
    # Finding the relative w-full h-48 bg-muted/50 block
    
    old_bg = """                                            <div className="relative w-full h-48 bg-muted/50 overflow-hidden flex items-center justify-center border-b border-border/40">
                                                {/* Simulated thumbnail background if generic */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent z-0" />
                                                <PlaySquare className="h-10 w-10 text-muted-foreground/30 z-10" />"""
                                                
    new_bg = """                                            <div className="relative w-full h-48 bg-muted/50 overflow-hidden flex items-center justify-center border-b border-border/40 group-hover:bg-muted/70 transition-colors">
                                                {thumbnailUrl ? (
                                                    <div 
                                                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90 group-hover:opacity-100 transition-opacity z-0" 
                                                        style={{ backgroundImage: `url(${thumbnailUrl})` }} 
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent z-0" />
                                                )}
                                                
                                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors z-0" />
                                                <PlaySquare className={`h-12 w-12 z-10 transition-transform group-hover:scale-110 ${thumbnailUrl ? 'text-white/80 drop-shadow-md' : 'text-muted-foreground/30'}`} />"""

    content = content.replace(old_bg, new_bg)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

add_thumbnail()
