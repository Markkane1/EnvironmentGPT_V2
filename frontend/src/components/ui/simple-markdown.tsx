interface SimpleMarkdownProps {
  children: string
}

export function SimpleMarkdown({ children }: SimpleMarkdownProps) {
  const blocks = children
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <>
      {blocks.map((block, index) => {
        if (block.startsWith('- ')) {
          const items = block
            .split('\n')
            .map((line) => line.replace(/^- /, '').trim())
            .filter(Boolean)

          return (
            <ul key={index} className="list-disc pl-5 my-2">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )
        }

        return (
          <p key={index} className="my-1 whitespace-pre-wrap">
            {block}
          </p>
        )
      })}
    </>
  )
}
