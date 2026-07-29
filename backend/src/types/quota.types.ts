/**
 * Token Quota Type Definitions
 * Platform-agnostic types for token quota management
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface QuotaInfo {
  dailyLimit: number;
  used: number;
  remaining: number;
  resetAt: string; // ISO 8601 timestamp
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaInfo?: QuotaInfo;
}

export interface UsageReport {
  userId: string;
  tokensUsed: number;
  model: string;
  timestamp: string;
}

export interface UsageReportResponse {
  success: boolean;
  remainingTokens: number;
  dailyLimit: number;
}
