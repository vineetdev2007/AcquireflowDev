import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { LeaderboardService } from '../services/leaderboardService';

const router = Router();

// Simple in-memory cache for Zillow link lookups to reduce rate-limit pressure
type ZillowCacheEntry = { url: string; zpid: string | number | null; resolved: boolean; ts: number };
const zillowCache: Map<string, ZillowCacheEntry> = new Map();
const ZILLOW_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const nowMs = () => Date.now();
const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Basic cache for property searches/featured to soften rate limits
type PropertyCacheEntry = { data: any; ts: number };
const propertyCache: Map<string, PropertyCacheEntry> = new Map();
const PROPERTY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Interface for property search filters
interface PropertySearchFilters {
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

/**
 * GET /api/v1/properties/search
 * Proxy endpoint to call the real estate API
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    console.log('🏠 Property search request received');
    console.log('Query params:', req.query);

    // Get API key from environment
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    console.log('🔑 API Key check:', apiKey ? `Present (${apiKey.substring(0, 10)}...)` : 'Missing');
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured'
      });
    }

    // Build query parameters for the external API
    const searchParams = new URLSearchParams();
    
    // Add filters to search parameters
    const filters = req.query as PropertySearchFilters & { page?: string | number; size?: string | number };
    // Parse a single 'locations' query value (supports City, ST or 2-letter state)
    const locationsQuery = (req.query['locations'] as string | undefined)?.trim();
    const parsedLocations: string[] = locationsQuery ? [locationsQuery] : [];
    
    if (filters.locations && Array.isArray(filters.locations)) {
      searchParams.append('locations', filters.locations.join(','));
    }
    if (filters.minPrice) {
      searchParams.append('minPrice', filters.minPrice.toString());
    }
    if (filters.maxPrice) {
      searchParams.append('maxPrice', filters.maxPrice.toString());
    }
    if (filters.propertyTypes && Array.isArray(filters.propertyTypes)) {
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

    console.log('🌐 Calling external API for property search (POST method)');

    // Pagination defaults
    const size = Math.max(1, Math.min(200, parseInt((filters.size as any) || '50', 10)));
    const page = Math.max(1, parseInt((filters.page as any) || '1', 10));
    const resultIndex = (page - 1) * size;

    // Build the request body with filters
    const requestBody: any = { size, resultIndex, mls_active: true };
    
    // Add filters to request body (convert from query params to body params)
    const allLocations = Array.isArray(filters.locations) ? filters.locations : parsedLocations;
    if (allLocations && allLocations.length > 0) {
      requestBody.locations = allLocations;
      requestBody.states = allLocations.filter(l => typeof l === 'string' && /^[A-Za-z]{2}$/.test(String(l))).map(s => String(s).toUpperCase());
      const cityState = allLocations
        .map(l => String(l))
        .map(s => {
          const parts = s.split(',');
          if (parts.length >= 2) {
            const statePart = parts[parts.length - 1] ?? '';
            const state = statePart.trim().toUpperCase();
            const city = parts.slice(0, parts.length - 1).join(',').trim();
            if (city && /^[A-Za-z]{2}$/.test(state) === false) {
              return { city, state };
            }
            return { city, state };
          }
          return null;
        })
        .filter(Boolean);
      (requestBody as any)._cityState = cityState; // internal marker for post-filtering
      // Best-effort upstream hints
      if (cityState.length === 1) {
        requestBody.city = cityState[0]?.city;
        requestBody.state = cityState[0]?.state;
      }
    }
    if (filters.minPrice) requestBody.minPrice = filters.minPrice;
    if (filters.maxPrice) requestBody.maxPrice = filters.maxPrice;
    if (filters.propertyTypes && Array.isArray(filters.propertyTypes)) {
      requestBody.propertyTypes = filters.propertyTypes;
    }
    if (filters.minBeds) requestBody.minBeds = filters.minBeds;
    if (filters.maxBeds) requestBody.maxBeds = filters.maxBeds;
    if (filters.minBaths) requestBody.minBaths = filters.minBaths;
    if (filters.maxBaths) requestBody.maxBaths = filters.maxBaths;
    if (filters.minSqft) requestBody.minSqft = filters.minSqft;
    if (filters.maxSqft) requestBody.maxSqft = filters.maxSqft;
    
    // Add boolean filters
    if (filters.absenteeOwner !== undefined) requestBody.absenteeOwner = filters.absenteeOwner;
    if (filters.highEquity !== undefined) requestBody.highEquity = filters.highEquity;
    if (filters.outOfStateOwner !== undefined) requestBody.outOfStateOwner = filters.outOfStateOwner;
    if (filters.corporateOwned !== undefined) requestBody.corporateOwned = filters.corporateOwned;
    if (filters.investorBuyer !== undefined) requestBody.investorBuyer = filters.investorBuyer;
    if (filters.preForeclosure !== undefined) requestBody.preForeclosure = filters.preForeclosure;
    if (filters.taxLien !== undefined) requestBody.taxLien = filters.taxLien;
    if (filters.vacant !== undefined) requestBody.vacant = filters.vacant;
    if (filters.cashBuyer !== undefined) requestBody.cashBuyer = filters.cashBuyer;
    
    // Add numeric filters
    if (filters.equityPercent) requestBody.equityPercent = filters.equityPercent;
    if (filters.yearsOwned) requestBody.yearsOwned = filters.yearsOwned;
    if (filters.lastSaleDate) requestBody.lastSaleDate = filters.lastSaleDate;
    if (filters.medianIncome) requestBody.medianIncome = filters.medianIncome;

    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));

    // Basic caching for search requests to mitigate rate limits
    const cacheKey = `search:${JSON.stringify(requestBody)}`;
    const cached = propertyCache.get(cacheKey);
    if (cached && nowMs() - cached.ts < PROPERTY_CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, meta: { page, size, resultIndex, cached: true } });
    }

    // Use the correct format from the cURL command
    const response = await axios.post('https://api.realestateapi.com/v2/PropertySearch', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ External API response received:', response.status);
    console.log('📊 Data count:', response.data?.data?.length || 0);

    // Post-filter by city/state if needed
    let payload = response.data;
    const statesFilter: string[] = requestBody.states || [];
    const cityStateFilter: Array<{ city?: string; state?: string }> = (requestBody as any)._cityState || [];
    const arr: any[] = Array.isArray(payload) ? payload : (payload?.data || []);
    if (arr && (statesFilter.length > 0 || cityStateFilter.length > 0)) {
      const statesSet = new Set(statesFilter);
      const norm = (s: string) => String(s || '').trim().toLowerCase();
      const filtered = arr.filter((item: any) => {
        const st = String(item?.address?.state || item?.state || '').toUpperCase();
        const ct = String(item?.address?.city || item?.city || '');
        const stateMatch = statesSet.size > 0 ? statesSet.has(st) : false;
        const cityStateMatch = cityStateFilter.some(cs => norm(cs.city || '') === norm(ct) && (cs.state ? cs.state.toUpperCase() === st : true));
        return (statesSet.size > 0 && stateMatch) || (cityStateFilter.length > 0 && cityStateMatch);
      });
      payload = Array.isArray(payload) ? filtered : { ...payload, data: filtered };
    }
    // Cache and return
    propertyCache.set(cacheKey, { data: payload, ts: nowMs() });
    return res.json({ success: true, data: payload, meta: { page, size, resultIndex } });

  } catch (error: any) {
    console.error('❌ Property search error:', error.message);
    
    if (error.response) {
      // External API returned an error
      console.error('API Error Status:', error.response.status);
      console.error('API Error Data:', error.response.data);
      
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data
      });
    } else if (error.request) {
      // Network error
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service'
      });
    } else {
      // Other error
      return res.status(500).json({
        success: false,
        message: 'Internal server error while processing property search'
      });
    }
  }
});

// POST variant that accepts JSON body, mirroring upstream contract
router.post('/search', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) return res.status(500).json({ success: false, message: 'Real Estate API key not configured' });

    const b = req.body || {};
    const page = Math.max(1, parseInt(String(b.page || '1'), 10));
    const size = Math.max(1, Math.min(200, parseInt(String(b.size || '50'), 10)));
    const resultIndex = (page - 1) * size;

    const body: any = {
      size,
      resultIndex,
      mls_active: b.mls_active !== undefined ? !!b.mls_active : true
    };
    if (b.state) body.state = String(b.state).toUpperCase();
    if (b.city) body.city = String(b.city);
    if (Array.isArray(b.states)) body.states = b.states.map((s: any) => String(s).toUpperCase());
    if (Array.isArray(b.locations)) body.locations = b.locations;
    if (b.property_type) body.property_type = String(b.property_type).toUpperCase();

    const response = await axios.post('https://api.realestateapi.com/v2/PropertySearch', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000
    });

    return res.json({ success: true, data: response.data, meta: { page, size, resultIndex } });
  } catch (error: any) {
    if (error.response) {
      return res.status(error.response.status).json({ success: false, message: error.response.data?.message || 'External API error', details: error.response.data });
    }
    return res.status(500).json({ success: false, message: error?.message || 'Search failed' });
  }
});

/**
 * GET /api/v1/properties/featured
 * Get featured properties (default search)
 */
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    console.log('🏠 Featured properties request received');

    // Get API key from environment
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    console.log('🔑 API Key check:', apiKey ? `Present (${apiKey.substring(0, 10)}...)` : 'Missing');
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured'
      });
    }

    console.log('🌐 Calling external API for featured properties (POST method)');
    console.log('📤 Request headers:', {
      'Content-Type': 'application/json',
      'x-api-key': `${apiKey.substring(0, 15)}...`,
      'User-Agent': 'AcquireFlow/1.0'
    });
    // Pagination: page & size from query
    const q = _req.query as any;
    const size = Math.max(1, Math.min(200, parseInt(q?.size || '50', 10)));
    const page = Math.max(1, parseInt(q?.page || '1', 10));
    const resultIndex = (page - 1) * size;
    const body = { size, resultIndex, mls_active: true };
    console.log('📤 Request body:', JSON.stringify(body, null, 2));

    // Basic caching layer to avoid hammering upstream
    const cacheKey = `featured:${body.size}:${body.resultIndex}`;
    const cached = propertyCache.get(cacheKey);
    if (cached && nowMs() - cached.ts < PROPERTY_CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, meta: { page, size, resultIndex, cached: true } });
    }

    // Use the correct format from the cURL command
    const response = await axios.post('https://api.realestateapi.com/v2/PropertySearch', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ External API response received:', response.status);
    console.log('📊 Featured properties count:', response.data?.data?.length || 0);

    // Save to cache and return the data to frontend
    propertyCache.set(cacheKey, { data: response.data, ts: nowMs() });
    return res.json({
      success: true,
      data: response.data,
      meta: { page, size, resultIndex }
    });

  } catch (error: any) {
    console.error('❌ Featured properties error:', error.message);
    
    if (error.response) {
      console.error('📊 Error Status:', error.response.status);
      console.error('📋 Error Headers:', error.response.headers);
      console.error('📄 Error Data:', error.response.data);
      console.error('🔗 Request URL:', error.config?.url);
      console.error('📤 Request Headers:', error.config?.headers);
      
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data,
        apiStatus: error.response.status
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching featured properties'
      });
    }
  }
});

/**
 * GET /api/v1/properties/mls-search
 * Proxies to https://api.realestateapi.com/v2/MLSSearch
 * Accepts common filters via query: city, state, zip, mlsType, page, size
 */
router.get('/mls-search', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) return res.status(500).json({ success: false, message: 'Real Estate API key not configured' });

    const q = req.query as any;
    const page = Math.max(1, parseInt(String(q.page || '1'), 10));
    const size = Math.max(1, Math.min(200, parseInt(String(q.size || '50'), 10)));
    const resultIndex = (page - 1) * size;

    const body: any = { size, resultIndex };
    if (q.city) body.city = String(q.city);
    if (q.state) body.state = String(q.state).toUpperCase();
    if (q.zip) body.zip = String(q.zip);
    if (q.mlsType) body.mlsType = Array.isArray(q.mlsType) ? q.mlsType : String(q.mlsType).split(',').map((s: string) => s.trim()).filter(Boolean);
    if (q.mlsBoardCode) body.mlsBoardCode = String(q.mlsBoardCode);
    if (q.isListed !== undefined) body.isListed = String(q.isListed).toLowerCase() === 'true';

    const cacheKey = `mls-search:${JSON.stringify(body)}`;
    const cached = propertyCache.get(cacheKey);
    if (cached && nowMs() - cached.ts < PROPERTY_CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, meta: { page, size, resultIndex, cached: true } });
    }

    const response = await axios.post('https://api.realestateapi.com/v2/MLSSearch', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000
    });

    propertyCache.set(cacheKey, { data: response.data, ts: nowMs() });
    return res.json({ success: true, data: response.data, meta: { page, size, resultIndex } });
  } catch (error: any) {
    if (error.response) {
      return res.status(error.response.status).json({ success: false, message: error.response.data?.message || 'External API error', details: error.response.data });
    }
    return res.status(500).json({ success: false, message: error?.message || 'MLS search failed' });
  }
});

/**
 * POST /api/v1/properties/mls-search
 * Proxies to https://api.realestateapi.com/v2/MLSSearch with JSON body
 */
router.post('/mls-search', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) return res.status(500).json({ success: false, message: 'Real Estate API key not configured' });

    const b = req.body || {};
    const page = Math.max(1, parseInt(String(b.page || '1'), 10));
    const size = Math.max(1, Math.min(200, parseInt(String(b.size || '50'), 10)));
    const resultIndex = (page - 1) * size;

    const body: any = { size, resultIndex };
    if (b.city) body.city = String(b.city);
    if (b.state) body.state = String(b.state).toUpperCase();
    if (b.zip) body.zip = String(b.zip);
    if (Array.isArray(b.mlsType)) body.mlsType = b.mlsType;
    else if (b.mlsType) body.mlsType = String(b.mlsType).split(',').map((s: string) => s.trim()).filter(Boolean);
    if (b.mlsBoardCode) body.mlsBoardCode = String(b.mlsBoardCode);
    if (b.isListed !== undefined) body.isListed = !!b.isListed;

    const response = await axios.post('https://api.realestateapi.com/v2/MLSSearch', body, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000
    });

    return res.json({ success: true, data: response.data, meta: { page, size, resultIndex } });
  } catch (error: any) {
    if (error.response) {
      return res.status(error.response.status).json({ success: false, message: error.response.data?.message || 'External API error', details: error.response.data });
    }
    return res.status(500).json({ success: false, message: error?.message || 'MLS search failed' });
  }
});

/**
 * GET /api/v1/properties/market-kpis
 * Query: city=Orlando&state=FL
 */
router.get('/market-kpis', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }
    const data = await LeaderboardService.computeCityKpisFromSample(city, state);
    const keys = Object.keys(data || {});
    const isZeroed = !data || (!data['medianPrice'] && !data['inventory'] && !data['daysOnMarket']);
    return res.json({ success: true, data, meta: { keys, city, state, zeroed: isZeroed } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute market KPIs';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/v1/properties/:id
 * Get property details by ID
 */
// Leaderboard must be defined BEFORE the catch-all :id route
/**
 * GET /api/v1/properties/leaderboard
 * Compute and return Top 10 cities to invest in
 */
router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const top10 = await LeaderboardService.computeLeaderboard();
    return res.json({ success: true, data: top10 });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute leaderboard';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/v1/properties/market-heatmap
 * Query: city=Orlando&state=FL&view=price|growth|opportunity (optional)
 * Returns synthetic but stable neighborhood metrics for heatmap overlays.
 */
router.get('/market-heatmap', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    const view = (((req.query as any)['view'] as string) || 'price').trim();
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }

    const kpi = await LeaderboardService.computeCityKpisFromSample(city, state);
    // Base anchors
    const medianPrice = kpi?.medianPrice ?? 350000;
    const priceChangeMoM = kpi?.priceChangeMoM ?? 0.5;
    const opportunity = kpi?.opportunityScore ?? 60;

    // Basic city center lat/lng (approximate). Fallback: Orlando
    const cityCenters: Record<string, { lat: number; lng: number }> = {
      'Orlando, FL': { lat: 28.538336, lng: -81.379234 },
      'Miami, FL': { lat: 25.761681, lng: -80.191788 },
      'Tampa, FL': { lat: 27.950575, lng: -82.457178 },
      'Jacksonville, FL': { lat: 30.332184, lng: -81.655651 },
      'Fort Lauderdale, FL': { lat: 26.122438, lng: -80.137314 },
      'West Palm Beach, FL': { lat: 26.715342, lng: -80.053375 },
      'Naples, FL': { lat: 26.142036, lng: -81.794807 },
      'Sarasota, FL': { lat: 27.336435, lng: -82.530653 },
      'Fort Myers, FL': { lat: 26.640628, lng: -81.872308 },
      'Daytona Beach, FL': { lat: 29.210815, lng: -81.022833 },
    };
    const centerKey = `${city}, ${state}`;
    const center = cityCenters[centerKey] || cityCenters['Orlando, FL'];

    // Deterministic pseudo-random based on city/state for stable results
    const seedStr = `${city}-${state}`;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => {
      // xorshift
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff;
    };

    const names = ['Downtown', 'Westside', 'Northside', 'Eastside', 'Southside', 'Midtown', 'Lakeside', 'Riverside', 'Uptown', 'Old Town'];
    const neighborhoods = names.slice(0, 8 + Math.floor(rand() * 3)).map((name) => {
      const pMult = 0.85 + rand() * 0.35; // 0.85 - 1.20
      const growth = (priceChangeMoM + (rand() * 0.8 - 0.2)).toFixed(2); // around MoM +/-
      const opp = Math.max(0, Math.min(100, Math.round(opportunity + (rand() * 20 - 10))));
      // create small geographic offsets (≈ ±0.08 deg)
      const baseLat = center ? center.lat : 28.538336;
      const baseLng = center ? center.lng : -81.379234;
      const lat = baseLat + (rand() - 0.5) * 0.16;
      const lng = baseLng + (rand() - 0.5) * 0.16;
      return {
        name,
        x: Math.round(10 + rand() * 80), // retained for legacy fallback
        y: Math.round(10 + rand() * 80),
        price: Math.round(medianPrice * pMult),
        growth: parseFloat(growth),
        opportunity: opp,
        lat,
        lng,
      };
    });

    const outCenterLat = center ? center.lat : 28.538336;
    const outCenterLng = center ? center.lng : -81.379234;
    return res.json({ success: true, data: { city, state, view, centerLat: outCenterLat, centerLng: outCenterLng, neighborhoods } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute market heatmap';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/v1/properties/zillow-link
 * Query: address=7200 N Ocean Blvd #440&city=Myrtle Beach&state=SC&zip=29572
 * Attempts to resolve a Zillow zpid and returns a direct homedetails URL.
 * Uses RapidAPI (zillow56) if ZILLOW_RAPIDAPI_KEY is configured. Falls back to slug URL.
 */
router.get('/zillow-link', async (req: Request, res: Response) => {
  try {
    const address = String((req.query as any)['address'] || '').trim();
    const city = String((req.query as any)['city'] || '').trim();
    const state = String((req.query as any)['state'] || '').trim();
    const zip = String((req.query as any)['zip'] || '').trim();
    const latQ = (req.query as any)['lat'];
    const lngQ = (req.query as any)['lng'];
    const lat = latQ !== undefined ? parseFloat(String(latQ)) : undefined;
    const lng = lngQ !== undefined ? parseFloat(String(lngQ)) : undefined;
    if (!address || !city || !state) {
      return res.status(400).json({ success: false, message: 'address, city, state are required' });
    }

    // Cache lookup (address+city+state+zip normalized)
    const cacheKey = normalizeKey(`${address}|${city}|${state}|${zip}|${Math.round((lat || 0) * 10000)}|${Math.round((lng || 0) * 10000)}`);
    const cached = zillowCache.get(cacheKey);
    if (cached && (nowMs() - cached.ts) < ZILLOW_CACHE_TTL_MS) {
      return res.json({ success: true, data: { url: cached.url, zpid: cached.zpid, resolved: cached.resolved, cached: true } });
    }

    const buildSlugUrl = () => {
      const slug = `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}`
        .replace(/#/g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return `https://www.zillow.com/homes/${slug}_rb/`;
    };

    const rapidKey = process.env['ZILLOW_RAPIDAPI_KEY'] || process.env['RAPIDAPI_KEY'];
    const primaryHost = process.env['ZILLOW_RAPIDAPI_HOST'] || 'zillow56.p.rapidapi.com';
    const fallbackHosts = [primaryHost, 'zillow-com1.p.rapidapi.com', 'zillow2.p.rapidapi.com']
      .filter((v, i, arr) => !!v && arr.indexOf(v) === i);

    let resolvedUrl: string | null = null;
    let zpid: string | number | null = null;

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const haversineMiles = (lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | null => {
      if (!Number.isFinite(lat1 as number) || !Number.isFinite(lon1 as number) || !Number.isFinite(lat2 as number) || !Number.isFinite(lon2 as number)) return null;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 3958.8; // miles
      const dLat = toRad((lat2 as number) - (lat1 as number));
      const dLon = toRad((lon2 as number) - (lon1 as number));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 as number)) * Math.cos(toRad(lat2 as number)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    type ZillowCandidate = { zpid?: string | number; detailUrl?: string; street?: string; city?: string; state?: string; zip?: string; latitude?: number; longitude?: number };
    const extractCandidates = (payload: any): ZillowCandidate[] => {
      const arr: any[] = [];
      if (!payload) return [];
      if (Array.isArray(payload)) arr.push(...payload);
      if (Array.isArray(payload?.results)) arr.push(...payload.results);
      if (Array.isArray(payload?.homes)) arr.push(...payload.homes);
      if (Array.isArray(payload?.props)) arr.push(...payload.props);
      if (Array.isArray(payload?.data)) arr.push(...payload.data);
      if (Array.isArray(payload?.listResults)) arr.push(...payload.listResults);
      if (Array.isArray(payload?.cat1?.searchResults?.listResults)) arr.push(...payload.cat1.searchResults.listResults);
      return arr.map((it: any) => {
        const info = it?.hdpData?.homeInfo || it;
        const latLong = it?.latLong || it?.coordinate || {};
        return {
          zpid: info?.zpid || it?.zpid,
          detailUrl: it?.detailUrl || it?.url || it?.href,
          street: info?.streetAddress || it?.address || it?.streetAddress,
          city: info?.city || it?.city,
          state: info?.state || it?.state,
          zip: info?.zipcode || it?.zip || it?.zipcode,
          latitude: info?.latitude || latLong?.latitude,
          longitude: info?.longitude || latLong?.longitude,
        } as ZillowCandidate;
      });
    };

    const scoreCandidate = (c: ZillowCandidate): number => {
      let score = 0;
      const inStreet = normalize(String(c.street || ''));
      const inCity = normalize(String(c.city || ''));
      const inState = normalize(String(c.state || ''));
      const inZip = normalize(String(c.zip || ''));

      const streetNum = (address.match(/\d+/)?.[0] || '').toLowerCase();
      const streetName = normalize(address.replace(/\d+/g, ''));
      if (streetNum && inStreet.includes(normalize(streetNum))) score += 45;
      if (streetName && inStreet.includes(streetName.slice(0, Math.min(8, streetName.length)))) score += 25;
      if (inCity && inCity === normalize(city)) score += 10;
      if (inState && inState === normalize(state)) score += 10;
      if (zip && inZip && inZip.startsWith(normalize(zip))) score += 10;

      const d = haversineMiles(lat, lng, c.latitude, c.longitude);
      if (d !== null) {
        if (d < 0.25) score += 30;
        else if (d < 0.5) score += 24;
        else if (d < 1.0) score += 18;
        else if (d < 2.0) score += 10;
      }
      if (c.zpid) score += 5; // prefer candidates with explicit zpid
      return score;
    };

    if (rapidKey) {
      for (const rapidHost of fallbackHosts) {
        try {
          // Call search with full address
          const locationFull = `${address}, ${city}, ${state} ${zip}`.trim();
          const searchResp = await axios.get(`https://${rapidHost}/search`, {
            params: { location: locationFull },
            headers: {
              'X-RapidAPI-Key': rapidKey,
              'X-RapidAPI-Host': rapidHost,
              'Accept': 'application/json',
              'User-Agent': 'AcquireFlow/1.0'
            },
            timeout: 15000
          }).catch(() => ({ data: null } as any));

          const candidates1 = extractCandidates(searchResp?.data);

          // Also try a broader extended search in the city/state
          const extResp = await axios.get(`https://${rapidHost}/propertyExtendedSearch`, {
            params: { location: `${city}, ${state}` },
            headers: {
              'X-RapidAPI-Key': rapidKey,
              'X-RapidAPI-Host': rapidHost,
              'Accept': 'application/json',
              'User-Agent': 'AcquireFlow/1.0'
            },
            timeout: 15000
          }).catch(() => ({ data: null } as any));

          const candidates2 = extractCandidates(extResp?.data);
          const all = [...candidates1, ...candidates2].filter(Boolean);

          if (all.length) {
            const scored = all
              .map(c => ({ c, s: scoreCandidate(c) }))
              .sort((a, b) => b.s - a.s);
            const best = scored[0];
            if (best && best.s >= 50 && best.c.zpid) {
              zpid = best.c.zpid as any;
              const detailUrl = best.c.detailUrl || '';
              if (detailUrl && /zpid/i.test(detailUrl)) {
                resolvedUrl = detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`;
              } else {
                const slug = `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}`
                  .replace(/#/g, '')
                  .replace(/,/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/[^a-zA-Z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
                resolvedUrl = `https://www.zillow.com/homedetails/${slug}/${zpid}_zpid/`;
              }
              // store in cache and stop trying other hosts
              zillowCache.set(cacheKey, { url: resolvedUrl, zpid, resolved: true, ts: nowMs() });
              break; // stop trying other hosts
            }
          }
        } catch (err: any) {
          // try next host
          continue;
        }
      }
    }

    const fallbackUrl = resolvedUrl || buildSlugUrl();
    // Cache fallback too (prevents hammering)
    zillowCache.set(cacheKey, { url: fallbackUrl, zpid: zpid || null, resolved: !!resolvedUrl, ts: nowMs() });
    return res.json({ success: true, data: { url: fallbackUrl, zpid: zpid || null, resolved: !!resolvedUrl } });
  } catch (error: any) {
    if (error?.response?.status === 429) {
      // Gracefully degrade to slug url instead of failing the UI
      const address = String((req.query as any)['address'] || '').trim();
      const city = String((req.query as any)['city'] || '').trim();
      const state = String((req.query as any)['state'] || '').trim();
      const zip = String((req.query as any)['zip'] || '').trim();
      const slug = `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}`
        .replace(/#/g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const url = `https://www.zillow.com/homes/${slug}_rb/`;
      return res.json({ success: true, data: { url, zpid: null, resolved: false, rateLimited: true } });
    }
    return res.status(500).json({ success: false, message: error?.message || 'Failed to resolve Zillow link' });
  }
});

/**
 * GET /api/v1/properties/agent-activity
 * Query: city=Orlando&state=FL
 * Returns brokerage market share and top agents (synthetic but stable).
 */
router.get('/agent-activity', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }
    const kpi = await LeaderboardService.computeCityKpisFromSample(city, state);
    const opportunity = kpi?.opportunityScore ?? 60;

    const seedStr = `${city}-${state}-agents`;
    let seed = 0; for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };

    const companies = ['Keller Williams', 'Coldwell Banker', 'RE/MAX', 'Century 21', 'Douglas Elliman', 'Compass', 'eXp Realty'];
    // Generate random weights that sum to 100
    const weights = companies.slice(0, 5 + Math.floor(rand() * 2)).map(() => 10 + Math.floor(rand() * 25));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const breakdown = weights.map((w, i) => {
      const value = Math.round((w / sum) * 100);
      const transactions = Math.round(150 + rand() * 400 * (opportunity / 100));
      const avgPrice = 300000 + rand() * 400000;
      const volume = `$${Math.round(transactions * avgPrice).toLocaleString()}`;
      return { name: companies[i], value, transactions, volume };
    });
    // Adjust to sum 100 exactly (guarded for TS noUncheckedIndexedAccess)
    const diff = 100 - breakdown.reduce((a, b) => a + b.value, 0);
    if (breakdown.length > 0) {
      const first = breakdown[0];
      if (first) first.value += diff;
    }

    const firstNames = ['Sarah', 'Michael', 'Jennifer', 'Robert', 'Emily', 'David', 'Sophia', 'Daniel'];
    const lastNames = ['Johnson', 'Rodriguez', 'Smith', 'Williams', 'Brown', 'Davis', 'Martinez', 'Miller'];
    const topAgents = Array.from({ length: 3 }).map(() => {
      const name = `${firstNames[Math.floor(rand() * firstNames.length)]} ${lastNames[Math.floor(rand() * lastNames.length)]}`;
      const idx = breakdown.length > 0 ? Math.floor(rand() * breakdown.length) : -1;
      const selected = idx >= 0 ? breakdown[idx] : undefined;
      const company = selected?.name || companies[0];
      const transactions = Math.round(20 + rand() * 60);
      const volume = `$${Math.round((300000 + rand() * 500000) * transactions).toLocaleString()}`;
      return { name, company, transactions, volume };
    });

    return res.json({ success: true, data: { city, state, breakdown, topAgents } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute agent activity';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * GET /api/v1/properties/monthly-kpis
 * Query: city=Orlando&state=FL&months=24
 * Returns synthetic, deterministic monthly KPIs suitable for charts.
 */
router.get('/monthly-kpis', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    const monthsParam = parseInt(((req.query as any)['months'] as string) || '24', 10);
    const months = Math.max(3, Math.min(120, isNaN(monthsParam) ? 24 : monthsParam));
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }

    // anchor from KPI
    const kpi = await LeaderboardService.computeCityKpisFromSample(city, state);
    const anchorPrice = kpi?.medianPrice ?? 350000;
    const anchorInventory = kpi?.inventory ?? 3000;
    const anchorDom = kpi?.daysOnMarket ?? 22;
    const priceMoM = (kpi?.priceChangeMoM ?? 0.5) / 100; // 0.005

    // deterministic randomness for stability
    const seedStr = `${city}-${state}-monthly`;
    let seed = 0; for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };

    const out: Array<{ month: string; medianPrice: number; inventory: number; daysOnMarket: number; salesIndex: number; }> = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const season = Math.sin((d.getMonth() + 3) * Math.PI / 6) * 0.03; // ±3%
      const noise = (rand() * 0.01) - 0.005; // ±0.5%

      // reverse compounding from anchor to past
      const monthsBack = months - 1 - i;
      const priceBase = anchorPrice / Math.pow(1 + priceMoM, monthsBack);
      const medianPrice = Math.max(50000, Math.round(priceBase * (1 + season + noise)));

      const inventorySeason = Math.sin((d.getMonth() + 2) * Math.PI / 6) * 0.08; // ±8%
      const inventoryNoise = (rand() * 0.04) - 0.02; // ±2%
      const inventory = Math.max(0, Math.round(anchorInventory * (1 + inventorySeason + inventoryNoise)));

      const domSeason = Math.cos((d.getMonth() + 3) * Math.PI / 6) * 0.12; // ±12%
      const domNoise = (rand() * 0.06) - 0.03; // ±3%
      const daysOnMarket = Math.max(1, Math.round(anchorDom * (1 + domSeason + domNoise)));

      const salesIndex = Math.round(100 * (1 + Math.sin((d.getMonth()) * Math.PI / 6) * 0.2)); // 80-120

      out.push({ month: monthKey, medianPrice, inventory, daysOnMarket, salesIndex });
    }

    return res.json({ success: true, data: out, meta: { city, state, months } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute monthly KPIs';
    return res.status(500).json({ success: false, message });
  }
});

/**
 * PUBLIC SHARE LINK SUPPORT
 * - GET /api/v1/properties/share-link?id=PROPERTY_ID&expiresDays=7
 *   Returns a signed URL that can be opened without login.
 * - GET /api/v1/properties/shared/:token
 *   Validates token and returns property details.
 */
const getShareSecret = (): string => process.env['SHARE_LINK_SECRET'] || process.env['JWT_SECRET'] || 'acquireflow_share_secret_dev';

type ShareTokenPayload = { id: string; exp: number; snap?: any };

const signToken = (payload: ShareTokenPayload): string => {
  const secret = getShareSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const verifyToken = (token: string): ShareTokenPayload | null => {
  const secret = getShareSecret();
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ShareTokenPayload;
    if (!payload?.id || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

router.get('/share-link', async (req: Request, res: Response) => {
  try {
    const id = (req.query['id'] as string || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'id required' });
    const days = Math.max(1, Math.min(90, parseInt((req.query['expiresDays'] as string) || '7', 10) || 7));
    const exp = Date.now() + days * 24 * 60 * 60 * 1000;
    let snap: any | undefined;
    const snapshotParam = (req.query['snapshot'] as string | undefined);
    if (snapshotParam) {
      try { snap = JSON.parse(Buffer.from(snapshotParam, 'base64url').toString('utf8')); } catch {}
    }
    const token = signToken({ id, exp, snap });
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/api/v1/properties/shared/${token}`;
    return res.json({ success: true, data: { token, url, expiresAt: new Date(exp).toISOString() } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'failed to create share link' });
  }
});

router.get('/shared/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = verifyToken(String(token || ''));
    if (!payload) return res.status(401).json({ success: false, message: 'Invalid or expired token' });

    // reuse property details logic; if fails, fall back to embedded snapshot
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'Real Estate API key not configured' });
    }
    const apiUrl = `https://api.realestateapi.com/v2/Property/${payload.id}?apikey=${apiKey}`;
    try {
      const response = await axios.get(apiUrl, { headers: { 'Accept': 'application/json', 'User-Agent': 'AcquireFlow/1.0' }, timeout: 30000 });
      return res.json({ success: true, data: response.data, shared: true });
    } catch (err) {
      if (payload.snap) {
        return res.json({ success: true, data: payload.snap, shared: true, fallback: true });
      }
      throw err;
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch shared property' });
  }
});
/**
 * GET /api/v1/properties/opportunity-summary
 * Query: city=Orlando&state=FL
 * Returns a dynamic summary used by the Investment Opportunity Alert card.
 */
router.get('/opportunity-summary', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }

    const kpi = await LeaderboardService.computeCityKpisFromSample(city, state);
    const opp = Math.max(0, Math.min(100, kpi?.opportunityScore ?? 60));
    const medianPrice = kpi?.medianPrice ?? 350000;

    // Deterministic small jitter for stability per city
    const seedStr = `${city}-${state}-opp-summary`;
    let seed = 0; for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };

    const jitter = (range: number) => (rand() * 2 - 1) * range; // ±range

    const avgCapRate = +(4 + (opp / 100) * 3 + jitter(0.2)).toFixed(1); // 4%–7% ±0.2
    const projectedRoi = +(8 + (opp / 100) * 12 + jitter(0.5)).toFixed(1); // 8%–20% ±0.5
    const count = Math.max(3, Math.round(6 + (opp / 100) * 18 + jitter(2))); // ~6–24

    return res.json({ success: true, data: { count, avgCapRate, medianPrice, projectedRoi } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute opportunity summary';
    return res.status(500).json({ success: false, message });
  }
});
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('🏠 Property details request for ID:', id);

    // Get API key from environment
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured'
      });
    }

    const apiUrl = `https://api.realestateapi.com/v2/Property/${id}?apikey=${apiKey}`;
    
    console.log('🌐 Calling external API for property details');

    // Make request to external API
    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AcquireFlow/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ External API response received:', response.status);

    // Return the data to frontend
    return res.json({
      success: true,
      data: response.data
    });

  } catch (error: any) {
    console.error('❌ Property details error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching property details'
      });
    }
  }
});

/**
 * GET /api/v1/properties/opportunity-summary
 * Query: city=Orlando&state=FL
 * Returns a dynamic summary used by the Investment Opportunity Alert card.
 */
router.get('/opportunity-summary', async (req: Request, res: Response) => {
  try {
    const city = ((req.query as any)['city'] as string || '').trim();
    const state = ((req.query as any)['state'] as string || '').trim();
    if (!city || !state) {
      return res.status(400).json({ success: false, message: 'city and state are required, e.g., ?city=Orlando&state=FL' });
    }

    const kpi = await LeaderboardService.computeCityKpisFromSample(city, state);
    const opp = Math.max(0, Math.min(100, kpi?.opportunityScore ?? 60));
    const medianPrice = kpi?.medianPrice ?? 350000;

    // Deterministic small jitter for stability per city
    const seedStr = `${city}-${state}-opp-summary`;
    let seed = 0; for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };

    const jitter = (range: number) => (rand() * 2 - 1) * range; // ±range

    const avgCapRate = +(4 + (opp / 100) * 3 + jitter(0.2)).toFixed(1); // 4%–7% ±0.2
    const projectedRoi = +(8 + (opp / 100) * 12 + jitter(0.5)).toFixed(1); // 8%–20% ±0.5
    const count = Math.max(3, Math.round(6 + (opp / 100) * 18 + jitter(2))); // ~6–24

    return res.json({ success: true, data: { count, avgCapRate, medianPrice, projectedRoi } });
  } catch (error: any) {
    const message = error?.message || 'Failed to compute opportunity summary';
    return res.status(500).json({ success: false, message });
  }
});

export default router;
