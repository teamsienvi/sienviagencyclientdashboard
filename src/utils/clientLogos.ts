import playiqLogo from "@/assets/logos/playiq-logo.jpeg";
import blingybagLogo from "@/assets/logos/blingybag-logo.jpeg";
import snarkyassLogo from "@/assets/logos/snarkyass-logo.jpeg";

// Map client names (lowercase) to their local logo asset imports
const logoMap: Record<string, string> = {
    "playiq": playiqLogo,
    "blingybag": blingybagLogo,
    "snarky humans": snarkyassLogo,
    "snarky a$$ humans": snarkyassLogo,
};

/**
 * Returns the logo URL for a client.
 * Prioritizes: DB logo_url > local asset by name > null
 */
export function getClientLogo(clientName: string, dbLogoUrl?: string | null): string | null {
    if (dbLogoUrl) return dbLogoUrl;
    const key = clientName.toLowerCase().trim();
    return logoMap[key] || null;
}
