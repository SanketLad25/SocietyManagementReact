import { useEffect, useRef, useState } from 'react'
import '../styles/emojiPicker.css'

// Curated, not exhaustive — built around the app's 7 event categories plus two general-purpose
// groups (faces, flowers) for events that don't fit a single category, so picking a banner emoji
// stays a quick browse instead of a search problem.
const EMOJI_GROUPS = [
  { label: 'Smilies', emojis: ['😀', '😄', '😁', '😊', '🙂', '😍', '🥰', '😎', '🤩', '😇', '🤗', '😆', '😃', '🥳'] },
  { label: 'Festivals', emojis: ['🎉', '🪔', '🎊', '🎆', '🎇', '🥳', '🎋', '🎐', '🧨', '🕯️', '🌟', '✨', '🎏', '🎎', '🏮'] },
  { label: 'Sports', emojis: ['🏏', '⚽', '🏀', '🏓', '🎾', '🏸', '🏐', '🏉', '🎱', '🥅', '🏹', '🥇', '🏆', '🎳', '🛹'] },
  { label: 'Fitness', emojis: ['🧘', '💪', '🏃', '🤸', '🚴', '🏊', '🤾', '🚵', '🥋', '🤺', '🧗', '🏋️', '⛹️'] },
  { label: 'Cultural', emojis: ['🎭', '🎶', '💃', '🕺', '🎤', '🎻', '🥁', '🎹', '🎺', '🎼', '🎵', '👘'] },
  { label: 'Flowers', emojis: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '💐', '🏵️', '🪷', '🌵', '🌴', '🌲', '🍀', '🌿'] },
  { label: 'Kids', emojis: ['🎨', '🧸', '🎪', '🎈', '🧩', '🪁', '🎠', '🎡', '🎢', '🍭', '🎁', '🖍️'] },
  { label: 'Meetings', emojis: ['💬', '📋', '📊', '🗓️', '📅', '📌', '🗒️', '📁', '🖊️', '📈', '🤝', '📢'] },
  { label: 'Workshops', emojis: ['🔧', '🛠️', '💻', '🔨', '🧰', '⚙️', '🔬', '🧪', '📐', '🖥️', '🔩'] },
]

export default function EmojiPicker({ value, onSelect }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="emoji-picker" ref={rootRef}>
      <button
        type="button"
        className="emoji-picker-trigger"
        aria-label="Choose an emoji"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {value || '🙂'}
      </button>

      {open && (
        <div className="emoji-picker-popover" role="dialog" aria-label="Choose an emoji">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="emoji-picker-group">
              <p className="emoji-picker-group-label">{group.label}</p>
              <div className="emoji-picker-grid">
                {group.emojis.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    className={`emoji-picker-cell ${value === emoji ? 'is-selected' : ''}`}
                    aria-label={`Use ${group.label} emoji ${emoji}`}
                    onClick={() => {
                      onSelect(emoji)
                      setOpen(false)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
