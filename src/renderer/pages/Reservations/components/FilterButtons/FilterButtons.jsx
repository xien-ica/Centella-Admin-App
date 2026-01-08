import React from 'react'
import styles from './FilterButtons.module.css'

const FilterButtons = ({ currentFilter, setFilter }) => {
  const filters = ['pending', 'approved', 'rejected', 'cancelled', 'completed']

  return (
    <div className={styles.filters}>
      {filters.map(f => (
        <button
          key={f}
          className={`${styles.filterButton} ${currentFilter === f ? styles.filterActive : ''}`}
          onClick={() => setFilter(f)}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      ))}
    </div>
  )
}

export default FilterButtons