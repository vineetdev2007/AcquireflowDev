// Frontend API base is computed within this service; no direct config import

// API Response Types based on the provided structure
export interface PropertyAddress {
  address: string;
  city: string;
  county: string;
  fips: string;
  state: string;
  street: string;
  zip: string;
}

export interface MailAddress {
  address: string;
  city: string;
  county: string;
  state: string;
  street: string;
  zip: string;
}

export interface PropertyData {
  absenteeOwner: boolean;
  address: PropertyAddress;
  adjustableRate: boolean;
  airConditioningAvailable: boolean | null;
  apn: string;
  assessedImprovementValue: number;
  assessedLandValue: number;
  assessedValue: number;
  assumable: boolean;
  auction: boolean;
  auctionDate: string | null;
  basement: boolean;
  bathrooms: number | null;
  bedrooms: number | null;
  cashBuyer: boolean;
  companyName: string;
  corporateOwned: boolean;
  death: boolean;
  deck: boolean;
  deckArea: number;
  documentType: string;
  documentTypeCode: string;
  equity: boolean;
  equityPercent: number;
  estimatedEquity: number;
  estimatedValue: number;
  floodZone: boolean;
  floodZoneDescription: string;
  floodZoneType: string;
  foreclosure: boolean;
  forSale: boolean;
  freeClear: boolean;
  garage: boolean;
  highEquity: boolean;
  hoa: string | null;
  id: string;
  inherited: boolean;
  inStateAbsenteeOwner: boolean;
  investorBuyer: boolean;
  judgment: boolean;
  landUse: string;
  lastMortgage1Amount: number | null;
  lastSaleAmount: string;
  lastSaleArmsLength: boolean;
  lastSaleDate: string;
  lastUpdateDate: string;
  latitude: number;
  lenderName: string;
  listingAmount: number | null;
  longitude: number;
  lotSquareFeet: number;
  mailAddress: MailAddress;
  medianIncome: string;
  MFH2to4: boolean;
  MFH5plus: boolean;
  mlsActive: boolean;
  mlsCancelled: boolean;
  mlsFailed: boolean;
  mlsHasPhotos: boolean;
  mlsLastSaleDate: string;
  mlsListingPrice: number | null;
  mlsPending: boolean;
  mlsSold: boolean;
  negativeEquity: boolean;
  openMortgageBalance: number;
  outOfStateAbsenteeOwner: boolean;
  owner1LastName: string;
  ownerOccupied: boolean;
  patio: boolean;
  patioArea: number;
  pool: boolean;
  poolArea: number;
  portfolioPurchasedLast12Months: number;
  portfolioPurchasedLast6Months: number;
  preForeclosure: boolean;
  pricePerSquareFoot: number;
  priorSaleAmount: number | null;
  privateLender: boolean;
  propertyId: string;
  propertyType: string;
  propertyUse: string;
  propertyUseCode: number;
  recordingDate: string;
  rentAmount: number | null;
  reo: boolean;
  roofConstruction: string | null;
  roofMaterial: string | null;
  roomsCount: number;
  squareFeet: number;
  stories: number | null;
  taxLien: boolean;
  totalPortfolioEquity: string;
  totalPortfolioMortgageBalance: string;
  totalPortfolioValue: string;
  totalPropertiesOwned: string;
  unitsCount: number;
  vacant: boolean;
  yearBuilt: number | null;
  yearsOwned: number;
}

export interface PropertySearchResponse {
  live: boolean;
  input: Record<string, any>;
  data: PropertyData[];
}

export interface PropertySearchFilters {
  locations?: string[];
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  motivationFactors?: string[];
  investmentStrategy?: string;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  absenteeOwner?: boolean;
  highEquity?: boolean;
  outOfStateOwner?: boolean;
  corporateOwned?: boolean;
  investorBuyer?: boolean;
  preForeclosure?: boolean;
  taxLien?: boolean;
  vacant?: boolean;
  cashBuyer?: boolean;
  equityPercent?: number;
  yearsOwned?: number;
  lastSaleDate?: string;
  medianIncome?: number;
}

export interface LeaderboardItem {
  rank: number;
  city: string;
  state: string;
  county?: string;
  priceGrowth: number;
  capRate: number;
  jobGrowth: number;
  affordability: number; // 0-100 score
  investmentScore: number; // 0-100
  sampleSize: number;
}

export interface MarketKpisResponse {
  city: string;
  state: string;
  medianPrice: number;
  priceChangeMoM: number;
  inventory: number;
  inventoryChangeMoM: number;
  daysOnMarket: number;
  daysOnMarketChangeMoM: number;
  opportunityScore: number;
}

export interface HeatmapNeighborhood {
  name: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  price: number;
  growth: number; // percent
  opportunity: number; // 0-100
  lat?: number;
  lng?: number;
}

export interface MarketHeatmapResponse {
  city: string;
  state: string;
  view: 'price' | 'growth' | 'opportunity';
  centerLat?: number;
  centerLng?: number;
  neighborhoods: HeatmapNeighborhood[];
}

export interface AgentBreakdownItem {
  name: string; // brokerage
  value: number; // percent share summing to 100
  transactions: number;
  volume: string;
}

export interface AgentActivityResponse {
  city: string;
  state: string;
  breakdown: AgentBreakdownItem[];
  topAgents: { name: string; company: string; transactions: number; volume: string }[];
}

export interface MonthlyKpiItem {
  month: string; // YYYY-MM
  medianPrice: number;
  inventory: number;
  daysOnMarket: number;
  salesIndex: number; // 80-120 normalized
}

export interface OpportunitySummary {
  count: number;
  avgCapRate: number; // percent
  medianPrice: number;
  projectedRoi: number; // percent
}

export interface LoanProduct {
  name: string;
  downPaymentPct: number;
  rate: number;
  termMonths?: number;
  interestOnly?: boolean;
}

export interface FinanceAssumptions {
  taxRateAnnual: number;
  insuranceRateAnnual: number;
  managementRate: number;
  maintenanceRate: number;
  defaultVacancyRate: number;
  defaultLtv: number;
  defaultInterestRate: number;
}

class PropertyService {
  private baseUrl: string;
  private apiKey: string;
  // Deduplicate identical in-flight requests and apply retry/backoff on 429
  private inflightRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    // Use your backend API instead of direct external API
    this.baseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';
    this.apiKey = ''; // Not needed for backend calls
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const bodyKey = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    const cacheKey = `${method}:${url}:${bodyKey}`;

    if (this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey) as Promise<T>;
    }

    const doFetch = async (attempt: number): Promise<T> => {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          // 429/5xx retry with backoff
          if ((response.status === 429 || response.status === 503 || response.status === 502 || response.status === 500) && attempt < 3) {
            const retryAfterHeader = response.headers.get('Retry-After');
            const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
            const backoff = retryAfter || (300 * Math.pow(2, attempt)) + Math.floor(Math.random() * 200);
            await new Promise(res => setTimeout(res, backoff));
            return doFetch(attempt + 1);
          }
          const errorText = await response.text().catch(() => '');
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        return response.json();
      } catch (error: any) {
        if (attempt < 2 && (error?.message?.includes('NetworkError') || error?.message?.includes('Failed to fetch'))) {
          await new Promise(res => setTimeout(res, 300 * Math.pow(2, attempt)));
          return doFetch(attempt + 1);
        }
        // If CORS error, provide a more helpful message (no mock fallback)
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('CORS_ERROR: Unable to connect to real estate API.');
        }
        throw error;
      }
    };

    const promise = doFetch(0).finally(() => {
      // Clear in-flight promise after completion
      this.inflightRequests.delete(cacheKey);
    });
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * Search for properties based on filters
   */
  async searchProperties(filters: PropertySearchFilters & { page?: number; size?: number }): Promise<PropertySearchResponse> {
    const searchParams = new URLSearchParams();
    if ((filters as any).page) {
      searchParams.append('page', String((filters as any).page));
    }
    if ((filters as any).size) {
      searchParams.append('size', String((filters as any).size));
    }
    
    // Add filters to search parameters
    if (filters.locations && filters.locations.length > 0) {
      searchParams.append('locations', filters.locations.join(','));
    }
    if (filters.minPrice) {
      searchParams.append('minPrice', filters.minPrice.toString());
    }
    if (filters.maxPrice) {
      searchParams.append('maxPrice', filters.maxPrice.toString());
    }
    if (filters.propertyTypes && filters.propertyTypes.length > 0) {
      searchParams.append('propertyTypes', filters.propertyTypes.join(','));
    }
    if (filters.minBeds) {
      searchParams.append('minBeds', filters.minBeds.toString());
    }
    if (filters.maxBeds) {
      searchParams.append('maxBeds', filters.maxBeds.toString());
    }
    if (filters.minBaths) {
      searchParams.append('minBaths', filters.minBaths.toString());
    }
    if (filters.maxBaths) {
      searchParams.append('maxBaths', filters.maxBaths.toString());
    }
    if (filters.minSqft) {
      searchParams.append('minSqft', filters.minSqft.toString());
    }
    if (filters.maxSqft) {
      searchParams.append('maxSqft', filters.maxSqft.toString());
    }
    if (filters.absenteeOwner !== undefined) {
      searchParams.append('absenteeOwner', filters.absenteeOwner.toString());
    }
    if (filters.highEquity !== undefined) {
      searchParams.append('highEquity', filters.highEquity.toString());
    }
    if (filters.outOfStateOwner !== undefined) {
      searchParams.append('outOfStateOwner', filters.outOfStateOwner.toString());
    }
    if (filters.corporateOwned !== undefined) {
      searchParams.append('corporateOwned', filters.corporateOwned.toString());
    }
    if (filters.investorBuyer !== undefined) {
      searchParams.append('investorBuyer', filters.investorBuyer.toString());
    }
    if (filters.preForeclosure !== undefined) {
      searchParams.append('preForeclosure', filters.preForeclosure.toString());
    }
    if (filters.taxLien !== undefined) {
      searchParams.append('taxLien', filters.taxLien.toString());
    }
    if (filters.vacant !== undefined) {
      searchParams.append('vacant', filters.vacant.toString());
    }
    if (filters.cashBuyer !== undefined) {
      searchParams.append('cashBuyer', filters.cashBuyer.toString());
    }
    if (filters.equityPercent) {
      searchParams.append('equityPercent', filters.equityPercent.toString());
    }
    if (filters.yearsOwned) {
      searchParams.append('yearsOwned', filters.yearsOwned.toString());
    }
    if (filters.lastSaleDate) {
      searchParams.append('lastSaleDate', filters.lastSaleDate);
    }
    if (filters.medianIncome) {
      searchParams.append('medianIncome', filters.medianIncome.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = `/properties/search${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.request<{success: boolean, data: PropertySearchResponse}>(endpoint);
    return result.data;
  }

  /**
   * POST variant to match upstream contract. Preferred for complex searches.
   */
  async searchPropertiesPost(
    filters: PropertySearchFilters & { page?: number; size?: number; city?: string; state?: string; mls_active?: boolean; property_type?: string }
  ): Promise<PropertySearchResponse> {
    // Derive city/state from locations[] if not explicitly provided
    let city = (filters as any).city as string | undefined;
    let state = (filters as any).state as string | undefined;
    const firstLocation = Array.isArray(filters.locations) && filters.locations.length ? String(filters.locations[0]) : undefined;
    if (!city && !state && firstLocation) {
      if (firstLocation.includes(',')) {
        const parts = firstLocation.split(',');
        city = parts.slice(0, parts.length - 1).join(',').trim();
        state = parts[parts.length - 1].trim().toUpperCase();
      } else if (/^[A-Za-z]{2}$/.test(firstLocation)) {
        state = firstLocation.toUpperCase();
      }
    }

    // Map our propertyTypes to upstream property_type when a single clear type is chosen
    let propertyType = (filters as any).property_type as string | undefined;
    if (!propertyType && Array.isArray(filters.propertyTypes) && filters.propertyTypes.length === 1) {
      const t = filters.propertyTypes[0];
      if (t === 'singleFamily') propertyType = 'SFR';
      else if (t === 'multiFamily') propertyType = 'MFR';
      else if (t === 'land') propertyType = 'LAND';
      else if (t === 'commercial') propertyType = 'OTHER';
    }

    const body: any = {
      page: (filters as any).page || 1,
      size: (filters as any).size || 50,
      mls_active: (filters as any).mls_active ?? true,
      city,
      state,
      property_type: propertyType
    };
    // Remove undefined
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
    const result = await this.request<{ success: boolean; data: PropertySearchResponse }>(
      `/properties/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    return result.data;
  }

  /**
   * Get featured properties (default search)
   */
   async getFeaturedProperties(page: number = 1, size: number = 50): Promise<PropertySearchResponse> {
    console.log('🔍 Fetching featured properties from backend:', `${this.baseUrl}/properties/featured`);
    
    try {
      const qs = new URLSearchParams({ page: String(page), size: String(size) }).toString();
      const result = await this.request<{success: boolean, data: PropertySearchResponse}>(`/properties/featured?${qs}`);
      console.log('✅ Backend API Response received:', result);
      return result.data;
    } catch (error) {
      console.log('❌ Backend API Error:', error);
      throw error;
    }
  }

  /**
   * Get property details by ID
   */
  async getPropertyDetails(propertyId: string): Promise<PropertyData> {
    const result = await this.request<{success: boolean, data: PropertyData}>(`/properties/${propertyId}`);
    return result.data;
  }

  /**
   * Get properties by location
   */
  async getPropertiesByLocation(location: string): Promise<PropertySearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('locations', location);
    
    const result = await this.request<{success: boolean, data: PropertySearchResponse}>(`/properties/search?${searchParams.toString()}`);
    return result.data;
  }

  /**
   * Get Top 10 cities leaderboard from backend
   */
  async getInvestmentLeaderboard(): Promise<LeaderboardItem[]> {
    const result = await this.request<{ success: boolean; data: LeaderboardItem[] }>(
      `/properties/leaderboard`
    );
    return result.data;
  }

  /**
   * Get market KPIs for a city/state pair like "Orlando, FL"
   */
  async getMarketKpis(location: string): Promise<MarketKpisResponse> {
    const [city, state] = location.split(',').map(s => s.trim());
    if (!city || !state) throw new Error('Invalid location; expected format "City, ST"');
    const qs = new URLSearchParams({ city, state }).toString();
    const result = await this.request<{ success: boolean; data: MarketKpisResponse }>(`/properties/market-kpis?${qs}`);
    return result.data;
  }

  async getMarketHeatmap(location: string, view: 'price' | 'growth' | 'opportunity' = 'price'): Promise<MarketHeatmapResponse> {
    const [city, state] = location.split(',').map(s => s.trim());
    if (!city || !state) throw new Error('Invalid location; expected format "City, ST"');
    const qs = new URLSearchParams({ city, state, view }).toString();
    const result = await this.request<{ success: boolean; data: MarketHeatmapResponse }>(`/properties/market-heatmap?${qs}`);
    return result.data;
  }

  async getAgentActivity(location: string): Promise<AgentActivityResponse> {
    const [city, state] = location.split(',').map(s => s.trim());
    if (!city || !state) throw new Error('Invalid location; expected format "City, ST"');
    const qs = new URLSearchParams({ city, state }).toString();
    const result = await this.request<{ success: boolean; data: AgentActivityResponse }>(`/properties/agent-activity?${qs}`);
    return result.data;
  }

  async getMonthlyKpis(location: string, months: number = 24): Promise<MonthlyKpiItem[]> {
    const [city, state] = location.split(',').map(s => s.trim());
    if (!city || !state) throw new Error('Invalid location; expected format "City, ST"');
    const qs = new URLSearchParams({ city, state, months: String(months) }).toString();
    const result = await this.request<{ success: boolean; data: MonthlyKpiItem[] }>(`/properties/monthly-kpis?${qs}`);
    return result.data;
  }

  async getOpportunitySummary(location: string): Promise<OpportunitySummary> {
    const [city, state] = location.split(',').map(s => s.trim());
    if (!city || !state) throw new Error('Invalid location; expected format "City, ST"');
    const qs = new URLSearchParams({ city, state }).toString();
    const result = await this.request<{ success: boolean; data: OpportunitySummary }>(`/properties/opportunity-summary?${qs}`);
    return result.data;
  }

  async getLoanProducts(): Promise<LoanProduct[]> {
    const result = await this.request<{ success: boolean; data: LoanProduct[] }>(`/finance/products`);
    return result.data;
  }

  async getFinanceAssumptions(): Promise<FinanceAssumptions> {
    const result = await this.request<{ success: boolean; data: FinanceAssumptions }>(`/finance/assumptions`);
    return result.data;
  }

  async createShareLink(propertyId: string, expiresDays: number = 7, snapshotBase64?: string): Promise<{ url: string; token: string; expiresAt: string }> {
    const params: Record<string, string> = { id: propertyId, expiresDays: String(expiresDays) };
    if (snapshotBase64) params['snapshot'] = snapshotBase64;
    const qs = new URLSearchParams(params).toString();
    const result = await this.request<{ success: boolean; data: { url: string; token: string; expiresAt: string } }>(`/properties/share-link?${qs}`);
    return result.data;
  }

  async getSharedProperty(token: string): Promise<PropertyData> {
    const result = await this.request<{ success: boolean; data: PropertyData }>(`/properties/shared/${token}`);
    return result.data;
  }
}

export const propertyService = new PropertyService();

// Simple test function to debug backend API
export const testAPI = async () => {
  console.log('🧪 Testing BACKEND API...');
  
  const backendUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';
  const testUrl = `${backendUrl}/properties/featured`;
  
  console.log('🎯 Backend API URL:', testUrl);
  
  try {
    console.log('\n🔍 Testing: Backend Featured Properties');
    console.log(`📍 URL: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Backend data received:', data);
      return data;
    } else {
      const error = await response.text();
      console.log('❌ Backend error response:', error);
    }
    
  } catch (error) {
    console.log('❌ Backend API Error:', error);
    console.log('\n🚫 Backend API test failed. This could be due to:');
    console.log('1. Backend server not running');
    console.log('2. Backend server not accessible');
    console.log('3. REAL_ESTATE_API_KEY not set in backend environment');
    console.log('4. External API endpoint issues');
  }
};
