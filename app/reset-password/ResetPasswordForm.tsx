"use client";

import { useState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";

export function ResetPasswordForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ token, ...Object.fromEntries(form.entries()) }),
      });
      const result = await response.json() as { url?: string; errors?: Record<string, string>; message?: string };
      if (response.ok && result.url) return window.location.assign(result.url);
      setErrors({ ...(result.errors ?? {}), ...(result.message ? { form: result.message } : {}) });
    } catch {
      setErrors({ form: "Құпиясөзді өзгерту мүмкін болмады." });
    } finally {
      setSubmitting(false);
    }
  }
  return <form className="login-form" onSubmit={submit} noValidate><p className="eyebrow dark">Жаңа құпиясөз</p><h2>Құпиясөзді жаңартыңыз</h2>{errors.form && <div className="form-alert" role="alert">{errors.form}</div>}<PasswordInput label="Жаңа құпиясөз" name="password" autoComplete="new-password" error={errors.password} /><PasswordInput label="Құпиясөзді қайталау" name="passwordConfirmation" autoComplete="new-password" error={errors.passwordConfirmation} /><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Сақталуда…" : "Құпиясөзді сақтау"}</button></form>;
}

