'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Card,
  Tag,
  Statistic,
  Row,
  Col,
  Timeline,
  Typography,
  Spin,
  Alert,
  Empty,
  Space,
  Button,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { fetchUser, type UserProfile } from '@/lib/api';

const { Title, Text } = Typography;

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function summariseProperties(props: Record<string, unknown>): string {
  const entries = Object.entries(props);
  if (entries.length === 0) return '{}';
  const parts = entries.slice(0, 4).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  const suffix = entries.length > 4 ? ` +${entries.length - 4} more` : '';
  return parts.join(', ') + suffix;
}

export default function UserProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawId = params['id'];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const type = searchParams.get('type') === 'device' ? 'device' : 'user';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchUser(id, type)
      .then(setProfile)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load user profile.');
      })
      .finally(() => setLoading(false));
  }, [id, type]);

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16 }}>
          Back
        </Button>
        <Alert
          type="error"
          message="Failed to load profile"
          description="There was a problem loading this user profile. Please go back and try again."
          showIcon
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16 }}>
          Back
        </Button>
        <Empty description="User not found" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.back()}
        style={{ marginBottom: 16 }}
      >
        Back to Users
      </Button>

      {/* Identity Cluster */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space align="center">
            <Title level={4} style={{ margin: 0 }}>
              {profile.id}
            </Title>
            <Tag color={profile.type === 'user' ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>
              {profile.type}
            </Tag>
          </Space>

          {profile.devices.length > 0 && (
            <div>
              <Text type="secondary" style={{ marginRight: 8 }}>
                Linked devices:
              </Text>
              {profile.devices.map((d) => (
                <Tag key={d} style={{ fontFamily: 'monospace', marginBottom: 4 }}>
                  {d}
                </Tag>
              ))}
            </div>
          )}
        </Space>
      </Card>

      {/* Stats row */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="First Seen" value={formatTimestamp(profile.first_seen)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Last Seen" value={formatTimestamp(profile.last_seen)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Events" value={profile.event_count} />
          </Card>
        </Col>
      </Row>

      {/* Event Timeline */}
      <Card title="Event Timeline">
        {profile.events.length === 0 ? (
          <Empty description="No events found" />
        ) : (
          <Timeline
            mode="left"
            items={profile.events.map((event) => ({
              key: event.id,
              label: formatTimestamp(event.timestamp),
              children: (
                <div>
                  <Tag color="blue" style={{ marginBottom: 4 }}>
                    {event.event_name}
                  </Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {summariseProperties(event.properties)}
                  </Text>
                  {event.device_id && event.device_id !== profile.id && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        device: {event.device_id}
                      </Text>
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
