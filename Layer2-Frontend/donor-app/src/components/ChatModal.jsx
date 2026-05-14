import React, { useState, useEffect, useRef } from 'react'
import {
  generateEphemeralKeyPair,
  exportPublicKeyJwk,
  importPublicKeyJwk,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from '../utils/cryptoChat'
import { getChatSession, uploadPublicKey, getChatMessages, terminateChat } from '../services/api'
import '../styles/ChatModal.css'

/**
 * Derive the WebSocket base URL from VITE_API_URL.
 * Dev:  same-origin proxy at ws://localhost:3004
 * Prod: wss://api.crisislink.com (strip /api suffix if present)
 */
function getWsBase() {
  const apiUrl = import.meta.env.VITE_API_URL || ''
  if (!apiUrl || apiUrl === '/api') {
    // Use same-origin Vite proxy
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
  return apiUrl
    .replace(/^https:/, 'wss:')
    .replace(/^http:/, 'ws:')
    .replace(/\/api\/?$/, '')
}

/**
 * ChatModal
 *
 * Props:
 *   listingId     {string}   — UUID of the food listing
 *   listingTitle  {string}   — display name for the header
 *   myOrgCode     {string}   — the current user's org code
 *   onClose       {function} — called when modal is dismissed
 *   onFoodCollected {function(listingId)} — called after successful "Food Collected"
 */
export default function ChatModal({
  listingId,
  listingTitle,
  myOrgCode,
  onClose,
  onFoodCollected,
}) {
  const [messages, setMessages]         = useState([])
  const [inputText, setInputText]       = useState('')
  const [chatStatus, setChatStatus]     = useState('init')
  // init | waiting | ready | terminated | error
  const [sessionInfo, setSessionInfo]   = useState(null)
  const [sending, setSending]           = useState(false)
  const [terminating, setTerminating]   = useState(false)

  // Refs hold mutable values that WebSocket callbacks need without stale-closure issues
  const privateKeyRef = useRef(null)   // ephemeral EC private key — never sent anywhere
  const aesKeyRef     = useRef(null)   // derived AES-256-GCM key — non-extractable
  const wsRef         = useRef(null)
  const messagesEndRef = useRef(null)

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Main setup effect ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // 1. Generate ephemeral key pair for this session
        const kp = await generateEphemeralKeyPair()
        if (cancelled) return
        privateKeyRef.current = kp.privateKey

        // 2. Upload our public key so the other party can derive the shared secret
        const jwk = await exportPublicKeyJwk(kp)
        await uploadPublicKey(listingId, myOrgCode, jwk)
        if (cancelled) return

        // 3. Fetch session info (may already contain the other party's public key)
        const sess = await getChatSession(listingId, myOrgCode)
        if (cancelled) return
        setSessionInfo(sess)

        // 4. Open WebSocket (needed to receive key_ready / messages live)
        openWebSocket(kp.privateKey, sess)

        // 5. If both keys are already present, derive shared key immediately
        await attemptKeyDerivation(kp.privateKey, sess)
      } catch {
        if (!cancelled) setChatStatus('error')
      }
    }

    init()

    return () => {
      cancelled = true
      wsRef.current?.close()
      // Discard ephemeral key material on unmount (forward secrecy)
      privateKeyRef.current = null
      aesKeyRef.current     = null
    }
  }, [listingId, myOrgCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attempt to derive the shared AES key ──────────────────────────────────
  const attemptKeyDerivation = async (privateKey, sess) => {
    const amDonor   = myOrgCode === sess.donorOrgCode
    const theirRaw  = amDonor ? sess.claimerPublicKey : sess.donorPublicKey

    if (!theirRaw) {
      setChatStatus('waiting')
      return
    }

    try {
      const theirKey = await importPublicKeyJwk(JSON.parse(theirRaw))
      const aes = await deriveSharedKey(
        privateKey,
        theirKey,
        sess.donorOrgCode,
        sess.claimerOrgCode,
        listingId
      )
      aesKeyRef.current = aes
      setChatStatus('ready')

      // Load encrypted history and decrypt client-side
      await loadHistory(aes, sess)
    } catch {
      setChatStatus('error')
    }
  }

  // ── Load + decrypt message history ────────────────────────────────────────
  const loadHistory = async (aes, sess) => {
    try {
      const raw = await getChatMessages(listingId, myOrgCode)
      const decoded = await Promise.all(
        raw.map(async (m, i) => {
          try {
            const text = await decryptMessage(aes, m.ciphertext, m.iv)
            return { id: `hist-${i}`, sender: m.senderOrgCode, text, time: m.createdAt }
          } catch {
            return { id: `hist-${i}`, sender: m.senderOrgCode, text: '[unable to decrypt]', time: m.createdAt }
          }
        })
      )
      setMessages(decoded)
    } catch {
      // Non-fatal; user can still chat going forward
    }
  }

  // ── Open WebSocket ─────────────────────────────────────────────────────────
  const openWebSocket = (privateKey, initialSess) => {
    const base = getWsBase()
    const ws   = new WebSocket(`${base}/chat/ws/${listingId}/${myOrgCode}`)
    wsRef.current = ws

    ws.onmessage = async (event) => {
      let data
      try { data = JSON.parse(event.data) } catch { return }

      // ── Chat was terminated (food collected) ──
      if (data.type === 'chat_terminated') {
        aesKeyRef.current     = null
        privateKeyRef.current = null
        setChatStatus('terminated')
        return
      }

      // ── Other party just uploaded their public key ──
      if (data.type === 'key_ready') {
        try {
          const freshSess = await getChatSession(listingId, myOrgCode)
          setSessionInfo(freshSess)
          await attemptKeyDerivation(privateKey, freshSess)
        } catch { /* ignore */ }
        return
      }

      // ── Incoming encrypted message ──
      if (data.type === 'message' && aesKeyRef.current) {
        try {
          const text = await decryptMessage(aesKeyRef.current, data.ciphertext, data.iv)
          setMessages(prev => [
            ...prev,
            {
              id:     `ws-${Date.now()}-${Math.random()}`,
              sender: data.senderOrgCode,
              text,
              time:   data.createdAt,
            },
          ])
        } catch {
          // Decryption failed — key mismatch or corrupted data
        }
      }
    }

    ws.onerror = () => {
      if (chatStatus !== 'terminated') setChatStatus('error')
    }
  }

  // ── Send a message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || !aesKeyRef.current || chatStatus !== 'ready' || sending) return

    setSending(true)
    try {
      const { ciphertext, iv } = await encryptMessage(aesKeyRef.current, text)

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type:          'message',
          senderOrgCode: myOrgCode,
          ciphertext,
          iv,
        }))
        setInputText('')
      }
    } catch { /* ignore send errors */ } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Food Collected — terminate chat ───────────────────────────────────────
  const handleFoodCollected = async () => {
    if (terminating) return
    setTerminating(true)
    try {
      await terminateChat(listingId, myOrgCode)
      aesKeyRef.current     = null
      privateKeyRef.current = null
      onFoodCollected(listingId)
      onClose()
    } catch {
      setTerminating(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isMe      = (sender) => sender === myOrgCode
  const isClaimer = sessionInfo && myOrgCode === sessionInfo.claimerOrgCode

  const statusLabel = {
    init:       'Connecting…',
    waiting:    'Waiting for the other party to join…',
    ready:      'End-to-end encrypted · ECDHE P-256 · AES-256-GCM',
    terminated: 'Chat ended — food collected. All messages deleted.',
    error:      'Connection error. Please close and try again.',
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="chat-overlay" onClick={handleOverlayClick}>
      <div className="chat-modal" role="dialog" aria-modal="true" aria-label="Secure Chat">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="material-symbols-outlined chat-header-icon">forum</span>
            <div>
              <h3 className="chat-title">{listingTitle}</h3>
              {sessionInfo && (
                <p className="chat-subtitle">
                  {sessionInfo.donorOrgCode} ↔ {sessionInfo.claimerOrgCode}
                </p>
              )}
            </div>
          </div>
          <button className="chat-close-btn" onClick={onClose} aria-label="Close chat">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Status banner ─────────────────────────────────────── */}
        <div className={`chat-status-bar status-${chatStatus}`}>
          <span className="material-symbols-outlined chat-status-icon">
            {chatStatus === 'ready'      && 'lock'}
            {chatStatus === 'waiting'    && 'hourglass_top'}
            {chatStatus === 'terminated' && 'check_circle'}
            {chatStatus === 'error'      && 'error'}
            {chatStatus === 'init'       && 'sync'}
          </span>
          <span className="chat-status-text">{statusLabel[chatStatus]}</span>
        </div>

        {/* ── Messages ──────────────────────────────────────────── */}
        <div className="chat-messages">
          {messages.length === 0 && chatStatus === 'ready' && (
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
                <span className="bubble-sender">
                  {isMe(m.sender) ? 'You' : m.sender}
                </span>
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

        {/* ── Input row ─────────────────────────────────────────── */}
        {chatStatus === 'ready' && (
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Type a message… (Enter to send)"
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

        {/* ── Food Collected footer (claimer only) ──────────────── */}
        {isClaimer && chatStatus !== 'terminated' && (
          <div className="chat-footer">
            <p className="chat-footer-hint">
              Physically collected the food? Click below to confirm and close this chat.
              All messages will be permanently deleted.
            </p>
            <button
              className="food-collected-btn"
              onClick={handleFoodCollected}
              disabled={terminating}
            >
              <span className="material-symbols-outlined">inventory</span>
              {terminating ? 'Processing…' : 'Food Collected — End Chat'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
