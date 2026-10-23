/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei UI"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: [
          '"Cascadia Code"',
          '"SF Mono"',
          'Consolas',
          '"JetBrains Mono"',
          'monospace',
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        input: "var(--input-bg)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          active: "var(--primary-active)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
        },
        "sidebar-hover": "var(--sidebar-hover)",
        "control-hover": "var(--control-hover)",
        "control-pressed": "var(--control-pressed)",
        // Backward-compatible app aliases
        app: {
          bg: "var(--app-bg)",
          panel: "var(--panel-bg)",
          input: "var(--input-bg)",
          hover: "var(--hover-bg)",
          selected: "var(--account-selected-bg)",
          border: "var(--border-input)",
          subtle: "var(--border-subtle)",
          text: "var(--text-primary)",
          body: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-secondary)",
          accent: "#2563EB",
          "btn-primary": "var(--btn-primary-bg)",
          "btn-primary-hover": "var(--btn-primary-hover)",
          "btn-primary-active": "var(--btn-primary-active)",
          "btn-primary-text": "var(--btn-primary-text)",
        },
      },
    },
  },
  plugins: [],
}
