const form = document.getElementById('form-busca');
const statusEl = document.getElementById('status');
const resultadoEl = document.getElementById('resultado');

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderResultado(dados) {
  resultadoEl.innerHTML = '';

  if (!dados.lojas || dados.lojas.length === 0) {
    statusEl.textContent =
      'Não encontrei preço em nenhuma loja de Curitiba para esse produto. ' +
      'Veja "todasAsLojasEncontradas" no console para conferir os nomes retornados.';
    statusEl.classList.add('erro');
    console.log('Lojas encontradas (sem filtro de Curitiba):', dados.todasAsLojasEncontradas);
    return;
  }

  statusEl.textContent = `Encontrado em ${dados.lojas.length} loja(s) de Curitiba.`;
  statusEl.classList.remove('erro');

  dados.lojas.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'card-loja' + (index === 0 ? ' mais-barato' : '');
    card.innerHTML = `
      <span>${item.loja}${index === 0 ? '<span class="selo">MAIS BARATO</span>' : ''}</span>
      <span class="preco">${formatarPreco(item.preco)}</span>
    `;
    resultadoEl.appendChild(card);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const produto = document.getElementById('produto').value.trim();
  if (!produto) return;

  const botao = form.querySelector('button');
  botao.disabled = true;
  statusEl.classList.remove('erro');
  statusEl.textContent = 'Buscando no Condor... isso pode levar alguns segundos.';
  resultadoEl.innerHTML = '';

  try {
    const resp = await fetch(`/api/buscar?produto=${encodeURIComponent(produto)}`);
    const dados = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = dados.detalhe || dados.erro || 'Erro ao buscar.';
      statusEl.classList.add('erro');
      return;
    }

    renderResultado(dados);
  } catch (err) {
    statusEl.textContent = 'Erro de conexão com o servidor local.';
    statusEl.classList.add('erro');
    console.error(err);
  } finally {
    botao.disabled = false;
  }
});
