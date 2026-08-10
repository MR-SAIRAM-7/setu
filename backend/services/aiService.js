/**
 * AI Service Module
 * Handles OpenAI/Gemini structured JSON responses and schema validation.
 */
const axios = require('axios');
const config = require('../config');

async function requestStructuredAI({ name, schema, instructions, input }) {
  if (!config.openAiApiKey) {
    throw new Error('OpenAI API key is not configured.');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/responses',
    {
      model: config.aiModel,
      instructions,
      input,
      store: false,
      text: { format: { type: 'json_schema', name, strict: true, schema } }
    },
    {
      headers: {
        Authorization: `Bearer ${config.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  const outputText =
    response.data.output_text ||
    response.data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text)
      .join('');

  if (!outputText) throw new Error('Model returned no output text.');
  return JSON.parse(outputText);
}

module.exports = {
  requestStructuredAI
};
