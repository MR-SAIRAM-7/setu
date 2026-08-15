/**
 * Mind Map & Document Chat Controller
 * -----------------------------------
 * Backs the conversational AI assistant: researches topics, generates mind maps,
 * answers queries grounded in attached documents, and saves conversations/messages
 * directly to MongoDB.
 */

const research = require('../services/researchService');
const documentService = require('../services/documentService');
const mongoService = require('../services/mongodbService');

function toText(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

/** Open an SSE stream and hand back a typed writer */
function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  return {
    send(event, data) {
      if (closed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    get closed() {
      return closed;
    },
    end() {
      if (!closed) res.end();
    }
  };
}

/**
 * POST /api/chat  (SSE)
 * body: {
 *   messages: [{role, content}],
 *   conversationId?: string,
 *   documentId?: string,
 *   map?: MindMap
 * }
 */
async function handleChat(req, res) {
  const stream = openStream(res);

  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous_user';
    const conversationId =
      req.headers['x-conversation-id'] || req.body.conversationId || `conv_${Date.now()}`;
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const currentMap = req.body.map || null;
    const documentId = req.body.documentId || null;

    if (!messages.length) {
      stream.send('error', { message: 'No messages supplied.' });
      return stream.end();
    }

    const lastUserMessage = messages[messages.length - 1] || {};
    const lastUserText = toText(lastUserMessage.content, '').trim();

    // Persist user turn to MongoDB
    await mongoService.saveMessage({
      conversationId,
      userId,
      role: 'user',
      content: lastUserText,
      fileAttachments: documentId ? [{ fileId: documentId }] : []
    }).catch(() => {});

    stream.send('status', { stage: 'thinking', message: 'Analyzing…' });

    // If a document is attached, fetch it for grounded context
    let attachedDoc = null;
    if (documentId) {
      attachedDoc = await mongoService.getDocumentFileById(documentId).catch(() => null);
    }

    const routed = await research.classifyTurn({
      messages,
      hasMap: Boolean(currentMap),
      currentTopic: currentMap?.title || attachedDoc?.originalName || '',
      hasDocument: Boolean(attachedDoc)
    });
    const routedIntent = toText(routed?.intent, 'research_topic') || 'research_topic';

    // Send immediate acknowledgment
    const ackReply = toText(routed?.reply, 'Working on that now.').trim() || 'Working on that now.';
    stream.send('reply', { text: ackReply, intent: routedIntent });

    let finalAssistantReply = ackReply;
    let generatedMap = null;
    let sources = [];

    if (routedIntent === 'query_document' && attachedDoc) {
      stream.send('status', { stage: 'reading', message: `Reviewing ${attachedDoc.originalName}…` });
      const queryResult = await documentService.queryDocument({
        documentId: attachedDoc.id,
        query: lastUserText,
        messages,
        userId
      });
      finalAssistantReply = toText(queryResult?.answer, 'I could not produce a grounded answer yet.');
      sources = queryResult.sources;
      stream.send('reply', {
        text: finalAssistantReply,
        intent: 'document_answer',
        final: true,
        sources
      });
    } else if (routedIntent === 'research_topic') {
      const topicQuery = toText(routed?.topic, '').trim() || lastUserText;
      const context = attachedDoc
        ? `From uploaded document "${attachedDoc.originalName}":\n${attachedDoc.extractedText.slice(0, 10000)}`
        : '';

      generatedMap = await research.researchMindMap({
        topic: topicQuery,
        context,
        onProgress: (update) => stream.send('status', update)
      });

      sources = generatedMap.sources || [];
      stream.send('map', generatedMap);

      // Save generated mind map in MongoDB
      await mongoService.saveMindMap({
        ...generatedMap,
        userId,
        conversationId,
        documentId: attachedDoc?.id || null
      }).catch(() => {});
    } else if (routedIntent === 'expand_map' && currentMap) {
      stream.send('status', { stage: 'researching', message: 'Going deeper into branches…' });
      generatedMap = await research.researchMindMap({
        topic: currentMap.title,
        context: `The user has an existing map and asked: "${lastUserText}". Deepen existing branches and discover missing facets.`,
        onProgress: (update) => stream.send('status', update)
      });
      sources = generatedMap.sources || [];
      stream.send('map', generatedMap);

      await mongoService.saveMindMap({
        ...generatedMap,
        userId,
        conversationId
      }).catch(() => {});
    } else if (routedIntent === 'answer_question') {
      const answer = await research.answerAboutMap({ messages, map: currentMap });
      finalAssistantReply = toText(answer, 'I could not answer that from the current map yet.');
      stream.send('reply', { text: finalAssistantReply, intent: 'answer', final: true });
    }

    // Persist assistant message in MongoDB
    await mongoService.saveMessage({
      conversationId,
      userId,
      role: 'assistant',
      content: finalAssistantReply,
      intent: routedIntent,
      sources,
      mindMapData: generatedMap ? { title: generatedMap.title, summary: generatedMap.summary } : null
    }).catch(() => {});

    stream.send('done', { ok: true, conversationId });
  } catch (error) {
    console.error('[SETU Chat Error]', error);
    stream.send('error', { message: error.message || 'Something went wrong processing your message.' });
  } finally {
    stream.end();
  }
}

/**
 * POST /api/research/mindmap
 */
async function handleMindMap(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous_user';
    const conversationId = req.headers['x-conversation-id'] || req.body.conversationId || null;
    const documentId = req.body.documentId || null;

    const map = await research.researchMindMap({
      topic: req.body.topic,
      context: req.body.context || ''
    });

    const saved = await mongoService.saveMindMap({
      ...map,
      userId,
      conversationId,
      documentId
    });

    res.json(saved || map);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/research/expand
 */
async function handleExpandNode(req, res, next) {
  try {
    const { topic, nodeLabel, nodeDetail, path } = req.body;
    if (!nodeLabel) {
      return res.status(400).json({ error: 'nodeLabel is required.' });
    }
    const children = await research.expandNode({ topic, nodeLabel, nodeDetail, path });
    res.json({ children });
  } catch (error) {
    next(error);
  }
}

module.exports = { handleChat, handleMindMap, handleExpandNode };
