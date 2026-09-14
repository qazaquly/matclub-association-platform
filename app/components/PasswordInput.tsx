"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({
  label,
  name,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${name}-error`;
  return <label className={error ? "field-invalid" : undefined}>{label}
    <span className="password-input-wrap">
      <input
        type={visible ? "text" : "password"}
        name={name}
        required
        minLength={name === "password" && autoComplete === "current-password" ? undefined : 7}
        maxLength={128}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <button
        type="button"
        className="password-visibility"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Құпиясөзді жасыру" : "Құпиясөзді көрсету"}
        aria-pressed={visible}
      >{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </span>
    {error && <small className="field-error" id={errorId}>{error}</small>}
  </label>;
}
