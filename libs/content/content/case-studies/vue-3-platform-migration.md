---
title: Migrating ten teams from Vue 2 to Vue 3 without stopping the platform
summary: As technical lead, I staged the application shell's upgrade so ten micro-frontend teams could move to Vue 3 in step, first through compatibility mode and then to pure Vue 3.
role: liveperson-principal-engineer
achievements: [vue-3-migration]
---
## Problem

Our platform ran on Vue 2, which was heading out of support. It was not one application but a shared UI shell hosting
micro-frontend modules owned by ten teams, all built on a common UI component library. The shell, the library, and every
module had to move together. No team could upgrade alone, and the platform had to keep running for customers the whole
time.

## Approach

I was the technical lead driving the migration, and I owned the shell. I worked out what had to change, wrote it up for
the teams, and staged the shell's upgrade so the teams could upgrade their modules in sync.

- **A sandbox for the upgraded shell.** We stood up a sandbox environment running the upgraded shell. As each team
  upgraded its module, we added it back into the sandbox app, so modules could be proven on the new shell before
  anything shipped.
- **Two stages.** First, everything moved to Vue 3's compatibility mode. Once that was stable, the next stage was pure
  Vue 3.
- **Full regression at every stage.** Each module team ran complete regression testing on its module at each stage
  before moving on.
- **The shared component library.** I also helped upgrade the UI component library that every module depends on.
- **Support and iteration.** I helped the teams through the issues they hit, and as new complexities turned up I
  revised the steps and the documentation for everyone who came after.

## Outcome

- The platform is on a supported version of Vue.
- It picks up Vue 3's performance improvements, which improved First Contentful Paint and other page metrics.
- All ten teams completed the migration while the platform stayed stable.
