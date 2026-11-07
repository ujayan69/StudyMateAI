
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

const NAV = [
  { name: 'Dashboard', icon: '🏠' },
  { name: 'My Notes', icon: '📝' },
  { name: 'PDF Summarizer', icon: '📄' },
  { name: 'Quiz Generator', icon: '🧠' },
  { name: 'My Progress', icon: '📊' },
  { name: 'AI Assistant', icon: '🤖' },
]

const readStore = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

const saveStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.warn(`Could not save ${key} to local storage.`)
  }
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return data
}

function App() {
  const [page, setPage] = useState('Dashboard')
  const [notes, setNotes] = useState(() => readStore('studymate-notes', []))
  const [chats, setChats] = useState(() => readStore('studymate-chats', []))
  const [progress, setProgress] = useState(() => readStore('studymate-progress', {
    studySessions: 0,
    quizzesTaken: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    summariesMade: 0,
  }))

  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [editingNote, setEditingNote] = useState(null)
  const [noteSearch, setNoteSearch] = useState('')

  const [pdfName, setPdfName] = useState('')
  const [pdfText, setPdfText] = useState('')
  const [summary, setSummary] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')

  const [quizTopic, setQuizTopic] = useState('')
  const [quizCount, setQuizCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState('')

  const [activeChatId, setActiveChatId] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef(null)
  const pdfInputRef = useRef(null)

  useEffect(() => saveStore('studymate-notes', notes), [notes])
  useEffect(() => saveStore('studymate-chats', chats), [chats])
  useEffect(() => saveStore('studymate-progress', progress), [progress])

  const activeChat = chats.find(chat => chat.id === activeChatId)
  const filteredNotes = useMemo(() => {
    const search = noteSearch.toLowerCase()
    return notes.filter(note =>
      `${note.title} ${note.body}`.toLowerCase().includes(search)
    )
  }, [notes, noteSearch])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages, chatLoading])

  function changePage(name) {
    setPage(name)
  }

  function saveNote() {
    if (!noteTitle.trim() || !noteBody.trim()) {
      alert('Please enter both a title and note content.')
      return
    }

    if (editingNote) {
      setNotes(previous => previous.map(note =>
        note.id === editingNote
          ? { ...note, title: noteTitle.trim(), body: noteBody.trim(), updatedAt: Date.now() }
          : note
      ))
    } else {
      setNotes(previous => [{
        id: crypto.randomUUID(),
        title: noteTitle.trim(),
        body: noteBody.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }, ...previous])
    }

    setNoteTitle('')
    setNoteBody('')
    setEditingNote(null)
  }

  function editNote(note) {
    setEditingNote(note.id)
    setNoteTitle(note.title)
    setNoteBody(note.body)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteNote(id) {
    if (!window.confirm('Delete this note permanently?')) return
    setNotes(previous => previous.filter(note => note.id !== id))
    if (editingNote === id) {
      setEditingNote(null)
      setNoteTitle('')
      setNoteBody('')
    }
  }

  async function extractPDF(file) {
    setPdfError('')
    setSummary('')
    setPdfText('')

    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Please select a PDF file.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setPdfError('Please select a PDF smaller than 15 MB.')
      return
    }

    setPdfLoading(true)
    setPdfName(file.name)

    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        import.meta.url
      ).toString()

      const buffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: buffer }).promise
      const pages = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const pageData = await pdf.getPage(pageNumber)
        const content = await pageData.getTextContent()
        const pageText = content.items
          .map(item => item.str || '')
          .join(' ')
        pages.push(pageText)
      }

      const extracted = pages.join('\n\n').trim()
      if (!extracted) {
        throw new Error('No selectable text was found. This may be a scanned PDF.')
      }
      if (extracted.length > 60000) {
        throw new Error('This PDF contains too much text. Please use a shorter PDF.')
      }

      setPdfText(extracted)
    } catch (error) {
      setPdfError(error.message || 'Could not read this PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  async function summarizePDF() {
    if (!pdfText.trim()) {
      setPdfError('Upload a PDF containing selectable text first.')
      return
    }

    setPdfLoading(true)
    setPdfError('')
    setSummary('')

    try {
      const data = await postJSON('/api/summarize', {
        text: pdfText,
        filename: pdfName,
      })
      setSummary(data.summary || 'No summary was returned.')
      setProgress(previous => ({
        ...previous,
        summariesMade: previous.summariesMade + 1,
      }))
    } catch (error) {
      setPdfError(error.message)
    } finally {
      setPdfLoading(false)
    }
  }

  async function generateQuiz() {
    if (!quizTopic.trim() && !pdfText.trim()) {
      setQuizError('Enter a topic or upload a PDF first.')
      return
    }

    setQuizLoading(true)
    setQuizError('')
    setQuestions([])
    setAnswers({})
    setQuizSubmitted(false)

    try {
      const data = await postJSON('/api/quiz', {
        topic: quizTopic,
        text: pdfText,
        count: quizCount,
      })

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('No quiz questions were returned.')
      }

      setQuestions(data.questions)
    } catch (error) {
      setQuizError(error.message)
    } finally {
      setQuizLoading(false)
    }
  }

  function submitQuiz() {
    if (Object.keys(answers).length !== questions.length) {
      setQuizError('Please answer every question before submitting.')
      return
    }

    setQuizSubmitted(true)
    const correct = questions.filter((question, index) =>
      answers[index] === question.answer
    ).length

    setProgress(previous => ({
      ...previous,
      quizzesTaken: previous.quizzesTaken + 1,
      totalCorrect: previous.totalCorrect + correct,
      totalQuestions: previous.totalQuestions + questions.length,
    }))
    setQuizError('')
  }

  function startNewChat() {
    setActiveChatId(null)
    setChatInput('')
  }

  function deleteChat(id) {
    setChats(previous => previous.filter(chat => chat.id !== id))
    if (activeChatId === id) setActiveChatId(null)
  }

  async function sendChatMessage() {
    const message = chatInput.trim()
    if (!message || chatLoading) return

    const id = activeChatId || crypto.randomUUID()
    const existing = chats.find(chat => chat.id === id)
    const previousMessages = existing?.messages || []
    const updatedMessages = [
      ...previousMessages,
      { role: 'user', content: message },
    ]

    const chat = {
      id,
      title: existing?.title || message.slice(0, 40),
      messages: updatedMessages,
    }

    setChats(previous => existing
      ? previous.map(item => item.id === id ? chat : item)
      : [chat, ...previous]
    )
    setActiveChatId(id)
    setChatInput('')
    setChatLoading(true)

    try {
      const messages = updatedMessages.map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        text: item.content,
      }))

      const data = await postJSON('/api/ask', { messages })
      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant', content: data.answer || 'No response received.' },
      ]

      setChats(previous => previous.map(item =>
        item.id === id ? { ...item, messages: finalMessages } : item
      ))
    } catch (error) {
      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant', content: `Sorry, I couldn't respond. ${error.message}` },
      ]
      setChats(previous => previous.map(item =>
        item.id === id ? { ...item, messages: finalMessages } : item
      ))
    } finally {
      setChatLoading(false)
    }
  }

  const accuracy = progress.totalQuestions
    ? Math.round(progress.totalCorrect / progress.totalQuestions * 100)
    : 0

  const totalActivities = progress.quizzesTaken + progress.summariesMade

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>✦</span> StudyMate AI</div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="navigation">
          {NAV.map(item => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? 'active' : ''}`}
              onClick={() => changePage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">S</div>
          <div>
            <strong>Student</strong>
            <small>Personal workspace</small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR PERSONAL STUDY SPACE</p>
            <h1>{page}</h1>
          </div>
          <div className="topbar-tag">✦ StudyMate AI</div>
        </header>

        {page === 'Dashboard' && (
          <div className="page-content">
            <section className="hero-card">
              <div>
                <span className="hero-kicker">WELCOME BACK 👋</span>
                <h2>Learn smarter.<br />Achieve more.</h2>
                <p>Your personal AI-powered space to organize notes, understand PDFs and practice what you learn.</p>
                <button className="primary-btn" onClick={() => setPage('AI Assistant')}>
                  Ask your AI assistant <span>→</span>
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">✦</div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Your study overview</h2>
                <p>Keep track of your learning activities.</p>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard icon="📝" label="Saved notes" value={notes.length} />
              <StatCard icon="🧠" label="Quizzes taken" value={progress.quizzesTaken} />
              <StatCard icon="📄" label="PDF summaries" value={progress.summariesMade} />
              <StatCard icon="🎯" label="Quiz accuracy" value={`${accuracy}%`} />
            </div>

            <div className="section-heading">
              <div>
                <h2>Study tools</h2>
                <p>Choose what you want to work on today.</p>
              </div>
            </div>

            <div className="tools-grid">
              {[
                ['📝', 'My Notes', 'Write, save and organize your study notes.'],
                ['📄', 'PDF Summarizer', 'Turn long study PDFs into clear summaries.'],
                ['🧠', 'Quiz Generator', 'Generate questions and test your knowledge.'],
                ['📊', 'My Progress', 'Review your quiz performance and activity.'],
                ['🤖', 'AI Assistant', 'Ask questions and learn through conversation.'],
              ].map(([icon, name, description]) => (
                <button className="tool-card" key={name} onClick={() => setPage(name)}>
                  <span className="tool-icon">{icon}</span>
                  <h3>{name}</h3>
                  <p>{description}</p>
                  <span className="tool-link">Open tool →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {page === 'My Notes' && (
          <div className="page-content">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>{editingNote ? 'Edit note' : 'Create a note'}</h2>
                  <p>Your notes are saved in this browser.</p>
                </div>
              </div>
              <input
                className="field"
                placeholder="Note title"
                value={noteTitle}
                onChange={event => setNoteTitle(event.target.value)}
              />
              <textarea
                className="field textarea"
                placeholder="Write your study notes here..."
                rows={6}
                value={noteBody}
                onChange={event => setNoteBody(event.target.value)}
              />
              <div className="button-row">
                <button className="primary-btn" onClick={saveNote}>
                  {editingNote ? 'Update note' : 'Save note'}
                </button>
                {editingNote && (
                  <button className="secondary-btn" onClick={() => {
                    setEditingNote(null)
                    setNoteTitle('')
                    setNoteBody('')
                  }}>Cancel</button>
                )}
              </div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Your saved notes ({notes.length})</h2>
                <p>Search, edit or delete your notes.</p>
              </div>
              <input
                className="search-field"
                placeholder="Search notes..."
                value={noteSearch}
                onChange={event => setNoteSearch(event.target.value)}
              />
            </div>

            <div className="notes-grid">
              {filteredNotes.map(note => (
                <article className="note-card" key={note.id}>
                  <h3>{note.title}</h3>
                  <p>{note.body}</p>
                  <small>{new Date(note.updatedAt).toLocaleString()}</small>
                  <div className="button-row">
                    <button className="secondary-btn" onClick={() => editNote(note)}>Edit</button>
                    <button className="danger-btn" onClick={() => deleteNote(note.id)}>Delete</button>
                  </div>
                </article>
              ))}
              {filteredNotes.length === 0 && (
                <EmptyState icon="📝" title="No notes found" text="Create your first note above." />
              )}
            </div>
          </div>
        )}

        {page === 'PDF Summarizer' && (
          <div className="page-content">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Summarize your PDF</h2>
                  <p>Upload a PDF with selectable text and let AI prepare study notes.</p>
                </div>
              </div>
              <div
                className="upload-box"
                onClick={() => pdfInputRef.current?.click()}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  extractPDF(event.dataTransfer.files?.[0])
                }}
              >
                <span className="upload-icon">📄</span>
                <strong>{pdfName || 'Choose a PDF file or drag it here'}</strong>
                <span>PDF only · Maximum 15 MB</span>
                <button className="secondary-btn" type="button">Browse files</button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={event => extractPDF(event.target.files?.[0])}
                />
              </div>

              {pdfLoading && <p className="status-text">Processing your PDF...</p>}
              {pdfError && <p className="error-text">{pdfError}</p>}
              {pdfText && (
                <div className="pdf-ready">
                  <span>✓ PDF text extracted successfully ({pdfText.length.toLocaleString()} characters)</span>
                  <button className="primary-btn" disabled={pdfLoading} onClick={summarizePDF}>
                    {pdfLoading ? 'Summarizing...' : 'Generate summary'}
                  </button>
                </div>
              )}
            </section>

            {summary && (
              <section className="panel summary-panel">
                <div className="section-heading">
                  <div>
                    <h2>AI summary</h2>
                    <p>{pdfName}</p>
                  </div>
                  <button className="secondary-btn" onClick={() => navigator.clipboard?.writeText(summary)}>
                    Copy summary
                  </button>
                </div>
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                </div>
              </section>
            )}
          </div>
        )}

        {page === 'Quiz Generator' && (
          <div className="page-content">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Create a practice quiz</h2>
                  <p>Generate multiple-choice questions from a topic or uploaded PDF text.</p>
                </div>
              </div>
              <label className="field-label">Topic</label>
              <input
                className="field"
                placeholder="Example: Fire triangle, Biology, Physics..."
                value={quizTopic}
                onChange={event => setQuizTopic(event.target.value)}
              />
              <label className="field-label">Number of questions</label>
              <select className="field select-field" value={quizCount} onChange={event => setQuizCount(Number(event.target.value))}>
                {[5, 10, 15].map(number => <option key={number} value={number}>{number} questions</option>)}
              </select>
              <p className="helper-text">
                {pdfText ? `Your uploaded PDF "${pdfName}" will also be used as study material.` : 'Tip: Upload a PDF in the PDF Summarizer page to use its text here.'}
              </p>
              <button className="primary-btn" onClick={generateQuiz} disabled={quizLoading}>
                {quizLoading ? 'Generating quiz...' : 'Generate quiz →'}
              </button>
              {quizError && <p className="error-text">{quizError}</p>}
            </section>

            {questions.length > 0 && (
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Your quiz</h2>
                    <p>{questions.length} multiple-choice questions</p>
                  </div>
                  {quizSubmitted && <span className="score-pill">Score: {questions.filter((q, i) => answers[i] === q.answer).length}/{questions.length}</span>}
                </div>

                {questions.map((question, index) => (
                  <div className="question-card" key={index}>
                    <h3>{index + 1}. {question.question}</h3>
                    <div className="options-list">
                      {question.options.map((option, optionIndex) => {
                        const selected = answers[index] === optionIndex
                        const correct = question.answer === optionIndex
                        let className = selected ? 'option selected' : 'option'
                        if (quizSubmitted && correct) className += ' correct'
                        if (quizSubmitted && selected && !correct) className += ' incorrect'

                        return (
                          <button
                            key={optionIndex}
                            className={className}
                            disabled={quizSubmitted}
                            onClick={() => setAnswers(previous => ({ ...previous, [index]: optionIndex }))}
                          >
                            <span>{String.fromCharCode(65 + optionIndex)}</span>
                            {option}
                          </button>
                        )
                      })}
                    </div>
                    {quizSubmitted && question.explanation && (
                      <p className="explanation"><strong>Explanation:</strong> {question.explanation}</p>
                    )}
                  </div>
                ))}

                {!quizSubmitted ? (
                  <button className="primary-btn" onClick={submitQuiz}>Submit answers</button>
                ) : (
                  <button className="secondary-btn" onClick={() => {
                    setQuestions([])
                    setAnswers({})
                    setQuizSubmitted(false)
                  }}>Create another quiz</button>
                )}
              </section>
            )}
          </div>
        )}

        {page === 'My Progress' && (
          <div className="page-content">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Your learning progress</h2>
                  <p>Your activity recorded on this device.</p>
                </div>
              </div>
              <div className="stats-grid">
                <StatCard icon="📝" label="Notes created" value={notes.length} />
                <StatCard icon="🧠" label="Quizzes completed" value={progress.quizzesTaken} />
                <StatCard icon="📄" label="PDF summaries" value={progress.summariesMade} />
                <StatCard icon="🎯" label="Accuracy" value={`${accuracy}%`} />
              </div>
              <div className="progress-section">
                <div className="progress-heading">
                  <strong>Overall quiz accuracy</strong>
                  <strong>{accuracy}%</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${accuracy}%` }} />
                </div>
                <p className="helper-text">
                  {progress.totalCorrect} correct answers out of {progress.totalQuestions} questions.
                </p>
              </div>
              <div className="activity-summary">
                <h3>Activity summary</h3>
                <p>Total completed quizzes and summaries: <strong>{totalActivities}</strong></p>
                <p>Notes currently saved: <strong>{notes.length}</strong></p>
              </div>
              <button className="danger-btn" onClick={() => {
                if (window.confirm('Reset all progress statistics? Your notes and chats will not be deleted.')) {
                  setProgress({
                    studySessions: 0,
                    quizzesTaken: 0,
                    totalCorrect: 0,
                    totalQuestions: 0,
                    summariesMade: 0,
                  })
                }
              }}>Reset progress statistics</button>
            </section>
          </div>
        )}

        {page === 'AI Assistant' && (
          <div className="chat-layout">
            <aside className="chat-history">
              <button className="primary-btn full-width" onClick={startNewChat}>＋ New chat</button>
              <p className="nav-label">CHAT HISTORY</p>
              {chats.map(chat => (
                <div className={`history-item ${chat.id === activeChatId ? 'selected' : ''}`} key={chat.id}>
                  <button onClick={() => setActiveChatId(chat.id)}>{chat.title}</button>
                  <button className="history-delete" title="Delete chat" onClick={() => deleteChat(chat.id)}>×</button>
                </div>
              ))}
              {chats.length === 0 && <p className="helper-text">Your conversations will appear here.</p>}
            </aside>

            <section className="chat-main">
              <div className="chat-messages">
                {!activeChat?.messages?.length && (
                  <div className="chat-welcome">
                    <span>✦</span>
                    <h2>What would you like to learn?</h2>
                    <p>Ask questions, understand difficult topics or get help with your studies.</p>
                  </div>
                )}

                {activeChat?.messages?.map((message, index) => (
                  <div className={`chat-message ${message.role}`} key={index}>
                    <div className="chat-avatar">{message.role === 'user' ? '👤' : '✦'}</div>
                    <div className="markdown-content">
                      {message.role === 'assistant'
                        ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        : <p>{message.content}</p>}
                    </div>
                  </div>
                ))}

                {chatLoading && <p className="status-text">✦ StudyMate AI is thinking...</p>}
                <div ref={chatBottomRef} />
              </div>

              <div className="chat-composer">
                <textarea
                  value={chatInput}
                  rows={1}
                  placeholder="Message StudyMate AI..."
                  onChange={event => setChatInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      sendChatMessage()
                    }
                  }}
                />
                <button
                  className="send-btn"
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading}
                >↑</button>
              </div>
              <p className="chat-disclaimer">AI can make mistakes. Check important information.</p>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export default App
