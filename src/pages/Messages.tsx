import { useState } from 'react'
import { Send } from 'lucide-react'
import { useDashboard } from '../context/DashboardContext'
import { hashQuery } from '../nav'

export function MessagesPage() {
  const { snapshot, sendMessage } = useDashboard()
  const threads = snapshot!.threads
  const preset = hashQuery('thread')
  const [selected, setSelected] = useState(preset || threads[0]?.id || '')
  const [draft, setDraft] = useState('')
  const thread = threads.find((item) => item.id === selected) ?? threads[0]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p className="sub">Patient conversations from the mobile app.</p>
        </div>
      </div>
      <section className="split-2">
        <article className="card">
          <h2>Inbox</h2>
          <div className="threads mt">
            {threads.map((item) => (
              <button key={item.id} className={thread?.id === item.id ? 'thread-btn is-on' : 'thread-btn'} type="button" onClick={() => setSelected(item.id)}>
                <span>
                  <b>{item.name}</b>
                  <span className="mini">{item.messages[item.messages.length - 1]?.text}</span>
                </span>
                {item.unread > 0 ? <i className="dot pending" /> : <span className="mini">{item.online ? 'Online' : 'Away'}</span>}
              </button>
            ))}
          </div>
        </article>
        {thread ? (
          <article className="card">
            <div className="chat">
              <div>
                <b>{thread.name}</b>
                <div className="mini">{thread.online ? 'Online' : 'Away'}</div>
              </div>
              <div className="bubbles">
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.from === 'staff' ? 'bubble staff' : 'bubble'}>
                    {message.text}
                    <small>{message.at}</small>
                  </div>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  const text = draft
                  void sendMessage(thread.id, text).then((ok) => {
                    if (ok) setDraft('')
                  })
                }}
              >
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${thread.name.split(' ')[0]}…`} aria-label="Message" />
                <button className="send" type="submit" aria-label="Send"><Send size={16} /></button>
              </form>
            </div>
          </article>
        ) : null}
      </section>
    </>
  )
}
