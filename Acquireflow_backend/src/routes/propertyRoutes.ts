import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Extend NodeJS.ProcessEnv type for TypeScript safety
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      REAL_ESTATE_API_KEY?: string;
    }
  }
}

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
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    console.log('🏠 Property search request received');

    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured',
      });
    }

    const filters = req.query as PropertySearchFilters;
    const requestBody: any = {};

    if (filters.locations) requestBody.locations = filters.locations;
    if (filters.minPrice) requestBody.minPrice = filters.minPrice;

    const response = await axios.post(
      'https://api.realestateapi.com/v2/PropertySearch',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'User-Agent': 'AcquireFlow/1.0',
        },
        timeout: 30000,
      }
    );

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('❌ Property search error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data,
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error while processing property search',
      });
    }
  }
});

/**
 * GET /api/v1/properties/featured
 */
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured',
      });
    }

    const response = await axios.post(
      'https://api.realestateapi.com/v2/PropertySearch',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'User-Agent': 'AcquireFlow/1.0',
        },
        timeout: 30000,
      }
    );

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('❌ Featured properties error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data,
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching featured properties',
      });
    }
  }
});

/**
 * GET /api/v1/properties/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const apiKey = process.env['REAL_ESTATE_API_KEY'];
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Real Estate API key not configured',
      });
    }

    const apiUrl = `https://api.realestateapi.com/v2/Property/${id}?apikey=${apiKey}`;
    const response = await axios.get(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AcquireFlow/1.0',
      },
      timeout: 30000,
    });

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('❌ Property details error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `External API Error: ${error.response.data?.message || error.message}`,
        details: error.response.data,
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'Unable to connect to real estate API service',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching property details',
      });
    }
  }
});

export default router;
