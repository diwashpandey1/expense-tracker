import { Button } from './ui'

export default function GoogleSignInButton({ onClick, disabled = false, label = 'Continue with Google' }) {
  return <Button type="button" variant="secondary" className="w-full py-3" onClick={onClick} disabled={disabled}>
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.27 5.64c4.25-3.92 6.71-9.7 6.71-17.29Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" transform="translate(0 0)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.27-5.64c-2.02 1.36-4.6 2.17-8.64 2.17-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
    {label}
  </Button>
}
