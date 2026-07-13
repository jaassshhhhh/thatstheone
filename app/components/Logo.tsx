export default function Logo({ size = 26 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="100" fill="#7F77DD" />
        <rect x="46" y="21" width="37" height="158" rx="11" fill="#26215C" />
        <rect x="46" y="21" width="108" height="37" rx="11" fill="#26215C" />
        <circle cx="160" cy="157" r="16" fill="#EF9F27" />
      </svg>
    )
  }