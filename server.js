const express = require('express');
const path = require('path');
const { pesquisarProdutos, compararPrecoEntreLojas, ScraperError } = require('./src/scraper');
const config = require('./src/config');

const app = express();
const PORT = process.env.PORT || 3000;

const scraperOptions = () => ({
  headless: process.env.HEADLESS !== '0',
  debug: process.env.DEBUG === '1',
  concorrencia: process.env.CONCORRENCIA_LOJAS ? Number(process.env.CONCORRENCIA_LOJAS) : config.CONCORRENCIA_LOJAS,
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/pesquisar', async (req, res) => {
  const termo = String(req.query.termo || '').trim();

  if (!termo) {
    res.status(400).json({ erro: 'Informe o termo pesquisado (?termo=...).' });
    return;
  }

  try {
    const resultado = await pesquisarProdutos(termo, scraperOptions());
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao pesquisar no Condor:', err);
    const status = err instanceof ScraperError ? 502 : 500;
    res.status(status).json({
      erro: 'Não foi possível pesquisar no Condor.',
      detalhe: err.message,
    });
  }
});

app.get('/api/comparar', async (req, res) => {
  const produto = String(req.query.produto || '').trim();

  if (!produto) {
    res.status(400).json({ erro: 'Informe o nome exato do produto (?produto=...).' });
    return;
  }

  try {
    const resultado = await compararPrecoEntreLojas(produto, scraperOptions());
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao comparar preços no Condor:', err);
    const status = err instanceof ScraperError ? 502 : 500;
    res.status(status).json({
      erro: 'Não foi possível comparar os preços no Condor.',
      detalhe: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`SmartList Condor rodando em http://localhost:${PORT}`);
});
