/**
 * Container Node para SAP AI Core.
 * Recebe POST com { question } e repassa ao Databricks; devolve { reply }.
 * Variáveis de ambiente (configurar no deployment do AI Core):
 *   DATABRICKS_URL  - URL do endpoint (ex: https://adb-.../serving-endpoints/.../invocations)
 *   DATABRICKS_TOKEN - Token Bearer do Databricks
 */
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const DATABRICKS_URL = process.env.DATABRICKS_URL || '';
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN || '';

if (!DATABRICKS_URL || !DATABRICKS_TOKEN) {
  console.warn('DATABRICKS_URL ou DATABRICKS_TOKEN não definidos. Defina no deployment do AI Core.');
}

/**
 * Formata o resultado do Databricks (predictions[0].result) em texto legível.
 */
function formatDatabricksResult(data) {
  if (!data || !data.predictions || !Array.isArray(data.predictions) || data.predictions.length === 0) {
    return data?.reply || data?.answer || (data ? JSON.stringify(data) : 'Sem resposta');
  }
  const pred = data.predictions[0];
  const results = pred.result || [];
  const question = pred.question || '';
  if (results.length === 0) {
    return `Não encontrei resultados para: "${question}"`;
  }
  const lines = results
    .map((r, i) => {
      const parts = Object.entries(r)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return parts ? `${i + 1}. ${parts}` : null;
    })
    .filter(Boolean);
  return lines.join('\n') || `Recebi ${results.length} resultado(s).`;
}

/**
 * Rota que o AI Core chama (convenção: /invocations).
 * Body esperado: { "question": "..." } ou { "input": "..." }
 */
app.post('/invocations', async (req, res) => {
  const question = req.body?.question || req.body?.input || req.body?.message || '';
  if (!question) {
    return res.status(400).json({ reply: 'Campo question/input/message é obrigatório.' });
  }

  if (!DATABRICKS_URL || !DATABRICKS_TOKEN) {
    return res.status(503).json({ reply: 'Container não configurado: DATABRICKS_URL/DATABRICKS_TOKEN.' });
  }

  try {
    const response = await axios.post(
      DATABRICKS_URL,
      { dataframe_records: [{ question }] },
      {
        headers: {
          Authorization: `Bearer ${DATABRICKS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 600000
      }
    );

    const reply = formatDatabricksResult(response.data);
    res.status(200).json({ reply });
  } catch (err) {
    console.error('Erro ao chamar Databricks:', err.response?.status, err.response?.data || err.message);
    const msg = err.response?.data?.message || err.message || 'Erro ao chamar Databricks';
    res.status(err.response?.status || 502).json({ reply: `[Erro] ${msg}` });
  }
});

/**
 * Health para o AI Core.
 */
app.get('/ping', (req, res) => {
  res.status(200).send('ok');
});

app.listen(PORT, () => {
  console.log(`Databricks proxy rodando na porta ${PORT}`);
});
