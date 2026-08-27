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

async function obterProdutoDaBusca(page, nomeAlvo) {
  const cards = page.locator(config.PRODUCT_CARD_SELECTOR);
  const total = await cards.count();

  let primeiro = null;
  for (let i = 0; i < total; i++) {
    const texto = (await cards.nth(i).innerText().catch(() => '')).trim();
    if (!texto) continue;

    const preco = normalizarPreco(texto);
    if (preco === null) continue;

    const nome = texto
      .replace(PRICE_RE, '')
      .replace(/\s+/g, ' ')
      .trim()
      // remove o rótulo de unidade ("un", "kg"...) que fica colado antes do nome.
      .replace(/^(un|kg|cx|pct|dz)\b\s*/i, '');
    if (!nome) continue;

    if (!primeiro) primeiro = { nome, preco };
    if (nomeAlvo && nome.toLowerCase() === nomeAlvo.toLowerCase()) {
      return { nome, preco };
    }
  }

  return primeiro;
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
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  await fecharPopups(page);
}

function ehLojaDeCuritiba(nome, endereco) {
  const texto = `${nome} ${endereco}`.toLowerCase();
  if (config.CURITIBA_KEYWORDS.some((k) => texto.includes(k.toLowerCase()))) return true;
  if (config.KNOWN_CURITIBA_STORES.some((k) => texto.includes(k.toLowerCase()))) return true;
  return false;
}

async function buscarPrecosCondor(produto, options = {}) {
  const { headless = true, debug = false } = options;
  const debugDir = path.join(__dirname, '..', 'debug');

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: config.USER_AGENT,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.TIMEOUT_MS);

  try {
    await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
    await fecharPopups(page);
    if (debug) await dumpDebug(page, debugDir, '01-home');

    const todasAsLojas = await listarLojas(page);
    if (debug) await dumpDebug(page, debugDir, '02-lojas');

    const lojasCuritiba = todasAsLojas.filter((loja) => ehLojaDeCuritiba(loja.nome, loja.endereco));
    if (lojasCuritiba.length === 0) {
      throw new ScraperError(
        'Nenhuma loja retornada pelo Condor bateu com os critérios de "Curitiba" ' +
          '(veja CURITIBA_KEYWORDS/KNOWN_CURITIBA_STORES em src/config.js).'
      );
    }

    let nomeProdutoAlvo = null;
    const resultados = [];

    for (const loja of lojasCuritiba) {
      await selecionarLoja(page, loja.id);

      await preencherBusca(page, produto);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await esperarProdutosCarregarem(page);
      if (debug) await dumpDebug(page, debugDir, `03-busca-loja-${loja.id}`);

      const item = await obterProdutoDaBusca(page, nomeProdutoAlvo);
      if (item) {
        if (!nomeProdutoAlvo) nomeProdutoAlvo = item.nome;
        resultados.push({
          loja: loja.nome,
          endereco: loja.endereco,
          preco: item.preco,
          produtoEncontrado: item.nome,
        });
      }
    }

    resultados.sort((a, b) => a.preco - b.preco);

    return {
      produto,
      produtoEncontrado: nomeProdutoAlvo,
      lojas: resultados,
      maisBarato: resultados[0] || null,
    };
  } catch (err) {
    if (debug) await dumpDebug(page, debugDir, '99-erro').catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

module.exports = { buscarPrecosCondor, ScraperError };
