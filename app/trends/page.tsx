'use client';

import { useEffect, useState } from 'react';
import { Select, Radio, Spin, Typography, Alert, Empty } from 'antd';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchEventNames, fetchEventProperties, fetchTrends, TrendPoint } from '@/lib/api';

const { Title } = Typography;

type DatePreset = '7d' | '30d' | '90d';
type Granularity = 'day' | 'week';
type Measure = 'count' | 'unique_users';
type AggFunction = 'sum' | 'avg' | 'min' | 'max';
type ChartType = 'line' | 'bar' | 'area';

const COLORS = [
  '#722ED1',
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
  '#a0d911',
  '#2f54eb',
];

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

type PivotedPoint = Record<string, string | number>;

function pivotBreakdownData(data: TrendPoint[], breakdownValues: string[]): PivotedPoint[] {
  const map = new Map<string, PivotedPoint>();
  for (const row of data) {
    const period = row.period;
    if (!map.has(period)) {
      const base: PivotedPoint = { period };
      for (const bv of breakdownValues) {
        base[bv] = 0;
      }
      map.set(period, base);
    }
    if (row.breakdown !== undefined) {
      const entry = map.get(period)!;
      const cur = entry[row.breakdown];
      entry[row.breakdown] = (typeof cur === 'number' ? cur : 0) + row.value;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a.period).localeCompare(String(b.period)),
  );
}

export default function TrendsPage() {
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DatePreset>('30d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [measure, setMeasure] = useState<Measure>('count');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [aggFunction, setAggFunction] = useState<AggFunction>('sum');
  const [aggProperty, setAggProperty] = useState<string | undefined>(undefined);
  const [breakdown, setBreakdown] = useState<string | undefined>(undefined);

  const [eventNames, setEventNames] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [breakdownValues, setBreakdownValues] = useState<string[]>([]);
  const [numericProperties, setNumericProperties] = useState<Array<{ key: string; type: 'string' | 'number' }>>([]);
  const [allProperties, setAllProperties] = useState<Array<{ key: string; type: 'string' | 'number' }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load event names on mount
  useEffect(() => {
    fetchEventNames()
      .then((names) => setEventNames(names))
      .catch(() => setEventNames([]));
  }, []);

  // Load properties when selected event changes
  useEffect(() => {
    if (!selectedEvent) {
      setNumericProperties([]);
      setAllProperties([]);
      setAggProperty(undefined);
      setBreakdown(undefined);
      return;
    }
    fetchEventProperties(selectedEvent)
      .then((props) => {
        setAllProperties(props);
        setNumericProperties(props.filter((p) => p.type === 'number'));
      })
      .catch(() => {
        setAllProperties([]);
        setNumericProperties([]);
      });
  }, [selectedEvent]);

  // Fetch trend data whenever relevant state changes
  useEffect(() => {
    if (!selectedEvent) {
      setTrendData([]);
      setBreakdownValues([]);
      return;
    }

    const { start, end } = getDateRange(dateRange);
    setLoading(true);
    setError(null);

    const params = {
      event: selectedEvent,
      start,
      end,
      granularity,
      measure,
      ...(aggProperty ? { aggregation: aggFunction, property: aggProperty } : {}),
      ...(breakdown ? { breakdown } : {}),
    };

    fetchTrends(params)
      .then((res) => {
        setTrendData(res.data);
        setBreakdownValues(res.breakdown_values ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
        setTrendData([]);
        setBreakdownValues([]);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent, dateRange, granularity, measure, aggFunction, aggProperty, breakdown]);

  const isBreakdownActive = breakdown !== undefined && breakdownValues.length > 0;
  const pivotedData = isBreakdownActive ? pivotBreakdownData(trendData, breakdownValues) : null;

  function renderChart() {
    const yLabel = measure === 'unique_users' ? 'Unique Users' : aggProperty ? `${aggFunction}(${aggProperty})` : 'Count';
    const xAxis = (
      <XAxis dataKey="period" tickFormatter={(v) => new Date(v as string).toLocaleDateString()} />
    );
    const yAxis = (
      <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} width={80} />
    );
    const grid = <CartesianGrid strokeDasharray="3 3" />;
    const tooltip = (
      <Tooltip
        labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
        formatter={(value: number) => [value.toLocaleString(), yLabel]}
      />
    );

    if (isBreakdownActive && pivotedData) {
      const series = breakdownValues.map((bv, i) => {
        const color = COLORS[i % COLORS.length];
        if (chartType === 'bar') {
          return <Bar key={bv} dataKey={bv} fill={color} name={bv} />;
        }
        if (chartType === 'area') {
          return (
            <Area
              key={bv}
              type="monotone"
              dataKey={bv}
              stroke={color}
              fill={color}
              fillOpacity={0.2}
              dot={false}
              name={bv}
            />
          );
        }
        return (
          <Line
            key={bv}
            type="monotone"
            dataKey={bv}
            stroke={color}
            dot={false}
            name={bv}
          />
        );
      });

      if (chartType === 'bar') {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pivotedData}>
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              <Legend />
              {series}
            </BarChart>
          </ResponsiveContainer>
        );
      }
      if (chartType === 'area') {
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pivotedData}>
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              <Legend />
              {series}
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={pivotedData}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Legend />
            {series}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Single series
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trendData}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar dataKey="value" fill="#722ED1" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trendData}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#722ED1"
              fill="#722ED1"
              fillOpacity={0.2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Line type="monotone" dataKey="value" stroke="#722ED1" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ marginBottom: '24px' }}>
        Trends
      </Title>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '16px',
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

        {/* Chart type toggle */}
        <Radio.Group
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          buttonStyle="solid"
        >
          <Radio.Button value="line">Line</Radio.Button>
          <Radio.Button value="bar">Bar</Radio.Button>
          <Radio.Button value="area">Area</Radio.Button>
        </Radio.Group>
      </div>

      {/* Numeric aggregation row — only shown when there are numeric properties */}
      {numericProperties.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <Select
            placeholder="Aggregate property"
            style={{ minWidth: 200 }}
            value={aggProperty}
            onChange={(val: string) => setAggProperty(val)}
            options={numericProperties.map((p) => ({ label: p.key, value: p.key }))}
            allowClear
            onClear={() => setAggProperty(undefined)}
          />
          {aggProperty && (
            <Select
              style={{ minWidth: 120 }}
              value={aggFunction}
              onChange={(val: AggFunction) => setAggFunction(val)}
              options={[
                { label: 'Sum', value: 'sum' },
                { label: 'Avg', value: 'avg' },
                { label: 'Min', value: 'min' },
                { label: 'Max', value: 'max' },
              ]}
            />
          )}
        </div>
      )}

      {/* Breakdown row — shown when there are any properties */}
      {allProperties.length > 0 && (
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
            placeholder="Breakdown by property"
            style={{ minWidth: 200 }}
            value={breakdown}
            onChange={(val: string) => setBreakdown(val)}
            options={allProperties.map((p) => ({ label: p.key, value: p.key }))}
            allowClear
            onClear={() => setBreakdown(undefined)}
          />
        </div>
      )}

      {/* Chart area */}
      {!selectedEvent && (
        <div style={{ padding: '40px 0' }}>
          <Empty description="Select an event to see trends" />
        </div>
      )}

      {selectedEvent && loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      )}

      {selectedEvent && !loading && error && (
        <Alert
          type="error"
          message="Failed to load trend data"
          description="There was a problem fetching trend data. Please try again."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {selectedEvent && !loading && !error && trendData.length === 0 && (
        <div style={{ padding: '40px 0' }}>
          <Empty description="No data found for the selected event and date range" />
        </div>
      )}

      {selectedEvent && !loading && !error && trendData.length > 0 && renderChart()}
    </div>
  );
}
