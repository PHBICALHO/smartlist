# SmartList — Preço Condor Curitiba

Site simples que pesquisa um produto no [condor.com.br](https://www.condor.com.br)
e mostra em qual loja Condor de Curitiba ele está mais barato, usando o
recurso de "ver preço loja a loja" do próprio site.

## Aviso importante

Este código foi escrito **sem conseguir acessar o condor.com.br** (o ambiente
onde ele foi gerado tem a rede bloqueada). Os seletores usados no scraper
(`src/config.js` e `src/scraper.js`) são tentativas genéricas — é bem
possível que algo precise de ajuste na primeira execução. O scraper tem um
modo de debug feito exatamente para isso (veja abaixo).

## Instalação

```bash
npm install
npx playwright install chromium
```

## Rodando

```bash
npm start
```

Abra http://localhost:3000, digite um produto (ex: "arroz 5kg") e clique em
Buscar.

## Se der erro / não achar nada

Rode em modo debug (navegador visível + salva screenshots e HTML de cada
etapa em `debug/`):

```bash
HEADLESS=0 DEBUG=1 npm start
```

Depois faça uma busca pelo site. Quando der erro, a mensagem vai dizer em
qual etapa parou (busca, abrir produto, abrir comparação de lojas, etc.).
Abra os arquivos em `debug/` (prints e HTML) e me envie — ou você mesmo pode
ajustar os seletores em `src/config.js`:

- `SEARCH_INPUT_SELECTORS`: como encontrar o campo de busca da home.
- `PRODUCT_LINK_SELECTORS`: como encontrar o link de um produto no resultado
  de busca.
- `STORE_PRICE_BUTTON_PATTERNS`: o texto do botão "ver preço loja a loja".
- `CURITIBA_KEYWORDS` / `KNOWN_CURITIBA_STORES`: como identificar se uma
  loja retornada é de Curitiba (o Condor tem lojas em outras cidades do
  Paraná também). Se os nomes das lojas não vierem com "Curitiba" no texto,
  preencha `KNOWN_CURITIBA_STORES` com os nomes/bairros das lojas de
  Curitiba (ex: "Batel", "Cabral", "Água Verde"...).

## Estrutura

```
server.js          -> servidor Express + endpoint /api/buscar
src/scraper.js      -> scraping com Playwright (Chromium headless)
src/config.js        -> seletores e configurações ajustáveis
public/              -> frontend (HTML/CSS/JS puro)
```

## Uso responsável

O scraper abre uma busca por vez, sem paralelismo nem loop automático —
é pensado para uso pessoal (comparar preço antes de ir ao mercado), não
para varrer o catálogo inteiro do Condor. Evite rodar buscas em massa/muito
frequentes.
