/**
 * AI Service Module
 * Orchestrates Google Gemini API & OpenAI API structured JSON responses.
 */
const axios = require('axios');
const config = require('../config');

async function requestStructuredAI({ name, schema, instructions, input }) {
  // 1. Try Google Gemini API if GEMINI_API_KEY is available (Free Tier)
  if (config.geminiApiKey) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${instructions}\n\nSchema Requirement: Return ONLY raw JSON matching this structure:\n${JSON.stringify(schema, null, 2)}\n\nINPUT:\n${input}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        },
        { timeout: 20000 }
      );

      const candidateText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return JSON.parse(candidateText);
      }
    } catch (geminiErr) {
      console.warn('Gemini API call failed, attempting OpenAI fallback:', geminiErr.message);
    }
  }

  // 2. Try OpenAI API if OPENAI_API_KEY is available
  if (config.openAiApiKey) {
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

    if (!outputText) throw new Error('OpenAI model returned no output text.');
    return JSON.parse(outputText);
  }

  throw new Error('No valid AI API Key (GEMINI_API_KEY or OPENAI_API_KEY) found.');
}

module.exports = {
  requestStructuredAI
};
