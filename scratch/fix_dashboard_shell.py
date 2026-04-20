import re

with open('components/dashboard/ClientDashboardShell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Social
content = content.replace(
    'className="rounded-2xl border bg-violet-500/5 p-6 md:p-8 border-violet-500/20"',
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-violet-500 shadow-sm relative overflow-hidden"'
)

# Ads
content = content.replace(
    'className="rounded-2xl border bg-orange-500/5 p-6 md:p-8 border-orange-500/20 mt-8"',
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-orange-500 shadow-sm mt-8 relative overflow-hidden"'
)

# Web
content = content.replace(
    'className="rounded-2xl border bg-emerald-500/5 p-6 md:p-8 border-emerald-500/20 mt-8"',
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-emerald-500 shadow-sm mt-8 relative overflow-hidden"'
)

# SEO
content = content.replace(
    'className="rounded-2xl border bg-slate-500/5 p-6 md:p-8 border-slate-500/20 mt-8"',
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-slate-700 shadow-sm mt-8 relative overflow-hidden"'
)

with open('components/dashboard/ClientDashboardShell.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
