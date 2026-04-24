export default function Badge({ children, className = '' }) {
  return (
    <span
      className={`badge ${className}`}
      style={{ fontFamily: 'Instrument Sans, sans-serif' }}
    >
      {children}
    </span>
  )
}
