import { IonIcon } from "@ionic/react"
import { shieldCheckmarkOutline } from "ionicons/icons"
import { useState, useEffect, memo, useRef } from "react"
import styles from "./loading.module.css"

const STUCK_TIMER_DELAY = 30000 // 30 seconds
const STUCK_MESSAGE = "Looks like it's taking a while... Try restarting the app."

function Loading({ message = "Loading your dashboard..." }) {
  const [displayMessage, setDisplayMessage] = useState(message)
  const [isStuck, setIsStuck] = useState(false)
  const stuckTimerRef = useRef(null)

  useEffect(() => {
    // Update message and reset stuck state
    setDisplayMessage(message)
    setIsStuck(false)

    // Clear existing timer if any
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current)
    }

    // Show "stuck" message after 30 seconds
    stuckTimerRef.current = setTimeout(() => {
      setIsStuck(true)
      setDisplayMessage(STUCK_MESSAGE)
    }, STUCK_TIMER_DELAY)

    return () => {
      if (stuckTimerRef.current) {
        clearTimeout(stuckTimerRef.current)
      }
    }
  }, [message])

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <div className={styles.logoGlow}></div>
          <div className={styles.logoWrapper}>
            <div className={styles.pulseRing}></div>
            <IonIcon icon={shieldCheckmarkOutline} className={styles.logo} />
          </div>
        </div>

        <h1 className={styles.title}>HOA Management</h1>
        <p className={styles.subtitle}>Centella Homes</p>

        <div className={styles.loaderContainer}>
          <div className={styles.loader}>
            <div className={styles.loaderBar}></div>
          </div>
        </div>

        <p className={`${styles.loadingText} ${isStuck ? styles.stuckText : ""}`}>
          {displayMessage}
        </p>
      </div>
    </div>
  )
}

export default memo(Loading)