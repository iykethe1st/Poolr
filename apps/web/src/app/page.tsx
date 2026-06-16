import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Globe,
  LayoutGrid,
  Lock,
  RefreshCw,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center text-xl font-bold tracking-tight"
        >
          <Image src="/favicon.png" alt="Poolr Logo" width={45} height={45} />
          Poolr
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ["Features", "#features"],
            ["How it works", "#how-it-works"],
            ["Pricing", "#pricing"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">
              Get started
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
      {/* Subtle grid bg */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[40px_40px] opacity-40"
      />
      {/* Radial fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,var(--background),transparent)]"
      />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Badge
          variant="secondary"
          className="mb-5 gap-1.5 px-3 py-1 text-xs font-medium"
        >
          <Sparkles className="size-3" />
          Now available in Nigeria
        </Badge>

        <h1 className="mb-6 text-5xl font-extrabold tracking-tighter sm:text-6xl lg:text-7xl">
          Save together.
          <br />
          <span className="text-muted-foreground/70">Grow together.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Poolr brings the power of community savings circles — ajo, esusu,
          tontine — into the digital age. Automated contributions, full
          transparency, and on-time payouts.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="h-12 px-8 text-base">
            <Link href="/register">
              Start saving for free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-12 px-8 text-base"
          >
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          No credit card required &nbsp;·&nbsp; Free for up to 5 members
        </p>
      </div>

      {/* App preview card */}
      <div className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
        <AppPreview />
      </div>
    </section>
  );
}

function AppPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/5">
      {/* Fake browser chrome */}
      <div className="flex h-10 items-center gap-2 border-b bg-muted/50 px-4">
        {["bg-red-400", "bg-yellow-400", "bg-green-400"].map((c, i) => (
          <span key={i} className={cn("size-2.5 rounded-full", c)} />
        ))}
        <div className="mx-auto flex h-5 w-48 items-center justify-center rounded-sm bg-background/80 text-[10px] text-muted-foreground">
          app.poolr.ng/dashboard
        </div>
      </div>
      {/* Dashboard mock */}
      <div className="grid grid-cols-4 divide-x">
        {/* Sidebar */}
        <div className="hidden p-4 md:block bg-sidebar">
          <div className="mb-4 h-4 w-12 rounded bg-muted" />
          {["Dashboard", "Groups", "Wallet", "History"].map((item) => (
            <div
              key={item}
              className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5"
            >
              <div className="size-3 rounded-sm bg-muted" />
              <div className="h-2.5 w-14 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="col-span-4 p-5 md:col-span-3">
          <div className="mb-4 h-4 w-28 rounded bg-muted" />
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Balance",
                value: "₦124,000",
                color: "text-emerald-600",
              },
              {
                label: "Next payout",
                value: "Aug 15",
                color: "text-foreground",
              },
              { label: "My groups", value: "3", color: "text-foreground" },
              {
                label: "This month",
                value: "₦20,000",
                color: "text-foreground",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border bg-background p-3">
                <p className="mb-1 text-[10px] text-muted-foreground">
                  {label}
                </p>
                <p className={cn("text-sm font-bold", color)}>{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="mb-3 h-3 w-24 rounded bg-muted" />
            <div className="space-y-2">
              {[95, 75, 100, 60].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-6 rounded-full bg-muted" />
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/20"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <div className="h-2 w-12 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "₦2.4B+", label: "Total saved by members" },
  { value: "50,000+", label: "Active members" },
  { value: "12,000+", label: "Completed circles" },
  { value: "99.8%", label: "On-time payout rate" },
];

function StatsSection() {
  return (
    <section className="border-y bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Automated contributions",
    description:
      "No more chasing members. Set it up once and contributions are automatically collected and recorded on schedule.",
  },
  {
    icon: TrendingUp,
    title: "Full transparency",
    description:
      "Every naira is accounted for in real time. See who has paid, who is next in the rotation, and your complete history.",
  },
  {
    icon: Zap,
    title: "Fast payouts",
    description:
      "When it is your turn, your payout is initiated instantly and lands in your account within minutes.",
  },
  {
    icon: Lock,
    title: "Secure & trustworthy",
    description:
      "Bank-grade encryption, BVN verification, and escrow-style fund handling keep every circle safe.",
  },
  {
    icon: Users,
    title: "Flexible group sizes",
    description:
      "Run intimate circles of 5 friends or large workplace pools of 50. Monthly, bi-weekly, or weekly — you decide.",
  },
  {
    icon: Smartphone,
    title: "Works everywhere",
    description:
      "Manage your circles from the web or our mobile app. Notifications keep everyone on the same page.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            Features
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything your circle needs
          </h2>
          <p className="text-muted-foreground">
            From creation to payout, Poolr handles the operational complexity so
            you can focus on what matters — building trust and growing wealth
            together.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-5" />
              </div>
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: "01",
    icon: LayoutGrid,
    title: "Create or join a circle",
    description:
      "Start a new savings circle and invite your friends, family, or colleagues — or join one you've been invited to.",
  },
  {
    step: "02",
    icon: CircleDollarSign,
    title: "Make your contribution",
    description:
      "Pay your agreed amount on schedule. We remind you before it is due and accept payment via card, bank transfer, or Paystack.",
  },
  {
    step: "03",
    icon: Globe,
    title: "The pool grows",
    description:
      "Every member's contribution is pooled together each cycle. The full amount goes to the designated recipient for that round.",
  },
  {
    step: "04",
    icon: Wallet,
    title: "Receive your payout",
    description:
      "When it is your turn in the rotation, the total pool is sent directly to your bank account or Poolr wallet.",
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-muted/30 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            How it works
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Simple as 1, 2, 3, 4
          </h2>
          <p className="text-muted-foreground">
            Poolr takes the centuries-old tradition of community savings and
            makes it effortless, fair, and fully digital.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ step, icon: Icon, title, description }, i) => (
            <div key={step} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[calc(50%+28px)] top-5 hidden h-px w-[calc(100%-56px)] border-t border-dashed border-border lg:block"
                />
              )}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 flex size-12 items-center justify-center rounded-2xl border bg-background shadow-sm">
                  <Icon className="size-5" />
                  <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "I've been doing ajo with my market women for 20 years. Poolr made it digital and I never have to argue about who paid again.",
    name: "Amaka O.",
    role: "Market trader, Lagos",
    initials: "AO",
  },
  {
    quote:
      "Our office ajo used to be a headache every month. Now Poolr handles everything and we all get notified automatically.",
    name: "Chidi N.",
    role: "Software engineer, Abuja",
    initials: "CN",
  },
  {
    quote:
      "Received my first payout of ₦600,000 last month! The transparency is amazing — I could track every kobo.",
    name: "Funke A.",
    role: "Small business owner, Ibadan",
    initials: "FA",
  },
];

function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            Testimonials
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Trusted by thousands
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role, initials }) => (
            <figure
              key={name}
              className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm"
            >
              <blockquote className="mb-6 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for small friend and family circles.",
    features: [
      "Up to 5 members",
      "Monthly cycles",
      "Basic analytics",
      "Email notifications",
    ],
    cta: "Get started free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Community",
    price: "₦2,500",
    period: "/month",
    description: "For larger groups and more flexible settings.",
    features: [
      "Up to 25 members",
      "Weekly, bi-weekly, or monthly",
      "Advanced analytics",
      "SMS + push notifications",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/register?plan=community",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For organisations running multiple large circles.",
    features: [
      "Unlimited members",
      "Custom cycle frequency",
      "White-label option",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact us",
    href: "mailto:hello@poolr.ng",
    highlighted: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="bg-muted/30 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">
            Pricing
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Transparent pricing
          </h2>
          <p className="text-muted-foreground">
            Start free and scale as your circle grows. No hidden fees.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map(
            ({
              name,
              price,
              period,
              description,
              features,
              cta,
              href,
              highlighted,
            }) => (
              <div
                key={name}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6",
                  highlighted
                    ? "border-primary bg-primary text-primary-foreground shadow-xl"
                    : "bg-card shadow-sm",
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-foreground px-3 py-0.5 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                )}
                <div className="mb-6">
                  <p
                    className={cn(
                      "mb-1 text-sm font-medium",
                      highlighted
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{price}</span>
                    {period && (
                      <span
                        className={cn(
                          "text-sm",
                          highlighted
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground",
                        )}
                      >
                        {period}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      highlighted
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {description}
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <BadgeCheck
                        className={cn(
                          "size-4 shrink-0",
                          highlighted
                            ? "text-primary-foreground/80"
                            : "text-foreground",
                        )}
                      />
                      <span
                        className={
                          highlighted ? "text-primary-foreground/90" : ""
                        }
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={highlighted ? "secondary" : "default"}
                  className={cn(
                    "w-full",
                    highlighted &&
                      "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
                  )}
                  asChild
                >
                  <Link href={href}>{cta}</Link>
                </Button>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to start your circle?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-primary-foreground/70">
            Join thousands of Nigerians already saving smarter with Poolr. Set
            up your first circle in under two minutes.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="h-12 bg-primary-foreground px-8 text-base text-primary hover:bg-primary-foreground/90"
            >
              <Link href="/register">
                Create your circle
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 border-primary-foreground/30 bg-transparent px-8 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="mb-3 flex items-center text-lg font-bold">
              <Image
                src="/favicon.png"
                alt="Poolr Logo"
                width={45}
                height={45}
              />
              Poolr
            </Link>
            <p className="text-sm text-muted-foreground">
              Rotating savings circles, reimagined for the modern age.
            </p>
          </div>

          {[
            {
              title: "Product",
              links: ["Features", "How it works", "Pricing", "Security"],
            },
            {
              title: "Company",
              links: ["About", "Blog", "Careers", "Contact"],
            },
            {
              title: "Legal",
              links: ["Privacy policy", "Terms of service", "Cookie policy"],
            },
          ].map(({ title, links }) => (
            <div key={title}>
              <p className="mb-3 text-sm font-semibold">{title}</p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Poolr Technologies Ltd. All rights
            reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Made with</span>
            <span className="text-red-500">♥</span>
            <span>in Nigeria</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
