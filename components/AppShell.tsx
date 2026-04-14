'use client';

import React, { useState } from 'react';
import { Layout, Menu, Switch, Typography, Button, theme as antTheme } from 'antd';
import {
  SearchOutlined,
  LineChartOutlined,
  FunnelPlotOutlined,
  TeamOutlined,
  BulbOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { seedData } from '@/lib/api';

const { Sider, Header, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/explorer', icon: <SearchOutlined />, label: 'Explorer' },
  { key: '/trends', icon: <LineChartOutlined />, label: 'Trends' },
  { key: '/funnels', icon: <FunnelPlotOutlined />, label: 'Funnels' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { token } = antTheme.useToken();

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedData();
    } catch {
      // Non-fatal: individual pages handle their own data refresh
    } finally {
      setSeeding(false);
    }
  }

  const selectedKeys = menuItems
    .filter((item) => pathname.startsWith(item.key))
    .map((item) => item.key);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            overflow: 'hidden',
          }}
        >
          <Title
            level={5}
            style={{
              color: token.colorPrimary,
              margin: 0,
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
            }}
          >
            MiniPanel
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            width: '100%',
          }}
        >
          <Title level={5} style={{ color: token.colorPrimary, margin: 0 }}>
            MiniPanel
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              icon={<DatabaseOutlined />}
              size="small"
              loading={seeding}
              onClick={handleSeed}
            >
              Seed Sample Data
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BulbOutlined style={{ color: isDark ? '#fadb14' : '#bfbfbf' }} />
              <Switch
                checked={isDark}
                onChange={toggleTheme}
                checkedChildren="Dark"
                unCheckedChildren="Light"
              />
            </div>
          </div>
        </Header>

        <Content style={{ padding: 24, overflow: 'initial' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
