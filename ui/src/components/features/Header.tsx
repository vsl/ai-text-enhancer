"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, User, LogOut, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthModals, AuthModalType } from "./auth/AuthModals";
import { Button } from "@/components/ui/button";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, profile, isAnonymous, signOut, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModalType>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/text-ai-assistants", label: "Text AI Assistants" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    // { href: "/contact", label: "Contact" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="text-xl font-semibold text-secondary hover:text-secondary/80 transition-colors"
          >
            AI Text Enhancer
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Auth & Theme Controls */}
          <div className="flex items-center gap-3">
            {/* Auth Buttons */}
            {mounted && !loading && (
              <>
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors"
                      aria-label="User menu"
                    >
                      <User className="h-4 w-4" />
                      {isAnonymous ? (
                        <span className="text-sm hidden sm:inline">Guest User</span>
                      ) : (
                        <span className="text-sm hidden sm:inline">{user.email}</span>
                      )}
                      {/* Tier Badge */}
                      {profile && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)}
                        </span>
                      )}
                    </button>

                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20">
                          {isAnonymous ? (
                            <>
                              <button
                                onClick={() => {
                                  setShowUserMenu(false);
                                  setAuthModal('signup');
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted transition-colors text-left"
                              >
                                <User className="h-4 w-4" />
                                <span className="text-sm">Create Account</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowUserMenu(false);
                                  setAuthModal('login');
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted transition-colors text-left"
                              >
                                <User className="h-4 w-4" />
                                <span className="text-sm">Sign In</span>
                              </button>
                              <div className="border-t border-border my-1" />
                            </>
                          ) : (
                            <Link
                              href="/settings"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-muted transition-colors"
                            >
                              <Settings className="h-4 w-4" />
                              <span className="text-sm">Settings</span>
                            </Link>
                          )}
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted transition-colors text-left"
                          >
                            <LogOut className="h-4 w-4" />
                            <span className="text-sm">{isAnonymous ? 'Start New Session' : 'Sign Out'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setAuthModal('login')}
                      variant="outline"
                      size="sm"
                    >
                      Sign In
                    </Button>
                    <Button
                      onClick={() => setAuthModal('signup')}
                      size="sm"
                    >
                      Sign Up
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Theme Toggle */}
            <button
              data-testid="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (
                <>
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5 text-foreground" />
                  ) : (
                    <Moon className="h-5 w-5 text-foreground" />
                  )}
                </>
              )}
              {!mounted && <div className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden mt-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Auth Modals */}
      <AuthModals
        activeModal={authModal}
        onClose={() => setAuthModal(null)}
        onSwitchModal={setAuthModal}
      />
    </header>
  );
}
