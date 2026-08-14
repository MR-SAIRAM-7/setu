/**
 * Mind Map Chat Controller
 * ------------------------
 * Backs the conversational surface: the user names any topic, the agent
 * researches it, and a mind map streams back into the conversation.
 *
 * Transport is Server-Sent Events so the UI can show research progress instead
 * of a spinner that hides a 20-second wait.
 */

const research = require('../services/researchService');

/** Open an SSE stream and hand back a typed writer. */
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
 * body: { messages: [{role, content}], map?: MindMap }
 *
 * Emits: status | reply | map | error | done
 */
async function handleChat(req, res) {
  const stream = openStream(res);

  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const currentMap = req.body.map || null;

    if (!messages.length) {
      stream.send('error', { message: 'No messages supplied.' });
      return stream.end();
    }

    stream.send('status', { stage: 'thinking', message: 'Thinking…' });

    const routed = await research.classifyTurn({
      messages,
      hasMap: Boolean(currentMap),
      currentTopic: currentMap?.title || ''
    });

    // Show the warm acknowledgement immediately, before any slow work starts.
    stream.send('reply', { text: routed.reply, intent: routed.intent });

    if (routed.intent === 'research_topic') {
      const map = await research.researchMindMap({
        topic: routed.topic || messages[messages.length - 1].content,
        onProgress: (update) => stream.send('status', update)
      });
      stream.send('map', map);
    } else if (routed.intent === 'expand_map' && currentMap) {
      stream.send('status', { stage: 'researching', message: 'Going deeper…' });
      const map = await research.researchMindMap({
        topic: currentMap.title,
        context: `The user already has a map of this topic and asked: "${
          messages[messages.length - 1].content
        }". Go materially deeper and cover facets the existing map missed.`,
        onProgress: (update) => stream.send('status', update)
      });
      stream.send('map', map);
    } else if (routed.intent === 'answer_question') {
      const answer = await research.answerAboutMap({ messages, map: currentMap });
      stream.send('reply', { text: answer, intent: 'answer', final: true });
    }

    stream.send('done', { ok: true });
  } catch (error) {
    console.error('[SETU Chat]', error);
    stream.send('error', { message: error.message || 'Something went wrong.' });
  } finally {
    stream.end();
  }
}

/**
 * POST /api/research/mindmap — non-streaming mind map generation.
 * Used by the extension and any client that would rather await one JSON blob.
 */
async function handleMindMap(req, res, next) {
  try {
    const map = await research.researchMindMap({
      topic: req.body.topic,
      context: req.body.context || ''
    });
    res.json(map);
  } catch (error) {
    next(error);
  }
}

/** POST /api/research/expand — grow one node of an existing map. */
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
