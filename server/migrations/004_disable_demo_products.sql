UPDATE products
SET active = false,
    updated_at = now()
WHERE barcode IN ('75010001', '75010002', '75010003')
  AND name IN (
    'Leche Entera Alpura 1L',
    'Leche entera 1L',
    'Pan Bimbo Blanco',
    'Pan blanco 680g',
    'Coca-Cola 600ml',
    'Refresco cola 600ml'
  );
