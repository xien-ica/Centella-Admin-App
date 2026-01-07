import { useState } from "react"
import { cashOutline, walletOutline, calendarOutline } from "ionicons/icons"
import { useIncome } from "./hooks/useIncome"
import { useFilters } from "./hooks/useFilters"
import { usePagination } from "./hooks/usePagination"
import { exportToExcel } from "./utils/export"
import { Header } from "./components/Header"
import { StatsCard } from "./components/StatsCard"
import { PeriodSelector } from "./components/PeriodSelector"
import { TransactionsTable } from "./components/TransactionsTable"
import { FilterModal } from "./components/FilterModal"
import { PeriodSelectorModal } from "./components/PeriodSelectorModal"
import { Pagination } from "./components/Pagination"
import styles from "./styles/Income.module.css"

// Skeleton Components
function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonIcon}></div>
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonText} style={{ width: '60%', height: '14px' }}></div>
        <div className={styles.skeletonText} style={{ width: '80%', height: '28px', marginTop: '8px' }}></div>
        <div className={styles.skeletonText} style={{ width: '70%', height: '13px', marginTop: '4px' }}></div>
      </div>
    </div>
  )
}

function SkeletonTable() {
  return (
    <div className={styles.skeletonTableContainer}>
      <table className={styles.skeletonTable}>
        <thead>
          <tr>
            {[1, 2, 3, 4, 5].map(i => (
              <th key={i}>
                <div className={styles.skeletonText} style={{ width: '80%', height: '12px', margin: '0 auto' }}></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(row => (
            <tr key={row}>
              {[1, 2, 3, 4, 5].map(col => (
                <td key={col}>
                  <div className={styles.skeletonText} style={{ 
                    width: col === 4 ? '60%' : col === 5 ? '50%' : '80%', 
                    height: '14px', 
                    margin: '0 auto' 
                  }}></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Income() {
  const { reservations, stats, loading } = useIncome()
  const {
    selectedPeriod,
    setSelectedPeriod,
    filterStatus,
    setFilterStatus,
    filterDateRange,
    setFilterDateRange,
    filteredReservations,
    resetFilters,
  } = useFilters(reservations)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showPeriodModal, setShowPeriodModal] = useState(false)

  const { currentItems, currentPage, totalPages, goToPage } = usePagination(filteredReservations, 10)

  const handleExportClick = () => {
    setShowPeriodModal(true)
  }

  const handleExport = async (dateRange) => {
    setShowPeriodModal(false)
    await exportToExcel(filteredReservations, dateRange)
  }

  const handleResetFilters = () => {
    resetFilters()
    setShowFilterModal(false)
  }

  if (loading) {
    return (
      <div className={styles.incomePage}>
        <Header onFilterClick={() => setShowFilterModal(true)} onExportClick={handleExportClick} />

        {/* Skeleton Stats Cards */}
        <div className={styles.statsGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Skeleton Period Selector */}
        <div className={styles.skeletonPeriodSelector}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonPeriodBtn}></div>
          ))}
        </div>

        {/* Skeleton Transactions Section */}
        <div className={styles.transactionsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.skeletonText} style={{ width: '180px', height: '20px' }}></div>
            <div className={styles.skeletonText} style={{ width: '120px', height: '14px' }}></div>
          </div>
          <SkeletonTable />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.incomePage}>
      <Header onFilterClick={() => setShowFilterModal(true)} onExportClick={handleExportClick} />

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <StatsCard
          icon={walletOutline}
          label="Total Income"
          value={`₱${stats.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description={`From ${stats.totalTransactions} Paid Reservations`}
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
        />
        <StatsCard
          icon={calendarOutline}
          label="Monthly Income"
          value={`₱${stats.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description="Current Month"
          gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
        />
        <StatsCard
          icon={cashOutline}
          label="Pending Payments"
          value={`₱${stats.pendingPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          description={`${stats.pendingTransactions} Pending Payments`}
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
        />
      </div>

      <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />

      {/* Recent Transactions */}
      <div className={styles.transactionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Income Transactions</h2>
          <span className={styles.transactionCount}>{filteredReservations.length} transactions</span>
        </div>
        <TransactionsTable reservations={currentItems} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          totalItems={filteredReservations.length}
          itemsPerPage={10}
        />
      </div>

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        filterDateRange={filterDateRange}
        onDateRangeChange={setFilterDateRange}
        onReset={handleResetFilters}
        onApply={() => setShowFilterModal(false)}
      />

      <PeriodSelectorModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onExport={handleExport}
      />
    </div>
  )
}

export default Income