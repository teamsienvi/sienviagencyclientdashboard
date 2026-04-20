import os
import re

def update_insights():
    path = "utils/topPerformingInsights.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add title to TopInsightContent
    content = content.replace(
        "  post_url: string;\n  platform: string;",
        "  post_url: string;\n  title?: string | null;\n  platform: string;"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_hook():
    path = "hooks/useAllTimeTopPosts.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add title property to the mapped object
    if "platform: c.platform," in content and "title: c.title," not in content:
        content = content.replace(
            "post_url: c.url || \"\",",
            "post_url: c.url || \"\",\n            title: c.title,"
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_card():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Ensure Eye is imported from lucide-react (it is, but let's check)
    if "Eye" not in content.split("} from \"lucide-react\";")[0]:
        content = content.replace(
            "ChevronDown, ChevronUp, ExternalLink",
            "ChevronDown, ChevronUp, ExternalLink, Eye"
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

update_insights()
update_hook()
update_card()
