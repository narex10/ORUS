export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Profile {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  timezone: string;
  currency: string;
  createdAt: string;
  _count?: { integrations: number; campaigns: number };
}

export type AdPlatform = 'META' | 'TIKTOK' | 'KWAI' | 'GOOGLE_ADS' | 'YOUTUBE';
export type IntegrationType = 'META_BMS' | 'TIKTOK' | 'KWAI' | 'GOOGLE_ADS' | 'GA4' | 'WHATSAPP' | 'CRM';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface Integration {
  id: string;
  type: IntegrationType;
  label: string;
  accountId?: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platform: AdPlatform;
  dailyBudget?: number;
  adSetsCount: number;
  spend: number;
  revenue: number;
  clicks: number;
  impressions: number;
  purchases: number;
  leads: number;
  ctr: number;
  cpm: number;
  roas: number;
  cpa: number;
}

export interface CampaignFunnel {
  clicks: number;
  pageViews: number;
  leads: number;
  realLeads: number;
  purchases: number;
  realPurchases: number;
}

export interface DashboardKPIs {
  spend: number;
  revenue: number;
  purchases: number;
  leads: number;
  roas: number;
  cpa: number;
}

export interface DashboardChart {
  date: string;
  spend: number;
  revenue: number;
  leads: number;
  purchases: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  chart: DashboardChart[];
  period: { from: string; to: string };
}

export interface Audience {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  filters: Record<string, unknown>;
  userCount: number;
  lastBuiltAt?: string;
  createdAt: string;
  _count?: { members: number };
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  targetLevel: 'CAMPAIGN' | 'ADSET' | 'AD';
  platform: AdPlatform;
  checkInterval: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastCheckedAt?: string;
  createdAt: string;
}

export interface RuleCondition {
  id: string;
  type: string;
  operator: 'AND' | 'OR';
  value: number;
  window: number;
}

export interface RuleAction {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface TrackingKey {
  id: string;
  key: string;
  label?: string;
  isActive: boolean;
  createdAt: string;
}

export type Period = '7d' | '14d' | '30d' | 'custom';
