import { useState, useEffect, useRef, useCallback } from 'react'
import { useReactFlow } from 'reactflow'
import {
  TextAlignLeft, TextAlignCenter, TextAlignRight,
  TextB, TextItalic, Trash, DotsSixVertical,
} from '@phosphor-icons/react'
import {
  updateTextNode as dbUpdateTextNode,
  deleteTextNode as dbDeleteTextNode,
} from '../lib/textNodes.js'

const DEFAULT_WIDTH = 240
const MIN_WIDTH     = 80
const MIN_HEIGHT    = 32

const FONT_SIZES = [
  { label: 'S',  px: 13 },
  { label: 'M',  px: 18 },
  { label: 'L',  px: 24 },
  { label: 'XL', px: 36 },
]

// ax/ay: which edge this handle moves ('left'|'right'|null, 'top'|'bottom'|null)
const HANDLES = [
  { id: 'nw', cx: 0,   cy: 0,   cursor: 'nwse-resize', ax: 'left',  ay: 'top'    },
  { id: 'n',  cx: 0.5, cy: 0,   cursor: 'ns-resize',   ax: null,    ay: 'top'    },
  { id: 'ne', cx: 1,   cy: 0,   cursor: 'nesw-resize', ax: 'right', ay: 'top'    },
  { id: 'e',  cx: 1,   cy: 0.5, cursor: 'ew-resize',   ax: 'right', ay: null     },
  { id: 'se', cx: 1,   cy: 1,   cursor: 'nwse-resize', ax: 'right', ay: 'bottom' },
  { id: 's',  cx: 0.5, cy: 1,   cursor: 'ns-resize',   ax: null,    ay: 'bottom' },
  { id: 'sw', cx: 0,   cy: 1,   cursor: 'nesw-resize', ax: 'left',  ay: 'bottom' },
  { id: 'w',  cx: 0,   cy: 0.5, cursor: 'ew-resize',   ax: 'left',  ay: null     },
]

export default function TextNode({ id, data, xPos, yPos }) {
  const { setNodes, getViewport } = useReactFlow()

  const width    = data.width    ?? DEFAULT_WIDTH
  const height   = data.height   ?? null
  const fontSize = data.fontSize ?? 24
  const align    = data.align    ?? 'left'

  const [editing,   setEditing]   = useState(data.editing ?? false)
  const [isBold,    setIsBold]    = useState(false)
  const [isItalic,  setIsItalic]  = useState(false)

  const editorRef = useRef(null)
  const boxRef    = useRef(null)
  const dragRef   = useRef(null)

  // ── Enter edit mode when data.editing flips true ──────────────────────────
  useEffect(() => {
    if (data.editing && !editing) setEditing(true)
  }, [data.editing]) // eslint-disable-line

  // ── Initialize editor content + focus on edit mode entry ─────────────────
  useEffect(() => {
    const el = editorRef.current
    if (!editing || !el) return
    el.innerHTML = data.text ?? ''
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }, [editing]) // eslint-disable-line

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Translate the in-memory data keys to the DB column names used by
  // dbUpdateTextNode (which takes camelCase arguments).
  const persistPatch = useCallback((patch) => {
    const dbPatch = {}
    if (patch.text     !== undefined) dbPatch.contentHtml = patch.text
    if (patch.width    !== undefined) dbPatch.width       = patch.width
    if (patch.height   !== undefined) dbPatch.height      = patch.height
    if (patch.fontSize !== undefined) dbPatch.fontSize    = patch.fontSize
    if (patch.align    !== undefined) dbPatch.align       = patch.align
    if (Object.keys(dbPatch).length === 0) return
    dbUpdateTextNode(id, dbPatch).catch(console.error)
  }, [id])

  const update = useCallback((patch) => {
    setNodes((nds) => nds.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
    ))
    persistPatch(patch)
  }, [id, setNodes, persistPatch])

  const save = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? ''
    setNodes((nds) => nds.map((n) =>
      n.id === id
        ? { ...n, draggable: true, dragHandle: undefined, data: { ...n.data, text: html, editing: false } }
        : n
    ))
    setEditing(false)
    // Persist the final text content. `editing` is UI-only and not stored in DB.
    persistPatch({ text: html })
  }, [id, setNodes, persistPatch])

  const deleteNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    dbDeleteTextNode(id).catch(console.error)
  }, [id, setNodes])

  const syncSelectionState = () => {
    setIsBold(document.queryCommandState('bold'))
    setIsItalic(document.queryCommandState('italic'))
  }

  // execCommand-based bold/italic: apply to selection only
  const execBold = (e) => {
    e.preventDefault()
    editorRef.current?.focus()
    document.execCommand('bold', false, null)
    syncSelectionState()
  }

  const execItalic = (e) => {
    e.preventDefault()
    editorRef.current?.focus()
    document.execCommand('italic', false, null)
    syncSelectionState()
  }

  // ── Resize drag ───────────────────────────────────────────────────────────
  const startResize = useCallback((handle, e) => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      handle,
      startX:      e.clientX,
      startY:      e.clientY,
      startWidth:  width,
      startHeight: boxRef.current ? boxRef.current.offsetHeight : (height ?? MIN_HEIGHT),
      startNodeX:  xPos,
      startNodeY:  yPos,
      zoom:        getViewport().zoom,
    }
  }, [width, height, xPos, yPos, getViewport])

  useEffect(() => {
    // Track the latest computed values during drag so we can persist them
    // once the user releases the mouse (instead of writing on every pixel).
    const latest = { dirty: false, x: 0, y: 0, width: 0, height: null }

    const onMove = (e) => {
      const drag = dragRef.current
      if (!drag) return
      const { handle, zoom, startX, startY, startWidth, startHeight, startNodeX, startNodeY } = drag

      const rawDx = (e.clientX - startX) / zoom
      const rawDy = (e.clientY - startY) / zoom

      let newWidth  = startWidth
      let newHeight = startHeight
      let newX      = startNodeX
      let newY      = startNodeY

      // Horizontal: drag right on the right edge increases width; drag left on left edge increases width
      if (handle.ax === 'right') {
        newWidth = Math.max(MIN_WIDTH, startWidth + rawDx)
      } else if (handle.ax === 'left') {
        const clamped = Math.max(MIN_WIDTH, startWidth - rawDx)
        newX     = startNodeX + (startWidth - clamped)
        newWidth = clamped
      }

      // Vertical: drag down on the bottom edge increases height; drag up on top edge increases height
      if (handle.ay === 'bottom') {
        newHeight = Math.max(MIN_HEIGHT, startHeight + rawDy)
      } else if (handle.ay === 'top') {
        const clamped = Math.max(MIN_HEIGHT, startHeight - rawDy)
        newY      = startNodeY + (startHeight - clamped)
        newHeight = clamped
      }

      setNodes((nds) => nds.map((n) => {
        if (n.id !== id) return n
        const committedHeight = handle.ay ? newHeight : n.data.height
        latest.dirty  = true
        latest.x      = newX
        latest.y      = newY
        latest.width  = newWidth
        latest.height = committedHeight
        return {
          ...n,
          position: { x: newX, y: newY },
          data: {
            ...n.data,
            width:  newWidth,
            height: committedHeight,
          },
        }
      }))
    }

    const onUp = () => {
      dragRef.current = null
      if (latest.dirty) {
        dbUpdateTextNode(id, {
          positionX: latest.x,
          positionY: latest.y,
          width:     latest.width,
          height:    latest.height,
        }).catch(console.error)
        latest.dirty = false
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [id, setNodes])

  // ── Styles ────────────────────────────────────────────────────────────────
  const textStyle = {
    fontSize,
    textAlign:  align,
    fontFamily: 'Inter, sans-serif',
    color:      '#374151',
    lineHeight: 1.35,
    wordBreak:  'break-word',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width }}>

      {/* Floating toolbar */}
      {editing && (
        <div
          className="absolute flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5"
          style={{ bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 20 }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
        >
          {/* Grip handle — drag this to move the text block */}
          <div
            className="text-node-drag-handle flex items-center self-stretch pr-2 mr-1 border-r border-gray-200 text-gray-300 hover:text-gray-400 transition-colors"
            style={{ cursor: 'grab' }}
            title="Drag to move"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <DotsSixVertical size={14} weight="bold" />
          </div>

          {FONT_SIZES.map(({ label, px }) => (
            <button
              key={label}
              className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${fontSize === px ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
              onClick={() => update({ fontSize: px })}
            >{label}</button>
          ))}

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <button
            className={`p-1 rounded transition-colors ${align === 'left'   ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            onClick={() => update({ align: 'left' })}
          ><TextAlignLeft size={14} weight="bold" /></button>
          <button
            className={`p-1 rounded transition-colors ${align === 'center' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            onClick={() => update({ align: 'center' })}
          ><TextAlignCenter size={14} weight="bold" /></button>
          <button
            className={`p-1 rounded transition-colors ${align === 'right'  ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            onClick={() => update({ align: 'right' })}
          ><TextAlignRight size={14} weight="bold" /></button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Bold / Italic use onMouseDown so execCommand fires before blur */}
          <button
            className={`p-1 rounded transition-colors ${isBold   ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseDown={execBold}
          ><TextB size={14} weight="bold" /></button>
          <button
            className={`p-1 rounded transition-colors ${isItalic ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
            onMouseDown={execItalic}
          ><TextItalic size={14} weight="bold" /></button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <button
            className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            onClick={deleteNode}
          ><Trash size={14} weight="bold" /></button>
        </div>
      )}

      {/* Content box with dashed border + resize handles when editing */}
      <div
        ref={boxRef}
        style={{
          position:     'relative',
          border:       editing ? '1.5px dashed #94a3b8' : '1.5px solid transparent',
          borderRadius: 4,
          padding:      8,
          minHeight:    MIN_HEIGHT,
          ...(height ? { height } : {}),
        }}
      >
        {/* 8 resize handles */}
        {editing && HANDLES.map((h) => (
          <div
            key={h.id}
            style={{
              position:        'absolute',
              width:           8,
              height:          8,
              left:            `calc(${h.cx * 100}% - 4px)`,
              top:             `calc(${h.cy * 100}% - 4px)`,
              backgroundColor: 'white',
              border:          '2px solid #64748b',
              borderRadius:    2,
              cursor:          h.cursor,
              zIndex:          10,
            }}
            onMouseDown={(e) => startResize(h, e)}
          />
        ))}

        {/* Editor: contenteditable for per-selection bold/italic */}
        {editing ? (
          <div
            key="editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type something…"
            style={{ ...textStyle, outline: 'none', minHeight: MIN_HEIGHT - 16 }}
            onInput={syncSelectionState}
            onKeyUp={syncSelectionState}
            onMouseUp={syncSelectionState}
            onSelect={syncSelectionState}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); save() }
            }}
          />
        ) : (
          <div
            key="display"
            style={textStyle}
            onDoubleClick={() => {
              setNodes((nds) => nds.map((n) =>
                n.id === id ? { ...n, draggable: true, dragHandle: '.text-node-drag-handle', data: { ...n.data, editing: true } } : n
              ))
              setEditing(true)
            }}
          >
            {data.text
              ? <span dangerouslySetInnerHTML={{ __html: data.text }} />
              : <span style={{ color: '#d1d5db', fontStyle: 'italic', fontWeight: 400, fontSize: 14 }}>Double-click to edit</span>
            }
          </div>
        )}
      </div>
    </div>
  )
}
