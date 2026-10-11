import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SpeedChart from '../../speed/src/SpeedChart';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const history = [{ t: 1, bps: 125000 }, { t: 10, bps: 500000 }, { t: 40, bps: 1000000 }];
describe('speed chart inspection', () => {
  it('shows the nearest sampled speed and time when the pointer moves', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    render(<SpeedChart history={history}/>);
    const chart = screen.getByRole('img', { name: '实时下载带宽曲线' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 680 } as DOMRect);
    fireEvent.pointerMove(chart, { clientX: 270, pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('任务 10.00 秒');
    expect(screen.getByRole('tooltip')).toHaveTextContent('4.00 Mbps');
    expect(screen.getByRole('tooltip')).toHaveTextContent('500.00 KB/s');
    vi.unstubAllGlobals();
  });
  it('supports point inspection by keyboard and hides it on Escape', () => {
    render(<SpeedChart history={history}/>);
    const chart = screen.getByRole('img', { name: '实时下载带宽曲线' });
    fireEvent.focus(chart); expect(screen.getByRole('tooltip')).toHaveTextContent('8.00 Mbps');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' }); expect(screen.getByRole('tooltip')).toHaveTextContent('4.00 Mbps');
    fireEvent.keyDown(chart, { key: 'Home' }); expect(screen.getByRole('tooltip')).toHaveTextContent('1.00 Mbps');
    fireEvent.pointerLeave(chart, { pointerType: 'mouse' }); expect(screen.getByRole('tooltip')).toHaveTextContent('1.00 Mbps');
    fireEvent.keyDown(chart, { key: 'Escape' }); expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('preserves the tapped point when focus arrives and the touch ends', () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerType: string; constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerType = init.pointerType || 'mouse'; } });
    render(<SpeedChart history={history}/>);
    const chart = screen.getByRole('img', { name: '实时下载带宽曲线' });
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 680 } as DOMRect);
    fireEvent.pointerDown(chart, { clientX: 270, pointerType: 'touch' }); fireEvent.focus(chart);
    expect(screen.getByRole('tooltip')).toHaveTextContent('任务 10.00 秒');
    fireEvent.pointerLeave(chart, { pointerType: 'touch' }); expect(screen.getByRole('tooltip')).toHaveTextContent('4.00 Mbps');
    fireEvent.blur(chart); expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
