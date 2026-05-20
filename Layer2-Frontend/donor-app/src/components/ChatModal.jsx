import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getClaimThread, getClaimMessages, sendClaimMessage, markClaimMessagesRead } from '../services/api'
import '../styles/ChatModal.css'

const POLL_INTERVAL_MS = 4000

export default function ChatModal({ claimId, listingTitle, orgCode, onClose }) {
  const [messages, setMessages] = useState([])
  const [thread, setThread] = useState(null)
  const [inputText, setInputText] = useState('')
  const [status, setStatus] = useState('loading')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch latest messages and mark them as read
  const fetchMessages = useCallback(async () => {
    try {
      const rows = await getClaimMessages(claimId, orgCode)
      setMessages(rows.map((m) => ({
        id: m.message_id,
        sender: m.sender_org_code,
        text: m.content,
        time: m.sent_at,
      })))
      markClaimMessagesRead(claimId, orgCode).catch(() => {})
    } catch {
      // Non-fatal — keep polling
    }
  }, [claimId, orgCode])

  // Load thread on mount and start polling
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const t = await getClaimThread(claimId, orgCode)
        if (cancelled) return
        setThread(t)
        setStatus(t.is_closed ? 'closed' : 'ready')
        await fetchMessages()
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    init()

    pollRef.current = setInterval(() => {
      if (!cancelled) fetchMessages()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(pollRef.current)
    }
  }, [claimId, orgCode, fetchMessages])

  // Send a new message from the current user
  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending || status !== 'ready') return

    setSending(true)
    try {
      const msg = await sendClaimMessage(claimId, { senderOrgCode: orgCode, content: text })
      setMessages((prev) => [
        ...prev,
        { id: msg.message_id, sender: msg.sender_org_code, text: msg.content, time: msg.sent_at },
      ])
      setInputText('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  // Send on Enter, allow Shift+Enter for new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Close modal when clicking outside the dialog
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Check if a message was sent by the current org
  const isMe = (sender) => String(sender || '').toUpperCase() === String(orgCode || '').toUpperCase()

  const statusLabel = {
    loading: 'Connecting...',
    ready: 'Claim chat - Messages are stored securely',
    closed: 'Chat closed - pickup confirmed.',
    error: 'Connection error. Please close and try again.',
  }

  return (
    <div className="chat-overlay" onClick={handleOverlayClick}>
      <div className="chat-modal" role="dialog" aria-modal="true" aria-label="Claim Chat">

        {/* Modal header with title and close button */}
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="material-symbols-outlined chat-header-icon">forum</span>
            <div>
              <h3 className="chat-title">{listingTitle}</h3>
              {thread && (
                <p className="chat-subtitle">
                  {thread.donor_org_code} to {thread.claiming_org_code}
                </p>
              )}
            </div>
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="Close chat">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Status bar showing connection or thread state */}
        <div className={`chat-status-bar status-${status}`}>
          <span className="material-symbols-outlined chat-status-icon">
            {status === 'ready' && 'chat'}
            {status === 'loading' && 'sync'}
            {status === 'closed' && 'check_circle'}
            {status === 'error' && 'error'}
          </span>
          <span className="chat-status-text">{statusLabel[status]}</span>
        </div>

        {/* Message list area */}
        <div className="chat-messages">
          {messages.length === 0 && status === 'ready' && (
            <div className="chat-empty">
              <span className="material-symbols-outlined">chat_bubble_outline</span>
              <p>No messages yet. Start the conversation.</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-row ${isMe(m.sender) ? 'chat-row-me' : 'chat-row-them'}`}
            >
              <div className={`chat-bubble ${isMe(m.sender) ? 'bubble-me' : 'bubble-them'}`}>
                <span className="bubble-sender">{isMe(m.sender) ? 'You' : m.sender}</span>
                <span className="bubble-text">{m.text}</span>
                <span className="bubble-time">
                  {m.time
                    ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input row shown only when chat is active */}
        {status === 'ready' && (
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Type a message... (Enter to send)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              disabled={sending}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              aria-label="Send message"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
