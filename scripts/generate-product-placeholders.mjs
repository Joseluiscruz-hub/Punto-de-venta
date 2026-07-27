import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outputDir = join(root, 'public', 'productos', 'genericos');
const catalogPath = join(root, 'public', 'productos', 'catalogo-generico.csv');

const products = [
  ['arroz-blanco-1kg', 'Arroz blanco 1kg', 'Abarrotes', 'bag'],
  ['frijol-negro-1kg', 'Frijol negro 1kg', 'Abarrotes', 'bag'],
  ['frijol-pinto-1kg', 'Frijol pinto 1kg', 'Abarrotes', 'bag'],
  ['azucar-1kg', 'Azucar 1kg', 'Abarrotes', 'bag'],
  ['sal-fina-1kg', 'Sal fina 1kg', 'Abarrotes', 'bag'],
  ['harina-trigo-1kg', 'Harina de trigo 1kg', 'Abarrotes', 'bag'],
  ['harina-maiz-1kg', 'Harina de maiz 1kg', 'Abarrotes', 'bag'],
  ['pasta-codito-200g', 'Pasta codito 200g', 'Abarrotes', 'bag'],
  ['spaghetti-200g', 'Spaghetti 200g', 'Abarrotes', 'bag'],
  ['sopa-fideo-200g', 'Sopa fideo 200g', 'Abarrotes', 'bag'],
  ['avena-400g', 'Avena 400g', 'Abarrotes', 'box'],
  ['lenteja-500g', 'Lenteja 500g', 'Abarrotes', 'bag'],
  ['garbanzo-500g', 'Garbanzo 500g', 'Abarrotes', 'bag'],
  ['aceite-vegetal-1l', 'Aceite vegetal 1L', 'Abarrotes', 'bottle'],
  ['vinagre-blanco-1l', 'Vinagre blanco 1L', 'Abarrotes', 'bottle'],
  ['cafe-soluble-100g', 'Cafe soluble 100g', 'Abarrotes', 'jar'],
  ['chocolate-polvo-400g', 'Chocolate en polvo 400g', 'Abarrotes', 'jar'],
  ['cereal-maiz-500g', 'Cereal de maiz 500g', 'Abarrotes', 'box'],
  ['galletas-vainilla-150g', 'Galletas vainilla 150g', 'Abarrotes', 'pack'],
  ['galletas-saladas-150g', 'Galletas saladas 150g', 'Abarrotes', 'pack'],
  ['tortillas-maiz-1kg', 'Tortillas de maiz 1kg', 'Panaderia', 'pack'],
  ['tortillas-harina-20pz', 'Tortillas de harina 20pz', 'Panaderia', 'pack'],
  ['pan-blanco-680g', 'Pan blanco 680g', 'Panaderia', 'bag'],
  ['pan-integral-680g', 'Pan integral 680g', 'Panaderia', 'bag'],
  ['bolillo-6pz', 'Bolillo 6pz', 'Panaderia', 'pack'],
  ['pan-dulce-4pz', 'Pan dulce 4pz', 'Panaderia', 'pack'],
  ['tostadas-maiz-200g', 'Tostadas de maiz 200g', 'Panaderia', 'pack'],
  ['leche-entera-1l', 'Leche entera 1L', 'Lacteos', 'carton'],
  ['leche-deslactosada-1l', 'Leche deslactosada 1L', 'Lacteos', 'carton'],
  ['yogurt-natural-1l', 'Yogurt natural 1L', 'Lacteos', 'bottle'],
  ['queso-fresco-400g', 'Queso fresco 400g', 'Lacteos', 'pack'],
  ['crema-450ml', 'Crema 450ml', 'Lacteos', 'jar'],
  ['mantequilla-90g', 'Mantequilla 90g', 'Lacteos', 'pack'],
  ['huevo-12pz', 'Huevo 12pz', 'Abarrotes', 'carton'],
  ['jamon-250g', 'Jamon 250g', 'Refrigerados', 'pack'],
  ['salchicha-500g', 'Salchicha 500g', 'Refrigerados', 'pack'],
  ['pollo-empaquetado-1kg', 'Pollo empaquetado 1kg', 'Refrigerados', 'pack'],
  ['carne-molida-500g', 'Carne molida 500g', 'Refrigerados', 'pack'],
  ['atun-en-agua-140g', 'Atun en agua 140g', 'Enlatados', 'can'],
  ['sardina-tomate-155g', 'Sardina tomate 155g', 'Enlatados', 'can'],
  ['mayonesa-390g', 'Mayonesa 390g', 'Condimentos', 'jar'],
  ['catsup-370g', 'Catsup 370g', 'Condimentos', 'bottle'],
  ['mostaza-250g', 'Mostaza 250g', 'Condimentos', 'bottle'],
  ['salsa-picante-150ml', 'Salsa picante 150ml', 'Condimentos', 'bottle'],
  ['chile-en-lata-220g', 'Chile en lata 220g', 'Enlatados', 'can'],
  ['elote-en-lata-220g', 'Elote en lata 220g', 'Enlatados', 'can'],
  ['verduras-mixtas-220g', 'Verduras mixtas 220g', 'Enlatados', 'can'],
  ['pure-tomate-210g', 'Pure de tomate 210g', 'Enlatados', 'box'],
  ['caldo-polvo-100g', 'Caldo en polvo 100g', 'Condimentos', 'box'],
  ['agua-natural-1l', 'Agua natural 1L', 'Bebidas', 'bottle'],
  ['agua-mineral-600ml', 'Agua mineral 600ml', 'Bebidas', 'bottle'],
  ['refresco-cola-600ml', 'Refresco cola 600ml', 'Bebidas', 'bottle'],
  ['bebida-naranja-600ml', 'Bebida naranja 600ml', 'Bebidas', 'bottle'],
  ['bebida-limon-600ml', 'Bebida limon 600ml', 'Bebidas', 'bottle'],
  ['jugo-manzana-1l', 'Jugo manzana 1L', 'Bebidas', 'carton'],
  ['nectar-mango-1l', 'Nectar mango 1L', 'Bebidas', 'carton'],
  ['te-frio-600ml', 'Te frio 600ml', 'Bebidas', 'bottle'],
  ['bebida-energetica-355ml', 'Bebida energetica 355ml', 'Bebidas', 'can'],
  ['suero-oral-625ml', 'Suero oral 625ml', 'Bebidas', 'bottle'],
  ['papas-sal-45g', 'Papas sal 45g', 'Botanas', 'bag'],
  ['papas-limon-45g', 'Papas limon 45g', 'Botanas', 'bag'],
  ['chicharron-60g', 'Chicharron 60g', 'Botanas', 'bag'],
  ['cacahuates-salados-100g', 'Cacahuates salados 100g', 'Botanas', 'bag'],
  ['palomitas-maiz-90g', 'Palomitas maiz 90g', 'Botanas', 'bag'],
  ['dulce-gomita-100g', 'Dulce gomita 100g', 'Dulces', 'bag'],
  ['chocolate-barra-45g', 'Chocolate barra 45g', 'Dulces', 'pack'],
  ['caramelo-100g', 'Caramelo 100g', 'Dulces', 'bag'],
  ['paleta-20g', 'Paleta 20g', 'Dulces', 'pack'],
  ['galleta-chocolate-120g', 'Galleta chocolate 120g', 'Dulces', 'pack'],
  ['detergente-polvo-1kg', 'Detergente polvo 1kg', 'Limpieza', 'box'],
  ['jabon-lavanderia-400g', 'Jabon lavanderia 400g', 'Limpieza', 'pack'],
  ['cloro-1l', 'Cloro 1L', 'Limpieza', 'bottle'],
  ['limpiador-piso-1l', 'Limpiador piso 1L', 'Limpieza', 'bottle'],
  ['suavizante-850ml', 'Suavizante 850ml', 'Limpieza', 'bottle'],
  ['fibra-esponja-2pz', 'Fibra esponja 2pz', 'Limpieza', 'pack'],
  ['servilletas-250pz', 'Servilletas 250pz', 'Hogar', 'pack'],
  ['papel-higienico-4pz', 'Papel higienico 4pz', 'Hogar', 'roll'],
  ['toalla-cocina-2pz', 'Toalla cocina 2pz', 'Hogar', 'roll'],
  ['bolsa-basura-10pz', 'Bolsa basura 10pz', 'Hogar', 'pack'],
  ['shampoo-750ml', 'Shampoo 750ml', 'Higiene', 'bottle'],
  ['jabon-corporal-120g', 'Jabon corporal 120g', 'Higiene', 'pack'],
  ['pasta-dental-100ml', 'Pasta dental 100ml', 'Higiene', 'box'],
  ['cepillo-dental-1pz', 'Cepillo dental 1pz', 'Higiene', 'pack'],
  ['desodorante-90g', 'Desodorante 90g', 'Higiene', 'bottle'],
  ['panales-20pz', 'Panales 20pz', 'Bebe', 'pack'],
  ['toallitas-humedas-80pz', 'Toallitas humedas 80pz', 'Bebe', 'pack'],
  ['alimento-perro-2kg', 'Alimento perro 2kg', 'Mascotas', 'bag'],
  ['alimento-gato-1kg', 'Alimento gato 1kg', 'Mascotas', 'bag'],
  ['arena-gato-3kg', 'Arena gato 3kg', 'Mascotas', 'bag'],
  ['manzana-1kg', 'Manzana 1kg', 'Frutas y verduras', 'produce'],
  ['platano-1kg', 'Platano 1kg', 'Frutas y verduras', 'produce'],
  ['tomate-1kg', 'Tomate 1kg', 'Frutas y verduras', 'produce'],
  ['cebolla-1kg', 'Cebolla 1kg', 'Frutas y verduras', 'produce'],
  ['papa-1kg', 'Papa 1kg', 'Frutas y verduras', 'produce'],
  ['zanahoria-1kg', 'Zanahoria 1kg', 'Frutas y verduras', 'produce'],
  ['limon-1kg', 'Limon 1kg', 'Frutas y verduras', 'produce'],
  ['aguacate-1kg', 'Aguacate 1kg', 'Frutas y verduras', 'produce'],
  ['helado-vainilla-1l', 'Helado vainilla 1L', 'Congelados', 'carton'],
  ['verdura-congelada-500g', 'Verdura congelada 500g', 'Congelados', 'bag'],
  ['hielo-5kg', 'Hielo 5kg', 'Congelados', 'bag'],
];

const palettes = [
  ['#0f766e', '#99f6e4', '#f8fafc'],
  ['#2563eb', '#bfdbfe', '#f8fafc'],
  ['#c2410c', '#fed7aa', '#fff7ed'],
  ['#7c3aed', '#ddd6fe', '#faf5ff'],
  ['#15803d', '#bbf7d0', '#f0fdf4'],
  ['#b45309', '#fde68a', '#fffbeb'],
  ['#be123c', '#fecdd3', '#fff1f2'],
  ['#334155', '#cbd5e1', '#f8fafc'],
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function labelLines(name) {
  const words = name.replace(/\d+[a-zA-Z]+|\d+pz/gi, '').trim().split(/\s+/).slice(0, 3);
  return words.length ? words : ['Producto'];
}

function shape(kind, primary, soft) {
  const commonShadow = `<ellipse cx="360" cy="560" rx="170" ry="28" fill="#0f172a" opacity=".12"/>`;
  const variants = {
    bag: `${commonShadow}<path d="M235 155h250l35 365c3 34-22 62-56 62H256c-34 0-59-28-56-62l35-365Z" fill="${soft}" stroke="${primary}" stroke-width="10"/><path d="M250 165c30 28 67 42 110 42s80-14 110-42" fill="none" stroke="${primary}" stroke-width="10" stroke-linecap="round"/>`,
    box: `${commonShadow}<rect x="218" y="145" width="284" height="410" rx="28" fill="${soft}" stroke="${primary}" stroke-width="10"/><path d="M218 245h284" stroke="${primary}" stroke-width="10" opacity=".45"/>`,
    bottle: `${commonShadow}<path d="M318 112h84v82c0 22 16 36 34 55 26 27 43 58 43 103v137c0 45-36 82-82 82h-74c-46 0-82-37-82-82V352c0-45 17-76 43-103 18-19 34-33 34-55v-82Z" fill="${soft}" stroke="${primary}" stroke-width="10"/><rect x="315" y="104" width="90" height="42" rx="12" fill="${primary}"/><rect x="278" y="330" width="164" height="118" rx="22" fill="#fff" opacity=".78"/>`,
    carton: `${commonShadow}<path d="M235 205 360 125l125 80v350H235V205Z" fill="${soft}" stroke="${primary}" stroke-width="10" stroke-linejoin="round"/><path d="M235 205h250M360 125v430" stroke="${primary}" stroke-width="10" opacity=".35"/>`,
    jar: `${commonShadow}<rect x="252" y="190" width="216" height="362" rx="54" fill="${soft}" stroke="${primary}" stroke-width="10"/><rect x="282" y="128" width="156" height="72" rx="18" fill="${primary}"/><rect x="292" y="330" width="136" height="105" rx="22" fill="#fff" opacity=".78"/>`,
    can: `${commonShadow}<path d="M260 165c0-34 200-34 200 0v350c0 34-200 34-200 0V165Z" fill="${soft}" stroke="${primary}" stroke-width="10"/><ellipse cx="360" cy="165" rx="100" ry="32" fill="#fff" opacity=".55" stroke="${primary}" stroke-width="8"/><rect x="292" y="312" width="136" height="112" rx="24" fill="#fff" opacity=".76"/>`,
    pack: `${commonShadow}<rect x="205" y="220" width="310" height="260" rx="44" fill="${soft}" stroke="${primary}" stroke-width="10"/><path d="M245 265h230M245 435h230" stroke="${primary}" stroke-width="10" opacity=".36" stroke-linecap="round"/>`,
    roll: `${commonShadow}<ellipse cx="360" cy="190" rx="122" ry="52" fill="${soft}" stroke="${primary}" stroke-width="10"/><path d="M238 190v270c0 29 55 52 122 52s122-23 122-52V190" fill="${soft}" stroke="${primary}" stroke-width="10"/><ellipse cx="360" cy="190" rx="50" ry="21" fill="#fff" opacity=".78"/>`,
    produce: `${commonShadow}<circle cx="335" cy="362" r="120" fill="${soft}" stroke="${primary}" stroke-width="10"/><circle cx="415" cy="388" r="96" fill="${soft}" stroke="${primary}" stroke-width="10" opacity=".9"/><path d="M365 210c26-39 70-55 118-47-12 44-45 73-94 82" fill="#86efac" stroke="#15803d" stroke-width="8"/>`,
  };
  return variants[kind] ?? variants.box;
}

function svgFor(product, index) {
  const [, name, category, kind] = product;
  const [primary, soft, background] = palettes[index % palettes.length];
  const lines = labelLines(name);
  const text = lines
    .map(
      (line, lineIndex) =>
        `<text x="360" y="${625 + lineIndex * 32}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${line.length > 12 ? 23 : 27}" font-weight="800" fill="#17212b">${escapeXml(line.toUpperCase())}</text>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <rect width="720" height="720" rx="48" fill="${background}"/>
  <circle cx="112" cy="116" r="62" fill="${soft}" opacity=".62"/>
  <circle cx="618" cy="176" r="84" fill="${soft}" opacity=".48"/>
  ${shape(kind, primary, soft)}
  <rect x="160" y="600" width="400" height="92" rx="28" fill="#ffffff" opacity=".82"/>
  ${text}
  <text x="360" y="82" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${primary}">${escapeXml(category.toUpperCase())}</text>
  <title>${escapeXml(name)}</title>
</svg>`;
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

await mkdir(outputDir, { recursive: true });

await Promise.all(
  products.map(async (product, index) => {
    const [slug] = product;
    await sharp(Buffer.from(svgFor(product, index)))
      .resize({ width: 720, height: 720 })
      .webp({ quality: 88, effort: 5 })
      .toFile(join(outputDir, `${String(index + 1).padStart(3, '0')}-${slug}.webp`));
  }),
);

const rows = [
  ['codigo', 'producto', 'categoria', 'imagen', 'Costo proveedor', 'Venta publico', 'Items', 'stock minimo'],
  ...products.map(([slug, name, category], index) => [
    '',
    name,
    category,
    `/productos/genericos/${String(index + 1).padStart(3, '0')}-${slug}.webp`,
    '',
    '',
    '',
    '5',
  ]),
];

await mkdir(join(root, 'public', 'productos'), { recursive: true });
await writeFile(catalogPath, rows.map((row) => row.map(csvEscape).join(',')).join('\n'));

console.log(`Generated ${products.length} product images in ${outputDir}`);
console.log(`Catalog template: ${catalogPath}`);
