import playiqLogo from "@/assets/logos/playiq-logo.jpeg";
import blingybagLogo from "@/assets/logos/blingybag-logo.jpeg";
import snarkyassLogo from "@/assets/logos/snarkyass-logo.jpeg";
import snarkyhumansLogo from "@/assets/logos/snarkyhumans-logo.png";

// Map client names (lowercase) to their local logo asset imports
const logoMap: Record<string, string> = {
    "playiq": playiqLogo.src,
    "blingybag": blingybagLogo.src,
    "snarky a$$ humans": snarkyassLogo.src,
    "snarky humans": snarkyhumansLogo.src,
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
