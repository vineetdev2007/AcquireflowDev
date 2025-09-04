import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { propertyService, type MonthlyKpiItem } from '../../../services/propertyService';
export const SeasonalPatternsChart = ({
  selectedMarket
}) => {
  const [selectedMetric, setSelectedMetric] = useState('sales'); // sales, price, inventory
  const [data, setData] = useState([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Try to load monthly KPIs for past 12 months
        const monthly: MonthlyKpiItem[] = await propertyService.getMonthlyKpis(selectedMarket, 12);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const avgPrice = (monthly.reduce((a, b) => a + b.medianPrice, 0) / (monthly.length || 1)) || 1;
        const avgInventory = (monthly.reduce((a, b) => a + b.inventory, 0) / (monthly.length || 1)) || 1;
        const built = monthly.map(item => {
          const [y, m] = item.month.split('-');
          const label = months[Number(m) - 1] || item.month;
          return {
            month: label,
            sales: item.salesIndex,
            price: Math.round((item.medianPrice / avgPrice) * 100),
            inventory: Math.round((item.inventory / avgInventory) * 100),
            current: false
          };
        });
        if (mounted) setData(built);
      } catch {
        // Fallback to modeled seasonality if monthly history is unavailable
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const baseSales = 100;
        const basePrice = 100;
        const baseInventory = 100;
        const seasonSales = [0.8,0.85,0.95,1.05,1.15,1.2,1.1,1.0,0.9,0.85,0.82,0.8];
        const seasonPrice = [0.97,0.98,1.0,1.03,1.06,1.08,1.06,1.04,1.02,1.0,0.98,0.97];
        const seasonInventory = [1.1,1.05,1.0,0.95,0.9,0.85,0.9,0.95,1.0,1.05,1.1,1.15];
        const fallback = months.map((m, i) => ({
          month: m,
          sales: Math.round(baseSales * seasonSales[i]),
          price: Math.round(basePrice * seasonPrice[i]),
          inventory: Math.round(baseInventory * seasonInventory[i]),
          current: m === new Date().toLocaleString('en-US', { month: 'short' })
        }));
        if (mounted) setData(fallback);
      }
    })();
    return () => { mounted = false; };
  }, [selectedMarket]);
  const CustomTooltip = ({
    active,
    payload,
    label
  }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const metric = selectedMetric;
      return <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="mt-2">
            <p className="text-primary">
              <span className="font-medium">
                {metric === 'sales' ? 'Sales Volume: ' : metric === 'price' ? 'Price Level: ' : 'Inventory Level: '}
              </span>
              {value}%
              <span className="text-gray-500 text-xs ml-1">
                (of annual average)
              </span>
            </p>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {value > 100 ? `${value - 100}% higher than average` : value < 100 ? `${100 - value}% lower than average` : 'At annual average'}
          </div>
        </div>;
    }
    return null;
  };
  return <div className="h-full">
      <div className="flex mb-3 space-x-2">
        <button className={`px-2 py-1 text-xs rounded-full ${selectedMetric === 'sales' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setSelectedMetric('sales')}>
          Sales Volume
        </button>
        <button className={`px-2 py-1 text-xs rounded-full ${selectedMetric === 'price' ? 'bg-tertiary text-dark' : 'bg-gray-100 text-gray-600'}`} onClick={() => setSelectedMetric('price')}>
          Price Levels
        </button>
        <button className={`px-2 py-1 text-xs rounded-full ${selectedMetric === 'inventory' ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => setSelectedMetric('inventory')}>
          Inventory
        </button>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Showing seasonal patterns as percentage of annual average (100% =
        average)
      </div>
      <ResponsiveContainer width="100%" height="75%">
        <AreaChart data={data} margin={{
        top: 5,
        right: 30,
        left: 20,
        bottom: 5
      }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{
          fontSize: 10,
          fill: '#6B7280'
        }} axisLine={{
          stroke: '#E5E7EB'
        }} tickLine={{
          stroke: '#E5E7EB'
        }} />
          <YAxis tick={{
          fontSize: 10,
          fill: '#6B7280'
        }} axisLine={{
          stroke: '#E5E7EB'
        }} tickLine={{
          stroke: '#E5E7EB'
        }} domain={[60, 140]} tickFormatter={value => `${value}%`} />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3AB795" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3AB795" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FECA57" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#FECA57" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          {selectedMetric === 'sales' && <Area type="monotone" dataKey="sales" stroke="#3AB795" fillOpacity={1} fill="url(#colorSales)" animationDuration={1000} />}
          {selectedMetric === 'price' && <Area type="monotone" dataKey="price" stroke="#FECA57" fillOpacity={1} fill="url(#colorPrice)" animationDuration={1000} />}
          {selectedMetric === 'inventory' && <Area type="monotone" dataKey="inventory" stroke="#FF6B6B" fillOpacity={1} fill="url(#colorInventory)" animationDuration={1000} />}
          <ReferenceLine y={100} stroke="#9CA3AF" strokeDasharray="3 3" />
          {/* Reference line for current month */}
          {data.findIndex(d => d.current) >= 0 && <ReferenceLine x={data.find(d => d.current)?.month} stroke="#3AB795" strokeWidth={2} label={{
          value: 'Current',
          position: 'top',
          fill: '#3AB795',
          fontSize: 10
        }} />}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-gray-600">
        <h4 className="font-medium">Key Insights:</h4>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>
            Best time to{' '}
            {selectedMetric === 'sales' ? 'sell' : selectedMetric === 'price' ? 'list' : 'buy'}
            :{' '}
            {selectedMetric === 'sales' ? 'May-June' : selectedMetric === 'price' ? 'May-July' : 'December-January'}
          </li>
          <li>
            Market{' '}
            {selectedMetric === 'sales' ? 'activity' : selectedMetric === 'price' ? 'prices' : 'inventory'}{' '}
            {selectedMetric === 'sales' ? 'slows' : selectedMetric === 'price' ? 'drop' : 'rises'}{' '}
            during{' '}
            {selectedMetric === 'sales' || selectedMetric === 'price' ? 'winter months' : 'summer months'}
          </li>
        </ul>
      </div>
    </div>;
};