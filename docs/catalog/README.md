# Base de produtos (dados publicos)

## Tabelas
- `product_catalog` (ean PK): alimentos/bebidas/higiene vendidos no Brasil. `source` = `openfoodfacts` ou `qerbie` (itens internos, que crescem com o uso).
- `pharmacy_cmed`: medicamentos da lista CMED/Anvisa (PF e PMC). Unica por (ean, registro).
- RLS: leitura para `authenticated`; escrita so com service role.

## Fontes e licencas
- **Open Food Facts** (https://world.openfoodfacts.org/data), dump `en.openfoodfacts.org.products.csv.gz`. Filtro: `countries_tags` contem `en:brazil`, EAN numerico (8/12/13/14 digitos) e nome preenchido. Licenca **ODbL 1.0**: atribuicao obrigatoria ("Open Food Facts contributors") e compartilhamento igual da base derivada. Fotos tem licenca CC BY-SA propria; guardamos so a URL. Cada linha grava `attribution`.
- **CMED/Anvisa**: `lista_pmc_20260923_222937320.xlsx` (gerada em 23/09/2026, precos validos a partir de 24/09/2026), aba "Lista PMC". Dado publico governamental. PMC = preco maximo ao consumidor; guardados PMC sem impostos e PMC 18% (ICMS 18%), alem de PF sem impostos. Outras aliquotas ficam fora; o PMC varia por ICMS do estado.

## Contagens (carga inicial)
- product_catalog / openfoodfacts: 32.417 (20.963 com foto)
- pharmacy_cmed: 26.408 linhas

## Como aplicar
1. Rodar `supabase/migrations/20261002000000_product_catalog.sql` (SQL editor do Supabase ou `supabase db push`).
2. `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalog/import-catalog.mjs all` (idempotente; `off` ou `cmed` para so uma fonte). Nunca commitar a service role key.

## Formato dos dados
`data/catalog/off_br/part-*.b64` e `data/catalog/cmed/part-*.b64`: CSV gzip em base64, dividido em partes de 300 KB (o script junta, decodifica e descomprime).

## Como atualizar
- OFF: baixar o CSV novo, refiltrar (Brasil), substituir as partes em `data/catalog/off_br/` (csv.gz em base64: `base64 -w0 off_br.csv.gz | split -b 300000 -d -a 2 - part-` e renomear para `part-NN.b64`), rodar o import.
- CMED: baixar a nova lista PMC em https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos, regerar `cmed.csv.gz` (colunas: ean, registro, substancia, produto, apresentacao, laboratorio, cnpj, classe_terapeutica, tipo_produto, regime_preco, tarja, pf_sem_impostos, pmc_sem_impostos, pmc_18), atualizar `CMED_DATE` no script e rodar o import.

## Limites
Cobertura publica boa so em alimentos e medicamentos. Material de construcao e outros segmentos entram como itens internos (`source='qerbie'`).
