'use client';

import { useEffect, useState } from 'react';
import { Select, Radio, Spin, Typography } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchEventNames, fetchTrends, TrendPoint } from '@/lib/api';

const { Title } = Typography;

type DatePreset = '7d' | '30d' | '90d';
type Granularity = 'day' | 'week';
type Measure = 'count' | 'unique_users';

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function TrendsPage() {
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DatePreset>('30d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [measure, setMeasure] = useState<Measure>('count');
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load event names on mount
  useEffect(() => {
    fetchEventNames()
      .then((names) => setEventNames(names))
      .catch(() => setEventNames([]));
  }, []);

  // Fetch trend data whenever relevant state changes
  useEffect(() => {
    if (!selectedEvent) {
      setTrendData([]);
      return;
    }

    const { start, end } = getDateRange(dateRange);
    setLoading(true);
    setError(null);

    fetchTrends({ event: selectedEvent, start, end, granularity, measure })
      .then((res) => {
        setTrendData(res.data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
        setTrendData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent, dateRange, granularity, measure]);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        Trends
      </Title>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <Select
          placeholder="Select event"
          style={{ minWidth: 220 }}
          value={selectedEvent}
          onChange={(val: string) => setSelectedEvent(val)}
          options={eventNames.map((name) => ({ label: name, value: name }))}
          showSearch
          allowClear
          onClear={() => setSelectedEvent(undefined)}
        />

        <Radio.Group
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DatePreset)}
          buttonStyle="solid"
        >
          <Radio.Button value="7d">7d</Radio.Button>
          <Radio.Button value="30d">30d</Radio.Button>
          <Radio.Button value="90d">90d</Radio.Button>
        </Radio.Group>

        <Radio.Group
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          buttonStyle="solid"
        >
          <Radio.Button value="day">Day</Radio.Button>
          <Radio.Button value="week">Week</Radio.Button>
        </Radio.Group>

        <Radio.Group
          value={measure}
          onChange={(e) => setMeasure(e.target.value as Measure)}
          buttonStyle="solid"
        >
          <Radio.Button value="count">Count</Radio.Button>
          <Radio.Button value="unique_users">Unique Users</Radio.Button>
        </Radio.Group>
      </div>

      {/* Chart area */}
      {!selectedEvent && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
          Select an event to see trends
        </div>
      )}

      {selectedEvent && loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      )}

      {selectedEvent && !loading && error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#ff4d4f' }}>{error}</div>
      )}

      {selectedEvent && !loading && !error && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tickFormatter={(v) => new Date(v).toLocaleDateString()}
            />
            <YAxis />
            <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
            <Line type="monotone" dataKey="value" stroke="#722ED1" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
