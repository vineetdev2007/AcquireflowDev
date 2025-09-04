import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { propertyService } from '../../../services/propertyService';
type InventoryLevelsChartProps = {
  selectedMarket: string;
  timeRange: string;
};

type InventoryDatum = {
  date: string;
  inventory: number;
  newListings: number;
  balanced: number;
  timestamp: number;
};

export const InventoryLevelsChart = ({
  selectedMarket,
  timeRange
}: InventoryLevelsChartProps) => {
  const [data, setData] = useState<InventoryDatum[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60 } as const;
      const monthCount = months[(timeRange as keyof typeof months)] || 6;
      const now = new Date();
      try {
        const kpi = await propertyService.getMarketKpis(selectedMarket);
        const baseInventory = kpi.inventory;
        const series: InventoryDatum[] = [];
        for (let i = monthCount; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          const noise = Math.sin(i * 0.5) * 0.05;
          const trend = -i * 0.01; // slight decrease into the past
          const seasonality = Math.sin((date.getMonth() + 2) * Math.PI / 6) * 0.08;
          const multiplier = 1 + noise + trend + seasonality;
          series.push({
            date: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            inventory: Math.max(0, Math.round(baseInventory * multiplier)),
            newListings: Math.max(0, Math.round(baseInventory * multiplier * 0.22)),
            balanced: Math.round(baseInventory * 0.9),
            timestamp: date.getTime(),
          });
        }
        if (mounted) setData(series);
      } catch {
        if (mounted) setData([]);
      }
    })();
    return () => { mounted = false; };
  }, [selectedMarket, timeRange]);
  const CustomTooltip = ({
    active,
    payload,
    label
  }: any) => {
    if (active && payload && payload.length) {
      const inventoryData = payload.find((p: any) => p.dataKey === 'inventory');
      const newListingsData = payload.find((p: any) => p.dataKey === 'newListings');
      const balancedData = payload.find((p: any) => p.dataKey === 'balanced');
      const inventoryValue = inventoryData ? inventoryData.value : 0;
      const balancedValue = balancedData ? balancedData.value : 0;
      const marketStatus = inventoryValue > balancedValue * 1.1 ? "Buyer's Market" : inventoryValue < balancedValue * 0.9 ? "Seller's Market" : 'Balanced Market';
      return <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <div className="mt-2 space-y-1">
            <p style={{
            color: '#3AB795'
          }}>
              <span className="font-medium">Total Inventory: </span>
              {inventoryData?.value.toLocaleString()}
            </p>
            <p style={{
            color: '#FECA57'
          }}>
              <span className="font-medium">New Listings: </span>
              {newListingsData?.value.toLocaleString()}
            </p>
            <p className="text-gray-600 text-xs mt-2">
              <span className="font-medium">Market Status: </span>
              <span className={marketStatus === "Buyer's Market" ? 'text-secondary' : marketStatus === "Seller's Market" ? 'text-primary' : 'text-tertiary'}>
                {marketStatus}
              </span>
            </p>
          </div>
        </div>;
    }
    return null;
  };
  return <div className="h-full">
      <div className="text-xs text-gray-500 mb-2">
        <div className="flex items-center">
          <span className="w-3 h-3 bg-primary rounded-full mr-1"></span>
          <span className="mr-3">Total Inventory</span>
          <span className="w-3 h-3 bg-tertiary rounded-full mr-1"></span>
          <span className="mr-3">New Listings</span>
          <span className="w-3 h-3 border border-dashed border-gray-400 rounded-full mr-1"></span>
          <span>Balanced Market</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{
        top: 5,
        right: 30,
        left: 20,
        bottom: 5
      }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{
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
        }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="inventory" fill="#3AB795" radius={[4, 4, 0, 0]} animationDuration={1000} name="Total Inventory" />
          <Bar dataKey="newListings" fill="#FECA57" radius={[4, 4, 0, 0]} animationDuration={1000} name="New Listings" />
          {data.length > 0 && typeof data[0].balanced === 'number' && <ReferenceLine y={data[0].balanced} stroke="#9CA3AF" strokeDasharray="3 3" label={{
          value: 'Balanced Market',
          position: 'right',
          fill: '#9CA3AF',
          fontSize: 10
        }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>;
};