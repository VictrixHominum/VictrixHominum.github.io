import { Fragment, useMemo, useState, useRef, useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload: (file: File) => Promise<string>;
}

interface KeyboardShortcut {
  /** KeyboardEvent.code value, e.g. 'KeyB', 'Digit1' */
  code: string;
  shift?: boolean;
  /** Base key label without modifiers, e.g. 'B', '1', '.' */
  key: string;
}

interface ToolbarAction {
  label: string;
  icon: ReactNode;
  prefix: string;
  suffix: string;
  block?: boolean;
  /** Render a vertical divider before this button */
  divider?: boolean;
  /** Keyboard shortcut (Cmd/Ctrl modifier is implied) */
  shortcut?: KeyboardShortcut;
}

// ---- Alignment SVG icons (16×16, three bars) ----

function AlignLeftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" rx="0.5" />
      <rect x="1" y="7" width="8" height="2" rx="0.5" />
      <rect x="1" y="12" width="11" height="2" rx="0.5" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" rx="0.5" />
      <rect x="4" y="7" width="8" height="2" rx="0.5" />
      <rect x="2.5" y="12" width="11" height="2" rx="0.5" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2" rx="0.5" />
      <rect x="7" y="7" width="8" height="2" rx="0.5" />
      <rect x="4" y="12" width="11" height="2" rx="0.5" />
    </svg>
  );
}

const toolbarActions: ToolbarAction[] = [
  // Text formatting
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**', shortcut: { code: 'KeyB', key: 'B' } },
  { label: 'Italic', icon: 'I', prefix: '*', suffix: '*', shortcut: { code: 'KeyI', key: 'I' } },
  { label: 'Strikethrough', icon: 'S̶', prefix: '~~', suffix: '~~', shortcut: { code: 'KeyD', shift: true, key: 'D' } },

  // Headings
  { label: 'Heading 1', icon: 'H1', prefix: '# ', suffix: '', block: true, divider: true, shortcut: { code: 'Digit1', shift: true, key: '1' } },
  { label: 'Heading 2', icon: 'H2', prefix: '## ', suffix: '', block: true, shortcut: { code: 'Digit2', shift: true, key: '2' } },
  { label: 'Heading 3', icon: 'H3', prefix: '### ', suffix: '', block: true, shortcut: { code: 'Digit3', shift: true, key: '3' } },

  // Alignment (no keyboard shortcuts — less commonly used)
  { label: 'Align Left', icon: <AlignLeftIcon />, prefix: '<div align="left">\n\n', suffix: '\n\n</div>', block: true, divider: true },
  { label: 'Align Center', icon: <AlignCenterIcon />, prefix: '<div align="center">\n\n', suffix: '\n\n</div>', block: true },
  { label: 'Align Right', icon: <AlignRightIcon />, prefix: '<div align="right">\n\n', suffix: '\n\n</div>', block: true },

  // Rich content
  { label: 'Link', icon: '🔗', prefix: '[', suffix: '](url)', divider: true, shortcut: { code: 'KeyK', key: 'K' } },
  { label: 'Image', icon: '🖼', prefix: '![alt](', suffix: ')' },
  { label: 'Code', icon: '<>', prefix: '```\n', suffix: '\n```', block: true, shortcut: { code: 'KeyE', key: 'E' } },
  { label: 'Quote', icon: '>', prefix: '> ', suffix: '', block: true, shortcut: { code: 'Period', shift: true, key: '.' } },
  { label: 'Unordered List', icon: '•', prefix: '- ', suffix: '', block: true, shortcut: { code: 'Digit8', shift: true, key: '8' } },
  { label: 'Ordered List', icon: '1.', prefix: '1. ', suffix: '', block: true, shortcut: { code: 'Digit7', shift: true, key: '7' } },
  { label: 'Horizontal Rule', icon: '—', prefix: '\n---\n', suffix: '', block: true, shortcut: { code: 'Minus', shift: true, key: '-' } },
  { label: 'Footnote', icon: '¹', prefix: '', suffix: '', shortcut: { code: 'KeyF', shift: true, key: 'F' } },
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

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Format a keyboard shortcut for display, e.g. "⌘B" or "Ctrl+B". */
function formatShortcut(sc: KeyboardShortcut): string {
  if (isMac) {
    return sc.shift ? `⌘⇧${sc.key}` : `⌘${sc.key}`;
  }
  return sc.shift ? `Ctrl+Shift+${sc.key}` : `Ctrl+${sc.key}`;
}

// ---- Basic grammar checker ----

interface GrammarIssue {
  message: string;
  line: number;
  text: string;
  suggestion?: string;
}

/**
 * Run lightweight grammar checks on markdown content.
 * Skips code blocks, HTML, and other non-prose lines.
 */
function checkGrammar(content: string): GrammarIssue[] {
  if (!content.trim()) return [];

  const issues: GrammarIssue[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track fenced code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip empty lines, horizontal rules, HTML tags, image-only lines
    if (trimmed === '') continue;
    if (/^---+$/.test(trimmed)) continue;
    if (/^<\/?div[\s>]/.test(trimmed)) continue;
    if (/^!\[.*\]\(.*\)$/.test(trimmed)) continue;

    // Strip inline markdown syntax so we check prose only
    const plain = trimmed
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
      .replace(/!\[.*?\]\(.*?\)/g, '')           // images
      .replace(/[*_~`]+/g, '')                   // emphasis / code markers
      .replace(/^#{1,6}\s+/, '')                 // heading markers
      .replace(/^>\s+/, '')                       // blockquote markers
      .replace(/^[-*]\s+/, '')                    // unordered list markers
      .replace(/^\d+\.\s+/, '')                   // ordered list markers
      .replace(/\[\^\d+\]:?\s?/g, '');            // footnote refs / defs

    if (plain.trim().length < 2) continue;

    // 1. Repeated adjacent words ("the the", "is is")
    const doubleWordRe = /\b(\w{2,})\s+\1\b/gi;
    let match;
    while ((match = doubleWordRe.exec(plain)) !== null) {
      issues.push({
        message: `Repeated word "${match[1]}"`,
        line: i + 1,
        text: match[0],
        suggestion: match[1],
      });
    }

    // 2. Multiple consecutive spaces (not leading whitespace)
    if (/\S {2,}/.test(plain)) {
      issues.push({
        message: 'Extra spaces detected',
        line: i + 1,
        text: (plain.match(/\S( {2,})\S/) ?? [''])[0],
        suggestion: 'Use a single space',
      });
    }

    // 3. Missing capitalisation after sentence-ending punctuation
    const missingCapRe = /[.!?]\s+[a-z]/g;
    while ((match = missingCapRe.exec(plain)) !== null) {
      // Skip common abbreviations
      const prefix = plain.slice(Math.max(0, match.index - 4), match.index + 1);
      if (/\b(e\.g|i\.e|vs|etc|Mr|Mrs|Dr|St|Jr|Sr)\./i.test(prefix)) continue;
      issues.push({
        message: 'Sentence should start with a capital letter',
        line: i + 1,
        text: plain.slice(match.index, match.index + match[0].length + 8).trim(),
      });
    }

    // 4. Opening punctuation without closing (unmatched parentheses / quotes)
    const opens = (plain.match(/\(/g) ?? []).length;
    const closes = (plain.match(/\)/g) ?? []).length;
    if (opens > closes) {
      issues.push({
        message: 'Unclosed parenthesis',
        line: i + 1,
        text: '(',
        suggestion: 'Add a closing )',
      });
    }
  }

  return issues;
}

export function MarkdownEditor({
  value,
  onChange,
  onImageUpload,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const grammarIssues = useMemo(() => checkGrammar(value), [value]);
  const [tooltip, setTooltip] = useState<{
    label: string;
    shortcut?: KeyboardShortcut;
    x: number;
    y: number;
  } | null>(null);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      for (const action of toolbarActions) {
        if (!action.shortcut) continue;
        const sc = action.shortcut;
        if (
          e.code === sc.code &&
          Boolean(e.shiftKey) === Boolean(sc.shift)
        ) {
          e.preventDefault();
          handleToolbarClick(action);
          return;
        }
      }
    },
    [handleToolbarClick],
  );

  return (
    <div className="flex flex-col rounded-xl border border-surface-300 overflow-hidden bg-surface-50">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-surface-300 bg-surface-100 overflow-x-auto">
        {toolbarActions.map((action) => (
          <Fragment key={action.label}>
            {action.divider && (
              <div className="w-px h-5 bg-surface-300 mx-1 shrink-0" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => handleToolbarClick(action)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  label: action.label,
                  shortcut: action.shortcut,
                  x: rect.left + rect.width / 2,
                  y: rect.bottom + 6,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              aria-label={action.label}
              className="flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-md text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-200 transition-colors duration-150 font-mono shrink-0"
            >
              {action.icon}
            </button>
          </Fragment>
        ))}

        {/* Spacer to push shortcuts toggle to the right */}
        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setShowShortcuts((prev) => !prev)}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({
              label: 'Keyboard Shortcuts',
              x: rect.left + rect.width / 2,
              y: rect.bottom + 6,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
          aria-label="Toggle keyboard shortcuts"
          aria-expanded={showShortcuts}
          className={`flex items-center justify-center h-8 px-2 rounded-md text-sm transition-colors duration-150 font-mono shrink-0 ${
            showShortcuts
              ? 'text-primary-400 bg-surface-200'
              : 'text-gray-400 hover:text-gray-100 hover:bg-surface-200'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="1" y="2" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <rect x="3" y="5" width="2" height="1.5" rx="0.3" />
            <rect x="7" y="5" width="2" height="1.5" rx="0.3" />
            <rect x="11" y="5" width="2" height="1.5" rx="0.3" />
            <rect x="3" y="8" width="2" height="1.5" rx="0.3" />
            <rect x="7" y="8" width="2" height="1.5" rx="0.3" />
            <rect x="11" y="8" width="2" height="1.5" rx="0.3" />
            <rect x="5" y="11" width="6" height="1.5" rx="0.3" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setShowGrammar((prev) => !prev)}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({
              label: 'Grammar Check',
              x: rect.left + rect.width / 2,
              y: rect.bottom + 6,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
          aria-label="Toggle grammar check"
          aria-expanded={showGrammar}
          className={`flex items-center gap-1 h-8 px-2 rounded-md text-sm transition-colors duration-150 font-mono shrink-0 ${
            showGrammar
              ? 'text-primary-400 bg-surface-200'
              : 'text-gray-400 hover:text-gray-100 hover:bg-surface-200'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <path d="M2 12 L6 4 L10 12" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="3.5" y1="9.5" x2="8.5" y2="9.5" strokeLinecap="round" />
            <path d="M11 6 L12.5 10 L14 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {grammarIssues.length > 0 && (
            <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-sans font-medium ${
              showGrammar ? 'bg-primary-500/20 text-primary-300' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {grammarIssues.length}
            </span>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFile}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Collapsible keyboard shortcuts reference */}
      {showShortcuts && (
        <div className="px-4 py-3 border-b border-surface-300 bg-surface-100/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
            {toolbarActions
              .filter((a) => a.shortcut)
              .map((a) => (
                <div key={a.label} className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">{a.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-200 border border-surface-300 text-gray-300 font-mono text-[11px] whitespace-nowrap">
                    {formatShortcut(a.shortcut!)}
                  </kbd>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Collapsible grammar issues panel */}
      {showGrammar && (
        <div className="px-4 py-3 border-b border-surface-300 bg-surface-100/50">
          {grammarIssues.length === 0 ? (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 8.5 L6.5 12 L13 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              No grammar issues found
            </p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {grammarIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="text-yellow-400 shrink-0 mt-px">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M8 1 L15 14 H1 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <line x1="8" y1="6" x2="8" y2="10" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="12" r="0.8" />
                    </svg>
                  </span>
                  <span className="text-gray-400">
                    <span className="text-gray-500">Ln {issue.line}:</span>{' '}
                    {issue.message}
                    {issue.suggestion && (
                      <span className="text-gray-500"> — try: &ldquo;{issue.suggestion}&rdquo;</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor and preview panes */}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-surface-300 min-h-[400px]">
        {/* Editor pane — 2× wider than preview */}
        <div className="flex-[2] flex flex-col">
          <div className="px-3 py-1.5 text-xs text-gray-500 font-mono border-b border-surface-300 bg-surface-100/50">
            Markdown
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your markdown here..."
            spellCheck
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

      {/* Floating tooltip (fixed so it's never clipped by overflow) */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 text-xs rounded-md bg-gray-900 border border-surface-300 text-gray-200 whitespace-nowrap pointer-events-none shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.label}
          {tooltip.shortcut && (
            <kbd className="ml-1.5 px-1 py-0.5 rounded bg-surface-200 border border-surface-300 text-gray-400 font-mono text-[10px]">
              {formatShortcut(tooltip.shortcut)}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}
