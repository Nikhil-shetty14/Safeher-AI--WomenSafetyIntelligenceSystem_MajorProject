import React, { useState, useEffect } from 'react';
import { adminAPI } from './api';
import './StateCommandCenter.css';
import {
  Activity,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  MapPin,
  CheckCircle,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function StateCommandCenter() {
  const getInitial = (key: string, def: any) => {
    try {
      const cached = localStorage.getItem(`page_cache_scc_${key}`);
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return def;
  };

  const [performance, setPerformance] = useState<any>(getInitial('perf', null));
  const [rankings, setRankings] = useState<any[]>(getInitial('rank', []));
  const [escalations, setEscalations] = useState<any>(getInitial('esc', { sos_escalations: [], complaint_escalations: [], total_escalations: 0 }));

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [perfRes, rankRes, escRes] = await Promise.all([
        adminAPI.getStatePerformance(),
        adminAPI.getStateRankings(),
        adminAPI.getStateEscalations()
      ]);
      const perf = perfRes.data;
      const rank = rankRes.data;
      const esc = escRes.data;
      
      setPerformance(perf);
      setRankings(rank);
      setEscalations(esc);

      try {
        localStorage.setItem('page_cache_scc_perf', JSON.stringify(perf));
        localStorage.setItem('page_cache_scc_rank', JSON.stringify(rank));
        localStorage.setItem('page_cache_scc_esc', JSON.stringify(esc));
      } catch(e) {}
    } catch (error) {
      console.error("Error fetching state dashboard data:", error);
    }
  };



  return (
    <div className="state-command-center">
      <div className="scc-header">
        <h1 className="scc-title">
          <Activity size={32} className="scc-title-icon" />
          State Command Center
        </h1>
        <p className="scc-subtitle">Real-time statewide performance monitoring and SLA enforcement</p>
      </div>

      <div className="scc-metrics-grid">
        <div className="scc-metric-card">
          <div className="scc-metric-header">
            <span className="scc-metric-title">Overall SLA Compliance</span>
            <div className="scc-metric-icon icon-emerald">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="scc-metric-value">{performance?.overall_sla_compliance_pct || 0}%</div>
          <div className="scc-metric-trend">
            {performance?.overall_sla_compliance_pct >= 90 ? (
              <span className="trend-up"><TrendingUp size={14} /> Healthy</span>
            ) : (
              <span className="trend-down"><TrendingDown size={14} /> Needs Attention</span>
            )}
          </div>
        </div>

        <div className="scc-metric-card">
          <div className="scc-metric-header">
            <span className="scc-metric-title">SOS Avg Response</span>
            <div className="scc-metric-icon icon-purple">
              <Clock size={20} />
            </div>
          </div>
          <div className="scc-metric-value">{performance?.sos?.avg_response_time_mins || 0}m</div>
          <div className="scc-metric-trend">
            <span>SLA: &lt; 15 mins</span>
          </div>
        </div>

        <div className="scc-metric-card">
          <div className="scc-metric-header">
            <span className="scc-metric-title">Complaint Avg Resolve</span>
            <div className="scc-metric-icon icon-blue">
              <FileText size={20} />
            </div>
          </div>
          <div className="scc-metric-value">{performance?.complaints?.avg_response_time_hours || 0}h</div>
          <div className="scc-metric-trend">
            <span>SLA: &lt; 48 hours</span>
          </div>
        </div>

        <div className="scc-metric-card" style={{ borderColor: (escalations?.total_escalations || 0) > 0 ? 'rgba(239, 68, 68, 0.5)' : '' }}>
          <div className="scc-metric-header">
            <span className="scc-metric-title">Active Escalations</span>
            <div className="scc-metric-icon icon-red">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="scc-metric-value" style={{ color: (escalations?.total_escalations || 0) > 0 ? '#ef4444' : '#fff' }}>
            {escalations?.total_escalations || 0}
          </div>
          <div className="scc-metric-trend">
            <span className={(escalations?.total_escalations || 0) > 0 ? 'trend-down' : 'trend-up'}>Breached SLA limits</span>
          </div>
        </div>
      </div>

      <div className="scc-dashboard-content">
        <div className="scc-section">
          <div className="scc-section-header">
            <h2 className="scc-section-title">
              <ShieldAlert size={20} /> Regional Performance Rankings
            </h2>
          </div>
          <div className="scc-rankings-table-container">
            <table className="scc-rankings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Administrator</th>
                  <th>Region</th>
                  <th>Resolved SOS</th>
                  <th>Resolved Complaints</th>
                  <th>Pending Load</th>
                  <th>Performance Score</th>
                </tr>
              </thead>
              <tbody>
                {(rankings || []).map((admin, index) => (
                  <tr key={admin.admin_id || index}>
                    <td>
                      <div className={`scc-rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                        {index + 1}
                      </div>
                    </td>
                    <td>
                      <div className="scc-admin-name">{admin.name}</div>
                      <div className="scc-admin-role">{admin.role.replace('_', ' ').toUpperCase()}</div>
                    </td>
                    <td>{admin.region || 'N/A'}</td>
                    <td>{admin.resolved_sos}</td>
                    <td>{admin.resolved_complaints}</td>
                    <td>{admin.pending_load}</td>
                    <td>
                      <div className="scc-score-pill">{admin.score} pts</div>
                    </td>
                  </tr>
                ))}
                {rankings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No admin performance data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="scc-section">
          <div className="scc-section-header">
            <h2 className="scc-section-title" style={{ color: '#ef4444' }}>
              <AlertTriangle size={20} /> Live Escalations
            </h2>
          </div>
          
          <div className="scc-escalations-feed">
            {(escalations?.total_escalations || 0) === 0 ? (
              <div className="scc-empty-state">
                <div className="scc-empty-icon">
                  <CheckCircle size={32} />
                </div>
                <h3>All Clear</h3>
                <p>No SLA breaches detected. All regions are operating within acceptable parameters.</p>
              </div>
            ) : (
              <>
                {(escalations?.sos_escalations || []).map((sos: any) => (
                  <div key={sos.id} className="scc-escalation-card">
                    <div className="scc-escalation-header">
                      <div className="scc-escalation-type">
                        <AlertTriangle size={16} /> SOS SLA BREACH
                      </div>
                      <div className="scc-escalation-time">
                        <Clock size={12} /> {formatDistanceToNow(new Date(sos.created_at))} ago
                      </div>
                    </div>
                    <div className="scc-escalation-content">
                      Critical SOS alert unhandled for over 15 minutes. Immediate state-level intervention required.
                    </div>
                    <div className="scc-escalation-footer">
                      <div className="scc-escalation-location">
                        <MapPin size={14} /> {sos.location_details?.district || 'Unknown District'}
                      </div>
                      <button className="scc-escalation-action">Take Over</button>
                    </div>
                  </div>
                ))}
                
                {(escalations?.complaint_escalations || []).map((comp: any) => (
                  <div key={comp.id} className="scc-escalation-card" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                    <div className="scc-escalation-header">
                      <div className="scc-escalation-type" style={{ color: '#f59e0b' }}>
                        <FileText size={16} /> COMPLAINT SLA BREACH
                      </div>
                      <div className="scc-escalation-time">
                        <Clock size={12} /> {formatDistanceToNow(new Date(comp.created_at))} ago
                      </div>
                    </div>
                    <div className="scc-escalation-content">
                      Complaint pending for over 48 hours without resolution. Needs review.
                    </div>
                    <div className="scc-escalation-footer">
                      <div className="scc-escalation-location">
                        <MapPin size={14} /> {comp.district || 'Unknown District'}
                      </div>
                      <button className="scc-escalation-action" style={{ background: '#f59e0b' }}>Review</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
