/**
 * Telemetry Tracking for AI Operations
 * 
 * Tracks critical metrics to detect issues early:
 * - Plan Validity %
 * - Apply Success %
 * - Undo Rate
 * - Dry-run errors
 * - Hallucination references
 * 
 * Alerts when thresholds breached.
 */

import { getFeatureFlags } from "./feature-flags";

export interface TelemetryEvent {
  eventType: 'plan-created' | 'plan-validated' | 'apply-success' | 'apply-failure' | 'undo-performed' | 'dry-run-error';
  timestamp: string;
  userId?: string;
  workbookId: string;
  planId?: string;
  metadata: Record<string, any>;
}

export interface TelemetryMetrics {
  // Plan metrics
  totalPlansCreated: number;
  validPlans: number;
  invalidPlans: number;
  planValidityPercent: number;
  
  // Apply metrics
  totalApplies: number;
  successfulApplies: number;
  failedApplies: number;
  applySuccessPercent: number;
  
  // Undo metrics
  totalUndos: number;
  undoRate: number; // undos / successful applies
  
  // Error tracking
  dryRunErrors: number;
  hallucinationErrors: number; // References to nonexistent named ranges, sheets
  
  // Performance
  avgPlanSizeOps: number;
  avgDryRunTimeMs: number;
  avgApplyTimeMs: number;
}

class TelemetryService {
  private events: TelemetryEvent[] = [];
  private metrics: TelemetryMetrics = this.initMetrics();
  
  private initMetrics(): TelemetryMetrics {
    return {
      totalPlansCreated: 0,
      validPlans: 0,
      invalidPlans: 0,
      planValidityPercent: 0,
      totalApplies: 0,
      successfulApplies: 0,
      failedApplies: 0,
      applySuccessPercent: 0,
      totalUndos: 0,
      undoRate: 0,
      dryRunErrors: 0,
      hallucinationErrors: 0,
      avgPlanSizeOps: 0,
      avgDryRunTimeMs: 0,
      avgApplyTimeMs: 0,
    };
  }
  
  /**
   * Track an event
   */
  track(event: TelemetryEvent): void {
    const flags = getFeatureFlags();
    
    if (!flags.telemetry.enabled) {
      return;
    }
    
    this.events.push(event);
    this.updateMetrics(event);
    this.checkAlertThresholds();
    
    // Send to analytics backend (implement based on your infra)
    this.sendToBackend(event);
  }
  
  /**
   * Update metrics based on event
   */
  private updateMetrics(event: TelemetryEvent): void {
    switch (event.eventType) {
      case 'plan-created':
        this.metrics.totalPlansCreated++;
        if (event.metadata.opsCount) {
          const total = this.metrics.avgPlanSizeOps * (this.metrics.totalPlansCreated - 1);
          this.metrics.avgPlanSizeOps = (total + event.metadata.opsCount) / this.metrics.totalPlansCreated;
        }
        break;
      
      case 'plan-validated':
        if (event.metadata.valid) {
          this.metrics.validPlans++;
        } else {
          this.metrics.invalidPlans++;
        }
        this.metrics.planValidityPercent = this.metrics.validPlans / this.metrics.totalPlansCreated;
        break;
      
      case 'apply-success':
        this.metrics.totalApplies++;
        this.metrics.successfulApplies++;
        this.metrics.applySuccessPercent = this.metrics.successfulApplies / this.metrics.totalApplies;
        
        if (event.metadata.durationMs) {
          const total = this.metrics.avgApplyTimeMs * (this.metrics.totalApplies - 1);
          this.metrics.avgApplyTimeMs = (total + event.metadata.durationMs) / this.metrics.totalApplies;
        }
        break;
      
      case 'apply-failure':
        this.metrics.totalApplies++;
        this.metrics.failedApplies++;
        this.metrics.applySuccessPercent = this.metrics.successfulApplies / this.metrics.totalApplies;
        
        if (event.metadata.errorType === 'hallucination') {
          this.metrics.hallucinationErrors++;
        }
        break;
      
      case 'undo-performed':
        this.metrics.totalUndos++;
        this.metrics.undoRate = this.metrics.totalUndos / Math.max(1, this.metrics.successfulApplies);
        break;
      
      case 'dry-run-error':
        this.metrics.dryRunErrors++;
        
        if (event.metadata.durationMs) {
          const count = this.metrics.dryRunErrors;
          const total = this.metrics.avgDryRunTimeMs * (count - 1);
          this.metrics.avgDryRunTimeMs = (total + event.metadata.durationMs) / count;
        }
        break;
    }
  }
  
  /**
   * Check alert thresholds and notify
   */
  private checkAlertThresholds(): void {
    const flags = getFeatureFlags();
    const alerts: string[] = [];
    
    // Check apply success rate
    if (
      flags.telemetry.trackApplySuccess &&
      this.metrics.totalApplies >= 10 && // Require minimum sample size
      this.metrics.applySuccessPercent < flags.telemetry.alertThresholds.minApplySuccess
    ) {
      alerts.push(
        `🚨 ALERT: Apply success rate (${(this.metrics.applySuccessPercent * 100).toFixed(1)}%) ` +
        `below threshold (${flags.telemetry.alertThresholds.minApplySuccess * 100}%)`
      );
    }
    
    // Check undo rate
    if (
      flags.telemetry.trackUndoRate &&
      this.metrics.successfulApplies >= 10 &&
      this.metrics.undoRate > flags.telemetry.alertThresholds.maxUndoRate
    ) {
      alerts.push(
        `🚨 ALERT: Undo rate (${(this.metrics.undoRate * 100).toFixed(1)}%) ` +
        `above threshold (${flags.telemetry.alertThresholds.maxUndoRate * 100}%)`
      );
    }
    
    // Check hallucination rate
    if (this.metrics.failedApplies > 0) {
      const hallucinationRate = this.metrics.hallucinationErrors / this.metrics.failedApplies;
      if (hallucinationRate > 0.3) { // 30%+ of failures due to hallucinations
        alerts.push(
          `🚨 ALERT: High hallucination rate (${(hallucinationRate * 100).toFixed(1)}%). ` +
          `AI referencing nonexistent ranges/sheets.`
        );
      }
    }
    
    // Send alerts
    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }
  
  /**
   * Send event to analytics backend
   */
  private sendToBackend(event: TelemetryEvent): void {
    // Implement based on your analytics stack (e.g., Segment, Mixpanel, custom)
    if (import.meta.env.DEV) {
      console.log('[Telemetry]', event);
    }
    
    // Example: POST to analytics endpoint
    // fetch('/api/telemetry', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // }).catch(err => console.error('Telemetry send failed:', err));
  }
  
  /**
   * Send alerts to monitoring system
   */
  private sendAlerts(alerts: string[]): void {
    console.error('[Telemetry Alerts]', alerts);
    
    // Send to alerting system (PagerDuty, Slack, email, etc.)
    // Example:
    // fetch('/api/alerts', {
    //   method: 'POST',
    //   body: JSON.stringify({ alerts }),
    // });
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): TelemetryMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get recent events (last N)
   */
  getRecentEvents(limit: number = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }
  
  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.events = [];
    this.metrics = this.initMetrics();
  }
}

// Singleton instance
export const telemetry = new TelemetryService();

/**
 * Convenience tracking functions
 */

export function trackPlanCreated(workbookId: string, planId: string, opsCount: number, userId?: string): void {
  telemetry.track({
    eventType: 'plan-created',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    planId,
    metadata: { opsCount },
  });
}

export function trackPlanValidated(workbookId: string, planId: string, valid: boolean, errors?: string[], userId?: string): void {
  telemetry.track({
    eventType: 'plan-validated',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    planId,
    metadata: { valid, errors },
  });
}

export function trackApplySuccess(workbookId: string, planId: string, durationMs: number, userId?: string): void {
  telemetry.track({
    eventType: 'apply-success',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    planId,
    metadata: { durationMs },
  });
}

export function trackApplyFailure(workbookId: string, planId: string, error: string, errorType: string, userId?: string): void {
  telemetry.track({
    eventType: 'apply-failure',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    planId,
    metadata: { error, errorType },
  });
}

export function trackUndo(workbookId: string, actionId: string, userId?: string): void {
  telemetry.track({
    eventType: 'undo-performed',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    metadata: { actionId },
  });
}

export function trackDryRunError(workbookId: string, planId: string, error: string, durationMs: number, userId?: string): void {
  telemetry.track({
    eventType: 'dry-run-error',
    timestamp: new Date().toISOString(),
    userId,
    workbookId,
    planId,
    metadata: { error, durationMs },
  });
}
