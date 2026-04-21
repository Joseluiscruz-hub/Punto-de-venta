import { render, screen } from '@testing-library/react';
import SalesView from '../views/Sales/SalesView';

declare var global: any;
describe('SalesView', () => {
  it('muestra mensaje de error si falla la API', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve([]) }) as any
    );
    render(<SalesView />);
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
    (global.fetch as jest.Mock).mockRestore();
  });
});
