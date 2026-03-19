import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
type ThemePalette = "default" | "beauty"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  paletteStorageKey?: string
  defaultPalette?: ThemePalette
}

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
  palette: ThemePalette
  setPalette: (palette: ThemePalette) => void
  resolvedTheme: "dark" | "light"
} | null>(null)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "appoint-saas-theme",
  paletteStorageKey = "appoint-saas-palette",
  defaultPalette = "default",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(storageKey) as Theme) || defaultTheme)
  const [palette, setPaletteState] = useState<ThemePalette>(() => (localStorage.getItem(paletteStorageKey) as ThemePalette) || defaultPalette)
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("light")

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    let resolved: "dark" | "light" = "light"
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    } else {
      resolved = theme
    }
    setResolvedTheme(resolved)
    root.classList.add(resolved)
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    root.setAttribute("data-theme", palette)
  }, [palette])

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (theme === "system") {
        const resolved = m.matches ? "dark" : "light"
        setResolvedTheme(resolved)
        window.document.documentElement.classList.remove("light", "dark")
        window.document.documentElement.classList.add(resolved)
      }
    }
    m.addEventListener("change", handler)
    return () => m.removeEventListener("change", handler)
  }, [theme])

  const setTheme = (value: Theme) => {
    localStorage.setItem(storageKey, value)
    setThemeState(value)
  }

  const setPalette = (value: ThemePalette) => {
    localStorage.setItem(paletteStorageKey, value)
    setPaletteState(value)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
