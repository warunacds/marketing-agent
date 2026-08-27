"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { resolveTodo } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { brandFileLabel } from "@/lib/format"
import type { Todo } from "@/lib/state"

export function OpenQuestionsCard({ product, todos }: { product: string; todos: Todo[] }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (todos.length === 0) return null

  const byFile = new Map<string, Todo[]>()
  for (const t of todos) {
    byFile.set(t.file, [...(byFile.get(t.file) ?? []), t])
  }

  function apply(todo: Todo, key: string) {
    const answer = (answers[key] ?? "").trim()
    if (!answer) {
      toast.error("Type an answer first")
      return
    }
    setBusyKey(key)
    startTransition(async () => {
      const result = await resolveTodo(product, todo.file, todo.text, answer)
      setBusyKey(null)
      if (result.ok) {
        toast.success(`Updated ${brandFileLabel(todo.file)}`, { description: result.output })
      } else if (result.code === "conflict") {
        toast.error("That question changed — reloading", {
          description: result.output.slice(0, 400),
        })
      } else {
        toast.error("Could not apply the answer", { description: result.output.slice(0, 400) })
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Open questions ({todos.length})</CardTitle>
        <CardDescription>Answer these to make the AI more accurate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...byFile.entries()].map(([file, fileTodos]) => (
          <details key={file} className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {brandFileLabel(file)}{" "}
              <span className="font-normal text-muted-foreground">({fileTodos.length})</span>
            </summary>
            <div className="space-y-4 border-t p-3">
              {fileTodos.map((todo) => {
                const key = `${todo.file}:${todo.line}:${todo.text}`
                const busy = busyKey === key
                return (
                  <div key={key} className="space-y-2">
                    <p className="text-sm">{todo.text}</p>
                    <Textarea
                      value={answers[key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                      placeholder="Your answer"
                      className="min-h-16"
                      disabled={busy}
                      aria-label={`Answer for: ${todo.text}`}
                    />
                    {busy ? (
                      <p className="text-sm text-muted-foreground">
                        The AI is updating the file… (takes up to a minute)
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() => apply(todo, key)}
                      >
                        Apply answer
                      </Button>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground">
                …or{" "}
                <Link
                  href={`/p/${product}/knowledge/${encodeURIComponent(file)}`}
                  className="underline hover:text-foreground"
                >
                  edit the file yourself
                </Link>
                .
              </p>
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  )
}
