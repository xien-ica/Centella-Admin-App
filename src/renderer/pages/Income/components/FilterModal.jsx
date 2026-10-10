import { useState, useEffect } from "react"
import { IonIcon } from "@ionic/react"
import { closeOutline, filterOutline, checkmark } from "ionicons/icons"
import styles from "../styles/FilterModal.module.css"

// Matches the "Payment Status" column in the transactions table
const STATUS_OPTIONS = [
  { value: "all", label: "All", color: "#9ca3af" },
  { value: "paid", label: "Paid", color: "#059669" },
  { value: "pending", label: "Pending", color: "#d97706" },
  { value: "cancelled", label: "Cancelled", color: "#dc2626" },
  { value: "refunded", label: "Refunded", color: "#4f46e5" },
]

// YYYY-MM-DD in local time (avoids UTC date shifts)
const toInputDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const getDatePresets = () => {
  const now = new Date()
  const today = toInputDate(now)
  const daysAgo = (n) => toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))

  return [
    { id: "today", label: "Today", start: today, end: today },
    { id: "last7", label: "Last 7 days", start: daysAgo(6), end: today },
    {
      id: "thisMonth",
      label: "This month",
      start: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: today,
    },
    {
      id: "lastMonth",
      label: "Last month",
      start: toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    },
    {
      id: "thisYear",
      label: "This year",
      start: toInputDate(new Date(now.getFullYear(), 0, 1)),
      end: today,
    },
  ]
}

export function FilterModal({
  isOpen,
  onClose,
  filterStatus,
  onStatusChange,
  filterDateRange,
  onDateRangeChange,
  onReset,
  onApply,
}) {
  // Edits stay in a draft until "Apply" is pressed, so closing the modal discards them
  const [status, setStatus] = useState("all")
  const [range, setRange] = useState({ start: "", end: "" })
  const [error, setError] = useState("")

  // Load the currently applied filters each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus(filterStatus || "all")
      setRange({ start: filterDateRange?.start || "", end: filterDateRange?.end || "" })
      setError("")
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const presets = getDatePresets()
  const hasDates = Boolean(range.start || range.end)
  const activeCount = (status !== "all" ? 1 : 0) + (hasDates ? 1 : 0)

  const handleRangeChange = (field, value) => {
    setRange((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleReset = () => {
    setStatus("all")
    setRange({ start: "", end: "" })
    setError("")
    onReset()
  }

  const handleApply = () => {
    if (range.start && range.end && range.start > range.end) {
      setError("The start date must be on or before the end date.")
      return
    }
    onStatusChange(status)
    onDateRangeChange(range)
    onApply()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>
              <IonIcon icon={filterOutline} />
            </span>
            <div>
              <h3 id="filter-modal-title" className={styles.modalTitle}>
                Filter transactions
              </h3>
              <p className={styles.modalSubtitle}>
                {activeCount === 0
                  ? "Showing everything"
                  : `${activeCount} filter${activeCount > 1 ? "s" : ""} selected`}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Payment status */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Payment status</span>
            <div className={styles.chips}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    onClick={() => setStatus(opt.value)}
                    aria-pressed={active}
                  >
                    {active ? (
                      <IonIcon icon={checkmark} className={styles.chipCheck} />
                    ) : (
                      <span className={styles.dot} style={{ background: opt.color }} />
                    )}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date range */}
          <div className={styles.filterGroup}>
            <div className={styles.labelRow}>
              <span className={styles.filterLabel}>Date range</span>
              {hasDates && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setRange({ start: "", end: "" })
                    setError("")
                  }}
                >
                  Clear dates
                </button>
              )}
            </div>

            <div className={styles.chips}>
              {presets.map((p) => {
                const active = range.start === p.start && range.end === p.end
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    onClick={() => {
                      setRange({ start: p.start, end: p.end })
                      setError("")
                    }}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div className={styles.dateRange}>
              <label className={styles.dateField}>
                <span className={styles.dateCaption}>From</span>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={range.start}
                  max={range.end || undefined}
                  onChange={(e) => handleRangeChange("start", e.target.value)}
                />
              </label>
              <label className={styles.dateField}>
                <span className={styles.dateCaption}>To</span>
                <input
                  type="date"
                  className={styles.filterInput}
                  value={range.end}
                  min={range.start || undefined}
                  onChange={(e) => handleRangeChange("end", e.target.value)}
                />
              </label>
            </div>
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} onClick={handleReset}>
            Reset all
          </button>
          <div className={styles.footerActions}>
            <button className={styles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.btnPrimary} onClick={handleApply}>
              Apply filters
              {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}