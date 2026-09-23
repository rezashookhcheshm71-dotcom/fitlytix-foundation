# FitLytix Foundation

Build the first production-quality React/TypeScript foundation of a new app called FitLytix.

FitLytix is a premium intelligent sports coaching platform connecting Athlete, Human Coach, AI Coaching Engine, and a shared Data/Performance Engine. This is NOT a WordPress-style admin panel and NOT merely a chatbot. It must be designed as a real product whose web app will later be the foundation for a mobile app.

TECH:
- React + TypeScript
- Tailwind + shadcn/ui
- Responsive, mobile-first
- Component architecture ready to scale
- Use clean domain-oriented folders/components
- Prepare the app so Supabase/Postgres can be connected cleanly later; do not fake real authentication or payment.
- Use mock domain data only where necessary, clearly isolated.

BRAND / UX:
- Premium Sport + Technology aesthetic.
- Dark-first interface with sophisticated contrast, subtle gradients, glass/solid cards, strong typography, restrained animation.
- Avoid generic SaaS dashboard appearance.
- FitLytix visual identity should feel athletic, intelligent, precise and premium.
- Use the existing FitLytix concept: orange as an accent, charcoal/near-black foundation, neutral surfaces, with sport-specific accent tokens rather than random colors.
- Persian/RTL should be supported from the architecture; primary demo UI can be Persian RTL with English sport names where useful.
- Smooth but controlled motion.
- Charts, progress rings, skill maps, performance cards and workout blocks should be visually rich.

PRODUCT ARCHITECTURE:
1. Athlete/User:
Registration fields: first name, last name, verified mobile OTP, email, password. Account data must conceptually belong to an independent FitLytix identity layer rather than WordPress users.
2. Assessment Engine:
Common assessment + sport-specific assessment.
Sports: CrossFit, Hyrox, Functional Training, Bodybuilding, Running.
Create an extensible assessment model and UI. CrossFit sections should include Warm-up, Bodybuilding, Engine, WOD, Skill, Weightlifting, Cooldown, with deeper fields for experienced athletes such as PRs, benchmark WODs, skills, lifts, running and scaling.
Assessment ultimately feeds a Fitness DNA profile.
3. AI Coaching Engine:
Assessment -> User Profile -> Fitness DNA -> Goal -> Sport -> Experience -> Performance History -> AI Coaching Engine -> Personalized Program.
The AI layer must be represented as a domain/service boundary, not as a chat screen.
4. Performance Loop:
Workout -> Athlete Feedback -> Performance Data -> Recovery -> Analysis -> Program Adjustment.
5. Coach Platform:
Coach Command Center with Athletes, Programs, Exercise Database, Scaling, Skills, Assessments, Performance.
Athlete 360 with Overview, Performance, Program, Fitness DNA, Recovery, Goals, Assessment, Benchmarks, PRs, Skills, Calendar, Sessions, Exercise History.
6. Commerce:
Registration -> Assessment -> Sport -> Coaching Type (AI/Human) -> Suggested Plan -> Subscription -> Payment -> Membership -> Dashboard.
7. Data model concepts:
User/Profile, Assessment, Goals, Sport, Fitness DNA, Skills, PRs, Benchmarks, Programs, Workouts, Workout Results, Feedback, Recovery, Payments, Subscription.

FIRST BUILD SCOPE:
Create a polished app shell and representative working flows, not every backend feature at once.
Routes/screens:
- / : premium landing/dashboard entry
- /onboarding : onboarding/assessment entry
- /assessment/common
- /assessment/sport
- /athlete/dashboard
- /athlete/program
- /athlete/performance
- /athlete/fitness-dna
- /coach
- /coach/athlete/:id
- /coach/programs
- /coach/exercises
- /plans
- /checkout
- /login
- /register

Make the navigation and buttons actually route between these screens. Build a realistic Athlete Dashboard as the flagship screen:
- Today’s Focus
- active program
- next workout
- performance trend chart
- recovery snapshot
- Fitness DNA summary
- skill progress
- recent sessions
- clear CTA for today's workout.
Create a visually strong Assessment flow with progress indicator, sport cards and CrossFit assessment section cards.
Create a Coach Command Center with athlete cards and an Athlete 360 page.
Create a Program screen with workout blocks for warm-up, strength/bodybuilding, engine, WOD, skill and cooldown.
Create Fitness DNA visualization using meaningful mock dimensions.
Create a plans/checkout flow visually, but payment must remain mock/unconnected.

IMPORTANT ARCHITECTURE:
- Define TypeScript domain types/interfaces for athlete profile, sport, assessment, fitness DNA, exercise, skill, program, workout, workout result, recovery, subscription.
- Create reusable UI primitives and domain components.
- Centralize sport definitions and sport-specific visual tokens.
- Keep AI engine, assessment engine, performance engine and commerce as separate service/domain modules so real APIs/database can replace mocks later.
- Do not couple the app to WordPress.
- Do not claim AI is live; label mock/generated data appropriately.
- Add TODO boundaries where backend integration will go.
- Make the first version feel like a serious product prototype, not a wireframe.

Seed realistic demo data for a CrossFit athlete and a coach so screens look populated.
After implementation, check for TypeScript/build errors and fix them.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/790c145a-8d4b-4160-aca6-f3c2c3581cbb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
