
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';s
import { fileURLToPath } from 'url';
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'StudyMate AI backend is running.' });
});

function checkAI(res) {
  if (!ai) {
    res.status(500).json({
      error: 'Gemini API key is missing. Add GEMINI_API_KEY to your .env file.'
    });
    return false;
  }
  return true;
}

async function generateText(prompt, config = {}) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config
  });

  return response.text || '';
}

// AI ASSISTANT
app.post('/api/ask', async (req, res) => {
  try {
    if (!checkAI(res)) return;

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Please provide a message.' });
    }

    const contents = messages.slice(-30).map((message) => ({
      role: message.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(message.text || '').slice(0, 12000) }]
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction:
          'You are StudyMate AI, a helpful study assistant. Explain concepts clearly, use simple language, provide examples, and help students learn. Use Markdown formatting when useful.'
      }
    });

    res.json({ answer: response.text || 'I could not generate an answer. Please try again.' });
  } catch (error) {
    console.error('AI Assistant error:', error);
    res.status(500).json({ error: 'AI Assistant failed. Please try again.' });
  }
});

// PDF SUMMARIZER
app.post('/api/summarize', async (req, res) => {
  try {
    if (!checkAI(res)) return;

    const { text, filename } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'No PDF text was provided.' });
    }

    const summary = await generateText(
      `Summarize the following study document.
      
File name: ${filename || 'Study document'}

Create a useful student-friendly summary with:
1. Main topic
2. Important points
3. Key definitions
4. Important facts to remember
5. Short conclusion

Use clear headings and bullet points. Do not invent information that is not in the document.

DOCUMENT:
${text.slice(0, 60000)}`
    );

    res.json({ summary });
  } catch (error) {
    console.error('PDF summarizer error:', error);
    res.status(500).json({ error: 'Could not summarize this PDF. Please try again.' });
  }
});

// QUIZ GENERATOR
app.post('/api/quiz', async (req, res) => {
  try {
    if (!checkAI(res)) return;

    const { topic, text, count } = req.body;
    const numberOfQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);

    if (!topic && !text) {
      return res.status(400).json({ error: 'Please provide a topic or study text.' });
    }

    const prompt = `Create exactly ${numberOfQuestions} multiple-choice questions for a student.

Topic: ${topic || 'Based on the supplied study text'}

${text ? `Study text:\n${String(text).slice(0, 30000)}` : ''}

Return ONLY a valid JSON array. Each item must have this structure:
{
  "question": "Question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 0,
  "explanation": "Short explanation"
}

The answer must be the zero-based index of the correct option (0, 1, 2, or 3).
Make sure there are exactly four options and only one correct answer per question.`;

    const raw = await generateText(prompt, {
      responseMimeType: 'application/json'
    });

    let questions;
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      questions = JSON.parse(cleaned);
    } catch {
      throw new Error('The AI returned invalid quiz data.');
    }

    if (!Array.isArray(questions)) {
      throw new Error('Invalid quiz format.');
    }

    const formattedQuestions = questions.slice(0, numberOfQuestions).map((q) => {
      const options = Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [];
      let answer = Number(q.answer);

      if (options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) {
        throw new Error('A quiz question has invalid options or answer.');
      }

      return {
        question: String(q.question || ''),
        options,
        answer,
        explanation: String(q.explanation || '')
      };
    });

    if (formattedQuestions.length !== numberOfQuestions) {
      throw new Error('The AI did not generate the requested number of questions.');
    }

    res.json({ questions: formattedQuestions });
  } catch (error) {
    console.error('Quiz generator error:', error);
    res.status(500).json({ error: 'Could not generate the quiz. Please try again.' });
  }
});
// Serve the React frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Handle website routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(PORT, () => {
  console.log(`StudyMate AI backend running at http://localhost:${PORT}`);
});
