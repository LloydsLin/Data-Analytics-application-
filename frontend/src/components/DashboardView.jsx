import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  AlertTriangle, 
  Percent, 
  RefreshCw,
  Sparkles
} from 'lucide-react';
import DataChart from './DataChart';

export default function DashboardView({ onLoadSample, tableCount }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboard = async () => {
    if (tableCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.error("Failed loading dashboard", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [tableCount]);

  if (tableCount === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '50%',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <Sparkles size={32} color="var(--accent-indigo)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', marginBottom: '8px' }}>
          No Active Datasets Loaded
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '24px', fontSize: '13.5px' }}>
          Upload your CSV datasets or load the bundled sample sales, customers, and products data to instantly view the automated executive dashboard.
        </p>
        <button className="btn btn-primary" onClick={onLoadSample}>
          <Sparkles size={16} />
          Load Sample Dataset
        </button>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const regional = dashboardData?.regional_breakdown || [];
  const monthly = dashboardData?.monthly_trend || [];
  const customers = dashboardData?.top_customers || [];
  const categories = dashboardData?.category_distribution || [];

  // Regional chart spec
  const regionalChart = {
    type: 'bar',
    title: 'Revenue & Profit Contribution by Region',
    traces: [
      {
        name: 'Revenue (£)',
        x: regional.map(r => r.Region),
        y: regional.map(r => r.Revenue),
        type: 'bar',
        marker: { color: '#6366f1' }
      },
      {
        name: 'Profit (£)',
        x: regional.map(r => r.Region),
        y: regional.map(r => r.Profit),
        type: 'bar',
        marker: { color: '#10b981' }
      }
    ]
  };

  // Monthly trend chart spec
  const monthlyChart = {
    type: 'line',
    title: 'Monthly Revenue Progression & Trajectory',
    traces: [
      {
        name: 'Monthly Revenue (£)',
        x: monthly.map(m => m.Month),
        y: monthly.map(m => m.Revenue),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#6366f1', width: 3 },
        marker: { size: 6, color: '#818cf8' },
        fill: 'tozeroy',
        fillcolor: 'rgba(99, 102, 241, 0.08)'
      }
    ]
  };

  // Top customers chart spec
  const customerChart = {
    type: 'bar',
    title: 'Top 5 Enterprise Accounts by Revenue',
    traces: [
      {
        name: 'Total Revenue (£)',
        x: customers.map(c => c.Customer),
        y: customers.map(c => c.Revenue),
        type: 'bar',
        marker: { color: '#8b5cf6' }
      }
    ]
  };

  // Categories chart spec
  const categoryChart = {
    type: 'pie',
    title: 'Revenue Share by Product Category',
    traces: [
      {
        type: 'pie',
        labels: categories.map(c => c.Category),
        values: categories.map(c => c.Revenue),
        hole: 0.4,
        marker: {
          colors: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899']
        }
      }
    ]
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 }}>
            Executive Performance Dashboard
          </h1>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time analytics and KPI summary synthesized autonomously across DuckDB tables.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchDashboard} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {/* Total Revenue */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</span>
            <DollarSign size={16} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>
            £{(kpis.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-emerald)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} /> Top-line volume
          </div>
        </div>

        {/* Total Profit */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Net Profit</span>
            <TrendingUp size={16} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px', color: '#10b981' }}>
            £{(kpis.total_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Margin: <strong>{kpis.profit_margin_pct ?? 0}%</strong>
          </div>
        </div>

        {/* Total Orders */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Total Orders</span>
            <ShoppingCart size={16} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>
            {(kpis.total_orders || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Completed transactions
          </div>
        </div>

        {/* Average Order Value */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Avg Order Value</span>
            <Percent size={16} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px', color: '#f8fafc' }}>
            £{(kpis.avg_order_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Per order average
          </div>
        </div>

        {/* Anomalies Flagged */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase' }}>Anomalies Flagged</span>
            <AlertTriangle size={16} color="var(--accent-rose)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px', color: '#fb7185' }}>
            {kpis.anomaly_count || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-rose)', marginTop: '4px' }}>
            IQR outliers detected
          </div>
        </div>
      </div>

      {/* 2x2 Curated Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        <DataChart chartSpec={regionalChart} />
        <DataChart chartSpec={monthlyChart} />
        <DataChart chartSpec={customerChart} />
        <DataChart chartSpec={categoryChart} />
      </div>
    </div>
  );
}
