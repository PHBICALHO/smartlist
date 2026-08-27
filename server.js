const express = require('express');
const path = require('path');
const { buscarPrecosCondor, ScraperError } = require('./src/scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/buscar', async (req, res) => {
  const produto = String(req.query.produto || '').trim();

  if (!produto) {
    res.status(400).json({ erro: 'Informe o produto pesquisado (?produto=...).' });
    return;
  }

  try {
    const resultado = await buscarPrecosCondor(produto, {
      headless: process.env.HEADLESS !== '0',
      debug: process.env.DEBUG === '1',
    });
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao buscar no Condor:', err);
    const status = err instanceof ScraperError ? 502 : 500;
    res.status(status).json({
      erro: 'Não foi possível concluir a consulta no Condor.',
      detalhe: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`SmartList Condor rodando em http://localhost:${PORT}`);
});
