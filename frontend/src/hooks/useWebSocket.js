import { useState, useEffect, useRef, useCallback } from 'react';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL     = `${protocol}//${window.location.host}/ws`;
const MAX_BACKOFF = 30_000;

export function useWebSocket() {
  const [messages, setMessages]       = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef      = useRef(null);
  const backoffRef = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen    = () => { if (!mountedRef.current) return; setIsConnected(true); backoffRef.current = 1000; };
    ws.onmessage = e => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        setMessages(prev => [...prev.slice(-199), msg]);
        setLastMessage(msg);
      } catch { /* malformed */ }
    };
    ws.onclose   = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      const delay = Math.min(backoffRef.current, MAX_BACKOFF);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      setTimeout(connect, delay);
    };
    ws.onerror   = () => ws.close();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => { mountedRef.current = false; wsRef.current?.close(); };
  }, [connect]);

  return { messages, lastMessage, isConnected };
}
