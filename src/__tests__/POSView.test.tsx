import { render, screen } from '@testing-library/react';
import POSView from '../views/POS/POSView';

declare var global: any;
describe('POSView', () => {
  it('muestra mensaje de error si falla la API', async () => {
    // Simular error en BackendAPI
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve([]) }) as any
    );
    render(<POSView />);
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
    (global.fetch as jest.Mock).mockRestore();
  });
});
