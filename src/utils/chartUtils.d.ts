/**
 * TypeScript declarations for chartUtils.js
 * Supports both CommonJS (require) and ES6 (import) usage
 */

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  danger: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  gridLines: string;
}

export interface ColorSchemes {
  light: ColorScheme;
  dark: ColorScheme;
}

export interface ChartDefaults {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: any;
  scales: any;
}

export interface RechartsTheme {
  colors: string[];
  tooltip: {
    contentStyle: any;
  };
  cartesianGrid: {
    stroke: string;
  };
  xAxis: {
    tick: { fill: string };
    axisLine: { stroke: string };
  };
  yAxis: {
    tick: { fill: string };
    axisLine: { stroke: string };
  };
}

export interface AnimationPreset {
  animateRotate: boolean;
  animateScale: boolean;
  duration: number;
  easing?: string;
}

export interface AnimationPresets {
  smooth: AnimationPreset;
  fast: AnimationPreset;
  none: AnimationPreset;
}

export interface KPIData {
  items: any[];
  transactions: unknown[];
  companies: any[];
}

export interface KPIResult {
  totalItems: number;
  activeCompanies: number;
  monthlyVolume: number;
  lowStockItems: number;
  volumeChange: number;
  trends: {
    items: number;
    companies: number;
    volume: number;
    lowStock: number;
  };
}

// Korean formatting functions
export function formatKoreanNumber(value: number): string;
export function formatKoreanCurrency(value: number): string;
export function formatKoreanPercent(value: number): string;
export function formatKoreanDate(date: string | Date): string;

// Color schemes and themes
export const colorSchemes: ColorSchemes;
export function getChartDefaults(isDark?: boolean): ChartDefaults;
export function getRechartsTheme(isDark?: boolean): RechartsTheme;
export function getTransactionTypeColor(type: string, isDark?: boolean): string;
export function getStockLevelColor(current: number, minimum: number, isDark?: boolean): string;

// Data transformation utilities
export function transformStockData(items: any[]): any[];
export function transformTransactionData(transactions: unknown[]): any[];

// Chart utilities
export function exportChartAsImage(chartRef: any, filename?: string): void;
export function printChart(chartRef: any): void;

// Performance utilities
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T;

// Animation presets
export const animationPresets: AnimationPresets;

// KPI calculation
export function calculateKPIs(data: KPIData): KPIResult;

// Default export interface for default imports and CommonJS
interface ChartUtils {
  // Korean formatting functions
  formatKoreanNumber: typeof formatKoreanNumber;
  formatKoreanCurrency: typeof formatKoreanCurrency;
  formatKoreanPercent: typeof formatKoreanPercent;
  formatKoreanDate: typeof formatKoreanDate;

  // Color schemes and themes
  colorSchemes: ColorSchemes;
  getChartDefaults: typeof getChartDefaults;
  getRechartsTheme: typeof getRechartsTheme;
  getTransactionTypeColor: typeof getTransactionTypeColor;
  getStockLevelColor: typeof getStockLevelColor;

  // Data transformation utilities
  transformStockData: typeof transformStockData;
  transformTransactionData: typeof transformTransactionData;

  // Chart utilities
  exportChartAsImage: typeof exportChartAsImage;
  printChart: typeof printChart;

  // Performance utilities
  debounce: typeof debounce;
  throttle: typeof throttle;

  // Animation presets
  animationPresets: AnimationPresets;

  // KPI calculation
  calculateKPIs: typeof calculateKPIs;
}

// Default export for ES6 import chartUtils from './chartUtils'
declare const chartUtils: ChartUtils;
export default chartUtils;