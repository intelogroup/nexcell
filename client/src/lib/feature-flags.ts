/**
 * Feature Flags Configuration
 * 
 * Controls rollout of AI Plan→Act and other experimental features.
 * 
 * ⚠️ CRITICAL: Do NOT enable aiPlanAct in production until:
 * 1. All Priority-1 tests pass in CI
 * 2. Manual QA complete (dates, formats, layout)
 * 3. Telemetry and monitoring deployed
 * 4. Backup/undo infrastructure tested
 */

export interface FeatureFlags {
  // AI Plan→Act Feature (STAGED ROLLOUT)
  aiPlanAct: {
    enabled: boolean;
    stage: 'internal' | 'beta' | 'gradual' | 'public';
    allowedUsers?: string[];  // User IDs for stage='internal' or 'beta'
    rolloutPercent?: number;  // 0-100 for stage='gradual'
    requireDryRunApproval: boolean; // Always show diff before apply
    maxOpsWithoutConfirmation: number; // Require typed confirmation above this
  };
  
  // Export/Import Safety
  exportWarnings: {
    enabled: boolean;
    blockExportOnUnsupported: boolean; // Block or warn for charts/pivots
    requireConfirmation: boolean; // Require user ack before export
  };
  
  // Telemetry
  telemetry: {
    enabled: boolean;
    trackPlanValidity: boolean;
    trackApplySuccess: boolean;
    trackUndoRate: boolean;
    alertThresholds: {
      minApplySuccess: number; // Alert if below (e.g., 0.90 = 90%)
      maxUndoRate: number; // Alert if above (e.g., 0.05 = 5%)
    };
  };
  
  // Backup & Versioning
  backupBeforeApply: {
    enabled: boolean;
    keepVersions: number; // How many versions to keep
    compactOlderThan: number; // Days before compacting old versions
  };
  
  // Experimental Features
  experimental: {
    namedRangesSupport: boolean;
    conditionalFormattingSupport: boolean;
    chartsAndPivotsSupport: boolean;
    excelJSAdapter: boolean; // Full style support
  };
}

/**
 * Default configuration for each environment
 */
export const DEFAULT_FLAGS: Record<string, FeatureFlags> = {
  development: {
    aiPlanAct: {
      enabled: true,
      stage: 'internal',
      requireDryRunApproval: true,
      maxOpsWithoutConfirmation: 50,
    },
    exportWarnings: {
      enabled: true,
      blockExportOnUnsupported: false,
      requireConfirmation: false,
    },
    telemetry: {
      enabled: true,
      trackPlanValidity: true,
      trackApplySuccess: true,
      trackUndoRate: true,
      alertThresholds: {
        minApplySuccess: 0.90,
        maxUndoRate: 0.05,
      },
    },
    backupBeforeApply: {
      enabled: true,
      keepVersions: 10,
      compactOlderThan: 7,
    },
    experimental: {
      namedRangesSupport: true,
      conditionalFormattingSupport: false,
      chartsAndPivotsSupport: false,
      excelJSAdapter: false,
    },
  },
  
  staging: {
    aiPlanAct: {
      enabled: true,
      stage: 'beta',
      allowedUsers: [], // Add specific user IDs
      requireDryRunApproval: true,
      maxOpsWithoutConfirmation: 100,
    },
    exportWarnings: {
      enabled: true,
      blockExportOnUnsupported: false,
      requireConfirmation: true,
    },
    telemetry: {
      enabled: true,
      trackPlanValidity: true,
      trackApplySuccess: true,
      trackUndoRate: true,
      alertThresholds: {
        minApplySuccess: 0.90,
        maxUndoRate: 0.05,
      },
    },
    backupBeforeApply: {
      enabled: true,
      keepVersions: 20,
      compactOlderThan: 14,
    },
    experimental: {
      namedRangesSupport: true,
      conditionalFormattingSupport: false,
      chartsAndPivotsSupport: false,
      excelJSAdapter: false,
    },
  },
  
  production: {
    aiPlanAct: {
      enabled: false, // ⚠️ GATE: Enable after QA and staged rollout
      stage: 'internal',
      requireDryRunApproval: true,
      maxOpsWithoutConfirmation: 200,
    },
    exportWarnings: {
      enabled: true,
      blockExportOnUnsupported: false,
      requireConfirmation: true,
    },
    telemetry: {
      enabled: true,
      trackPlanValidity: true,
      trackApplySuccess: true,
      trackUndoRate: true,
      alertThresholds: {
        minApplySuccess: 0.90,
        maxUndoRate: 0.05,
      },
    },
    backupBeforeApply: {
      enabled: true,
      keepVersions: 50,
      compactOlderThan: 30,
    },
    experimental: {
      namedRangesSupport: false,
      conditionalFormattingSupport: false,
      chartsAndPivotsSupport: false,
      excelJSAdapter: false,
    },
  },
};

/**
 * Load feature flags for current environment
 */
export function getFeatureFlags(): FeatureFlags {
  const env = import.meta.env.MODE || 'development';
  
  // Allow override via environment variables
  const overrides: Partial<FeatureFlags> = {};
  
  if (import.meta.env.VITE_AI_PLAN_ACT_ENABLED !== undefined) {
    overrides.aiPlanAct = {
      ...DEFAULT_FLAGS[env].aiPlanAct,
      enabled: import.meta.env.VITE_AI_PLAN_ACT_ENABLED === 'true',
    };
  }
  
  if (import.meta.env.VITE_AI_PLAN_ACT_STAGE) {
    overrides.aiPlanAct = {
      ...DEFAULT_FLAGS[env].aiPlanAct,
      ...overrides.aiPlanAct,
      stage: import.meta.env.VITE_AI_PLAN_ACT_STAGE as any,
    };
  }
  
  return {
    ...DEFAULT_FLAGS[env],
    ...overrides,
  };
}

/**
 * Check if AI Plan→Act is enabled for a specific user
 */
export function isAIPlanActEnabled(userId?: string): boolean {
  const flags = getFeatureFlags();
  
  if (!flags.aiPlanAct.enabled) {
    return false;
  }
  
  // Stage-based gating
  switch (flags.aiPlanAct.stage) {
    case 'internal':
      // Only specific users (e.g., engineering team)
      return userId ? (flags.aiPlanAct.allowedUsers?.includes(userId) ?? false) : false;
    
    case 'beta':
      // Expanded set of beta users
      return userId ? (flags.aiPlanAct.allowedUsers?.includes(userId) ?? false) : false;
    
    case 'gradual':
      // Percentage-based rollout (hash userId)
      if (!userId) return false;
      const hash = simpleHash(userId);
      const percent = flags.aiPlanAct.rolloutPercent ?? 0;
      return (hash % 100) < percent;
    
    case 'public':
      // Available to all
      return true;
    
    default:
      return false;
  }
}

/**
 * Simple hash function for gradual rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Export for testing
 */
export const __test__ = {
  simpleHash,
};
