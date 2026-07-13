export default function Logo({ size = 26 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect x="52" y="30" width="30" height="140" rx="9" fill="#FF2E92" />
        <rect x="52" y="30" width="95" height="30" rx="9" fill="#00E5FF" />
        <circle cx="160" cy="157" r="16" fill="#FFF23C" />
      </svg>
    )
  }