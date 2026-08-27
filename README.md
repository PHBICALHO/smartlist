# SmartList — Preço Condor Curitiba

Site simples que pesquisa um produto no [condor.com.br](https://www.condor.com.br)
e mostra em qual loja Condor de Curitiba ele está mais barato.

O Condor não tem um botão de "comparar preço entre lojas" num produto — em
vez disso, o site inteiro reflete o preço da loja selecionada no momento
(botão "Loja de..." na home). Por isso o scraper troca a loja selecionada
uma a uma (só as de Curitiba) e refaz a busca do produto em cada uma, para
depois comparar os preços. Uma busca completa passa por ~10 lojas e leva
cerca de 1 a 2 minutos.

## Instalação

```bash
npm install
npx playwright install chromium
```

## Rodando

```bash
npm start
```

Abra http://localhost:3000 e a busca acontece em duas etapas:

1. Digite um termo (ex: "arroz") e clique em Pesquisar — isso é rápido
   (~5s) e mostra os produtos reais do catálogo do Condor que batem com o
   termo, com nome, imagem e preço, pra você escolher o produto exato.
2. Clique no produto desejado — aí sim o site troca de loja em loja
   (~10 lojas de Curitiba) e refaz a busca por esse produto específico em
   cada uma, o que leva 1 a 2 minutos.

Separar em duas etapas existe porque produtos têm nomes bem específicos no
catálogo do Condor (marca, peso, variação); pesquisar direto por um termo
genérico e comparar "no escuro" arriscava comparar produtos diferentes entre
lojas.

## Se der erro / não achar nada

Rode em modo debug (navegador visível + salva screenshots e HTML de cada
etapa em `debug/`):

```bash
HEADLESS=0 DEBUG=1 npm start
```

Depois faça uma busca pelo site. Quando der erro, a mensagem vai dizer em
qual etapa parou. Abra os arquivos em `debug/` (prints e HTML) e ajuste os
seletores em `src/config.js`:

- `SEARCH_INPUT_SELECTORS`: campo de busca do header.
- `PRODUCT_CARD_SELECTOR`: card de produto na página de resultado de busca.
- `STORE_BUTTON_SELECTOR` / `STORE_ITEM_SELECTOR` /
  `STORE_CONFIRM_BUTTON_SELECTOR`: o modal "Selecione uma loja" (só
  disponível na home) usado para trocar de loja.
- `CURITIBA_KEYWORDS` / `KNOWN_CURITIBA_STORES`: como identificar se uma
  loja retornada é de Curitiba (o Condor tem lojas em outras cidades do
  Paraná e até Santa Catarina). O endereço retornado já inclui a cidade, então
  o filtro padrão (`"curitiba"`) costuma bastar.

Na etapa de comparação, o scraper busca pelo nome exato do produto
escolhido em cada loja; se uma loja não tiver esse produto exato, ele cai
para o primeiro resultado da busca naquela loja como aproximação (marcado
como "produto aproximado" na tela).

## Estrutura

```
server.js       -> servidor Express + endpoints /api/pesquisar e /api/comparar
src/scraper.js  -> scraping com Playwright (Chromium headless)
src/config.js   -> seletores e configurações ajustáveis
public/         -> frontend (HTML/CSS/JS puro)
```

## Uso responsável

O scraper roda uma busca por vez, sem paralelismo nem loop automático — é
pensado para uso pessoal (comparar preço antes de ir ao mercado), não para
varrer o catálogo inteiro do Condor. Evite rodar buscas em massa/muito
frequentes.
