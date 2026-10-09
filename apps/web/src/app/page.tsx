import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock3,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Community savings circles",
  description:
    "Organize ajo, esusu, and rotating savings circles with clear contributions, payout turns, and group activity.",
};

const BENEFITS = [
  {
    icon: UsersRound,
    title: "One place for your circle",
    description:
      "Bring your group together and keep its schedule, members, and activity easy to find.",
  },
  {
    icon: Clock3,
    title: "A clear turn for everyone",
    description:
      "See the contribution cycle and who is next to receive the pooled savings.",
  },
  {
    icon: WalletCards,
    title: "Keep track of your money",
    description:
      "View wallet activity and follow contributions and payouts from your account.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create or join a group",
    description:
      "Start a circle with people you trust, or join a group you have been invited to.",
  },
  {
    number: "02",
    title: "Agree on the contribution cycle",
    description:
      "Your group sets the contribution amount, schedule, and payout order together.",
  },
  {
    number: "03",
    title: "Follow each contribution and payout",
    description:
      "Keep up with the cycle and see the group’s contribution activity in one place.",
  },
];

function Brand() {
  return (
    <Link
      href="/"
      aria-label="Poolr home"
      className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight"
    >
      <Image src="/favicon.png" alt="" width={34} height={34} priority />
      Poolr
    </Link>
  );
}

function LandingNav() {
  return (
    <header className="bg-background">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Brand />

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-8 md:flex"
        >
          <a
            href="#features"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">
              Get started <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function CycleCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden="true"
        className="absolute -inset-5 rounded-[2rem] bg-primary/5 blur-2xl"
      />
      <div className="relative rounded-2xl border bg-card p-5 shadow-lg shadow-foreground/[0.04] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              A savings circle
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              Together, by turns
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Ajo · Esusu
          </Badge>
        </div>

        <div className="my-6 rounded-xl bg-muted/60 p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Contribution cycle</span>
            <span className="text-xs text-muted-foreground">Each member</span>
          </div>
          <div className="flex items-center">
            {[0, 1, 2, 3, 4].map((step, index) => (
              <div
                key={step}
                className="flex min-w-0 flex-1 items-center last:flex-none"
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    index === 0
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {index === 0 ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 4 && (
                  <span className="h-px min-w-2 flex-1 bg-border" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
            <span>Contribute</span>
            <span>Take your turn</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowDownLeft aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Members contribute</p>
              <p className="text-xs text-muted-foreground">
                Follow the agreed schedule
              </p>
            </div>
            <CircleDollarSign
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">The pool goes to one member</p>
              <p className="text-xs text-muted-foreground">
                The group takes turns each cycle
              </p>
            </div>
            <UsersRound
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </div>
        </div>
      </div>
      <p className="relative mt-3 text-center text-xs text-muted-foreground">
        A simple illustration of a rotating savings cycle
      </p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/group-color.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="pointer-events-none -z-20 object-cover object-[center_60%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-background/40 lg:bg-gradient-to-r lg:from-background/90 lg:via-background/65 lg:via-[40%] lg:to-background/40"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
        <div className="max-w-xl">
          <Badge variant="secondary" className="mb-6">
            Community savings, made clearer
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-[3.5rem]">
            Save together.
            <br />
            <span className="text-primary">Take turns with confidence.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Poolr helps groups organize ajo, esusu, and other rotating savings
            circles. Keep contributions, payout order, and group activity
            together in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-11 px-5" asChild>
              <Link href="/register">
                Create an account <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-5" asChild>
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Start a group or join one you have been invited to.
          </p>
        </div>
        {/* <CycleCard /> */}
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-primary">Made for groups</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            The details of your circle, kept clear.
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Everyone can follow the plan and understand what is happening in the
            cycle.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-xl border bg-card p-5 sm:p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            A familiar way to save, with a clearer view.
          </h2>
        </div>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ number, title, description }) => (
            <li key={number}>
              <span className="text-sm font-medium tabular-nums text-primary">
                {number}
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClosingSection() {
  return (
    <section className="bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to organize your savings circle?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a group or sign in to continue with yours.
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/register">
            Get started <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 text-sm text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between">
        <Brand />
        <p>Rotating savings circles for people who save together.</p>
        <div className="flex items-center gap-5">
          <Link
            className="transition-colors hover:text-foreground"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="transition-colors hover:text-foreground"
            href="/register"
          >
            Create account
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ClosingSection />
      </main>
      <Footer />
    </>
  );
}
