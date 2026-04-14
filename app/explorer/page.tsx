'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Select,
  Pagination,
  Spin,
  Tag,
  Button,
  Space,
  Typography,
  Empty,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchExplore, fetchEventNames, seedData, type ExploreEvent } from '@/lib/api';

const { Text } = Typography;

const PAGE_SIZE = 50;

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

function formatIdentity(event: ExploreEvent): { label: string; prefix: string } {
  if (event.resolved_user_id) {
    return { prefix: 'user', label: event.resolved_user_id };
  }
  if (event.device_id) {
    return { prefix: 'device', label: event.device_id };
  }
  return { prefix: 'unknown', label: '—' };
}

const columns: ColumnsType<ExploreEvent> = [
  {
    title: 'Timestamp',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 180,
    render: (ts: string) => <Text style={{ whiteSpace: 'nowrap' }}>{formatTimestamp(ts)}</Text>,
  },
  {
    title: 'Event Name',
    dataIndex: 'event_name',
    key: 'event_name',
    width: 200,
    render: (name: string) => <Tag color="blue">{name}</Tag>,
  },
  {
    title: 'Identity',
    key: 'identity',
    width: 220,
    render: (_: unknown, event: ExploreEvent) => {
      const { prefix, label } = formatIdentity(event);
      return (
        <Text>
          <Text type="secondary">{prefix}: </Text>
          {label}
        </Text>
      );
    },
  },
  {
    title: 'Properties',
    dataIndex: 'properties',
    key: 'properties',
    render: (props: Record<string, unknown>) => {
      const str = JSON.stringify(props);
      const truncated = str.length > 100 ? str.slice(0, 100) + '…' : str;
      return <code style={{ fontSize: 12 }}>{truncated}</code>;
    },
  },
];

export default function ExplorerPage() {
  const [events, setEvents] = useState<ExploreEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventNameFilter, setEventNameFilter] = useState<string | undefined>(undefined);
  const [eventNames, setEventNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (currentPage: number, filter?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExplore({
        event_name: filter,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventNames()
      .then(setEventNames)
      .catch(() => {
        // Non-fatal: filter just won't be populated
      });
  }, []);

  useEffect(() => {
    void loadEvents(page, eventNameFilter);
  }, [page, eventNameFilter, loadEvents]);

  function handleFilterChange(value: string | undefined) {
    setEventNameFilter(value);
    setPage(1);
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedData();
      // Refresh events and names after seeding
      const [names] = await Promise.all([
        fetchEventNames(),
        loadEvents(1, eventNameFilter),
      ]);
      setEventNames(names);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed data.');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>
        Event Explorer
      </Typography.Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="All events"
          style={{ minWidth: 220 }}
          value={eventNameFilter}
          onChange={handleFilterChange}
          options={eventNames.map((name) => ({ label: name, value: name }))}
          loading={loading}
        />
        <Button onClick={handleSeed} loading={seeding} size="small">
          Seed Data
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading}>
        <Table<ExploreEvent>
          columns={columns}
          dataSource={events}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty description="No events found" /> }}
          size="small"
          scroll={{ x: true }}
        />
      </Spin>

      {total > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            showTotal={(t) => `${t} events`}
            onChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
}
