import { useRef, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload: (file: File) => Promise<string>;
}

interface ToolbarAction {
  label: string;
  icon: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const toolbarActions: ToolbarAction[] = [
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { label: 'Italic', icon: 'I', prefix: '*', suffix: '*' },
  { label: 'Heading', icon: 'H', prefix: '## ', suffix: '', block: true },
  { label: 'Link', icon: '🔗', prefix: '[', suffix: '](url)' },
  { label: 'Image', icon: '🖼', prefix: '![alt](', suffix: ')' },
  { label: 'Code', icon: '<>', prefix: '```\n', suffix: '\n```', block: true },
  { label: 'Quote', icon: '>', prefix: '> ', suffix: '', block: true },
  { label: 'Unordered List', icon: '•', prefix: '- ', suffix: '', block: true },
  { label: 'Ordered List', icon: '1.', prefix: '1. ', suffix: '', block: true },
  { label: 'Horizontal Rule', icon: '—', prefix: '\n---\n', suffix: '', block: true },
  { label: 'Footnote', icon: '¹', prefix: '', suffix: '' },
];

/**
 * Scan content for `[^N]` footnote references and return the next
 * available number (max existing + 1, or 1 if none found).
 */
function getNextFootnoteNumber(content: string): number {
  const matches = content.match(/\[\^(\d+)\]/g);
  if (!matches) return 1;

  const used = matches.map((m) => {
    const n = m.match(/\[\^(\d+)\]/);
    return n ? parseInt(n[1], 10) : 0;
  });

  return Math.max(...used) + 1;
}

export function MarkdownEditor({
  value,
  onChange,
  onImageUpload,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertMarkdown = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.slice(start, end);

      let newText: string;
      let cursorPos: number;

      if (action.block && !selectedText) {
        const beforeCursor = value.slice(0, start);
        const needsNewline =
          beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
        const prefix = (needsNewline ? '\n' : '') + action.prefix;
        newText =
          value.slice(0, start) + prefix + action.suffix + value.slice(end);
        cursorPos = start + prefix.length;
      } else {
        newText =
          value.slice(0, start) +
          action.prefix +
          selectedText +
          action.suffix +
          value.slice(end);
        cursorPos = selectedText
          ? start + action.prefix.length + selectedText.length + action.suffix.length
          : start + action.prefix.length;
      }

      onChange(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [value, onChange],
  );

  const insertFootnote = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const num = getNextFootnoteNumber(value);

    const ref = `[^${num}]`;
    const def = `[^${num}]: `;

    // Insert the inline reference at the cursor position
    const before = value.slice(0, start);
    const after = value.slice(end);
    const withRef = before + ref + after;

    // Append the definition at the very end, separated by a blank line
    const trimmed = withRef.trimEnd();
    const newText = (trimmed.length > 0 ? trimmed + '\n\n' : '') + def;

    onChange(newText);

    // Move cursor to the end of the definition so the user can type immediately
    const cursorPos = newText.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
      textarea.scrollTop = textarea.scrollHeight;
    });
  }, [value, onChange]);

  const handleToolbarClick = useCallback(
    (action: ToolbarAction) => {
      if (action.label === 'Image') {
        fileInputRef.current?.click();
        return;
      }
      if (action.label === 'Footnote') {
        insertFootnote();
        return;
      }
      insertMarkdown(action);
    },
    [insertMarkdown, insertFootnote],
  );

  const handleImageFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const url = await onImageUpload(file);
        const textarea = textareaRef.current;
        const cursorPos = textarea?.selectionStart ?? value.length;
        const imageMarkdown = `![${file.name}](${url})`;
        const newValue =
          value.slice(0, cursorPos) + imageMarkdown + value.slice(cursorPos);
        onChange(newValue);
      } catch {
        // Upload failed; parent should handle error display
      }

      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [value, onChange, onImageUpload],
  );

  return (
    <div className="flex flex-col rounded-xl border border-surface-300 overflow-hidden bg-surface-50">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-surface-300 bg-surface-100 overflow-x-auto">
        {toolbarActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => handleToolbarClick(action)}
            title={action.label}
            aria-label={action.label}
            className="flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-md text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-200 transition-colors duration-150 font-mono shrink-0"
          >
            {action.icon}
          </button>
        ))}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFile}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Editor and preview panes */}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-surface-300 min-h-[400px]">
        {/* Editor pane */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 text-xs text-gray-500 font-mono border-b border-surface-300 bg-surface-100/50">
            Markdown
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your markdown here..."
            spellCheck={false}
            className="flex-1 w-full p-4 bg-transparent text-gray-200 text-sm font-mono leading-relaxed placeholder-gray-600 resize-none focus:outline-none"
          />
        </div>

        {/* Preview pane */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 text-xs text-gray-500 font-mono border-b border-surface-300 bg-surface-100/50">
            Preview
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {value.trim() ? (
              <div className="prose-blog prose prose-invert prose-sm max-w-none text-gray-300">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                Preview will appear here...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
