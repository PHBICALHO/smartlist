// Configuração do scraper do Condor.
//
// IMPORTANTE: não foi possível abrir o condor.com.br a partir do ambiente
// onde este código foi gerado (rede bloqueada). Os seletores abaixo são
// tentativas genéricas/comuns para sites de e-commerce brasileiros.
// Se o scraper não encontrar algo, rode com DEBUG=1 (veja o README) e
// ajuste os seletores/padrões aqui usando o HTML salvo em debug/.

module.exports = {
  BASE_URL: 'https://www.condor.com.br',

  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

  TIMEOUT_MS: 30000,

  // Textos de botões/links de cookies, popups de CEP, newsletter etc.
  // que devem ser fechados/ignorados antes de continuar.
  DISMISS_BUTTON_PATTERNS: [
    /aceitar/i,
    /concordo/i,
    /continuar sem informar/i,
    /fechar/i,
    /agora não/i,
  ],

  // Onde procurar o campo de busca na home do Condor.
  SEARCH_INPUT_SELECTORS: [
    'input[type="search"]',
    'input[name="q"]',
    'input#input-busca',
    'input[placeholder*="usca" i]',
    'input[aria-label*="usca" i]',
  ],

  // Como identificar um link de produto na página de resultado de busca.
  PRODUCT_LINK_SELECTORS: [
    'a[href*="/produto"]',
    'a[href*="/p/"]',
    '[data-testid*="product"] a',
    '.product-item a',
    '.product-card a',
  ],

  // Texto do botão que abre a comparação de preço "loja a loja"
  // (você mencionou que esse botão existe na página do produto).
  STORE_PRICE_BUTTON_PATTERNS: [
    /pre[cç]o.*loja/i,
    /comparar.*loja/i,
    /loja a loja/i,
    /ver.*pre[cç]o.*loja/i,
    /dispon[ií]vel.*loja/i,
  ],

  // Um nome de loja é considerado "de Curitiba" se contiver qualquer uma
  // destas palavras (case-insensitive). Ajuste depois de ver os nomes reais
  // retornados pelo Condor (rode com DEBUG=1).
  CURITIBA_KEYWORDS: ['curitiba'],

  // Lista extra de nomes/bairros de lojas que você sabe que são de
  // Curitiba, para o caso do Condor não escrever "Curitiba" no nome da loja
  // (ex: só "Condor Batel", "Condor Cabral"). Preencha depois de conferir
  // no site real ou no dump de debug.
  KNOWN_CURITIBA_STORES: [],
};
