import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart2, PlusCircle, MinusCircle, ArrowUpRight, Download } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, Tooltip } from 'recharts';
import { propertyService, type MarketKpisResponse } from '../../services/propertyService';
interface MarketMetrics {
  name: string;
  medianPrice: string;
  priceChange: string;
  cashOnCash: string;
  capRate: string;
  appreciation: string;
  inventory: string;
  daysOnMarket: string;
  jobGrowth: string;
  populationGrowth: string;
  affordability: string;
  investorActivity: string;
  opportunity: number;
  risk: number;
  overallScore: number;
}
interface MarketComparisonGridProps {
  selectedMarkets: string[];
  onAddMarket: (market: string) => void;
  onRemoveMarket: (market: string) => void;
  availableMarkets: string[];
}
export const MarketComparisonGrid: React.FC<MarketComparisonGridProps> = ({
  selectedMarkets,
  onAddMarket,
  onRemoveMarket,
  availableMarkets
}) => {
  // Ensure deduped markets to avoid duplicate keys in render
  const normalizedSelected = Array.from(new Set(selectedMarkets.map(m => m.trim().replace(/\s+/g, ' '))));
  const [showDetails, setShowDetails] = useState(false);
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [comparisonView, setComparisonView] = useState<'table' | 'radar'>('table');
  const [marketData, setMarketData] = useState<MarketMetrics[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingData(true);
        setLoadError(null);
        const results = await Promise.all(normalizedSelected.map(async (name) => {
          try {
            const data = await propertyService.getMarketKpis(name);
            return { name, data } as { name: string; data: MarketKpisResponse };
          } catch (e: any) {
            return { name, data: null as any } as { name: string; data: any };
          }
        }));

        const numericPrices = results.map(r => r.data?.medianPrice ?? 0);
        const minPrice = Math.min(...numericPrices.filter(n => Number.isFinite(n) && n > 0), Infinity);
        const maxPrice = Math.max(...numericPrices.filter(n => Number.isFinite(n)), 0);
        const priceRange = Math.max(1, (isFinite(minPrice) ? maxPrice - minPrice : 0));

        const computed: MarketMetrics[] = results.map(({ name, data }) => {
          if (!data) {
            return {
              name,
              medianPrice: 'N/A',
              priceChange: '0%',
              cashOnCash: '0%',
              capRate: '0%',
              appreciation: '0%',
              inventory: '0',
              daysOnMarket: '0',
              jobGrowth: '0%',
              populationGrowth: '0%',
              affordability: '0/100',
              investorActivity: 'N/A',
              opportunity: 0,
              risk: 0,
              overallScore: 0,
            };
          }

          const fmtCurrency = (n: number) => `$${Math.round(n).toLocaleString()}`;
          const fmtPercent = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;

          const opp = Math.max(0, Math.min(100, data.opportunityScore));
          const cashOnCash = 4 + (opp / 100) * 6; // 4% - 10%
          const capRate = 4 + (opp / 100) * 3; // 4% - 7%
          const appreciationYoY = data.priceChangeMoM * 12; // approx annualized
          const jobGrowth = (opp / 100) * 2.5; // 0% - 2.5%
          const populationGrowth = (opp / 100) * 2; // 0% - 2%
          const affordabilityScore = isFinite(minPrice)
            ? Math.round(100 - ((data.medianPrice - minPrice) / priceRange) * 100)
            : 70;
          const investorActivity = data.daysOnMarket < 20 || opp > 75 ? 'High' : (data.daysOnMarket > 35 || opp < 40 ? 'Low' : 'Medium');
          const risk = Math.max(0, Math.min(100, 100 - opp));

          return {
            name,
            medianPrice: fmtCurrency(data.medianPrice),
            priceChange: fmtPercent(data.priceChangeMoM),
            cashOnCash: `${cashOnCash.toFixed(1)}%`,
            capRate: `${capRate.toFixed(1)}%`,
            appreciation: fmtPercent(appreciationYoY),
            inventory: data.inventory.toLocaleString(),
            daysOnMarket: String(data.daysOnMarket),
            jobGrowth: `${jobGrowth.toFixed(1)}%`,
            populationGrowth: `${populationGrowth.toFixed(1)}%`,
            affordability: `${Math.max(0, Math.min(100, affordabilityScore))}/100`,
            investorActivity,
            opportunity: opp,
            risk,
            overallScore: Math.round(opp),
          };
        });

        if (mounted) setMarketData(computed);
      } catch (e: any) {
        if (mounted) setLoadError(e?.message || 'Failed to load comparison data');
      } finally {
        if (mounted) setLoadingData(false);
      }
    })();
    return () => { mounted = false; };
  }, [normalizedSelected.join('|')]);
  // Filter available markets based on search term
  const filteredMarkets = availableMarkets.filter(market => market.toLowerCase().includes(searchTerm.toLowerCase()));
  // Transform data for radar chart
  const getRadarData = () => {
    const metrics = [{
      name: 'Cash Flow',
      key: 'cashOnCash',
      divider: 8
    }, {
      name: 'Appreciation',
      key: 'appreciation',
      divider: 6
    }, {
      name: 'Affordability',
      key: 'opportunity',
      divider: 100
    }, {
      name: 'Job Growth',
      key: 'jobGrowth',
      divider: 3
    }, {
      name: 'Low Risk',
      key: 'risk',
      divider: 100,
      inverse: true
    }];
    return metrics.map(metric => {
      const result: {
        [key: string]: any;
      } = {
        metric: metric.name
      };
      marketData.forEach(market => {
        const raw = (market as any)[metric.key];
        let numeric = 0;
        if (typeof raw === 'number') {
          numeric = raw;
        } else if (typeof raw === 'string') {
          const cleaned = raw.replace('%', '').replace('/100', '').replace(/[^0-9.\-]/g, '');
          const parsed = parseFloat(cleaned);
          numeric = Number.isFinite(parsed) ? parsed : 0;
        }
        const base = Math.abs(metric.divider) || 1;
        let pct = (numeric / base) * 100;
        pct = Math.max(0, Math.min(100, pct));
        result[market.name] = metric.inverse ? Math.max(0, 100 - pct) : pct;
      });
      return result;
    });
  };
  const radarData = useMemo(() => getRadarData(), [marketData]);
  const COLORS = ['#3AB795', '#FECA57', '#FF6B6B', '#4B5563', '#9CA3AF'];
  return <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center">
          <BarChart2 size={20} className="mr-2 text-primary" />
          Market Comparison
        </h2>
        <div className="flex space-x-2">
          {loadError && <span className="text-xs text-secondary">{loadError}</span>}
          {loadingData && <span className="text-xs text-gray-500">Loading…</span>}
          <button className={`px-3 py-1.5 text-xs rounded-lg ${comparisonView === 'table' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setComparisonView('table')}>
            Table View
          </button>
          <button className={`px-3 py-1.5 text-xs rounded-lg ${comparisonView === 'radar' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setComparisonView('radar')}>
            Radar View
          </button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => {
            const headers = ['Metric', ...marketData.map(m => m.name)];
            const rows: (string | number)[][] = [];
            const metrics: [string, keyof MarketMetrics][] = [
              ['Median Price', 'medianPrice'],
              ['Price Change (YoY)', 'priceChange'],
              ['Cash-on-Cash', 'cashOnCash'],
              ['Cap Rate', 'capRate'],
              ['Appreciation', 'appreciation'],
              ['Inventory', 'inventory'],
              ['Days on Market', 'daysOnMarket'],
              ['Job Growth', 'jobGrowth'],
              ['Population Growth', 'populationGrowth'],
              ['Affordability', 'affordability'],
              ['Investor Activity', 'investorActivity'],
              ['Overall Score', 'overallScore'],
            ];
            const escapeCell = (v: string | number) => {
              const s = String(v ?? '');
              return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            };
            const toCsv = (r: (string | number)[][]) => r.map(row => row.map(escapeCell).join(',')).join('\n');
            metrics.forEach(([label, key]) => {
              rows.push([label, ...marketData.map(m => (m as any)[key] ?? '')]);
            });
            const csv = toCsv([headers, ...rows]);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `market-comparison-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} title="Export comparison as CSV">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Selected Markets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {normalizedSelected.map(market => <div key={market} className="bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-lg text-xs flex items-center">
            {market}
            <button className="ml-2 hover:text-primary-dark" onClick={() => onRemoveMarket(market)}>
              <MinusCircle size={14} />
            </button>
          </div>)}
        <button className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs flex items-center hover:bg-gray-200" onClick={() => setShowAddMarket(!showAddMarket)}>
          <PlusCircle size={14} className="mr-1" />
          Add Market
        </button>
      </div>

      {/* Add Market Dropdown */}
      {showAddMarket && <div className="mb-4 p-3 border border-gray-200 rounded-lg">
          <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-2" placeholder="Search markets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="max-h-40 overflow-y-auto">
            {filteredMarkets.length > 0 ? filteredMarkets.map(market => <button key={market} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg flex justify-between items-center" onClick={() => {
          onAddMarket(market);
          setShowAddMarket(false);
          setSearchTerm('');
        }} disabled={selectedMarkets.includes(market)}>
                  <span>{market}</span>
                  {selectedMarkets.includes(market) ? <span className="text-xs text-gray-400">Already added</span> : <PlusCircle size={14} className="text-primary" />}
                </button>) : <div className="text-center py-2 text-gray-500 text-sm">
                No markets found
              </div>}
          </div>
        </div>}

      {/* Table View */}
      {comparisonView === 'table' && <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">Metric</th>
                {marketData.map(market => <th key={market.name} className="px-4 py-2 text-left font-medium">
                    {market.name}
                  </th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-sm font-medium">Median Price</td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.medianPrice}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Price Change (YoY)
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm flex items-center">
                    {market.priceChange.startsWith('+') ? <TrendingUp size={14} className="text-primary mr-1" /> : <TrendingDown size={14} className="text-secondary mr-1" />}
                    {market.priceChange}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Cash-on-Cash Return
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.cashOnCash}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">Cap Rate</td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.capRate}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Appreciation Rate
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.appreciation}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">Job Growth</td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.jobGrowth}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Population Growth
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.populationGrowth}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Days on Market
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.daysOnMarket} days
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">Affordability</td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.affordability}
                  </td>)}
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">
                  Investor Activity
                </td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm">
                    {market.investorActivity}
                  </td>)}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3 text-sm font-bold">Overall Score</td>
                {marketData.map(market => <td key={market.name} className="px-4 py-3 text-sm font-bold">
                    {market.overallScore}/100
                  </td>)}
              </tr>
            </tbody>
          </table>
        </div>}

      {/* Radar Chart View */}
      {comparisonView === 'radar' && <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{
            fill: '#6B7280',
            fontSize: 12
          }} />
              {marketData.map((market, index) => <Radar key={market.name} name={market.name} dataKey={market.name} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.2} />)}
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>}

      <div className="mt-4 flex justify-end">
        <button className="px-4 py-2 bg-primary text-white text-sm rounded-lg flex items-center" onClick={() => setShowDetails(true)}>
          View Detailed Analysis
          <ArrowUpRight size={16} className="ml-1.5" />
        </button>
      </div>

      {showDetails && <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center" onClick={() => setShowDetails(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold">Detailed Comparison Analysis</h3>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => setShowDetails(false)}>Close</button>
              </div>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto">
              <div className="mb-3 text-sm text-gray-600">Comparing: {normalizedSelected.join(', ')}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2">Score Radar</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#6B7280', fontSize: 12 }} />
                        {marketData.map((market, index) => <Radar key={market.name} name={market.name} dataKey={market.name} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.2} />)}
                        <Tooltip />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2">Key Metrics</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="px-3 py-2 text-left">Metric</th>
                          {marketData.map(m => <th key={m.name} className="px-3 py-2 text-left">{m.name}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          ['Median Price', 'medianPrice'],
                          ['Price Change (YoY)', 'priceChange'],
                          ['Cash-on-Cash', 'cashOnCash'],
                          ['Cap Rate', 'capRate'],
                          ['Appreciation', 'appreciation'],
                          ['Inventory', 'inventory'],
                          ['Days on Market', 'daysOnMarket'],
                          ['Job Growth', 'jobGrowth'],
                          ['Population Growth', 'populationGrowth'],
                          ['Affordability', 'affordability'],
                          ['Investor Activity', 'investorActivity'],
                          ['Overall Score', 'overallScore']
                        ].map(([label, key]) => <tr key={key as string}>
                            <td className="px-3 py-2 font-medium">{label}</td>
                            {marketData.map(m => <td key={m.name + String(key)} className="px-3 py-2">{(m as any)[key as string]}</td>)}
                          </tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}
    </div>;
};