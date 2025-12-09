export interface TopPostCSVRow {
  link: string;
  views: number;
  engagementPercent: number;
  platform: string;
  followers: number;
  reachTier?: string;
  engagementTier?: string;
  influence?: number;
}

export interface PlatformDataCSVRow {
  platform: string;
  followers: number;
  newFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
}

export interface PlatformContentCSVRow {
  platform: string;
  contentType: string;
  postDate: string;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  interactions?: number;
  impressions?: number;
  engagements?: number;
  profileVisits?: number;
  linkClicks?: number;
}

export interface ParsedReportData {
  topPosts: TopPostCSVRow[];
  platformData: PlatformDataCSVRow[];
  platformContent: PlatformContentCSVRow[];
}

export const parseCSV = <T>(
  csvText: string,
  headerMap: Record<string, string>
): T[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const mappedKey = headerMap[header];
      if (mappedKey) {
        const value = values[index]?.trim() || '';
        row[mappedKey] = parseValue(value);
      }
    });
    rows.push(row as T);
  }

  return rows;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const parseValue = (value: string): string | number => {
  // Remove percentage signs and parse as number
  const cleanValue = value.replace('%', '').replace(/,/g, '');
  const numValue = parseFloat(cleanValue);
  return isNaN(numValue) ? value : numValue;
};

// Header mappings for different CSV types
export const topPostsHeaderMap: Record<string, keyof TopPostCSVRow> = {
  'link': 'link',
  'url': 'link',
  'views': 'views',
  'engagement': 'engagementPercent',
  'engagement%': 'engagementPercent',
  'engagementpercent': 'engagementPercent',
  'platform': 'platform',
  'followers': 'followers',
  'reachtier': 'reachTier',
  'reach tier': 'reachTier',
  'engagementtier': 'engagementTier',
  'engagement tier': 'engagementTier',
  'influence': 'influence',
};

export const platformDataHeaderMap: Record<string, keyof PlatformDataCSVRow> = {
  'platform': 'platform',
  'followers': 'followers',
  'newfollowers': 'newFollowers',
  'new followers': 'newFollowers',
  'engagementrate': 'engagementRate',
  'engagement rate': 'engagementRate',
  'lastweekengagementrate': 'lastWeekEngagementRate',
  'last week engagement rate': 'lastWeekEngagementRate',
  'totalcontent': 'totalContent',
  'total content': 'totalContent',
  'lastweekcontent': 'lastWeekTotalContent',
  'last week content': 'lastWeekTotalContent',
};

export const platformContentHeaderMap: Record<string, keyof PlatformContentCSVRow> = {
  'platform': 'platform',
  'type': 'contentType',
  'contenttype': 'contentType',
  'content type': 'contentType',
  'date': 'postDate',
  'postdate': 'postDate',
  'post date': 'postDate',
  'reach': 'reach',
  'views': 'views',
  'likes': 'likes',
  'comments': 'comments',
  'shares': 'shares',
  'interactions': 'interactions',
  'impressions': 'impressions',
  'engagements': 'engagements',
  'profilevisits': 'profileVisits',
  'profile visits': 'profileVisits',
  'linkclicks': 'linkClicks',
  'link clicks': 'linkClicks',
};
