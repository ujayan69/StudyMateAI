
import { useState } from 'react'

const menuItems = [
  { name: 'Dashboard', icon: '🏠' },
  { name: 'My Notes', icon: '📝' },
  { name: 'PDF Summarizer', icon: '📄' },
  { name: 'Quiz Generator', icon: '🧠' },
  { name: 'My Progress', icon: '📊' },
  { name: 'AI Assistant', icon: '🤖' },
]

const features = [
  { name: 'My Notes', icon: '📝', desc: 'Create and manage your study notes.' },
  { name: 'PDF Summarizer', icon: '📄', desc: 'Summarize your study materials.' },
  { name: 'Quiz Generator', icon: '🧠', desc: 'Practice with AI-generated quizzes.' },
  { name: 'My Progress', icon: '📊', desc: 'Track your learning progress.' },
]

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAskAI = async () => {
    if (!question.trim()) {
      setAnswer('Please type a question first!')
      return
    }

    setLoading(true)
    setAnswer('')

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.')
      }

      setAnswer(data.answer || 'No answer received.')
    } catch (error) {
      setAnswer(error.message || 'Could not connect to the AI assistant.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #0d0b18; color: #fff; font-family: Arial, sans-serif; }
        .app { display: flex; min-height: 100vh; background: #0d0b18; }
        .sidebar { width: 245px; padding: 28px 18px; background: #151226; border-right: 1px solid #29243f; flex-shrink: 0; }
        .brand { font-size: 23px; font-weight: bold; margin: 5px 8px 40px; color: #b79aff; }
        .nav-item { width: 100%; display: flex; gap: 13px; align-items: center; padding: 14px; margin: 7px 0; border: 0; border-radius: 10px; color: #aaa4c2; background: transparent; cursor: pointer; text-align: left; font-size: 14px; }
        .nav-item.active, .nav-item:hover { background: #30264f; color: white; }
        .main { flex: 1; padding: 35px; min-width: 0; }
        .top { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 35px; }
        .top h1 { margin: 0; font-size: 27px; }
        .muted { color: #aaa4bd; font-size: 14px; }
        .welcome { padding: 28px; border-radius: 18px; background: linear-gradient(120deg,#39256d,#6c3c9c); margin-bottom: 28px; }
        .welcome h2 { margin: 0 0 10px; font-size: 25px; }
        .welcome p { color: #e3d9f8; }
        .section-title { font-size: 19px; margin: 28px 0 18px; }
        .cards { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }
        .card { background: #19162b; border: 1px solid #302b46; padding: 23px; border-radius: 15px; }
        .card-icon { font-size: 27px; }
        .card h3 { margin: 14px 0 8px; }
        .card p { color: #aaa4bd; font-size: 14px; line-height: 1.5; }
        .ai-box { background: #19162b; border: 1px solid #302b46; border-radius: 16px; padding: 24px; }
        .search-row { display: flex; gap: 12px; margin-top: 18px; }
        .search-box { flex: 1; min-width: 0; background: #0f0d1b; border: 1px solid #41375d; border-radius: 10px; padding: 15px; color: white; font-size: 15px; outline: none; }
        .primary-btn { background: #8654db; border: 0; color: white; padding: 14px 22px; border-radius: 10px; cursor: pointer; font-weight: bold; }
        .primary-btn:disabled { opacity: .6; cursor: wait; }
        .ai-answer { white-space: pre-wrap; line-height: 1.7; color: #e4dcf8; background: #100e1d; border-radius: 10px; padding: 18px; margin-top: 20px; }
        @media(max-width:700px) {
          .sidebar { width: 75px; padding: 20px 8px; }
          .brand { font-size: 0; margin: 8px 0 30px; }
          .brand:first-letter { font-size: 23px; }
          .nav-item { justify-content: center; font-size: 0; padding: 14px 5px; }
          .nav-item span { font-size: 20px; }
          .main { padding: 20px 14px; }
          .cards { grid-template-columns: 1fr; }
          .search-row { flex-direction: column; }
          .top h1 { font-size: 22px; }
        }
      `}</style>

      <aside className="sidebar">
        <div className="brand">StudyMate AI ✨</div>
        {menuItems.map((item) => (
          <button
            key={item.name}
            className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
            onClick={() => setActiveTab(item.name)}
          >
            <span>{item.icon}</span>
            {item.name}
          </button>
        ))}
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>{activeTab}</h1>
            <p className="muted">Your personal AI-powered study space.</p>
          </div>
          <div>👨‍🎓 Student</div>
        </div>

        {activeTab === 'Dashboard' && (
          <>
            <section className="welcome">
              <h2>Welcome to StudyMate AI! 👋</h2>
              <p>Learn smarter, study better, and achieve your goals.</p>
            </section>

            <h2 className="section-title">Your Study Tools</h2>
            <div className="cards">
              {features.map((feature) => (
                <div className="card" key={feature.name}>
                  <div className="card-icon">{feature.icon}</div>
                  <h3>{feature.name}</h3>
                  <p>{feature.desc}</p>
                  <button
                    className="primary-btn"
                    onClick={() => setActiveTab(feature.name)}
                  >
                    Open →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'AI Assistant' && (
          <section className="ai-box">
            <h2>🤖 Ask your AI Assistant</h2>
            <p className="muted">Ask questions and get help with your studies.</p>

            <div className="search-row">
              <input
                className="search-box"
                type="text"
                placeholder="Ask anything about your studies..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) handleAskAI()
                }}
              />
              <button
                className="primary-btn"
                onClick={handleAskAI}
                disabled={loading}
              >
                {loading ? 'Thinking...' : 'Ask AI →'}
              </button>
            </div>

            {answer && <div className="ai-answer">{answer}</div>}
          </section>
        )}

        {activeTab !== 'Dashboard' && activeTab !== 'AI Assistant' && (
          <section className="card">
            <h2>{activeTab}</h2>
            <p>This study tool is coming soon. Stay tuned!</p>
            <button className="primary-btn" onClick={() => setActiveTab('Dashboard')}>
              Back to Dashboard
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
src/App.jsx