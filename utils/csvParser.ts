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
  'lastweektotalcontent': 'lastWeekTotalContent',
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

/**
 * Parses a combined CSV file that contains all three sections:
 * - [TOP_POSTS] section
 * - [PLATFORM_DATA] section
 * - [PLATFORM_CONTENT] section
 * 
 * Sections are separated by section headers like [TOP_POSTS], [PLATFORM_DATA], [PLATFORM_CONTENT]
 * or by empty lines followed by a new header row.
 */
export const parseCombinedCSV = (csvText: string): ParsedReportData => {
  const result: ParsedReportData = {
    topPosts: [],
    platformData: [],
    platformContent: [],
  };

  const lines = csvText.trim().split('\n');
  
  // Try to detect section markers
  let currentSection: 'topPosts' | 'platformData' | 'platformContent' | null = null;
  let sectionLines: string[] = [];
  
  const processSectionLines = () => {
    if (sectionLines.length < 2 || !currentSection) return;
    
    const sectionText = sectionLines.join('\n');
    
    if (currentSection === 'topPosts') {
      result.topPosts = parseCSV<TopPostCSVRow>(sectionText, topPostsHeaderMap);
    } else if (currentSection === 'platformData') {
      result.platformData = parseCSV<PlatformDataCSVRow>(sectionText, platformDataHeaderMap);
    } else if (currentSection === 'platformContent') {
      result.platformContent = parseCSV<PlatformContentCSVRow>(sectionText, platformContentHeaderMap);
    }
  };
  
  for (const line of lines) {
    const trimmedLine = line.trim().toLowerCase();
    
    // Check for section markers
    if (trimmedLine.includes('[top_posts]') || trimmedLine.includes('[top posts]') || trimmedLine === 'top posts' || trimmedLine === 'top_posts') {
      processSectionLines();
      currentSection = 'topPosts';
      sectionLines = [];
      continue;
    }
    
    if (trimmedLine.includes('[platform_data]') || trimmedLine.includes('[platform data]') || trimmedLine === 'platform data' || trimmedLine === 'platform_data' || trimmedLine === 'platforms') {
      processSectionLines();
      currentSection = 'platformData';
      sectionLines = [];
      continue;
    }
    
    if (trimmedLine.includes('[platform_content]') || trimmedLine.includes('[platform content]') || trimmedLine === 'platform content' || trimmedLine === 'platform_content' || trimmedLine === 'content') {
      processSectionLines();
      currentSection = 'platformContent';
      sectionLines = [];
      continue;
    }
    
    // Auto-detect section by analyzing header row if no explicit section marker
    if (!currentSection && trimmedLine) {
      const headers = trimmedLine.split(',').map(h => h.trim().toLowerCase());
      
      // Detect Top Posts by presence of 'link' and ('views' or 'engagement')
      if (headers.includes('link') && (headers.includes('views') || headers.includes('engagement') || headers.includes('engagement%'))) {
        currentSection = 'topPosts';
      }
      // Detect Platform Data by presence of 'platform' and 'followers' and ('engagementrate' or 'engagement rate' or 'newfollowers')
      else if (headers.includes('platform') && headers.includes('followers') && 
               (headers.includes('engagementrate') || headers.includes('engagement rate') || headers.includes('newfollowers') || headers.includes('new followers') || headers.includes('totalcontent') || headers.includes('total content'))) {
        currentSection = 'platformData';
      }
      // Detect Platform Content by presence of 'platform' and ('type' or 'contenttype') and 'date'
      else if (headers.includes('platform') && (headers.includes('type') || headers.includes('contenttype') || headers.includes('content type')) && 
               (headers.includes('date') || headers.includes('postdate') || headers.includes('post date'))) {
        currentSection = 'platformContent';
      }
    }
    
    // Skip empty lines but use them as potential section breaks
    if (!trimmedLine) {
      if (sectionLines.length > 1) {
        processSectionLines();
        currentSection = null;
        sectionLines = [];
      }
      continue;
    }
    
    if (currentSection) {
      sectionLines.push(line);
    }
  }
  
  // Process remaining lines
  processSectionLines();
  
  return result;
};
