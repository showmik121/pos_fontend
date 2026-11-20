"use client"
// Loads once per `key`, aborts the previous request, and turns failures into one short sentence.
// Data is tagged with the key that produced it, so rows from another filter are never shown (or clickable) while a new one loads or after it fails.
import { useEffect, useRef, useState } from "react"
import { friendlyError } from "@/lib/api"

export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data: T } | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load // always the latest closure; the effect re-runs only for key / reload

  useEffect(() => {
    const ctl = new AbortController()
    loadRef
      .current(ctl.signal)
      .then((data) => {
        if (ctl.signal.aborted) return
        setFailed(null)
        setState({ key, data })
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return
        setFailed({ key, message: friendlyError(e) })
      })
    return () => ctl.abort()
  }, [key, version])

  const data = state && state.key === key && !(failed && failed.key === key) ? state.data : null
  const error = failed && failed.key === key ? failed.message : null
  const loading = data === null && error === null
  return { data, error, loading, reload: () => {
      setState(null) // rows from before the change must not stay clickable while the fresh list loads
      setVersion((v) => v + 1)
    },
  }
}
