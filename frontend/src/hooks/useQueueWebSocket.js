import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom React hook to manage real-time WebSocket communication with MediQueue.
 * 
 * Features:
 * - Real-time two-way connection to FastAPI WebSocket endpoint (/ws/queue)
 * - Automatic exponential backoff reconnection
 * - Authoritative state reconciliation upon connect or reconnect
 * - Live event routing for queue updates and status transitions
 * - Clean teardown on unmount
 */
export function useQueueWebSocket({ onEvent, onSync }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected' | 'reconnecting' | 'disconnected'
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Derive WebSocket URL from HTTP API URL
  const getWsUrl = useCallback(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    const wsBase = apiBase.replace(/^http/, 'ws');
    return `${wsBase}/ws/queue`;
  }, []);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnectionStatus('reconnecting');

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Authoritative reconciliation: fetch fresh snapshot from backend on connect/reconnect
        if (onSync) onSync();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          if (onEvent) onEvent(payload);
        } catch {
          // Ignore non-json heartbeats
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('reconnecting');
        wsRef.current = null;

        // Exponential backoff: 1s, 2s, 4s, up to 10s max
        const backoffMs = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          10000
        );
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };

      ws.onerror = () => {
        // onclose is automatically triggered by the browser
      };
    } catch {
      setConnectionStatus('disconnected');
    }
  }, [getWsUrl, onEvent, onSync]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connectionStatus };
}
