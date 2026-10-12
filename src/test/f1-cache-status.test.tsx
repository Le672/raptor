import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataStatus } from '../components/f1/F1Common';

describe('F1 cached record status', () => {
  it('labels cached schedules and keeps their source timestamp visible', () => {
    render(<DataStatus loading={false} error="" reload={() => {}} data={{ source: 'Jolpica F1', fetchedAt: '2026-10-11T10:00:00Z', stale: true, errors: ['Jolpica 请求频率受限'] }} />);
    expect(screen.getByText(/Jolpica F1 · 缓存记录 · 更新于/)).toHaveTextContent('10月11日 18:00');
    expect(screen.getByText(/部分数据未能更新/)).toHaveTextContent('频率受限');
  });
});
