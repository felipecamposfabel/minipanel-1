'use client';

import { useEffect, useState } from 'react';
import { Select, Radio, Button, Progress, Typography, Spin, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { fetchEventNames, fetchFunnel, FunnelResult } from '@/lib/api';

const { Title, Text } = Typography;

type DatePreset = '7d' | '30d' | '90d';

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function FunnelsPage() {
  const [steps, setSteps] = useState<string[]>(['', '']);
  const [dateRange, setDateRange] = useState<DatePreset>('30d');
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [result, setResult] = useState<FunnelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEventNames()
      .then((names) => setEventNames(names))
      .catch(() => setEventNames([]));
  }, []);

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addStep() {
    if (steps.length < 5) {
      setSteps((prev) => [...prev, '']);
    }
  }

  function removeStep(index: number) {
    if (steps.length > 2) {
      setSteps((prev) => prev.filter((_, i) => i !== index));
    }
  }

  const canAnalyze = steps.length >= 2 && steps.every((s) => s.trim() !== '');

  function handleAnalyze() {
    if (!canAnalyze) return;
    const { start, end } = getDateRange(dateRange);
    setLoading(true);
    setError(null);
    setResult(null);
    fetchFunnel({ steps, start, end })
      .then((data) => setResult(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to analyze funnel');
      })
      .finally(() => setLoading(false));
  }

  const firstCount = result && result.steps.length > 0 ? result.steps[0].count : 1;

  return (
    <div style={{ padding: '24px', maxWidth: 800 }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        Funnel Analysis
      </Title>

      {/* Step builder */}
      <div style={{ marginBottom: '16px' }}>
        {steps.map((step, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
          >
            <Text style={{ width: 60, flexShrink: 0 }}>Step {i + 1}</Text>
            <Select
              placeholder="Select event"
              style={{ flex: 1 }}
              value={step || undefined}
              onChange={(val: string) => updateStep(i, val)}
              options={eventNames.map((name) => ({ label: name, value: name }))}
              showSearch
              allowClear
              onClear={() => updateStep(i, '')}
            />
            {steps.length > 2 && (
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={() => removeStep(i)}
                aria-label={`Remove step ${i + 1}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add step button */}
      {steps.length < 5 && (
        <Button
          icon={<PlusOutlined />}
          onClick={addStep}
          style={{ marginBottom: '16px' }}
        >
          Add Step
        </Button>
      )}

      {/* Date range */}
      <div style={{ marginBottom: '16px' }}>
        <Radio.Group
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DatePreset)}
          buttonStyle="solid"
        >
          <Radio.Button value="7d">7d</Radio.Button>
          <Radio.Button value="30d">30d</Radio.Button>
          <Radio.Button value="90d">90d</Radio.Button>
        </Radio.Group>
      </div>

      {/* Analyze button */}
      <Button
        type="primary"
        disabled={!canAnalyze}
        onClick={handleAnalyze}
        style={{ marginBottom: '32px' }}
      >
        Analyze Funnel
      </Button>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <Alert type="error" message={error} showIcon />
      )}

      {/* Empty state */}
      {!loading && !error && result === null && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
          Add 2–5 steps and click Analyze
        </div>
      )}

      {/* Results */}
      {!loading && !error && result !== null && (
        <div>
          {result.steps.map((step, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <Text strong>
                Step {i + 1}: {step.name}
              </Text>
              <Progress
                percent={Math.round((step.count / firstCount) * 100)}
                format={() => `${step.count} users`}
                strokeColor="#722ED1"
              />
              {i > 0 && (
                <Text type="secondary">
                  ↓ {((step.conversion ?? 0) * 100).toFixed(1)}% from previous step
                </Text>
              )}
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <Text strong>
              Overall conversion:{' '}
              {(result.overall_conversion * 100).toFixed(1)}%
            </Text>
          </div>
        </div>
      )}
    </div>
  );
}
