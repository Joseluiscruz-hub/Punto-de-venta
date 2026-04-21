import { render, screen } from '@testing-library/react';
import InventoryView from '../views/Inventory/InventoryView';

declare var global: any;
describe('InventoryView', () => {
  it('muestra mensaje de error si falla la API', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve([]) }) as any
    );
    render(<InventoryView />);
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
    (global.fetch as jest.Mock).mockRestore();
  });
});
