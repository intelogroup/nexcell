import React from 'react';
import type { AIPlan, PlanChange } from '../../lib/ai/planTypes';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  plan: AIPlan;
  onApprove: () => void;
  onReject: () => void;
  onClose?: () => void;
}

export const PlanPreview: React.FC<Props> = ({ plan, onApprove, onReject, onClose }) => {
  const { operations, reasoning, warnings } = plan;

  const groupedBySheet = React.useMemo(() => {
    const map: Record<string, PlanChange[]> = {};
    for (const op of operations) {
      const sheetKey = (op as any).sheetId || 'workbook';
      map[sheetKey] = map[sheetKey] || [];
      map[sheetKey].push({
        opType: op.type,
        address: (op as any).address,
        before: (op as any).before,
        after: (op as any).after,
        raw: (op as any).raw,
        formula: (op as any).formula,
      });
    }
    return map;
  }, [operations]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Planned Changes</h3>
          <div>
            <Button onClick={onReject} variant="secondary" style={{ marginRight: 8 }}>Reject</Button>
            <Button onClick={onApprove} variant="primary">Approve & Apply</Button>
          </div>
        </div>
        {warnings && warnings.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, background: '#fff4e5', borderRadius: 6 }}>
            <strong>Warnings</strong>
            <ul>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {Object.keys(groupedBySheet).map((sheet) => (
            <div key={sheet} style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '8px 0' }}>{sheet}</h4>
              <div>
                {(groupedBySheet[sheet] || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: 8, borderBottom: '1px solid #eee' }}>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.opType}</div>
                      <div style={{ fontWeight: 600 }}>{c.address || '—'}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>Before</div>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{String(c.before ?? '')}</pre>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>After</div>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{String(c.after ?? c.raw ?? c.formula ?? '')}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {reasoning && (
          <div style={{ marginTop: 12 }}>
            <strong>Reasoning</strong>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{reasoning}</div>
          </div>
        )}

        {onClose && (
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button onClick={onClose} variant="ghost">Close</Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PlanPreview;
