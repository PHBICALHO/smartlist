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
    'Não encontrei o campo de busca na home do Condor. Rode com DEBUG=1 e me envie o HTML salvo em debug/ para eu ajustar os seletores.'
  );
}

async function abrirPrimeiroResultado(page) {
  await page.waitForLoadState('networkidle').catch(() => {});

  for (const seletor of config.PRODUCT_LINK_SELECTORS) {
    const link = page.locator(seletor).first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      return;
    }
  }

  throw new ScraperError(
    'Não encontrei nenhum produto na busca. Confira se o termo existe no Condor, ou rode com DEBUG=1 para inspecionar a página de resultados.'
  );
}

async function abrirComparacaoDeLojas(page) {
  for (const pattern of config.STORE_PRICE_BUTTON_PATTERNS) {
    const botao = page.getByText(pattern).first();
    if (await botao.count()) {
      await botao.click();
      await page.waitForTimeout(1000);
      return;
    }
  }

  throw new ScraperError(
    'Não encontrei o botão de "ver preço loja a loja" na página do produto. Rode com DEBUG=1 e me envie o HTML da página do produto para eu ajustar.'
  );
}

function normalizarPreco(texto) {
  const match = texto.match(PRICE_RE);
  if (!match) return null;
  const numero = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(numero) ? null : numero;
}

async function extrairPrecosPorLoja(page) {
  const linhas = page.locator('tr, li, [class*="loja" i], [class*="store" i]');
  const total = await linhas.count();

  const encontrados = new Map();
  for (let i = 0; i < total; i++) {
    const texto = (await linhas.nth(i).innerText().catch(() => '')).trim();
    if (!texto) continue;

    const preco = normalizarPreco(texto);
    if (preco === null) continue;

    const nomeLoja = texto.replace(PRICE_RE, '').replace(/\s+/g, ' ').trim();
    if (!nomeLoja) continue;

    // Mantém a primeira ocorrência de cada loja (evita duplicar quando um
    // elemento "pai" e um "filho" batem no mesmo seletor genérico).
    const chave = nomeLoja.toLowerCase();
    if (!encontrados.has(chave)) {
      encontrados.set(chave, { loja: nomeLoja, preco });
    }
  }

  return Array.from(encontrados.values());
}

function ehLojaDeCuritiba(nomeLoja) {
  const nome = nomeLoja.toLowerCase();
  if (config.CURITIBA_KEYWORDS.some((k) => nome.includes(k.toLowerCase()))) return true;
  if (config.KNOWN_CURITIBA_STORES.some((k) => nome.includes(k.toLowerCase()))) return true;
  return false;
}

async function buscarPrecosCondor(produto, options = {}) {
  const { headless = true, debug = false } = options;
  const debugDir = path.join(__dirname, '..', 'debug');

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ userAgent: config.USER_AGENT });
  const page = await context.newPage();
  page.setDefaultTimeout(config.TIMEOUT_MS);

  try {
    await page.goto(config.BASE_URL, { waitUntil: 'domcontentloaded' });
    await fecharPopups(page);
    if (debug) await dumpDebug(page, debugDir, '01-home');

    await preencherBusca(page, produto);
    await page.waitForLoadState('domcontentloaded');
    await fecharPopups(page);
    if (debug) await dumpDebug(page, debugDir, '02-busca');

    await abrirPrimeiroResultado(page);
    await fecharPopups(page);
    if (debug) await dumpDebug(page, debugDir, '03-produto');

    await abrirComparacaoDeLojas(page);
    if (debug) await dumpDebug(page, debugDir, '04-comparacao-lojas');

    const todasAsLojas = await extrairPrecosPorLoja(page);
    const lojasCuritiba = todasAsLojas
      .filter((item) => ehLojaDeCuritiba(item.loja))
      .sort((a, b) => a.preco - b.preco);

    return {
      produto,
      url: page.url(),
      lojas: lojasCuritiba,
      todasAsLojasEncontradas: todasAsLojas,
      maisBarato: lojasCuritiba[0] || null,
    };
  } catch (err) {
    if (debug) await dumpDebug(page, debugDir, '99-erro').catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

module.exports = { buscarPrecosCondor, ScraperError };
