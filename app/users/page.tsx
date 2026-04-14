'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Input,
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
import { fetchUsers, type User } from '@/lib/api';

const { Title } = Typography;

const PAGE_SIZE = 50;

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUsers({
        search: currentSearch || undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers(page, search);
  }, [page, search, loadUsers]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleView(user: User) {
    router.push(`/users/${encodeURIComponent(user.id)}?type=${user.type}`);
  }

  const columns: ColumnsType<User> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {id}
        </Typography.Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: 'user' | 'device') => (
        <Tag color={type === 'user' ? 'blue' : 'orange'}>{type}</Tag>
      ),
    },
    {
      title: 'First Seen',
      dataIndex: 'first_seen',
      key: 'first_seen',
      width: 180,
      render: (ts: string) => formatTimestamp(ts),
    },
    {
      title: 'Last Seen',
      dataIndex: 'last_seen',
      key: 'last_seen',
      width: 180,
      render: (ts: string) => formatTimestamp(ts),
    },
    {
      title: 'Events',
      dataIndex: 'event_count',
      key: 'event_count',
      width: 90,
      align: 'right',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_: unknown, user: User) => (
        <Button size="small" onClick={() => handleView(user)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        Users
      </Title>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search by user ID"
          allowClear
          onSearch={handleSearch}
          style={{ width: 300 }}
          loading={loading}
        />
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
        <Table<User>
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: <Empty description="No users found" /> }}
          size="small"
          scroll={{ x: true }}
          onRow={(user) => ({
            style: { cursor: 'pointer' },
            onClick: () => handleView(user),
          })}
        />
      </Spin>

      {total > 0 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            showTotal={(t) => `${t} users`}
            onChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
}
