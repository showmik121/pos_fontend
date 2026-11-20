"use client"

import { useState, type InputHTMLAttributes, type ReactNode } from "react"
import { Field } from "./field"

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string
  label: string
  hint?: string
  error?: string | null
  leading?: ReactNode
}

export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand active:bg-brand-soft"
        >
          {visible ? "লুকান" : "দেখান"}
        </button>
      }
    />
  )
}
