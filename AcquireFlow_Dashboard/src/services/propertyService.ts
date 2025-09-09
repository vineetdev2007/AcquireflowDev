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
  // Optional media support from MLSSearch/public block
  imageUrl?: string;
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
  // Cache normalization to avoid repeated heavy transforms in-session
  private mlsNormalizationCache: WeakMap<any, PropertyData> = new WeakMap();

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

  // --- MLS helpers ---
  private extractMlsArray(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.listings)) return payload.listings;
    if (Array.isArray(payload?.results)) return payload.results;
    if (payload?.listing || payload?.public) return [payload];
    if (Array.isArray(payload?.data?.listings)) return payload.data.listings;
    return [];
  }

  private num(v: any, d = 0): number {
    const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : d;
  }

  private bool(v: any, d = false): boolean { return v === true || v === 'true' ? true : v === false || v === 'false' ? false : d; }

  private mapMlsItemToPropertyData(item: any): PropertyData {
    if (this.mlsNormalizationCache.has(item)) {
      return this.mlsNormalizationCache.get(item)!;
    }
    const listing = item?.listing || item?.Listing || {};
    const pub = item?.public || item?.Public || {};
    const prop = listing?.property || {};
    const lead = listing?.leadTypes || pub?.leadTypes || {};
    const addr = pub?.address || listing?.address || {};
    const county = addr?.county || addr?.countyOrParish || listing?.address?.countyOrParish || '';

    const lat = this.num(pub?.latitude ?? prop?.latitude);
    const lng = this.num(pub?.longitude ?? prop?.longitude);

    const primaryImage = listing?.media?.primaryListingImageUrl || pub?.imageUrl || '';

    const out: PropertyData = {
      absenteeOwner: this.bool(lead?.absenteeOwner),
      address: {
        address: addr?.label || addr?.address || [addr?.street, addr?.city, addr?.state, addr?.zip].filter(Boolean).join(', '),
        city: String(addr?.city || listing?.address?.city || ''),
        county: String(county || ''),
        fips: String(pub?.fips || ''),
        state: String(addr?.state || addr?.stateOrProvince || ''),
        street: String(addr?.street || addr?.unparsedAddress || ''),
        zip: String(addr?.zip || addr?.zipCode || ''),
      },
      adjustableRate: false,
      airConditioningAvailable: null,
      apn: String(pub?.apn || ''),
      assessedImprovementValue: this.num(pub?.assessedImprovementValue),
      assessedLandValue: this.num(pub?.assessedLandValue),
      assessedValue: this.num(pub?.assessedValue),
      assumable: false,
      auction: this.bool(pub?.auction),
      auctionDate: pub?.auctionDate || null,
      basement: this.bool(pub?.basement),
      bathrooms: this.num(prop?.bathroomsTotal, 0),
      bedrooms: this.num(prop?.bedroomsTotal, 0),
      cashBuyer: this.bool(lead?.cashBuyer),
      companyName: String(pub?.companyName || ''),
      corporateOwned: this.bool(lead?.corporateOwned),
      death: this.bool(lead?.death),
      deck: this.bool(lead?.deck),
      deckArea: this.num(pub?.deckArea),
      documentType: String(pub?.documentType || ''),
      documentTypeCode: String(pub?.documentTypeCode || ''),
      equity: this.bool(pub?.equity),
      equityPercent: this.num(pub?.equityPercent),
      estimatedEquity: this.num(pub?.estimatedEquity),
      estimatedValue: this.num(pub?.estimatedValue),
      floodZone: this.bool(lead?.floodZone),
      floodZoneDescription: String(pub?.floodZoneDescription || ''),
      floodZoneType: String(pub?.floodZoneType || ''),
      foreclosure: this.bool(lead?.foreclosure),
      forSale: this.bool(listing?.isListed ?? lead?.mlsStatus === 'Active'),
      freeClear: this.bool(lead?.freeClear),
      garage: this.bool(lead?.garage),
      highEquity: this.bool(lead?.highEquity),
      hoa: null,
      id: String(item?.id || pub?.propertyId || listing?.listingId || ''),
      inherited: this.bool(lead?.inherited),
      inStateAbsenteeOwner: this.bool(lead?.inStateAbsenteeOwner),
      investorBuyer: this.bool(lead?.investorBuyer),
      judgment: this.bool(lead?.judgment),
      landUse: String(pub?.landUse || ''),
      lastMortgage1Amount: null,
      lastSaleAmount: String(pub?.lastSaleAmount ?? '0'),
      lastSaleArmsLength: true,
      lastSaleDate: String(pub?.lastSaleDate || listing?.leadTypes?.mlsListingDate || '1970-01-01'),
      lastUpdateDate: String(pub?.lastUpdateDate || listing?.modificationTimestamp || new Date().toISOString()),
      latitude: Number.isFinite(lat) ? lat : 0,
      lenderName: String(pub?.lenderName || ''),
      listingAmount: this.num(listing?.leadTypes?.mlsListingPrice ?? listing?.listPriceLow, 0) || null,
      longitude: Number.isFinite(lng) ? lng : 0,
      lotSquareFeet: this.num(pub?.lotSquareFeet || listing?.property?.lotSizeSquareFeet),
      mailAddress: {
        address: pub?.mailAddress?.label || [pub?.mailAddress?.street, pub?.mailAddress?.city, pub?.mailAddress?.state, pub?.mailAddress?.zip].filter(Boolean).join(', '),
        city: String(pub?.mailAddress?.city || ''),
        county: String(pub?.mailAddress?.county || ''),
        state: String(pub?.mailAddress?.state || ''),
        street: String(pub?.mailAddress?.street || ''),
        zip: String(pub?.mailAddress?.zip || ''),
      },
      medianIncome: String(pub?.medianIncome || ''),
      MFH2to4: this.bool(lead?.MFH2to4),
      MFH5plus: this.bool(lead?.MFH5plus),
      mlsActive: this.bool(listing?.leadTypes?.mlsStatus ? String(listing.leadTypes.mlsStatus).toLowerCase() === 'active' : listing?.isListed),
      mlsCancelled: this.bool(listing?.leadTypes?.mlsCancelled),
      mlsFailed: this.bool(listing?.leadTypes?.mlsFailed),
      mlsHasPhotos: this.bool(listing?.leadTypes?.mlsHasPhotos ?? listing?.hasPhotos),
      mlsLastSaleDate: String(listing?.leadTypes?.mlsLastStatusDate || ''),
      mlsListingPrice: this.num(listing?.leadTypes?.mlsListingPrice ?? listing?.listPriceLow, 0) || null,
      mlsPending: this.bool(listing?.leadTypes?.mlsPending),
      mlsSold: this.bool(listing?.leadTypes?.mlsSold),
      negativeEquity: this.bool(pub?.negativeEquity),
      openMortgageBalance: this.num(pub?.openMortgageBalance),
      outOfStateAbsenteeOwner: this.bool(lead?.outOfStateAbsenteeOwner),
      owner1LastName: String(pub?.owner1LastName || ''),
      ownerOccupied: this.bool(lead?.ownerOccupied),
      patio: this.bool(lead?.patio),
      patioArea: this.num(pub?.patioArea),
      pool: this.bool(lead?.pool),
      poolArea: this.num(pub?.poolArea),
      portfolioPurchasedLast12Months: this.num(pub?.portfolioPurchasedLast12Months),
      portfolioPurchasedLast6Months: this.num(pub?.portfolioPurchasedLast6Months),
      preForeclosure: this.bool(lead?.preForeclosure),
      pricePerSquareFoot: this.num(listing?.pricePerSqFt),
      priorSaleAmount: this.num(pub?.priorSaleAmount),
      privateLender: this.bool(pub?.privateLender),
      propertyId: String(pub?.propertyId || item?.id || ''),
      propertyType: String(pub?.propertyType || listing?.property?.propertyType || ''),
      propertyUse: String(pub?.propertyUse || (Array.isArray(listing?.property?.propertySubType) ? listing.property.propertySubType.join(', ') : listing?.property?.propertySubType) || ''),
      propertyUseCode: this.num(pub?.propertyUseCode),
      recordingDate: String(pub?.recordingDate || ''),
      rentAmount: null,
      reo: this.bool(pub?.reo),
      roofConstruction: null,
      roofMaterial: null,
      roomsCount: this.num(pub?.roomsCount),
      squareFeet: this.num(listing?.property?.livingArea ?? pub?.squareFeet, 0),
      stories: typeof prop?.stories === 'number' ? prop.stories : null,
      taxLien: this.bool(lead?.taxLien),
      totalPortfolioEquity: String(pub?.totalPortfolioEquity || ''),
      totalPortfolioMortgageBalance: String(pub?.totalPortfolioMortgageBalance || ''),
      totalPortfolioValue: String(pub?.totalPortfolioValue || ''),
      totalPropertiesOwned: String(pub?.totalPropertiesOwned || ''),
      unitsCount: this.num(pub?.unitsCount),
      vacant: this.bool(lead?.vacant),
      yearBuilt: pub?.yearBuilt ? this.num(pub?.yearBuilt) : (typeof prop?.yearBuilt === 'string' ? this.num(prop?.yearBuilt) : (typeof prop?.yearBuilt === 'number' ? prop.yearBuilt : null)),
      yearsOwned: this.num(pub?.yearsOwned),
      imageUrl: String(primaryImage || '')
    };

    this.mlsNormalizationCache.set(item, out);
    return out;
  }

  private normalizeMlsResponse(raw: any, input: Record<string, any>): PropertySearchResponse {
    const arr = this.extractMlsArray(raw);
    const mapped = arr.map((it) => this.mapMlsItemToPropertyData(it));
    return { live: true, input, data: mapped };
  }

  /**
   * Search for properties based on filters
   */
  async searchProperties(filters: PropertySearchFilters & { page?: number; size?: number }): Promise<PropertySearchResponse> {
    // Convert locations -> city/state (first location only for MLS search)
    const firstLocation = Array.isArray(filters.locations) && filters.locations.length ? String(filters.locations[0]) : undefined;
    let city: string | undefined; let state: string | undefined;
    if (firstLocation) {
      if (firstLocation.includes(',')) {
        const parts = firstLocation.split(',');
        city = parts.slice(0, parts.length - 1).join(',').trim();
        state = parts[parts.length - 1].trim().toUpperCase();
      } else if (/^[A-Za-z]{2}$/.test(firstLocation)) {
        state = firstLocation.toUpperCase();
      }
    }
    const page = (filters as any).page || 1;
    const size = (filters as any).size || 50;
    const qs = new URLSearchParams({ page: String(page), size: String(size) });
    if (city) qs.append('city', city);
    if (state) qs.append('state', state);
    const result = await this.request<{ success: boolean; data: any; meta?: any }>(`/properties/mls-search?${qs.toString()}`);
    return this.normalizeMlsResponse(result.data, { page, size, city, state });
  }

  /**
   * POST variant to match upstream contract. Preferred for complex searches.
   */
  async searchPropertiesPost(
    filters: PropertySearchFilters & { page?: number; size?: number; city?: string; state?: string; mls_active?: boolean; property_type?: string }
  ): Promise<PropertySearchResponse> {
    // Derive city/state from locations[] or explicit fields
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

    const body: any = {
      page: (filters as any).page || 1,
      size: (filters as any).size || 50,
      city,
      state
    };
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

    const result = await this.request<{ success: boolean; data: any; meta?: any }>(
      `/properties/mls-search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    return this.normalizeMlsResponse(result.data, body);
  }

  /**
   * Get featured properties (default search)
   */
   async getFeaturedProperties(page: number = 1, size: number = 50): Promise<PropertySearchResponse> {
    console.log('🔍 Fetching featured MLS listings from backend:', `${this.baseUrl}/properties/mls-search`);
    try {
      const qs = new URLSearchParams({ page: String(page), size: String(size) }).toString();
      const result = await this.request<{ success: boolean; data: any }>(`/properties/mls-search?${qs}`);
      const normalized = this.normalizeMlsResponse(result.data, { page, size });
      return normalized;
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
    const [city, state] = location.split(',').map(s => s.trim());
    const qs = new URLSearchParams();
    if (city) qs.append('city', city);
    if (state) qs.append('state', state);
    const result = await this.request<{ success: boolean; data: any }>(`/properties/mls-search?${qs.toString()}`);
    return this.normalizeMlsResponse(result.data, { city, state });
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

  /**
   * Resolve a Zillow homedetails link with zpid using backend proxy. Falls back to slug URL if zpid cannot be resolved.
   */
  async getZillowLink(params: { address: string; city: string; state: string; zip?: string; lat?: number; lng?: number }): Promise<{ url: string; zpid?: string | number | null; resolved: boolean }> {
    const qs = new URLSearchParams({ address: params.address, city: params.city, state: params.state } as any);
    if (params.zip) qs.append('zip', params.zip);
    if (Number.isFinite(params.lat as number)) qs.append('lat', String(params.lat));
    if (Number.isFinite(params.lng as number)) qs.append('lng', String(params.lng));
    const result = await this.request<{ success: boolean; data: { url: string; zpid?: string | number | null; resolved: boolean } }>(`/properties/zillow-link?${qs.toString()}`);
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
