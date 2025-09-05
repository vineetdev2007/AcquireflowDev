import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, MapPin, Clock, Star, Share2, ChevronRight, Printer, Download, Mail, Phone } from 'lucide-react';
import { propertyService, LoanProduct, FinanceAssumptions } from '../../services/propertyService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
interface PropertyResult {
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
}
interface PropertyDetailsModalProps {
  property: PropertyResult;
  onClose: () => void;
  // Raw property list from the results grid for dynamic market stats
  allProperties?: Array<{
    address?: { city?: string; state?: string };
    estimatedValue?: number;
    rentAmount?: number | null;
    bedrooms?: number | null;
    vacant?: boolean;
    lastSaleAmount?: string | number | null;
    lastSaleDate?: string | null;
    daysOnMarket?: number;
  }>;
  // Original property object (full dataset) for pulling extra fields like yearBuilt, lotSquareFeet
  sourceProperty?: {
    yearBuilt?: number | null;
    lotSquareFeet?: number | null;
    garage?: boolean | null;
    estimatedValue?: number | null;
    rentAmount?: number | null;
    assessedValue?: number | null;
    corporateOwned?: boolean | null;
    companyName?: string | null;
    owner1FirstName?: string | null;
    owner1LastName?: string | null;
  };
}
export const PropertyDetailsModal: React.FC<PropertyDetailsModalProps> = ({
  property,
  onClose,
  allProperties = [],
  sourceProperty
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'contact'>('overview');
  // Track fetch state in case we want to show loaders/errors later
  const [, setLoadingMarket] = useState(false);
  const [, setMarketError] = useState<string | null>(null);
  const [marketKpis, setMarketKpis] = useState<{
    medianHomePrice?: number;
    daysOnMarket?: number;
  } | null>(null);
  const [monthlyKpis, setMonthlyKpis] = useState<Array<{ month: string; medianPrice: number }> | null>(null);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[] | null>(null);
  const [assumptions, setAssumptions] = useState<FinanceAssumptions | null>(null);
  const [agentInfo, setAgentInfo] = useState<{ name: string; company: string; phone?: string | null; email?: string | null; image?: string | null } | null>(null);
  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  // ---------- Neighborhood metrics (dynamic) ----------
  const cityProperties = useMemo(() => {
    return (allProperties || []).filter(p => p?.address?.city === property.city && p?.address?.state === property.state);
  }, [allProperties, property.city, property.state]);

  const median = (values: number[]): number | null => {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return Math.round(sorted[mid]);
  };

  const avg = (values: number[]): number | null => {
    const nums = values.filter(v => Number.isFinite(v));
    if (nums.length === 0) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  };

  // Derived metrics from the loaded list (fallbacks when backend KPI is not available)
  const derivedMedianHomePrice = useMemo(() => {
    return median(cityProperties.map(p => Number(p.estimatedValue || 0)));
  }, [cityProperties]);

  const derivedAvgRent = useMemo(() => {
    const rents = cityProperties
      .map(p => {
        if (Number.isFinite(p.rentAmount as number)) return Number(p.rentAmount);
        if (Number.isFinite(p.estimatedValue as number)) return Math.round(Number(p.estimatedValue) * 0.0045);
        return NaN;
      })
      .filter(v => Number.isFinite(v)) as number[];
    if (rents.length > 0) return avg(rents);
    if (derivedMedianHomePrice) return Math.round(derivedMedianHomePrice * 0.0045);
    return null;
  }, [cityProperties, derivedMedianHomePrice, property.beds]);

  const derivedVacancyRate = useMemo(() => {
    if (!cityProperties.length) return null;
    const vacants = cityProperties.filter(p => p.vacant === true).length;
    return Math.round((vacants / cityProperties.length) * 100);
  }, [cityProperties]);

  const derivedDom = useMemo(() => {
    return avg(cityProperties.map(p => Number(p.daysOnMarket || 0)));
  }, [cityProperties]);

  // Fetch market KPIs and monthly KPIs (for YoY calculations) for the property's city/state
  useEffect(() => {
    let mounted = true;
    const fetchKpis = async () => {
      setLoadingMarket(true);
      setMarketError(null);
      try {
        const location = `${property.city}, ${property.state}`;
        const [kpis, monthly, products, financeAssumptions] = await Promise.all([
          propertyService.getMarketKpis(location).catch(() => null),
          propertyService.getMonthlyKpis(location, 24).catch(() => null),
          propertyService.getLoanProducts().catch(() => null),
          propertyService.getFinanceAssumptions().catch(() => null)
        ]);
        if (!mounted) return;
        if (kpis) setMarketKpis({ medianHomePrice: kpis.medianPrice, daysOnMarket: kpis.daysOnMarket });
        if (monthly) setMonthlyKpis(monthly.map(m => ({ month: m.month, medianPrice: m.medianPrice })));
        if (products) setLoanProducts(products);
        if (financeAssumptions) setAssumptions(financeAssumptions);
        // Build contact from property ownership details
        const ownerName = [sourceProperty?.owner1FirstName, sourceProperty?.owner1LastName]
          .filter(Boolean)
          .join(' ');
        const company = sourceProperty?.corporateOwned
          ? (sourceProperty?.companyName || 'Corporate Owner')
          : 'Property Owner';
        setAgentInfo({
          name: ownerName || 'Property Contact',
          company,
          phone: null,
          email: null,
          image: 'https://source.unsplash.com/random/100x100/?portrait',
        });
      } catch (e: any) {
        if (!mounted) return;
        setMarketError(e?.message || 'Failed to load market KPIs');
      } finally {
        if (mounted) setLoadingMarket(false);
      }
    };
    fetchKpis();
    return () => {
      mounted = false;
    };
  }, [property.city, property.state]);

  // Compute YoY appreciation using monthly KPIs when available, otherwise estimate from lastSale vs current value for city properties
  const yoyAppreciation = useMemo(() => {
    if (monthlyKpis && monthlyKpis.length >= 13) {
      const latest = monthlyKpis[monthlyKpis.length - 1];
      const yearAgo = monthlyKpis[monthlyKpis.length - 13];
      if (yearAgo?.medianPrice > 0) {
        return Math.round(((latest.medianPrice - yearAgo.medianPrice) / yearAgo.medianPrice) * 100);
      }
    }
    // Fallback: estimate using last sale vs current value for properties with a sale ~1 year ago
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const samples = cityProperties
      .map(p => {
        const saleDate = p.lastSaleDate ? new Date(p.lastSaleDate).getTime() : NaN;
        const withinWindow = Number.isFinite(saleDate) && Math.abs(now - saleDate) < oneYearMs * 1.5; // ~18 months window
        const lastAmt = Number(p.lastSaleAmount);
        const current = Number(p.estimatedValue);
        if (withinWindow && lastAmt > 0 && current > 0) {
          return ((current - lastAmt) / lastAmt) * 100;
        }
        return NaN;
      })
      .filter(v => Number.isFinite(v)) as number[];
    if (samples.length) return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    return null;
  }, [monthlyKpis, cityProperties]);

  // Use YoY price change as a proxy for rent growth when rent time-series isn't available
  const yoyRentIncrease = useMemo(() => {
    if (monthlyKpis && monthlyKpis.length >= 13) {
      const latest = monthlyKpis[monthlyKpis.length - 1];
      const yearAgo = monthlyKpis[monthlyKpis.length - 13];
      if (yearAgo?.medianPrice > 0) {
        const latestRent = latest.medianPrice * 0.0045;
        const yearAgoRent = yearAgo.medianPrice * 0.0045;
        return Math.round(((latestRent - yearAgoRent) / yearAgoRent) * 100);
      }
    }
    return yoyAppreciation ?? null;
  }, [monthlyKpis, yoyAppreciation]);

  // Investment metric calculations
  const estimatedArv = useMemo(() => {
    const base = Number(sourceProperty?.estimatedValue ?? property.price) || property.price;
    const growth = Number.isFinite(yoyAppreciation as number) ? (yoyAppreciation as number) : 5; // default 5%
    const multiplier = Math.max(0, (100 + growth) / 100);
    return Math.round(base * multiplier);
  }, [sourceProperty?.estimatedValue, property.price, yoyAppreciation]);

  const potentialRoi = useMemo(() => {
    const investment = property.price + (property.rehabCost || 0);
    if (investment <= 0) return 0;
    const roi = ((estimatedArv - investment) / investment) * 100;
    return Math.round(roi);
  }, [property.price, property.rehabCost, estimatedArv]);

  const estimatedRent = useMemo(() => {
    if (Number.isFinite(sourceProperty?.rentAmount as number)) return Math.round(Number(sourceProperty?.rentAmount));
    if (derivedAvgRent !== null && derivedAvgRent !== undefined) return derivedAvgRent;
    if (sourceProperty?.estimatedValue) return Math.round(Number(sourceProperty.estimatedValue) * 0.0045);
    return Math.round(property.price * 0.0045);
  }, [sourceProperty?.rentAmount, derivedAvgRent, sourceProperty?.estimatedValue, property.price]);

  // Property info derived fields
  const yearBuilt = sourceProperty?.yearBuilt ?? null;
  const lotAcres = useMemo(() => {
    const sq = Number(sourceProperty?.lotSquareFeet);
    if (!Number.isFinite(sq) || sq <= 0) return null;
    return (sq / 43560).toFixed(2);
  }, [sourceProperty?.lotSquareFeet]);
  const parkingText = sourceProperty?.garage ? '1-Car Garage' : 'Street / Driveway';

  // ---------- Financial Analysis (dynamic) ----------
  const purchasePrice = property.price;
  const priceBasis = Number(sourceProperty?.assessedValue ?? sourceProperty?.estimatedValue ?? purchasePrice) || purchasePrice;
  const loanToValue = assumptions?.defaultLtv ?? 0.8;
  const interestRateAnnual = assumptions?.defaultInterestRate ?? 0.065;
  const loanTermMonths = 30 * 12; // 30-year fixed
  const monthlyRate = interestRateAnnual / 12;
  const loanAmount = Math.round(purchasePrice * loanToValue);
  const mortgagePayment = useMemo(() => {
    if (monthlyRate === 0) return Math.round(loanAmount / loanTermMonths);
    const pow = Math.pow(1 + monthlyRate, loanTermMonths);
    const payment = Math.round(loanAmount * ((monthlyRate * pow) / (pow - 1)));
    return payment;
  }, [loanAmount, monthlyRate]);

  // Annualized assumptions (prefer backend values)
  const taxRateAnnual = assumptions?.taxRateAnnual ?? 0.01;
  const insuranceRateAnnual = assumptions?.insuranceRateAnnual ?? 0.004;
  const managementRate = assumptions?.managementRate ?? 0.08;
  const maintenanceRate = assumptions?.maintenanceRate ?? 0.05;
  const vacancyRate = ((derivedVacancyRate ?? Math.round(((assumptions?.defaultVacancyRate ?? 0.05) * 100))) as number) / 100;

  const propertyTaxes = Math.round((priceBasis * taxRateAnnual) / 12);
  const insurance = Math.round((priceBasis * insuranceRateAnnual) / 12);
  const management = Math.round((estimatedRent || 0) * managementRate);
  const maintenance = Math.round((estimatedRent || 0) * maintenanceRate);
  const vacancy = Math.round((estimatedRent || 0) * vacancyRate);

  const rentalIncome = estimatedRent || 0;
  const otherIncome = 0;
  const totalIncome = rentalIncome + otherIncome;
  const totalExpenses = mortgagePayment + propertyTaxes + insurance + management + maintenance + vacancy;
  const computedMonthlyCashFlow = totalIncome - totalExpenses;

  // Investment metric recomputations
  const annualOperatingExpenses = (propertyTaxes + insurance + management + maintenance + vacancy) * 12;
  const annualNoi = totalIncome * 12 - annualOperatingExpenses;
  const derivedCapRate = purchasePrice > 0 ? Math.round((annualNoi / purchasePrice) * 100) : 0;
  const cashInvested = Math.round(purchasePrice * (1 - loanToValue) + property.rehabCost);
  const cashOnCash = cashInvested > 0 ? Math.round(((computedMonthlyCashFlow * 12) / cashInvested) * 100) : 0;
  const onePercentStatus = purchasePrice > 0 ? ((rentalIncome / purchasePrice) * 100).toFixed(2) : '0.00';
  const roi5Year = (() => {
    const annualAppreciation = (yoyAppreciation ?? 5) / 100;
    const valueAfter5 = Math.round(purchasePrice * Math.pow(1 + annualAppreciation, 5));
    const profit = (valueAfter5 - purchasePrice) + (computedMonthlyCashFlow * 12 * 5);
    return cashInvested > 0 ? Math.round((profit / cashInvested) * 100) : 0;
  })();

  // ---------- Financing Options (dynamic) ----------
  const defaultOptions: LoanProduct[] = [
    { name: 'Conventional 30-year', downPaymentPct: 0.20, rate: 0.065, termMonths: 360 },
    { name: 'Conventional 15-year', downPaymentPct: 0.20, rate: 0.060, termMonths: 180 },
    { name: 'FHA Loan', downPaymentPct: 0.035, rate: 0.068, termMonths: 360 },
    { name: 'Hard Money Loan', downPaymentPct: 0.25, rate: 0.10, termMonths: 12, interestOnly: true }
  ];
  const financingOptions: LoanProduct[] = loanProducts && loanProducts.length > 0 ? loanProducts : defaultOptions;

  const calcMonthlyPayment = (principal: number, annualRate: number, termMonths?: number, interestOnly?: boolean): number => {
    if (principal <= 0) return 0;
    if (interestOnly) {
      return Math.round((principal * annualRate) / 12);
    }
    const m = (annualRate || 0) / 12;
    if (!termMonths || termMonths <= 0) return Math.round(principal * m);
    if (m === 0) return Math.round(principal / termMonths);
    const pow = Math.pow(1 + m, termMonths);
    return Math.round(principal * ((m * pow) / (pow - 1)));
  };
  const agent = (agentInfo && {
    name: agentInfo.name,
    company: agentInfo.company,
    phone: agentInfo.phone || undefined,
    email: agentInfo.email || undefined,
    image: agentInfo.image || undefined,
  }) || (({ name: 'Local Agent', company: `${property.city} Real Estate`, phone: '(000) 000-0000', email: 'contact@example.com', image: 'https://source.unsplash.com/random/100x100/?portrait' } as {
    name: string;
    company: string;
    phone?: string;
    email?: string;
    image?: string;
  }));
  const contentRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const title = `${property.address}, ${property.city}, ${property.state}`;
    try {
      // Request a backend-signed share link that works without login
      // include a minimal snapshot for resilience if API is unavailable on open
      const snapshot = btoa(unescape(encodeURIComponent(JSON.stringify({ id: property.id, address: { address: property.address }, city: property.city, state: property.state, estimatedValue: property.price, propertyType: property.type, bedrooms: property.beds, bathrooms: property.baths, squareFeet: property.sqft, latitude: property.lat, longitude: property.lng }))));
      const share = await propertyService.createShareLink(String(property.id), 7, snapshot);
      const url = `${window.location.origin}/share/${share.token}`;
      const text = `Check out this property: ${title}`;
      if ((navigator as any).share) {
        await (navigator as any).share({ title, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Share link copied to clipboard');
      }
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  const captureAsCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!contentRef.current) return null;
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      return canvas;
    } catch {
      return null;
    }
  };

  const buildPdf = async (): Promise<jsPDF> => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    let y = margin;

    // Colors
    const PRIMARY = { r: 58, g: 183, b: 149 };
    const DARK = { r: 20, g: 20, b: 20 };
    const MUTED = { r: 120, g: 120, b: 120 };
    const LIGHT = { r: 245, g: 247, b: 250 };
    const BORDER = { r: 226, g: 232, b: 240 };

    // Header bar
    pdf.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    pdf.rect(0, 0, pageWidth, 16, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('AcquireFlow Property Report', margin, 11);
    pdf.setFontSize(10);
    pdf.text(`Deal Score: ${property.dealScore}/100`, pageWidth - margin - 46, 11);

    // Title (wrap long addresses) and location
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(property.address, pageWidth - margin * 2 - 2);
    pdf.text(titleLines, margin, y + 20);
    let titleBlockHeight = 6 * (Array.isArray(titleLines) ? titleLines.length : 1);
    const hasCityInTitle = property.address.toLowerCase().includes((property.city || '').toLowerCase());
    pdf.setFontSize(11);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    if (!hasCityInTitle) {
      pdf.text(`${property.city}, ${property.state}`, margin, y + 20 + titleBlockHeight);
      titleBlockHeight += 6;
    }

    // Hero image banner
    try {
      const res = await fetch(property.image, { mode: 'cors' });
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const imgH = 50;
      pdf.addImage(dataUrl, 'JPEG', margin, y + 20 + titleBlockHeight + 4, pageWidth - margin * 2, imgH, '', 'FAST');
      y += 20 + titleBlockHeight + imgH + 8;
    } catch {
      y += 20 + titleBlockHeight;
    }

    // KPI Cards (2x3)
    const cardW = (pageWidth - margin * 2 - 8) / 2;
    const cardH = 22;
    const drawCard = (x: number, yy: number, label: string, value: string) => {
      pdf.setFillColor(LIGHT.r, LIGHT.g, LIGHT.b);
      pdf.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
      pdf.rect(x, yy, cardW, cardH, 'FD');
      pdf.setFontSize(9);
      pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      pdf.text(label, x + 6, yy + 7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.setFontSize(14);
      pdf.text(value, x + 6, yy + 15);
      pdf.setFont('helvetica', 'normal');
    };
    drawCard(margin, y, 'Price', formatCurrency(purchasePrice));
    // Cash flow color based on sign
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    drawCard(margin + cardW + 8, y, 'Cash Flow (mo)', `$${computedMonthlyCashFlow}`);
    if (computedMonthlyCashFlow < 0) {
      pdf.setTextColor(200, 50, 50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(`$${computedMonthlyCashFlow}`, margin + cardW + 8 + 6, y + 15);
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.setFont('helvetica', 'normal');
    }
    y += cardH + 6;
    drawCard(margin, y, 'Cap Rate', `${derivedCapRate}%`);
    drawCard(margin + cardW + 8, y, 'Cash on Cash', `${cashOnCash}%`);
    y += cardH + 6;
    drawCard(margin, y, '1% Rule', `${onePercentStatus}%`);
    drawCard(margin + cardW + 8, y, 'YoY Appreciation', yoyAppreciation != null ? `${yoyAppreciation}%` : 'N/A');
    y += cardH + 10;

    // Section: Property + Financial Summary
    pdf.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('Property Details', margin, y);
    pdf.text('Financial Summary (Monthly)', margin + cardW + 8, y);
    y += 6;
    const detailsYStart = y;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    const kvL = (k: string, v: string, offsetY: number) => {
      pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      pdf.text(k, margin, offsetY);
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.text(v, margin + 45, offsetY);
    };
    kvL('Type', property.type, y);
    y += 6; kvL('Beds/Baths', `${property.beds} / ${property.baths}`, y);
    y += 6; kvL('Square Feet', `${property.sqft.toLocaleString()}`, y);
    y += 6; kvL('Lot Size', lotAcres ? `${lotAcres} acres` : 'N/A', y);
    y += 6; kvL('Year Built', yearBuilt ? String(yearBuilt) : 'N/A', y);

    let yR = detailsYStart;
    const rightX = margin + cardW + 8;
    const kvR = (k: string, v: string) => {
      pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
      pdf.text(k, rightX, yR);
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.text(v, rightX + 55, yR);
      yR += 6;
    };
    kvR('Income', `$${totalIncome}`);
    kvR('Expenses', `$${totalExpenses}`);
    kvR('Mortgage', `$${mortgagePayment}`);
    kvR('Taxes / Insurance', `$${propertyTaxes} / $${insurance}`);
    kvR('Mgmt / Maint / Vac', `$${management} / $${maintenance} / $${vacancy}`);
    y = Math.max(y, yR) + 10;

    // Motivation badges
    if (property.motivationFactors && property.motivationFactors.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Motivation Factors', margin, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(255, 255, 255);
      let x = margin;
      for (const m of property.motivationFactors) {
        const label = ` ${m} `;
        const w = pdf.getTextWidth(label) + 6;
        pdf.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
        pdf.rect(x, y - 5, w, 7, 'F');
        pdf.text(label, x + 3, y);
        x += w + 3;
        if (x > pageWidth - margin - 40) { x = margin; y += 8; }
      }
      y += 8;
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    }

    // Contact
    pdf.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('Contact', margin, y);
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(agent.name, margin, y);
    pdf.text(agent.company, margin + 60, y);
    y += 6;
    agent.phone && pdf.text(`Phone: ${agent.phone}`, margin, y);
    agent.email && pdf.text(`Email: ${agent.email}`, margin + 60, y);

    // Footer
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text('This report is for informational purposes only and not financial advice.', margin, pageHeight - margin);

    return pdf;
  };

  const handleDownloadPdf = async () => {
    const pdf = await buildPdf();
    const safeName = `${property.address} ${property.city} ${property.state}`.replace(/[^a-z0-9]+/gi, '-');
    pdf.save(`${safeName}.pdf`);
  };

  const handlePrint = async () => {
    try {
      const pdf = await buildPdf();
      (pdf as any).autoPrint?.();
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) return;
      const revoke = () => URL.revokeObjectURL(url);
      w.addEventListener('beforeunload', revoke);
      setTimeout(revoke, 60000);
    } catch {
      // Fallback to canvas-based print
      const canvas = await captureAsCanvas();
      if (!canvas) { window.print(); return; }
      const dataUrl = canvas.toDataURL('image/png');
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write('<html><head><title>Print Property</title><style>@page{size:auto;margin:10mm;} body{margin:0;} img{width:100%;display:block;}</style></head><body>');
      w.document.write(`<img src="${dataUrl}" onload="window.focus(); window.print(); setTimeout(()=>window.close(), 300);"/>`);
      w.document.write('</body></html>');
      w.document.close();
    }
  };

  return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={contentRef} className="bg-white rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-dark">{property.address}</h2>
          <div className="flex items-center space-x-3">
            <button className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" onClick={handleShare}>
              <Share2 size={20} />
            </button>
            <button className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>
        {/* Modal content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Property image */}
            <div className="lg:w-1/2 h-80 lg:h-auto">
              <img src={property.image} alt={property.address} className="w-full h-full object-cover" />
            </div>
            {/* Property info */}
            <div className="lg:w-1/2 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center text-gray-500 text-sm mb-2">
                    <MapPin size={16} className="mr-1" />
                    <span>
                      {property.city}, {property.state}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-primary">
                    {formatCurrency(property.price)}
                  </h3>
                </div>
                <div className="bg-primary text-white text-sm px-3 py-1.5 rounded-lg flex items-center">
                  <Star size={16} className="mr-1.5" />
                  Deal Score: {property.dealScore}/100
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Beds</p>
                  <p className="font-bold text-lg">{property.beds}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Baths</p>
                  <p className="font-bold text-lg">{property.baths}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Sqft</p>
                  <p className="font-bold text-lg">
                    {property.sqft.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <h4 className="font-medium mb-2">Motivation Factors</h4>
                <div className="flex flex-wrap gap-2">
                  {property.motivationFactors.map((factor, index) => <span key={index} className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">
                      {factor}
                    </span>)}
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-center text-gray-500 text-sm mb-2">
                  <Clock size={16} className="mr-1.5" />
                  <span>On market for {property.daysOnMarket} days</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                  <div className="text-sm text-gray-500">Cash Flow</div>
                  <div className="font-bold text-lg text-primary">
                    ${property.cashFlow}/mo
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                  <div className="text-sm text-gray-500">Cap Rate</div>
                  <div className="font-bold text-lg text-primary">
                    {property.capRate}%
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="border-t border-b border-gray-200">
            <div className="flex">
              <button className={`px-6 py-4 font-medium text-sm ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('overview')}>
                Property Overview
              </button>
              <button className={`px-6 py-4 font-medium text-sm ${activeTab === 'financials' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('financials')}>
                Financial Analysis
              </button>
              <button className={`px-6 py-4 font-medium text-sm ${activeTab === 'contact' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('contact')}>
                Contact Agent
              </button>
            </div>
          </div>
          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'overview' && <div>
                <h3 className="text-lg font-bold mb-4">Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="font-medium mb-3">Property Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Property Type</span>
                        <span className="font-medium">{property.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Year Built</span>
                        <span className="font-medium">{yearBuilt ?? 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lot Size</span>
                        <span className="font-medium">{lotAcres ? `${lotAcres} acres` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Parking</span>
                        <span className="font-medium">{parkingText}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Investment Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estimated Rehab</span>
                        <span className="font-medium">
                          {formatCurrency(property.rehabCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estimated ARV</span>
                        <span className="font-medium">{formatCurrency(estimatedArv)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Potential ROI</span>
                        <span className="font-medium">{isFinite(potentialRoi) ? `${potentialRoi}%` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Estimated Rent</span>
                        <span className="font-medium">{estimatedRent ? `$${estimatedRent}/mo` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Description</h4>
                  <p className="text-gray-600">
                    This {property.beds} bedroom, {property.baths} bathroom{' '}
                    {property.type.toLowerCase()} offers excellent investment
                    potential in the desirable {property.city} market. With{' '}
                    {property.sqft.toLocaleString()} square feet of living space
                    and multiple motivation factors including{' '}
                    {property.motivationFactors.join(' and ')}, this property
                    presents a compelling opportunity for investors looking to
                    add to their portfolio.
                  </p>
                  <p className="text-gray-600 mt-3">
                    The property features a favorable cap rate of{' '}
                    {property.capRate}% and potential cash flow of $
                    {property.cashFlow}/month. With some strategic improvements,
                    this investment could yield an estimated ROI of{' '}
                    {property.roi}%.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Neighborhood Analysis</h4>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-medium mb-2">
                          Market Trends
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Median Home Price
                            </span>
                            <span className="font-medium text-sm">
                              {marketKpis?.medianHomePrice
                                ? formatCurrency(marketKpis.medianHomePrice)
                                : derivedMedianHomePrice
                                ? formatCurrency(derivedMedianHomePrice)
                                : formatCurrency(property.price)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Price Appreciation (1yr)
                            </span>
                            <span className="font-medium text-sm">
                              {yoyAppreciation !== null && yoyAppreciation !== undefined ? `${yoyAppreciation}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Average Days on Market
                            </span>
                            <span className="font-medium text-sm">
                              {marketKpis?.daysOnMarket
                                ? `${Math.round(marketKpis.daysOnMarket)} days`
                                : derivedDom
                                ? `${derivedDom} days`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium mb-2">
                          Rental Market
                        </h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Average Rent ({property.beds}bd)
                            </span>
                            <span className="font-medium text-sm">
                              {derivedAvgRent !== null && derivedAvgRent !== undefined
                                ? `$${derivedAvgRent}/mo`
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Rent Increase (1yr)
                            </span>
                            <span className="font-medium text-sm">
                              {yoyRentIncrease !== null && yoyRentIncrease !== undefined ? `${yoyRentIncrease}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">
                              Vacancy Rate
                            </span>
                            <span className="font-medium text-sm">
                              {derivedVacancyRate !== null && derivedVacancyRate !== undefined ? `${derivedVacancyRate}%` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>}
            {activeTab === 'financials' && <div>
                <h3 className="text-lg font-bold mb-4">Financial Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Purchase Price
                    </h4>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(purchasePrice)}
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      {formatCurrency(Math.round(purchasePrice / property.sqft))}
                      /sqft
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Rehab Costs
                    </h4>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(property.rehabCost)}
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      {formatCurrency(Math.round(property.rehabCost / property.sqft))}
                      /sqft
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">
                      Total Investment
                    </h4>
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(purchasePrice + property.rehabCost)}
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      Including purchase & rehab
                    </div>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="font-medium mb-3">
                    Monthly Cash Flow Analysis
                  </h4>
                  <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                            Income
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">Rental Income</td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${rentalIncome}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">Other Income</td>
                          <td className="px-4 py-3 text-sm text-right">${otherIncome}</td>
                        </tr>
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">
                            Total Income
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            ${totalIncome}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white rounded border border-gray-200 overflow-hidden mt-4">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                            Expenses
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">
                            Mortgage Payment
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${mortgagePayment}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">Property Taxes</td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${propertyTaxes}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">Insurance</td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${insurance}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">
                            Property Management
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${management}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">Maintenance</td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${maintenance}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm">
                            Vacancy Reserves
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            ${vacancy}
                          </td>
                        </tr>
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">
                            Total Expenses
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            ${totalExpenses}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-primary bg-opacity-10 rounded border border-primary border-opacity-20 overflow-hidden mt-4">
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="px-4 py-3 text-sm font-medium text-primary">
                            Monthly Cash Flow
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                            ${computedMonthlyCashFlow}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Investment Metrics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-100">
                      <h5 className="text-sm font-medium text-gray-500 mb-2">
                        Cap Rate
                      </h5>
                      <p className="text-xl font-bold text-primary">
                        {derivedCapRate}%
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Annual return on investment
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-100">
                      <h5 className="text-sm font-medium text-gray-500 mb-2">
                        Cash on Cash
                      </h5>
                      <p className="text-xl font-bold text-primary">
                        {cashOnCash}%
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Return on cash invested
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-100">
                      <h5 className="text-sm font-medium text-gray-500 mb-2">
                        1% Rule Status
                      </h5>
                      <p className="text-xl font-bold text-primary">
                        {onePercentStatus}
                        %
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Monthly rent / purchase price
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-100">
                      <h5 className="text-sm font-medium text-gray-500 mb-2">
                        ROI
                      </h5>
                      <p className="text-xl font-bold text-primary">
                        {roi5Year}%
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        5-year return projection
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Financing Options</h4>
                  <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Loan Type</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Down Payment</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Interest Rate</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Monthly Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financingOptions.map((opt, idx) => {
                          const down = Math.round(purchasePrice * opt.downPaymentPct);
                          const principal = purchasePrice - down;
                          const monthly = calcMonthlyPayment(principal, opt.rate, opt.termMonths, opt.interestOnly);
                          return (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="px-4 py-3 text-sm">{opt.name}</td>
                              <td className="px-4 py-3 text-sm text-right">{formatCurrency(down)} ({Math.round(opt.downPaymentPct * 100)}%)</td>
                              <td className="px-4 py-3 text-sm text-right">{(opt.rate * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-sm text-right">${monthly}</td>
                        </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>}
            {activeTab === 'contact' && <div>
                <h3 className="text-lg font-bold mb-4">
                  Contact Listing Agent
                </h3>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/3">
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                      <div className="flex items-center mb-4">
                        <img src={agent.image} alt={agent.name} className="w-16 h-16 rounded-full object-cover mr-4" />
                        <div>
                          <h4 className="font-medium">{agent.name}</h4>
                          <p className="text-sm text-gray-500">
                            {agent.company}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <a href={`tel:${agent.phone}`} className="flex items-center text-sm hover:text-primary">
                          <Phone size={16} className="mr-2" />
                          {agent.phone}
                        </a>
                        <a href={`mailto:${agent.email}`} className="flex items-center text-sm hover:text-primary">
                          <Mail size={16} className="mr-2" />
                          {agent.email}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="md:w-2/3">
                    <form className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Your Name
                        </label>
                        <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Enter your name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Your Email
                        </label>
                        <input type="email" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Enter your email" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Your Phone
                        </label>
                        <input type="tel" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Enter your phone number" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Your Message
                        </label>
                        <textarea rows={4} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="I'm interested in this property and would like to schedule a viewing..." defaultValue={`I'm interested in the property at ${property.address} and would like to discuss making an offer. Please contact me at your earliest convenience.`}></textarea>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors">
                          Send Message
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>}
          </div>
        </div>
        {/* Modal footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between items-center">
          <div className="flex space-x-3">
            <button onClick={handlePrint} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg flex items-center hover:bg-gray-200 transition-colors">
              <Printer size={18} className="mr-2" />
              Print
            </button>
            <button onClick={handleDownloadPdf} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg flex items-center hover:bg-gray-200 transition-colors">
              <Download size={18} className="mr-2" />
              Download PDF
            </button>
          </div>
          <button className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors flex items-center" onClick={onClose}>
            Make Offer
            <ChevronRight size={18} className="ml-1" />
          </button>
        </div>
      </div>
    </div>;
};