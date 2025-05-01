import { useState, useEffect, useRef, useCallback } from 'react';

const useSessionData = (sessionId, forceRefresh = true) => {
  const [sessionData, setSessionData] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const intervalRef = useRef(null);

  // fetch session data from backend
  const fetchSessionData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/session/${sessionId}`);
      const data = await res.json();
      setSessionData(data.session_data);
      setThumbnails(data.session_data.thumbnails || {});
      console.log("Fetched session data:", data.session_data);
    } catch (err) {
      console.error("Error fetching session data:", err);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (forceRefresh && sessionId) {
      intervalRef.current = setInterval(fetchSessionData, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [forceRefresh, sessionId, fetchSessionData]);

  return { sessionData, thumbnails, refresh: fetchSessionData };
};

export default useSessionData;
