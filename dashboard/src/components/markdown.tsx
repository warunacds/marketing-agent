import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-pre:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
