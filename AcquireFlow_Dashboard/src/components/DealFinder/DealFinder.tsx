import React, { useEffect, useState } from 'react';
import { FilterProvider } from './Filters/FilterContext';
import { FilterSidebar } from './Filters/FilterSidebar';
import { FilterState } from './Filters/FilterContext';
import { PropertyDetailsModal } from './PropertyDetailsModal';
import { PropertyMap } from './PropertyMap';
import { BulkSelectionToolbar } from './PropertyResults/BulkSelectionToolbar';
import { BulkOfferModal } from './BulkOfferModal';
import { DealFinderHeader } from './DealFinderHeader';
import { Home, MapPin, Star, Heart, Map as MapIcon, Grid, Clock, CheckSquare, FileText } from 'lucide-react';
import { propertyService, PropertyData, PropertySearchFilters, testAPI } from '../../services/propertyService';

// Extended interface for UI display
interface PropertyResult extends PropertyData {
  // Additional UI-specific properties
  image: string;
  cashFlow: number;
  capRate: number;
  roi: number;
  rehabCost: number;
  motivationFactors: string[];
  daysOnMarket: number;
  dealScore: number;
}

export const DealFinder: React.FC = () => {
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppending, setIsAppending] = useState(false);
  const [isFilteredResults, setIsFilteredResults] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyResult | null>(null);
  const [savedProperties, setSavedProperties] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [showBulkOfferModal, setShowBulkOfferModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [investmentStrategy, setInvestmentStrategy] = useState<'wholesaling' | 'fixAndFlip' | 'buyAndHold' | 'shortTermRental' | 'custom'>('buyAndHold');
  const [error, setError] = useState<string | null>(null);

  // Fetch initial properties when component mounts
  useEffect(() => {
    // If page is 1, replace results; otherwise, append
    if (page === 1) {
      fetchInitialProperties(1, pageSize);
    } else {
      const loadMore = async () => {
        setIsAppending(true);
        try {
          const response = await propertyService.getFeaturedProperties(page, pageSize);
          if (response.data && response.data.length > 0) {
            const transformed = response.data.map(transformPropertyData);
            const withCoords = await ensureCoordinates(transformed);
            setResults(prev => [...prev, ...withCoords]);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsAppending(false);
        }
      };
      loadMore();
    }
  }, [page, pageSize]);

  // Simple in-memory cache for geocoding results
  const geocodeCache = new Map<string, { lat: number; lng: number }>();

  // Geocode an address to coordinates using OpenStreetMap Nominatim as a lightweight fallback
  const geocodeAddress = async (fullAddress: string): Promise<{ lat: number; lng: number } | null> => {
    if (!fullAddress) return null;
    if (geocodeCache.has(fullAddress)) {
      return geocodeCache.get(fullAddress)!;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) return null;
      const data: Array<{ lat: string; lon: string } & Record<string, any>> = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        if (Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
          geocodeCache.set(fullAddress, coords);
          return coords;
        }
      }
    } catch (_) {
      // Ignore geocoding errors; map will simply skip invalid points
    }
    return null;
  };

  // Ensure every property has valid coordinates; if missing, try to geocode from address
  const ensureCoordinates = async (items: PropertyResult[]): Promise<PropertyResult[]> => {
    const resultsWithCoords = await Promise.all(items.map(async (p) => {
      const hasValidLatLng = Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);
      if (hasValidLatLng) return p;
      const fullAddress = p.address?.address || [p.address?.street, p.address?.city, p.address?.state, p.address?.zip].filter(Boolean).join(', ');
      const geocoded = await geocodeAddress(fullAddress);
      if (geocoded) {
        return { ...p, latitude: geocoded.lat, longitude: geocoded.lng };
      }
      return p;
    }));
    return resultsWithCoords;
  };

  // Function to transform API data to UI format
  const transformPropertyData = (apiData: PropertyData): PropertyResult => {
    // Calculate derived values
    const estimatedValue = apiData.estimatedValue || apiData.assessedValue || 0;
    const lastSaleAmount = parseFloat(apiData.lastSaleAmount) || 0;
    
    // Calculate cash flow (simplified calculation)
    const monthlyRent = apiData.rentAmount || estimatedValue * 0.01; // 1% rule
    const monthlyExpenses = estimatedValue * 0.005; // 0.5% for expenses
    const cashFlow = monthlyRent - monthlyExpenses;
    
    // Calculate cap rate
    const capRate = estimatedValue > 0 ? (monthlyRent * 12 / estimatedValue) * 100 : 0;
    
    // Calculate ROI
    const roi = lastSaleAmount > 0 ? ((estimatedValue - lastSaleAmount) / lastSaleAmount) * 100 : 0;
    
    // Estimate rehab cost (simplified)
    const rehabCost = estimatedValue * 0.15; // 15% of property value
    
    // Generate motivation factors
    const motivationFactors: string[] = [];
    if (apiData.absenteeOwner) motivationFactors.push('Absentee Owner');
    if (apiData.highEquity) motivationFactors.push('High Equity');
    if (apiData.outOfStateAbsenteeOwner) motivationFactors.push('Out-of-State');
    if (apiData.taxLien) motivationFactors.push('Tax Liens');
    if (apiData.preForeclosure) motivationFactors.push('Pre-Foreclosure');
    if (apiData.vacant) motivationFactors.push('Vacant');
    if (apiData.corporateOwned) motivationFactors.push('Corporate Owned');
    if (apiData.investorBuyer) motivationFactors.push('Investor Owned');
    
    // Calculate days on market (simplified)
    const lastSaleDate = new Date(apiData.lastSaleDate);
    const daysOnMarket = Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate deal score (0-100)
    let dealScore = 50; // Base score
    if (apiData.highEquity) dealScore += 20;
    if (apiData.absenteeOwner) dealScore += 15;
    if (apiData.outOfStateAbsenteeOwner) dealScore += 10;
    if (apiData.corporateOwned) dealScore += 10;
    if (apiData.investorBuyer) dealScore += 5;
    if (apiData.taxLien) dealScore += 15;
    if (apiData.preForeclosure) dealScore += 20;
    if (apiData.vacant) dealScore += 10;
    dealScore = Math.min(dealScore, 100);
    
    // Generate property image
    const image = `https://source.unsplash.com/random/800x600/?house,${apiData.id}`;

    return {
      ...apiData,
      image,
      cashFlow: Math.round(cashFlow),
      capRate: Math.round(capRate * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      rehabCost: Math.round(rehabCost),
      motivationFactors,
      daysOnMarket: Math.max(0, daysOnMarket),
      dealScore
    };
  };

  // Function to fetch initial properties
  const fetchInitialProperties = async (p: number = 1, s: number = 50) => {
    setIsLoading(true);
    setError(null);
    setIsFilteredResults(false);
    setSelectedProperties([]); // Clear selections when refreshing
    
    try {
      const response = await propertyService.getFeaturedProperties(p, s);
      
      if (response.data && response.data.length > 0) {
        const transformedResults = response.data.map(transformPropertyData);
        const withCoords = await ensureCoordinates(transformedResults);
        setResults(withCoords);
      } else {
        setError('No properties available at the moment.');
        setResults([]);
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('CORS_ERROR')) {
        setError('API temporarily unavailable due to CORS policy.');
      } else {
        setError('Failed to load properties.');
      }
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiltersApplied = async (filters: FilterState) => {
    setIsLoading(true);
    setError(null);
    setIsFilteredResults(true);
    setSelectedProperties([]); // Clear selections when applying filters
    
    // Update investment strategy based on filter selection if available
    if (filters.investmentStrategy) {
      setInvestmentStrategy(filters.investmentStrategy as any);
    }

    try {
      // Convert FilterState to PropertySearchFilters
      const searchFilters: PropertySearchFilters = {
        locations: filters.locations,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        propertyTypes: filters.propertyTypes,
        motivationFactors: filters.motivationFactors,
        investmentStrategy: filters.investmentStrategy,
        minBeds: filters.minBeds,
        maxBeds: filters.maxBeds,
        minBaths: filters.minBaths,
        maxBaths: filters.maxBaths,
        minSqft: filters.minSqft,
        maxSqft: filters.maxSqft
      };

      const response = await propertyService.searchProperties({ ...searchFilters, page, size: pageSize });
      
      if (response.data && response.data.length > 0) {
        const transformedResults = response.data.map(transformPropertyData);
        const withCoords = await ensureCoordinates(transformedResults);
        setResults(withCoords);
      } else {
        setError('No properties found matching your criteria.');
        setResults([]);
      }
    } catch (err) {
      console.error('Error searching properties:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('CORS_ERROR')) {
        setError('API search temporarily unavailable due to CORS policy. Please try again.');
      } else {
        setError('Failed to search properties. Please try again.');
      }
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Handle property selection
  const handleViewDetails = (property: PropertyResult) => {
    setSelectedProperty(property);
  };

  // Handle closing property details modal
  const handleCloseDetails = () => {
    setSelectedProperty(null);
  };

  // Convert PropertyResult to Property for map compatibility
  const convertToMapProperty = (property: PropertyResult) => {
    const parsedId = parseInt(property.id as any);
    const idNumber = Number.isFinite(parsedId)
      ? parsedId
      : Math.abs(Array.from(String(property.id)).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0));
    return {
      id: idNumber,
      address: property.address.address,
      city: property.address.city,
      state: property.address.state,
      price: property.estimatedValue,
      type: property.propertyType,
      beds: property.bedrooms || 0,
      baths: property.bathrooms || 0,
      sqft: property.squareFeet,
      image: property.image,
      lat: property.latitude,
      lng: property.longitude,
      dealScore: property.dealScore
    };
  };

  // Convert to details modal property shape
  type ModalProperty = {
    id: number;
    address: string;
    city: string;
    state: string;
    price: number;
    type: string;
    beds: number;
    baths: number;
    sqft: number;
    image: string;
    cashFlow: number;
    capRate: number;
    roi: number;
    rehabCost: number;
    motivationFactors: string[];
    daysOnMarket: number;
    dealScore: number;
    lat: number;
    lng: number;
  };

  const convertToDetailsProperty = (property: PropertyResult): ModalProperty => {
    const mapProps = convertToMapProperty(property);
    return {
      id: mapProps.id,
      address: property.address.address,
      city: property.address.city,
      state: property.address.state,
      price: property.estimatedValue,
      type: property.propertyType,
      beds: property.bedrooms || 0,
      baths: property.bathrooms || 0,
      sqft: property.squareFeet || 0,
      image: property.image,
      cashFlow: property.cashFlow,
      capRate: property.capRate,
      roi: property.roi,
      rehabCost: property.rehabCost,
      motivationFactors: property.motivationFactors,
      daysOnMarket: property.daysOnMarket,
      dealScore: property.dealScore,
      lat: property.latitude,
      lng: property.longitude,
    };
  };

  // Handle saving/favoriting properties
  const handleSaveProperty = (propertyId: string) => {
    setSavedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  // Toggle between grid and map view
  const toggleViewMode = (mode: 'grid' | 'map') => {
    setViewMode(mode);
  };

  // Handle refreshing results
  const handleRefreshResults = () => {
    if (isFilteredResults) {
      // Placeholder: re-trigger current filter search with same page
      setPage((p) => p); // no-op to trigger effect if needed
    } else {
      fetchInitialProperties(page, pageSize);
    }
  };

  // Handle selecting/deselecting a property
  const handleSelectProperty = (propertyId: string) => {
    setSelectedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  // Handle selecting all properties
  const handleSelectAll = () => {
    if (selectedProperties.length === results.length) {
      // If all are selected, deselect all
      setSelectedProperties([]);
    } else {
      // Otherwise, select all
      setSelectedProperties(results.map(property => property.id));
    }
  };

  // Clear all property selections
  const handleClearSelection = () => {
    setSelectedProperties([]);
  };

  // Handle bulk offer
  const handleBulkOffer = () => {
    if (selectedProperties.length > 0) {
      setShowBulkOfferModal(true);
    } else {
      alert('Please select properties first');
    }
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <FilterProvider onFiltersApplied={handleFiltersApplied}>
      <div className="flex flex-col h-full">
        <DealFinderHeader 
          propertyCount={results.length} 
          selectedCount={selectedProperties.length} 
          clearSelection={handleClearSelection} 
          investmentStrategy={investmentStrategy} 
          toggleSidebar={toggleSidebar} 
          isSidebarCollapsed={sidebarCollapsed} 
        />
        <div className="flex flex-1 overflow-hidden">
          <div className={`transition-all duration-300 ${sidebarCollapsed ? 'w-0' : 'w-80'} h-full`}>
            {!sidebarCollapsed && <FilterSidebar />}
          </div>
          <div className="flex-1 p-5 bg-gray-50 overflow-auto">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-semibold text-dark">
                  {isFilteredResults ? 'Filtered Properties' : 'Featured Properties'}
                </h2>
                {!isLoading && (
                  <p className="text-gray-500 mt-1">
                    {isFilteredResults 
                      ? `${results.length} properties matching your filters` 
                      : `${results.length} featured properties available`
                    }
                  </p>
                )}
                {error && (
                  <p className="text-red-500 mt-1 text-sm">
                    {error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!isLoading && results.length > 0 && (
                  <>
                    <button 
                      onClick={handleSelectAll} 
                      className={`px-3 py-1.5 text-sm rounded-lg flex items-center transition-colors ${
                        selectedProperties.length === results.length && results.length > 0 
                          ? 'bg-primary text-white' 
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CheckSquare size={16} className="mr-1.5" />
                      {selectedProperties.length === results.length && results.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedProperties.length > 0 && (
                      <button 
                        onClick={handleBulkOffer} 
                        className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg flex items-center hover:bg-primary-dark transition-colors"
                      >
                        <FileText size={16} className="mr-1.5" />
                        Send Bulk Offer
                      </button>
                    )}
                    <button 
                      onClick={handleRefreshResults} 
                      className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg flex items-center hover:bg-gray-50 transition-colors"
                    >
                      <Clock size={16} className="mr-1.5 text-primary" />
                      Refresh
                    </button>
                    <button 
                      onClick={() => {
                        console.log('🧪 Running API test...');
                        testAPI();
                      }} 
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg flex items-center hover:bg-blue-600 transition-colors"
                    >
                      🧪 Test API
                    </button>
                  </>
                )}
                {results.length > 0 && !isLoading && (
                  <div className="bg-white border border-gray-200 rounded-lg p-1 flex">
                    <button 
                      className={`px-3 py-1.5 rounded flex items-center text-sm ${
                        viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`} 
                      onClick={() => toggleViewMode('grid')}
                    >
                      <Grid size={16} className="mr-1.5" />
                      Grid
                    </button>
                    <button 
                      className={`px-3 py-1.5 rounded flex items-center text-sm ${
                        viewMode === 'map' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`} 
                      onClick={() => toggleViewMode('map')}
                    >
                      <MapIcon size={16} className="mr-1.5" />
                      Map
                    </button>
                  </div>
                )}
                {!isLoading && (
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => setPage(Math.max(1, page - 1))} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Prev</button>
                    <span className="text-sm text-gray-600">Page {page}</span>
                    <button onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Next</button>
                  </div>
                )}
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="text-center">
                  <svg className="animate-spin h-10 w-10 mx-auto text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-4 text-lg text-gray-600">
                    {isFilteredResults ? 'Finding properties matching your criteria...' : 'Loading featured investment properties...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {results.length > 0 ? (
                      results.map(property => (
                        <div 
                          key={property.id} 
                          className={`bg-white rounded-xl border ${
                            selectedProperties.includes(property.id) 
                              ? 'border-primary ring-2 ring-primary ring-opacity-30' 
                              : 'border-gray-200'
                          } shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                        >
                          <div className="h-48 bg-gray-200 relative">
                            <img src={property.image} alt={property.address.address} className="w-full h-full object-cover" />
                            <div className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center">
                              <Star size={12} className="mr-1" />
                              {property.dealScore}/100
                            </div>
                            <div className="absolute top-3 left-3 flex gap-2">
                              <button 
                                className={`p-2 rounded-full ${
                                  selectedProperties.includes(property.id) 
                                    ? 'bg-primary text-white' 
                                    : 'bg-white text-gray-500 hover:text-primary'
                                } transition-colors shadow-sm`} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProperty(property.id);
                                }}
                              >
                                <CheckSquare size={16} className={selectedProperties.includes(property.id) ? 'fill-current' : ''} />
                              </button>
                              <button 
                                className={`p-2 rounded-full ${
                                  savedProperties.includes(property.id) 
                                    ? 'bg-rose-500 text-white' 
                                    : 'bg-white text-gray-500 hover:text-rose-500'
                                } transition-colors shadow-sm`} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveProperty(property.id);
                                }}
                              >
                                <Heart size={16} className={savedProperties.includes(property.id) ? 'fill-current' : ''} />
                              </button>
                            </div>
                            {property.motivationFactors && property.motivationFactors.length > 0 && (
                              <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                                {property.motivationFactors.map((factor, index) => (
                                  <span key={index} className="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                                    {factor}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-dark">
                                {property.address.address}
                              </h3>
                              <p className="text-primary font-bold">
                                {formatCurrency(property.estimatedValue)}
                              </p>
                            </div>
                            <div className="flex items-center text-gray-500 text-sm mt-1">
                              <MapPin size={14} className="mr-1" />
                              <span>
                                {property.address.city}, {property.address.state}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center text-gray-500 text-sm">
                                <Home size={14} className="mr-1" />
                                <span>{property.propertyType}</span>
                              </div>
                              <div className="flex items-center text-gray-500 text-sm">
                                <span>{property.bedrooms || 0} bd</span>
                                <span className="mx-1">•</span>
                                <span>{property.bathrooms || 0} ba</span>
                                <span className="mx-1">•</span>
                                <span>
                                  {property.squareFeet ? property.squareFeet.toLocaleString() : 'N/A'} sqft
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                <div className="text-xs text-gray-500">
                                  Cash Flow
                                </div>
                                <div className="font-medium text-primary">
                                  ${property.cashFlow}/mo
                                </div>
                              </div>
                              <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                <div className="text-xs text-gray-500">
                                  Cap Rate
                                </div>
                                <div className="font-medium text-primary">
                                  {property.capRate}%
                                </div>
                              </div>
                            </div>
                            <div className="mt-4">
                              <button 
                                className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors" 
                                onClick={() => handleViewDetails(property)}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <h3 className="text-lg font-medium mb-2">
                          No properties found
                        </h3>
                        <p className="text-gray-500">
                          Try adjusting your filters to see more results.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[calc(100vh-220px)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {results.length > 0 ? (
                      <PropertyMap 
                        properties={results.map(convertToMapProperty)} 
                        onPropertySelect={(property) => {
                          const originalProperty = results.find(p => p.id === property.id.toString());
                          if (originalProperty) {
                            handleViewDetails(originalProperty);
                          }
                        }} 
                        selectedProperty={selectedProperty ? convertToMapProperty(selectedProperty) : null} 
                        savedProperties={savedProperties.map(id => parseInt(id) || 0)} 
                        onSaveProperty={(id) => handleSaveProperty(id.toString())} 
                        selectedProperties={selectedProperties.map(id => parseInt(id) || 0)} 
                        onSelectProperty={(id) => handleSelectProperty(id.toString())} 
                      />
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center h-64 flex items-center justify-center">
                        <div>
                          <h3 className="text-lg font-medium mb-2">
                            No properties found
                          </h3>
                          <p className="text-gray-500">
                            Try adjusting your filters to see results on the map.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Load More */}
                {viewMode === 'grid' && results.length > 0 && (
                  <div className="flex flex-col items-center mt-6">
                    {isAppending && (
                      <div className="flex items-center text-gray-500 text-sm mb-2">
                        <svg className="animate-spin h-5 w-5 mr-2 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading more properties...
                      </div>
                    )}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={isAppending}
                      className={`px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm ${isAppending ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                    >
                      {isAppending ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Property Details Modal */}
      {selectedProperty && (
        <PropertyDetailsModal 
          property={convertToDetailsProperty(selectedProperty)} 
          onClose={handleCloseDetails} 
          allProperties={results as any}
          sourceProperty={selectedProperty as any}
        />
      )}
      
      {/* Bulk Selection Toolbar */}
      {selectedProperties.length > 0 && (
        <BulkSelectionToolbar 
          selectedCount={selectedProperties.length} 
          onClearSelection={handleClearSelection} 
          investmentStrategy={investmentStrategy} 
        />
      )}
      
      {/* Bulk Offer Modal */}
      <BulkOfferModal 
        isOpen={showBulkOfferModal} 
        onClose={() => setShowBulkOfferModal(false)} 
        selectedProperties={selectedProperties.map(id => parseInt(id) || 0)} 
        propertyData={results} 
        investmentStrategy={investmentStrategy} 
      />
    </FilterProvider>
  );
};