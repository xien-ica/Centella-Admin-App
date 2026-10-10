import { useState, useEffect } from "react"
import { IonIcon } from "@ionic/react"
import { closeOutline, downloadOutline, documentTextOutline, gridOutline } from "ionicons/icons"
import styles from "../styles/PeriodSelectorModal.module.css"

// Format a Date as YYYY-MM-DD using local time (avoids UTC date shifts)
const toInputDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const getPresets = () => {
  const now = new Date()
  const today = toInputDate(now)

  return [
    {
      id: "thisMonth",
      label: "This Month",
      startDate: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: today,
    },
    {
      id: "lastMonth",
      label: "Last Month",
      startDate: toInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    },
    {
      id: "last3Months",
      label: "Last 3 Months",
      startDate: toInputDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      endDate: today,
    },
    {
      id: "thisYear",
      label: "This Year",
      startDate: toInputDate(new Date(now.getFullYear(), 0, 1)),
      endDate: today,
    },
  ]
}

// PDF first = default, Excel second
const FORMATS = [
  { id: "pdf", label: "PDF", hint: "Best for printing & sharing", icon: documentTextOutline },
  { id: "excel", label: "Excel", hint: "Editable spreadsheet (.xlsx)", icon: gridOutline },
]

export function PeriodSelectorModal({ isOpen, onClose, onExport }) {
  const [range, setRange] = useState({ startDate: "", endDate: "" })
  const [format, setFormat] = useState("pdf")
  const [error, setError] = useState("")

  // Reset to "This Month" + PDF every time the modal opens
  useEffect(() => {
    if (isOpen) {
      const { startDate, endDate } = getPresets()[0]
      setRange({ startDate, endDate })
      setFormat("pdf")
      setError("")
    }
  }, [isOpen])

  if (!isOpen) return null

  const presets = getPresets()

  const handlePreset = (preset) => {
    setRange({ startDate: preset.startDate, endDate: preset.endDate })
    setError("")
  }

  const handleChange = (field, value) => {
    setRange((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleExport = () => {
    if (!range.startDate || !range.endDate) {
      setError("Please select both a start and end date.")
      return
    }
    if (range.startDate > range.endDate) {
      setError("Start date must be on or before the end date.")
      return
    }
    onExport({ startDate: range.startDate, endDate: range.endDate }, format)
  }

  const selectedFormat = FORMATS.find((f) => f.id === format)

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Export Income Report</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.group}>
            <label className={styles.label}>File Format</label>
            <div className={styles.formats}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`${styles.formatBtn} ${format === f.id ? styles.formatActive : ""}`}
                  onClick={() => setFormat(f.id)}
                  aria-pressed={format === f.id}
                >
                  <IonIcon icon={f.icon} className={styles.formatIcon} />
                  <span className={styles.formatText}>
                    <span className={styles.formatLabel}>{f.label}</span>
                    <span className={styles.formatHint}>{f.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Quick Select</label>
            <div className={styles.presets}>
              {presets.map((preset) => {
                const isActive =
                  range.startDate === preset.startDate && range.endDate === preset.endDate
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.presetBtn} ${isActive ? styles.presetActive : ""}`}
                    onClick={() => handlePreset(preset)}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Custom Date Range</label>
            <div className={styles.dateRange}>
              <input
                type="date"
                className={styles.input}
                value={range.startDate}
                max={range.endDate || undefined}
                onChange={(e) => handleChange("startDate", e.target.value)}
              />
              <span>to</span>
              <input
                type="date"
                className={styles.input}
                value={range.endDate}
                min={range.startDate || undefined}
                onChange={(e) => handleChange("endDate", e.target.value)}
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={handleExport}>
            <IonIcon icon={downloadOutline} />
            Export to {selectedFormat.label}
          </button>
        </div>
      </div>
    </div>
  )
}