import { render, screen } from '@testing-library/react';
import DashboardView from '../views/Dashboard/DashboardView';

declare var global: any;
describe('DashboardView', () => {
  it('muestra mensaje de error si falla la API', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve([]) }) as any
    );
    render(<DashboardView />);
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
    (global.fetch as jest.Mock).mockRestore();
  });
});
