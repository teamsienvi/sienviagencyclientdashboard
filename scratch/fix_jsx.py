import os

def fix_jsx_error():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix the opening of the ternary
    content = content.replace(
        "                ) : (\n                    {isSocial ? (",
        "                ) : isSocial ? ("
    )

    # Fix the closing of the ternary
    # At the end of the non-social block:
    # 421:                         </div>
    # 422:                         )}
    # 423:                 )}
    # 424:             </CardContent>
    # It should be:
    # 421:                         </div>
    # 422:                 )}
    # 423:             </CardContent>

    content = content.replace(
        "                        )}\n                )}\n            </CardContent>",
        "                        )\n                }\n            </CardContent>"
    )

    if "    {isSocial ? (" in content:
        content = content.replace(") : (\n                    {isSocial ? (", ") : isSocial ? (")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

fix_jsx_error()
