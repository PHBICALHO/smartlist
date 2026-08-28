const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('./config');

const PRICE_RE = /R\$\s*([\d.,]+)/;

class ScraperError extends Error {}

async function dumpDebug(page, debugDir, nome) {
  try {
    await fs.promises.mkdir(debugDir, { recursive: true });
    const stamp = Date.now();
    await page.screenshot({ path: path.join(debugDir, `${stamp}-${nome}.png`), fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => null);
    if (html) {
      await fs.promises.writeFile(path.join(debugDir, `${stamp}-${nome}.html`), html, 'utf8');
    }
  } catch (err) {
    console.warn('Falha ao salvar debug:', err.message);
  }
}

async function fecharPopups(page) {
  for (const pattern of config.DISMISS_BUTTON_PATTERNS) {
    const botao = page.getByText(pattern).first();
    if ((await botao.count()) && (await botao.isVisible().catch(() => false))) {
      await botao.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

async function preencherBusca(page, produto) {
  for (const seletor of config.SEARCH_INPUT_SELECTORS) {
    const input = page.locator(seletor).first();
    if (await input.count()) {
      await input.click({ timeout: 5000 }).catch(() => {});
      await input.fill(produto);
      await input.press('Enter');
      return;
    }
  }

  const searchbox = page.getByRole('searchbox').first();
  if (await searchbox.count()) {
    await searchbox.fill(produto);
    await searchbox.press('Enter');
    return;
  }

  throw new ScraperError(
    'Não encontrei o campo de busca do Condor. Rode com DEBUG=1 e me envie o HTML salvo em debug/ para eu ajustar os seletores.'
  );
}

async function esperarProdutosCarregarem(page) {
  // A busca do Condor carrega os produtos via requisição assíncrona e
  // mostra skeletons enquanto isso. Espera eles sumirem antes de ler a
  // página de verdade.
  await page
    .locator(config.LOADING_PLACEHOLDER_SELECTOR)
    .first()
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}

function normalizarPreco(texto) {
  const match = texto.match(PRICE_RE);
  if (!match) return null;
  const numero = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(numero) ? null : numero;
}

// Lista os produtos da página de resultado de busca atual. O nome vem do
// atributo alt da imagem do produto (mais confiável do que tentar separar
// preço/unidade/nome do texto visível do card).
async function listarProdutosDaBusca(page, limite = 30) {
  const cards = page.locator(config.PRODUCT_CARD_SELECTOR);
  const total = Math.min(await cards.count(), limite);

  const produtos = [];
  for (let i = 0; i < total; i++) {
    const card = cards.nth(i);

    const nome = ((await card.locator('img').first().getAttribute('alt').catch(() => null)) || '').trim();
    if (!nome) continue;

    const texto = (await card.innerText().catch(() => '')).trim();
    const preco = normalizarPreco(texto);
    if (preco === null) continue;

    const imagem = await card.locator('img').first().getAttribute('src').catch(() => null);

    produtos.push({ nome, preco, imagem });
  }

  return produtos;
}

async function obterProdutoDaBusca(page, nomeAlvo) {
  const produtos = await listarProdutosDaBusca(page);
  if (produtos.length === 0) return null;

  if (nomeAlvo) {
    const match = produtos.find((p) => p.nome.toLowerCase() === nomeAlvo.toLowerCase());
    if (match) return { ...match, aproximado: false };
  }

  return { ...produtos[0], aproximado: Boolean(nomeAlvo) };
}

async function abrirSeletorDeLojas(page) {
  await page.locator(config.STORE_BUTTON_SELECTOR).first().click();
  await page.waitForTimeout(800);
}

async function listarLojas(page) {
  await abrirSeletorDeLojas(page);

  const itens = page.locator(config.STORE_ITEM_SELECTOR);
  const total = await itens.count();

  const lojas = [];
  for (let i = 0; i < total; i++) {
    const el = itens.nth(i);
    const id = await el.getAttribute('data-store-id');
    const texto = (await el.innerText().catch(() => '')).trim();
    const linhas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const nome = linhas[0] || '';
    const endereco = linhas[1] || '';

    if (id && nome) {
      lojas.push({ id, nome, endereco });
    }
  }

  await page.getByLabel(/fechar/i).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);

  if (lojas.length === 0) {
    throw new ScraperError(
      'Não encontrei nenhuma loja no seletor de lojas do Condor. Rode com DEBUG=1 e me envie o HTML para eu ajustar os seletores.'
    );
  }

  return lojas;
}

async function selecionarLoja(page, storeId) {
  // O botão de trocar de loja só existe na home — a página de resultado de
  // busca tem outro header sem ele. Por isso volta pra home antes de abrir
  // o seletor.
  if (!page.url().replace(/\/+$/, '').endsWith('condor.com.br')) {
    await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
    await fecharPopups(page);
  }

  await abrirSeletorDeLojas(page);

  await page.locator(`[data-store-id="${storeId}"]`).first().click();
  await page.waitForTimeout(300);
  await page.locator(config.STORE_CONFIRM_BUTTON_SELECTOR).first().click();

  // Não usa waitForLoadState('networkidle') aqui: o site mantém conexões
  // de fundo (chat, analytics) que impedem a rede de ficar "idle" de
  // verdade, então isso quase sempre estourava o timeout de 30s por loja.
  // Em vez disso, espera o modal fechar (sinal de que a troca foi aplicada).
  await page
    .locator(config.STORE_CONFIRM_BUTTON_SELECTOR)
    .first()
    .waitFor({ state: 'detached', timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  await fecharPopups(page);
}

function ehLojaDeCuritiba(nome, endereco) {
  const texto = `${nome} ${endereco}`.toLowerCase();
  if (config.CURITIBA_KEYWORDS.some((k) => texto.includes(k.toLowerCase()))) return true;
  if (config.KNOWN_CURITIBA_STORES.some((k) => texto.includes(k.toLowerCase()))) return true;
  return false;
}

async function abrirNavegador(headless) {
  const browser = await chromium.launch({ headless });
  const { context, page } = await abrirAba(browser);
  return { browser, page, context };
}

// Cria uma aba (context + page) nova a partir de um browser já aberto.
// Cada loja usa a sua própria aba na comparação em paralelo, porque a loja
// selecionada fica guardada em cookie/localStorage por context — usar a
// mesma aba pra duas lojas ao mesmo tempo misturaria os resultados.
async function abrirAba(browser) {
  const context = await browser.newContext({
    userAgent: config.USER_AGENT,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.TIMEOUT_MS);
  return { context, page };
}

// Roda `worker` para cada item de `itens`, no máximo `concorrencia` de cada
// vez. Erros de um item não derrubam os outros — ficam de fora do array
// final (com um aviso no console).
async function processarComConcorrencia(itens, concorrencia, worker) {
  const fila = [...itens];
  const resultados = [];

  async function trabalhador() {
    while (fila.length > 0) {
      const item = fila.shift();
      if (!item) continue;
      try {
        const resultado = await worker(item);
        if (resultado) resultados.push(resultado);
      } catch (err) {
        console.warn(`Falha processando "${item.nome || item}": ${err.message}`);
      }
    }
  }

  const trabalhadores = Array.from({ length: Math.min(concorrencia, itens.length) }, trabalhador);
  await Promise.all(trabalhadores);
  return resultados;
}

// Etapa 1: pesquisa o termo digitado pelo usuário e devolve a lista de
// produtos encontrados (na loja selecionada por padrão), para o usuário
// escolher qual é exatamente o produto que ele quer comparar.
async function pesquisarProdutos(termo, options = {}) {
  const { headless = true, debug = false } = options;
  const debugDir = path.join(__dirname, '..', 'debug');
  const { browser, page } = await abrirNavegador(headless);

  try {
    await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
    await fecharPopups(page);
    if (debug) await dumpDebug(page, debugDir, '01-home');

    await preencherBusca(page, termo);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await esperarProdutosCarregarem(page);
    if (debug) await dumpDebug(page, debugDir, '02-pesquisa');

    const produtos = await listarProdutosDaBusca(page);
    if (produtos.length === 0) {
      throw new ScraperError(
        'Não encontrei nenhum produto para esse termo no Condor. Confira a grafia ou rode com DEBUG=1.'
      );
    }

    return { termo, produtos };
  } catch (err) {
    if (debug) await dumpDebug(page, debugDir, '99-erro-pesquisa').catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

// Etapa 2: dado o nome EXATO de um produto (escolhido a partir do resultado
// de pesquisarProdutos), percorre as lojas de Curitiba trocando a loja
// selecionada e refazendo a busca, para comparar o preço em cada uma.
async function compararPrecoEntreLojas(nomeProduto, options = {}) {
  const { headless = true, debug = false, concorrencia = config.CONCORRENCIA_LOJAS } = options;
  const debugDir = path.join(__dirname, '..', 'debug');

  const browser = await chromium.launch({ headless });

  try {
    // Descobre a lista de lojas primeiro (precisa ser sequencial: só depois
    // de saber quais são as lojas de Curitiba dá pra paralelizar).
    const { context: contextInicial, page: pageInicial } = await abrirAba(browser);
    let todasAsLojas;
    try {
      await pageInicial.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
      await fecharPopups(pageInicial);
      if (debug) await dumpDebug(pageInicial, debugDir, '01-home');

      todasAsLojas = await listarLojas(pageInicial);
      if (debug) await dumpDebug(pageInicial, debugDir, '02-lojas');
    } catch (err) {
      if (debug) await dumpDebug(pageInicial, debugDir, '99-erro-lojas').catch(() => {});
      throw err;
    } finally {
      await contextInicial.close();
    }

    const lojasCuritiba = todasAsLojas.filter((loja) => ehLojaDeCuritiba(loja.nome, loja.endereco));
    if (lojasCuritiba.length === 0) {
      throw new ScraperError(
        'Nenhuma loja retornada pelo Condor bateu com os critérios de "Curitiba" ' +
          '(veja CURITIBA_KEYWORDS/KNOWN_CURITIBA_STORES em src/config.js).'
      );
    }

    // Cada loja roda na sua própria aba, em paralelo (limitado por
    // `concorrencia`), em vez de trocar de loja e buscar uma de cada vez.
    const resultados = await processarComConcorrencia(lojasCuritiba, concorrencia, async (loja) => {
      const { context, page } = await abrirAba(browser);
      try {
        await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
        await fecharPopups(page);

        await selecionarLoja(page, loja.id);

        await preencherBusca(page, nomeProduto);
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await esperarProdutosCarregarem(page);
        if (debug) await dumpDebug(page, debugDir, `03-busca-loja-${loja.id}`);

        const item = await obterProdutoDaBusca(page, nomeProduto);
        if (!item) return null;

        return {
          loja: loja.nome,
          endereco: loja.endereco,
          preco: item.preco,
          produtoEncontrado: item.nome,
          aproximado: item.aproximado,
        };
      } catch (err) {
        if (debug) await dumpDebug(page, debugDir, `99-erro-loja-${loja.id}`).catch(() => {});
        throw err;
      } finally {
        await context.close();
      }
    });

    resultados.sort((a, b) => a.preco - b.preco);

    return {
      produto: nomeProduto,
      lojas: resultados,
      maisBarato: resultados[0] || null,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { pesquisarProdutos, compararPrecoEntreLojas, ScraperError };
