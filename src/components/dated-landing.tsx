"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Compass,
  Leaf,
  MapPin,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";

const journey = [
  {
    label: "Discover",
    eyebrow: "01 / FIND A PLACE",
    title: "Find the right place for this kind of day.",
    description:
      "Explore restaurants, cafés, museums and more around Metro Manila.",
    icon: Compass,
    kind: "discover",
  },
  {
    label: "Journal",
    eyebrow: "02 / KEEP THE MOMENT",
    title: "Keep the moments that made it yours.",
    description:
      "Add a photo journal or a thoughtful review to the place you visited.",
    icon: Camera,
    kind: "journal",
  },
  {
    label: "Rewards",
    eyebrow: "03 / GIVE BACK LOCALLY",
    title: "Turn eligible reviews into a little something back.",
    description:
      "Earn coins for independent reviews, then choose partner-funded vouchers.",
    icon: Coins,
    kind: "rewards",
  },
];

export default function DatedLanding() {
  const [activeStep, setActiveStep] = useState(0);
  const active = journey[activeStep];

  return (
    <main className="dated-landing">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>

      <header className="landing-header">
        <Link className="landing-wordmark" href="/" aria-label="Dated home">
          <span className="landing-mark"><Leaf size={19} /></span>
          <span>dated<span className="landing-dot">.</span></span>
        </Link>
        <nav className="landing-links" aria-label="Landing page">
          <a href="#how-it-works">How it works</a>
          <a href="#for-business">For businesses</a>
        </nav>
        <div className="landing-actions">
          <Link className="landing-login" href="/explore?auth=login">
            Sign in
          </Link>
          <Link className="landing-button landing-button-dark" href="/explore?auth=signup">
            Join Dated <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <div id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span /> A local discovery app for better days out</p>
            <h1 id="landing-title">
              Find your kind of place.<br />
              <em>Make every visit count.</em>
            </h1>
            <p className="landing-lede">
              Discover places around Metro Manila, save the moments you want to
              remember, and help local businesses understand what makes a visit
              worth coming back for.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-button landing-button-dark" href="/explore">
                Explore Dated <ArrowRight size={17} />
              </Link>
              <Link className="landing-button landing-button-light" href="/business">
                I run a local business <Store size={17} />
              </Link>
            </div>
            <div className="landing-promise">
              <span><Check size={14} /> Free for customers</span>
              <span><Check size={14} /> Honest reviews matter</span>
              <span><Check size={14} /> Local partner rewards</span>
            </div>
          </div>

          <div className="landing-preview-wrap">
            <div className="landing-preview-note"><Sparkles size={14} /> A look inside Dated</div>
            <div className="landing-phone" aria-label="Interactive Dated product preview">
              <div className="landing-phone-top">
                <span className="landing-phone-wordmark">dated<span>.</span></span>
                <span className="landing-phone-city"><MapPin size={12} /> Metro Manila</span>
              </div>
              <div className={`landing-map-art landing-map-${active.kind}`} aria-hidden="true">
                <svg viewBox="0 0 460 180" preserveAspectRatio="none">
                  <path className="landing-map-water" d="M-12 121C67 96 86 146 162 120S271 61 334 84s91 18 143-12v120H-12Z" />
                  <path className="landing-map-road landing-map-road-wide" d="M-8 102C67 78 123 87 182 103s101 31 160 2 85-43 129-33" />
                  <path className="landing-map-road" d="M52 -9c16 42 35 65 77 86s65 34 72 111M232-12c-7 42 5 67 43 93s62 41 77 111M383-4c-14 52-8 79 19 102s41 28 61 34" />
                  <path className="landing-map-road" d="M-15 45c47 28 94 27 138 2s80-38 117-19 83 53 133 41 75-34 104-54" />
                  <path className="landing-map-route" d="M81 145c31-9 37-38 65-39s38 39 71 33 33-55 70-59 54 16 85-9" />
                </svg>
                <span className="landing-map-label landing-map-label-one">MAKATI</span>
                <span className="landing-map-label landing-map-label-two">MANILA</span>
                <span className="landing-map-pin"><MapPin size={18} fill="currentColor" /></span>
                <span className="landing-map-pin landing-map-pin-small"><MapPin size={15} fill="currentColor" /></span>
              </div>
              <div
                className="landing-phone-content"
                id="dated-journey-preview"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby={`journey-tab-${activeStep}`}
                aria-live="polite"
                key={active.kind}
              >
                <p className="landing-phone-eyebrow">{active.eyebrow}</p>
                <h2>{active.title}</h2>
                <p className="landing-phone-description">{active.description}</p>
                {active.kind === "discover" && (
                  <div className="landing-discovery-chips">
                    <span>Restaurants</span><span>Cafés</span><span>Museums</span>
                  </div>
                )}
                {active.kind === "journal" && (
                  <div className="landing-journal-tile">
                    <span className="landing-journal-icon"><Camera size={21} /></span>
                    <span><strong>A place in your journal</strong><small>Your photos and notes, tied to the visit</small></span>
                    <ChevronRight size={16} />
                  </div>
                )}
                {active.kind === "rewards" && (
                  <div className="landing-reward-flow">
                    <span><BookOpen size={17} /> Eligible review</span>
                    <ArrowRight size={15} />
                    <span><Coins size={17} /> Coins</span>
                    <ArrowRight size={15} />
                    <span><Sparkles size={17} /> Partner voucher</span>
                  </div>
                )}
              </div>
              <div className="landing-phone-bottom">
                <div className="landing-phone-tabs" role="tablist" aria-label="Preview the Dated journey">
                  {journey.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <button
                        key={step.kind}
                        type="button"
                        id={`journey-tab-${index}`}
                        tabIndex={activeStep === index ? 0 : -1}
                        role="tab"
                        aria-selected={activeStep === index}
                        aria-controls="dated-journey-preview"
                        onClick={() => setActiveStep(index)}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                          event.preventDefault();
                          const direction = event.key === "ArrowRight" ? 1 : -1;
                          const next = (index + direction + journey.length) % journey.length;
                          setActiveStep(next);
                          document.getElementById(`journey-tab-${next}`)?.focus();
                        }}
                      >
                        <Icon size={16} />{step.label}
                      </button>
                    );
                  })}
                </div>
                <span className="landing-preview-caption">Illustrative interface preview</span>
              </div>
            </div>
            <div className="landing-orbit landing-orbit-one" aria-hidden="true"><Leaf size={18} /></div>
            <div className="landing-orbit landing-orbit-two" aria-hidden="true"><Coins size={17} /></div>
          </div>
        </section>

        <section className="landing-strip" aria-label="Dated at a glance">
          <span>One local loop</span><i />
          <span>Free customer app</span><i />
          <span>Useful business insight</span><i />
          <span>Better days out</span>
        </section>

        <section className="landing-loop section-wrap" id="how-it-works">
          <div className="landing-section-heading">
            <p className="landing-kicker">THE DATED LOOP</p>
            <h2>Good visits can do<br /><em>a little more good.</em></h2>
            <p>Dated connects local discovery, independent customer stories and business learning in one simple cycle.</p>
          </div>
          <div className="landing-loop-grid">
            {[
              { number: "01", icon: Compass, title: "Find somewhere new", body: "Browse places, map listings and community recommendations for the day you have in mind." },
              { number: "02", icon: Camera, title: "Share your experience", body: "Save a photo journal or write a structured review after your visit. Your honest opinion stays yours." },
              { number: "03", icon: Coins, title: "Earn and come back", body: "Eligible reviews can earn coins. Choose vouchers funded by participating local businesses." },
            ].map(({ number, icon: Icon, title, body }) => (
              <article className="landing-loop-step" key={number}>
                <div className="landing-step-top"><span>{number}</span><Icon size={20} /></div>
                <h3>{title}</h3><p>{body}</p>
                {number !== "03" && <span className="landing-step-connector" aria-hidden="true"><ArrowRight size={17} /></span>}
              </article>
            ))}
          </div>
          <p className="landing-incentive-note"><ShieldCheck size={17} /> Rewards are for eligible participation, never for a positive rating.</p>
        </section>

        <section className="landing-people-business" id="for-business">
          <div className="landing-audience-intro">
            <p className="landing-kicker">ONE COMMUNITY, TWO WAYS IN</p>
            <h2>Made for the people who go out, <em>and the places that welcome them.</em></h2>
          </div>
          <div className="landing-audience-grid">
            <article className="landing-audience-card landing-audience-customer">
              <div className="landing-audience-icon"><UserRound size={22} /></div>
              <p className="landing-card-eyebrow">FOR PEOPLE</p>
              <h3>Your next favorite place is out there.</h3>
              <p className="landing-audience-body">Discover nearby places, keep a photo journal, plan outings with friends and earn rewards for eligible reviews. The customer app is free.</p>
              <ul>
                <li><Check size={16} /> Explore restaurants, cafés, museums and more</li>
                <li><Check size={16} /> Reviews and photos in one place</li>
                <li><Check size={16} /> Coins you can exchange for partner vouchers</li>
              </ul>
              <Link className="landing-text-link" href="/explore?auth=signup">Start exploring free <ArrowRight size={17} /></Link>
            </article>
            <article className="landing-audience-card landing-audience-business">
              <div className="landing-audience-icon"><Store size={22} /></div>
              <p className="landing-card-eyebrow">FOR LOCAL BUSINESSES</p>
              <h3>Understand what makes a visit better.</h3>
              <p className="landing-audience-body">A paid business workspace brings verified location tools, structured feedback trends, discovery performance and partner-funded campaigns together.</p>
              <ul>
                <li><Check size={16} /> Insights from public, independent reviews</li>
                <li><Check size={16} /> Branch roles, offers and voucher tools</li>
                <li><Check size={16} /> Sponsored discovery with clear reporting</li>
              </ul>
              <Link className="landing-text-link" href="/business">Explore business tools <ArrowRight size={17} /></Link>
            </article>
          </div>
          <p className="landing-privacy-line"><ShieldCheck size={17} /> Customer journals and private activity are not a business data product. The business workspace is built around public feedback and aggregate performance.</p>
        </section>

        <section className="landing-final-cta">
          <div className="landing-cta-mark"><Leaf size={23} /></div>
          <p className="landing-kicker">MAKE ROOM FOR A GOOD DAY</p>
          <h2>There’s somewhere<br /><em>you haven’t been yet.</em></h2>
          <p>Start with a place. Keep the story. Leave something useful behind.</p>
          <Link className="landing-button landing-button-cream" href="/explore">Find your next place <ArrowRight size={17} /></Link>
          <a className="landing-back-top" href="#landing-main">Back to top <ArrowDown size={14} /></a>
        </section>
      </div>

      <footer className="landing-footer">
        <Link className="landing-wordmark" href="/" aria-label="Dated home">
          <span className="landing-mark"><Leaf size={17} /></span>
          <span>dated<span className="landing-dot">.</span></span>
        </Link>
        <p>Good places. Better company.</p>
        <div><Link href="/business?auth=login">Business sign in</Link><Link href="/operations?auth=login">Staff access</Link><Link href="/app">Open the app</Link></div>
      </footer>
    </main>
  );
}
