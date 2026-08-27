const form = document.getElementById('form-busca');
const statusEl = document.getElementById('status');
const produtosEl = document.getElementById('produtos');
const comparacaoEl = document.getElementById('comparacao');

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function limparTudo() {
  statusEl.textContent = '';
  statusEl.classList.remove('erro');
  produtosEl.innerHTML = '';
  comparacaoEl.innerHTML = '';
}

function renderListaProdutos(dados) {
  produtosEl.innerHTML = '';
  statusEl.textContent = `${dados.produtos.length} produto(s) encontrado(s) para "${dados.termo}". Clique no que você quer comparar.`;

  dados.produtos.forEach((produto) => {
    const card = document.createElement('div');
    card.className = 'card-produto';
    card.innerHTML = `
      <img src="${produto.imagem || ''}" alt="" loading="lazy" />
      <div class="nome-produto">${produto.nome.toLowerCase()}</div>
      <div class="preco-produto">${formatarPreco(produto.preco)}</div>
    `;
    card.addEventListener('click', () => compararProduto(produto.nome));
    produtosEl.appendChild(card);
  });
}

function renderComparacao(nomeProduto, dados) {
  comparacaoEl.innerHTML = '';

  const voltar = document.createElement('button');
  voltar.className = 'voltar-btn';
  voltar.textContent = '← Voltar para os resultados';
  voltar.addEventListener('click', () => {
    comparacaoEl.innerHTML = '';
    statusEl.textContent = `Clique em outro produto para comparar, ou pesquise de novo.`;
  });
  comparacaoEl.appendChild(voltar);

  const titulo = document.createElement('div');
  titulo.className = 'produto-alvo';
  titulo.textContent = nomeProduto.toLowerCase();
  comparacaoEl.appendChild(titulo);

  if (!dados.lojas || dados.lojas.length === 0) {
    const aviso = document.createElement('div');
    aviso.textContent = 'Não achei preço em nenhuma loja de Curitiba para esse produto.';
    comparacaoEl.appendChild(aviso);
    return;
  }

  dados.lojas.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'card-loja' + (index === 0 ? ' mais-barato' : '');
    card.innerHTML = `
      <span>
        ${item.loja}
        ${index === 0 ? '<span class="selo">MAIS BARATO</span>' : ''}
        ${item.aproximado ? '<span class="selo aviso">produto aproximado</span>' : ''}
      </span>
      <span class="preco">${formatarPreco(item.preco)}</span>
    `;
    comparacaoEl.appendChild(card);
  });
}

async function pesquisar(termo) {
  limparTudo();
  statusEl.textContent = 'Pesquisando no Condor...';

  try {
    const resp = await fetch(`/api/pesquisar?termo=${encodeURIComponent(termo)}`);
    const dados = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = dados.detalhe || dados.erro || 'Erro ao pesquisar.';
      statusEl.classList.add('erro');
      return;
    }

    renderListaProdutos(dados);
  } catch (err) {
    statusEl.textContent = 'Erro de conexão com o servidor local.';
    statusEl.classList.add('erro');
    console.error(err);
  }
}

async function compararProduto(nomeProduto) {
  comparacaoEl.innerHTML = '';
  statusEl.textContent = `Comparando "${nomeProduto.toLowerCase()}" entre as lojas de Curitiba... isso pode levar 1-2 minutos.`;
  statusEl.classList.remove('erro');

  try {
    const resp = await fetch(`/api/comparar?produto=${encodeURIComponent(nomeProduto)}`);
    const dados = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = dados.detalhe || dados.erro || 'Erro ao comparar.';
      statusEl.classList.add('erro');
      return;
    }

    statusEl.textContent = `Comparado em ${dados.lojas.length} loja(s) de Curitiba.`;
    renderComparacao(nomeProduto, dados);
  } catch (err) {
    statusEl.textContent = 'Erro de conexão com o servidor local.';
    statusEl.classList.add('erro');
    console.error(err);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const termo = document.getElementById('termo').value.trim();
  if (termo) pesquisar(termo);
});
