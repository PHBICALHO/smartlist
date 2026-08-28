// Configuração do scraper do Condor.
//
// Confirmado testando ao vivo (rodando localmente): o Condor NÃO tem um
// botão de "comparar preço loja a loja" num único produto. Em vez disso,
// existe um seletor de loja global no header (o site inteiro reflete os
// preços da loja selecionada). Para comparar preços entre lojas, o scraper
// troca a loja selecionada e refaz a busca do produto para cada loja de
// Curitiba.

module.exports = {
  BASE_URL: 'https://www.condor.com.br',

  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

  TIMEOUT_MS: 30000,

  // Quantas lojas o scraper processa em paralelo (abas separadas) durante a
  // comparação de preços. Mais alto = mais rápido, mas mais carga no site
  // do Condor de uma vez. 4 é um meio-termo razoável para uso pessoal.
  CONCORRENCIA_LOJAS: 4,

  // Textos de botões/links de cookies, popups de CEP, newsletter etc.
  // que devem ser fechados/ignorados antes de continuar.
  DISMISS_BUTTON_PATTERNS: [
    /aceitar/i,
    /concordo/i,
    /continuar sem informar/i,
    /fechar/i,
    /agora não/i,
    /estou ciente/i,
  ],

  // Campo de busca na home/header do Condor.
  SEARCH_INPUT_SELECTORS: [
    'input[data-test="search-inp"]',
    'input[type="search"]',
    'input[name="q"]',
    'input#input-busca',
    'input[placeholder*="usca" i]',
    'input[aria-label*="usca" i]',
  ],

  // Card de produto na página de resultado de busca. Cada card é
  // ".item-product-wrapper" (um <a> sem href, navegação via JS) contendo o
  // nome e "R$ X,XX" do preço.
  PRODUCT_CARD_SELECTOR: '.item-product-wrapper',

  // Enquanto os produtos carregam via ajax, o Condor mostra skeletons com
  // essa classe.
  LOADING_PLACEHOLDER_SELECTOR: '.loading-placeholder',

  // Botão no header que abre o modal "Selecione uma loja".
  STORE_BUTTON_SELECTOR: '[data-test="store-btn"]',

  // Cada item da lista de lojas no modal tem um atributo data-store-id.
  STORE_ITEM_SELECTOR: '[data-store-id]',

  // Botão que confirma a troca de loja dentro do modal.
  STORE_CONFIRM_BUTTON_SELECTOR: '[data-test="store-confirm-btn"]',

  // Uma loja é considerada "de Curitiba" se o nome OU o endereço contiver
  // qualquer uma destas palavras (case-insensitive). O endereço retornado
  // pelo Condor já inclui a cidade (ex: "..., Curitiba - PR, 80520-000").
  CURITIBA_KEYWORDS: ['curitiba'],

  // Lista extra de nomes/bairros de lojas para casos em que o texto não
  // contenha "Curitiba" explicitamente.
  KNOWN_CURITIBA_STORES: [],
};
