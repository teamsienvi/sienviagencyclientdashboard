import re

with open('components/ClientCard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in group cursor-pointer"',
    'className="bg-card/80 backdrop-blur-sm border border-border/80 rounded-2xl p-6 hover:shadow-xl hover:border-primary/50 shadow-sm transition-all duration-300 animate-fade-in group cursor-pointer"'
)

content = content.replace(
    'className="h-14 w-14 rounded-xl bg-accent border-2 border-dashed border-border flex items-center justify-center overflow-hidden group-hover:border-primary/30 transition-all duration-300"',
    'className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-background border shadow-inner flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-all duration-300 relative"'
)

content = content.replace(
    'className="text-xl font-heading font-semibold text-foreground mb-1 group-hover:text-primary transition-colors duration-300"',
    'className="text-2xl font-heading font-bold text-foreground mb-1 tracking-tight group-hover:text-primary transition-colors duration-300"'
)

content = content.replace(
    'className="w-full justify-center gap-2"',
    'className="w-full justify-center gap-2 h-11 shadow-sm mt-2 font-medium"'
)

with open('components/ClientCard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('components/analytics/NextAnalyticsPageLayout.tsx', 'r', encoding='utf-8') as f:
    nav_content = f.read()

nav_content = nav_content.replace(
    'className="flex items-center gap-4 mb-8"',
    'className="flex items-center gap-4 mb-8 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10 p-6 rounded-2xl"'
)

nav_content = nav_content.replace(
    'className="h-12 w-12 rounded-lg object-cover"',
    'className="h-14 w-14 rounded-xl object-cover shadow-sm bg-white"'
)

nav_content = nav_content.replace(
    'className="text-3xl font-bold text-foreground"',
    'className="text-3xl font-heading font-bold text-foreground tracking-tight"'
)

with open('components/analytics/NextAnalyticsPageLayout.tsx', 'w', encoding='utf-8') as f:
    f.write(nav_content)
